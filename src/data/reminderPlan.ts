/**
 * Canonical reminder PLANNER — the pure half of the factory's `reminders`
 * module, and the TRUST CORE of any app that schedules local notifications.
 *
 * Nothing in this file imports React Native, Expo, or any storage layer: it is
 * a function from (items, now, options) to "the exact set of local
 * notifications to arm". That is what makes it unit-testable head-on
 * (`__tests__/reminderPlan.test.ts`) and what keeps the scheduler dumb — the
 * scheduler only executes what this decides.
 *
 * DOMAIN-AGNOSTIC BY DESIGN. Two very different apps plan reminders over the
 * same abstract thing: something with a due instant and a repeat policy. Home
 * Upkeep maps a maintenance task onto it; Relationships maps a person's
 * reach-out cadence and each of their important dates onto it. Each app keeps a
 * thin adapter (`src/lib/reminderAdapter.ts`) and nothing else, so this stays
 * one shared module instead of two forks that drift.
 *
 * The six capabilities it carries (the union of what the two apps had between
 * them, never the intersection):
 *
 *   1. Per-item timing — first reminder N days early, repeat every M days,
 *      stop after K follow-ups (or keep going until done).
 *   2. One app-wide notification hour (the presets + default live here; the
 *      persisted value lives in the scheduler).
 *   3. The iOS 64-pending-notification cap, honoured with headroom and shared
 *      out FAIRLY across items so a long series can never crowd another item's
 *      first reminder off the end.
 *   4. Never re-arm a past instant — the plan is deterministic from
 *      (items, now), so re-planning on every mutation and every app open is
 *      safe by construction and can never nag.
 *   5. A persisted "already notified" mark (item id -> the due instant it was
 *      nudged for), so reopening the app cannot re-fire an overdue nudge that
 *      already went out.
 *   6. An opt-in catch-up nudge for items that were ALREADY overdue when the
 *      plan ran (a cadence set on a stale contact, permission granted late) —
 *      exactly one, deduped by the mark above.
 *
 * Canon: `canonical-requirements.md` § Notifications. Everything is local, the
 * content is calm, sound is off, and there are no badge counts.
 */

export const DAY = 24 * 60 * 60 * 1000;

/**
 * iOS delivers at most 64 pending local notifications per app and silently
 * drops the rest. This is the hard ceiling we plan under; MAX_ARMED_REMINDERS
 * is that number with headroom for anything else the app arms.
 */
export const IOS_PENDING_NOTIFICATION_CAP = 64;

/** Global ceiling on armed reminders. Stays under the iOS cap with headroom. */
export const MAX_ARMED_REMINDERS = 56;

/** Per-item ceiling so one "until done" series can't crowd out the rest. */
export const MAX_ARMED_PER_ITEM = 6;

/** Iteration bound for an "until done" series — re-planning refreshes the tail. */
export const MAX_UNTIL_DONE_STEPS = 60;

/** Default fire hour when the app has no stored preference. */
export const DEFAULT_NOTIFY_HOUR = 9;

/** Hours offered in Settings (formatted per locale in the UI). */
export const NOTIFY_HOUR_PRESETS = [7, 9, 12, 18] as const;

/** First-reminder offsets offered in the UI, in days before the due day. */
export const REMINDER_LEAD_PRESETS = [0, 1, 3, 7, 14, 30] as const;

/** Follow-up cadences offered in the UI. null = just the one reminder. */
export const REMINDER_REPEAT_PRESETS = [null, 1, 3, 7] as const;

/** Follow-up counts offered in the UI. null = keep reminding until done. */
export const REMINDER_COUNT_PRESETS = [1, 3, 5, null] as const;

export const DEFAULT_LEAD_DAYS = 0;
export const DEFAULT_REPEAT_DAYS = 7;
export const DEFAULT_REPEAT_COUNT = 3;

/** Delay before an already-overdue item's single catch-up nudge fires. */
export const DEFAULT_CATCH_UP_DELAY_MS = 60_000;

// ---------- Time helpers (local calendar, never UTC) ----------

/** Start-of-day (local) so day maths aligns to the device's calendar. */
export function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** The calendar day containing `dayTs`, at `hour` o'clock local time. */
export function atHour(dayTs: number, hour: number): number {
  const d = new Date(dayTs);
  d.setHours(clampNotifyHour(hour), 0, 0, 0);
  return d.getTime();
}

/** Whole calendar days from `fromTs` to `toTs`; negative when `toTs` is earlier. */
export function daysBetween(fromTs: number, toTs: number): number {
  return Math.round((startOfDay(toTs) - startOfDay(fromTs)) / DAY);
}

// ---------- Clamps (garbage in never throws; it falls to the quiet reading) ----------

export function clampNotifyHour(n: unknown): number {
  if (typeof n !== 'number' || !Number.isFinite(n)) return DEFAULT_NOTIFY_HOUR;
  return Math.min(23, Math.max(0, Math.round(n)));
}

export function clampLeadDays(n: unknown): number {
  if (typeof n !== 'number' || !Number.isFinite(n)) return DEFAULT_LEAD_DAYS;
  return Math.min(365, Math.max(0, Math.round(n)));
}

/** null (and garbage) mean "never repeat" — the quiet, safe reading. */
export function clampRepeatDays(n: unknown): number | null {
  if (typeof n !== 'number' || !Number.isFinite(n)) return null;
  return Math.min(365, Math.max(1, Math.round(n)));
}

/** null (and garbage) mean "until done". */
export function clampRepeatCount(n: unknown): number | null {
  if (typeof n !== 'number' || !Number.isFinite(n)) return null;
  return Math.min(99, Math.max(1, Math.round(n)));
}

/**
 * The lead-time options worth offering for an item that repeats every
 * `cycleDays` — a first reminder a whole cycle early would land before the
 * previous cycle's due date and read as noise. Pure; the UI renders whatever
 * this returns. A null/absent cycle means "no cycle", so everything is offered.
 */
export function leadPresetsFor(cycleDays?: number | null): number[] {
  const presets = REMINDER_LEAD_PRESETS.slice();
  if (typeof cycleDays !== 'number' || !Number.isFinite(cycleDays)) return presets;
  return presets.filter((d) => d < cycleDays);
}

// ---------- The neutral item shape apps map their domain onto ----------

/**
 * How an item's fire instant is derived from its due instant:
 *   'hour'  — the app-wide notification hour on the reminder's calendar day.
 *             The right choice for anything that is due on a DAY (a maintenance
 *             task, a birthday).
 *   'exact' — the due instant itself, shifted by the lead/repeat offsets. The
 *             right choice when the due moment is a real instant the OS should
 *             hit precisely (a reach-out cadence clock).
 */
export type ReminderTiming = 'hour' | 'exact';

export type ReminderMeta = Record<string, string | number | boolean | null | undefined>;

/** Item id -> the due instant we have already nudged for. Persisted by the app. */
export type ReminderMarks = Record<string, number>;

/**
 * ONE thing that can be due. The app's adapter builds these from its own domain
 * — a maintenance task, a person's reach-out cadence, one important date — and
 * nothing in this module knows or cares which.
 */
export interface ReminderItem {
  /**
   * Stable id, unique across every item the app plans in one pass. It is the
   * dedup key for the notified mark, so namespace it per reason when one domain
   * object produces several items (`reachout:<personId>`, `date:<dateId>`).
   */
  id: string;
  /** When the thing is due, ms epoch. */
  dueAt: number;
  /** The thing's own name, handed back to the app's copy resolver. */
  label: string;
  /** The app's own category for this item, echoed back untouched, so one copy
   *  resolver can render several reasons (`'reachOut'`, `'birthday'`, `'task'`). */
  kindKey?: string;
  /** The user's per-item opt-in. Default true — pass false and it plans nothing. */
  enabled?: boolean;
  /** Default 'hour'. See ReminderTiming. */
  timing?: ReminderTiming;
  /** Days before the due day the FIRST reminder fires. 0 = on the due day. */
  leadDays?: number;
  /** Days between follow-ups while the item stays outstanding. null = one only. */
  repeatDays?: number | null;
  /** How many follow-ups AFTER the first before going quiet. null = until done. */
  repeatCount?: number | null;
  /** The item's own repeat interval, when it has one. The lead is capped to one
   *  day inside it so a reminder never predates the previous cycle. */
  cycleDays?: number | null;
  /** Arm one catch-up nudge when the item is already overdue at plan time.
   *  Default false ("never re-arm the past" — the safest reading). */
  catchUpWhenOverdue?: boolean;
  /** Opaque extras the copy resolver may need (a date label, a category). */
  meta?: ReminderMeta;
}

export type PlannedReminderKind = 'ahead' | 'due' | 'followUp' | 'catchUp';

/** One local notification to arm. The scheduler turns each into a dated request. */
export interface PlannedReminder {
  /** Stable, debuggable: `<item id>#<step>` (or `#catchUp`). */
  key: string;
  itemId: string;
  label: string;
  kindKey?: string;
  /** Fire instant, ms epoch. Always strictly in the future at plan time. */
  at: number;
  kind: PlannedReminderKind;
  /** Whole days from this reminder's day to the due day; positive = early. */
  daysBeforeDue: number;
  meta?: ReminderMeta;
}

export interface ReminderPlanOptions {
  /** App-wide fire hour for 'hour'-timed items. Default DEFAULT_NOTIFY_HOUR. */
  notifyHour?: number;
  /** The marks persisted from the previous plan. Default none. */
  marks?: ReminderMarks;
  /** How far after `now` a catch-up nudge fires. Default DEFAULT_CATCH_UP_DELAY_MS. */
  catchUpDelayMs?: number;
  /** Per-item ceiling. Default MAX_ARMED_PER_ITEM. */
  maxPerItem?: number;
  /** Global ceiling. Default MAX_ARMED_REMINDERS. */
  maxTotal?: number;
}

export interface ReminderPlan {
  /** What to arm, soonest first. Never longer than the global cap. */
  reminders: PlannedReminder[];
  /** The marks to persist AFTER a successful arm — rebuilt each pass, so marks
   *  for items that no longer exist prune themselves. */
  marks: ReminderMarks;
}

// ---------- Planning ----------

interface ResolvedItem {
  id: string;
  dueAt: number;
  label: string;
  kindKey?: string;
  timing: ReminderTiming;
  leadDays: number;
  repeatDays: number | null;
  repeatCount: number | null;
  catchUpWhenOverdue: boolean;
  meta?: ReminderMeta;
}

/** Clamp one item into a shape the planner can trust. null = skip it. */
function resolveItem(item: ReminderItem): ResolvedItem | null {
  if (!item || typeof item.id !== 'string' || !item.id) return null;
  if (typeof item.dueAt !== 'number' || !Number.isFinite(item.dueAt)) return null;
  if (item.enabled === false) return null;

  let leadDays = clampLeadDays(item.leadDays);
  const cycle = item.cycleDays;
  if (typeof cycle === 'number' && Number.isFinite(cycle)) {
    // A first reminder a full cycle early would predate the previous cycle.
    leadDays = Math.min(leadDays, Math.max(0, Math.round(cycle) - 1));
  }

  return {
    id: item.id,
    dueAt: item.dueAt,
    label: typeof item.label === 'string' ? item.label : '',
    kindKey: item.kindKey,
    timing: item.timing === 'exact' ? 'exact' : 'hour',
    leadDays,
    repeatDays: clampRepeatDays(item.repeatDays),
    repeatCount: clampRepeatCount(item.repeatCount),
    catchUpWhenOverdue: item.catchUpWhenOverdue === true,
    meta: item.meta,
  };
}

/** The future reminders for one item, soonest first. Past instants are simply
 *  never emitted — that is the whole "can't nag on reopen" guarantee. */
function seriesFor(
  item: ResolvedItem,
  now: number,
  notifyHour: number,
  maxPerItem: number
): PlannedReminder[] {
  const out: PlannedReminder[] = [];
  const steps = item.repeatDays == null ? 0 : item.repeatCount ?? MAX_UNTIL_DONE_STEPS;
  const firstAnchor = item.dueAt - item.leadDays * DAY;

  for (let k = 0; k <= steps && out.length < maxPerItem; k++) {
    const anchor = firstAnchor + (item.repeatDays ?? 0) * k * DAY;
    // Recomputing the hour off each shifted day (rather than adding fixed ms)
    // keeps every reminder at the chosen hour across a DST boundary.
    const at = item.timing === 'exact' ? anchor : atHour(anchor, notifyHour);
    if (at <= now) continue; // already fired or missed — never re-arm the past
    const daysBeforeDue = daysBetween(anchor, item.dueAt);
    const kind: PlannedReminderKind =
      daysBeforeDue > 0 ? 'ahead' : daysBeforeDue === 0 ? 'due' : 'followUp';
    out.push({
      key: `${item.id}#${k}`,
      itemId: item.id,
      label: item.label,
      kindKey: item.kindKey,
      at,
      kind,
      daysBeforeDue,
      meta: item.meta,
    });
  }
  return out;
}

/**
 * Share the global budget out fairly: every item's FIRST reminder before any
 * item's second, every second before any third, and so on — soonest-first
 * within each round. Without this, a handful of "until done" series eat the
 * whole iOS budget and a user with many items silently stops being reminded
 * about the rest.
 */
function takeFairly(series: PlannedReminder[][], maxTotal: number): PlannedReminder[] {
  const out: PlannedReminder[] = [];
  let depth = 0;
  for (const s of series) depth = Math.max(depth, s.length);
  for (let round = 0; round < depth && out.length < maxTotal; round++) {
    for (const s of series) {
      if (out.length >= maxTotal) break;
      if (round < s.length) out.push(s[round]);
    }
  }
  return out;
}

/**
 * Decide every local notification to arm.
 *
 * Deterministic from (items, now, marks): the same inputs always produce the
 * same plan, instants in the past are never emitted, and the only piece of
 * carried state is the notified-mark ledger — which exists solely so a catch-up
 * nudge for an already-overdue item fires once and not once per app open.
 *
 * Returns the reminders to arm AND the marks to persist. Persist the marks only
 * after the arm actually succeeded (a lost mark costs at most one extra nudge;
 * a mark saved when nothing was armed costs a missed one).
 */
export function planReminders(
  items: ReminderItem[],
  now: number,
  opts: ReminderPlanOptions = {}
): ReminderPlan {
  const notifyHour = clampNotifyHour(opts.notifyHour ?? DEFAULT_NOTIFY_HOUR);
  const prevMarks = opts.marks ?? {};
  const catchUpDelayMs =
    typeof opts.catchUpDelayMs === 'number' && Number.isFinite(opts.catchUpDelayMs)
      ? Math.max(0, opts.catchUpDelayMs)
      : DEFAULT_CATCH_UP_DELAY_MS;
  const maxPerItem = Math.max(1, opts.maxPerItem ?? MAX_ARMED_PER_ITEM);
  const maxTotal = Math.max(0, opts.maxTotal ?? MAX_ARMED_REMINDERS);

  const perItem: PlannedReminder[][] = [];
  const marks: ReminderMarks = {};

  for (const raw of items ?? []) {
    const item = resolveItem(raw);
    if (!item) continue;

    const series = seriesFor(item, now, notifyHour, maxPerItem);

    if (item.catchUpWhenOverdue) {
      // Remember this due-cycle whether or not we nudge for it: an armed FUTURE
      // reminder will deliver on its own, so once the cycle is recorded a later
      // reopen must not treat it as un-nudged.
      marks[item.id] = item.dueAt;
      const alreadyNudged = prevMarks[item.id] === item.dueAt;
      if (item.dueAt <= now && series.length === 0 && !alreadyNudged) {
        series.push({
          key: `${item.id}#catchUp`,
          itemId: item.id,
          label: item.label,
          kindKey: item.kindKey,
          at: now + catchUpDelayMs,
          kind: 'catchUp',
          daysBeforeDue: daysBetween(now, item.dueAt),
          meta: item.meta,
        });
      }
    }

    if (series.length) perItem.push(series);
  }

  // Soonest-first between items, so a binding cap keeps the nearest reminders.
  perItem.sort((a, b) => a[0].at - b[0].at || a[0].key.localeCompare(b[0].key));

  const reminders = takeFairly(perItem, maxTotal).sort(
    (a, b) => a.at - b.at || a.key.localeCompare(b.key)
  );

  return { reminders, marks };
}
