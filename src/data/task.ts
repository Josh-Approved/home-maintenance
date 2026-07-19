/**
 * Domain model + scheduling math for maintenance tasks — the app's TRUST CORE.
 * A task recurs every `intervalDays`; its schedule state is DERIVED from its
 * completion history (single source of truth — no denormalized lastDoneAt to
 * drift). A bug here silently corrupts every due date and reminder the user
 * sees, so it's pinned hard in src/data/__tests__/task.test.ts. Kept pure (no
 * expo / RN imports) so jest-expo tests it directly.
 */

import { makeId } from '../lib/id';
import type { CategoryId } from './library';

export const DAY = 24 * 60 * 60 * 1000;

/** Interval bounds: 1 day to 10 years. Clamped, never thrown. */
export const MIN_INTERVAL_DAYS = 1;
export const MAX_INTERVAL_DAYS = 3650;

export interface MaintenanceTask {
  id: string;
  name: string;
  category: CategoryId;
  intervalDays: number;
  /** Schedule anchor when there are no completions yet: first due =
   *  anchorAt + interval. Creation time unless the user backdates. */
  anchorAt: number;
  applianceId?: string;
  /** Per-task local reminder opt-in. */
  reminder: boolean;
  /** Days before the due day the FIRST reminder fires. 0 = on the due day. */
  reminderLeadDays: number;
  /** Days between follow-up reminders after the first, while the task stays
   *  not-done. null = just the one reminder. */
  reminderRepeatDays: number | null;
  /** How many follow-ups before going quiet. null = keep reminding until done. */
  reminderRepeatCount: number | null;
  note?: string;
  /** Provenance when added from the starter library. */
  libraryId?: string;
  createdAt: number;
  updatedAt: number;
  /** Soft-delete tombstone (canon § Backup #5) — null/undefined = active. */
  deletedAt?: number;
}

export interface Completion {
  id: string;
  taskId: string;
  /** When the work was done (ms). Backdatable. */
  at: number;
  createdAt: number;
  deletedAt?: number;
}

export type DueState = 'overdue' | 'dueSoon' | 'upcoming';

export interface TaskSchedule {
  task: MaintenanceTask;
  /** Most recent active completion's `at`, or null if never done. */
  lastDoneAt: number | null;
  dueAt: number;
  state: DueState;
  /** Whole days until due; negative when overdue. */
  daysUntilDue: number;
}

export function clampIntervalDays(n: number): number {
  if (!Number.isFinite(n)) return 30;
  return Math.min(MAX_INTERVAL_DAYS, Math.max(MIN_INTERVAL_DAYS, Math.round(n)));
}

// ---------- Reminder timing (presets, defaults, clamps) ----------

/** First-reminder offsets offered in the UI, in days before due. */
export const REMINDER_LEAD_PRESETS = [0, 1, 3, 7, 14, 30] as const;
/** Follow-up cadences offered in the UI. null = just the one reminder. */
export const REMINDER_REPEAT_PRESETS = [null, 1, 3, 7] as const;
/** Follow-up counts offered in the UI. null = keep reminding until done. */
export const REMINDER_COUNT_PRESETS = [1, 3, 5, null] as const;

export const DEFAULT_REMINDER_LEAD_DAYS = 0;
export const DEFAULT_REMINDER_REPEAT_DAYS = 7;
export const DEFAULT_REMINDER_REPEAT_COUNT = 3;

export function clampLeadDays(n: unknown): number {
  if (typeof n !== 'number' || !Number.isFinite(n)) return DEFAULT_REMINDER_LEAD_DAYS;
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

export function makeTask(
  fields: Pick<MaintenanceTask, 'name' | 'category' | 'intervalDays'> &
    Partial<
      Pick<
        MaintenanceTask,
        | 'applianceId'
        | 'reminder'
        | 'reminderLeadDays'
        | 'reminderRepeatDays'
        | 'reminderRepeatCount'
        | 'note'
        | 'libraryId'
        | 'anchorAt'
      >
    >
): MaintenanceTask {
  const now = Date.now();
  return {
    id: makeId('t'),
    name: fields.name.trim(),
    category: fields.category,
    intervalDays: clampIntervalDays(fields.intervalDays),
    anchorAt: fields.anchorAt ?? now,
    applianceId: fields.applianceId,
    reminder: fields.reminder ?? true,
    reminderLeadDays: clampLeadDays(fields.reminderLeadDays ?? DEFAULT_REMINDER_LEAD_DAYS),
    reminderRepeatDays:
      fields.reminderRepeatDays === undefined
        ? DEFAULT_REMINDER_REPEAT_DAYS
        : clampRepeatDays(fields.reminderRepeatDays),
    reminderRepeatCount:
      fields.reminderRepeatCount === undefined
        ? DEFAULT_REMINDER_REPEAT_COUNT
        : clampRepeatCount(fields.reminderRepeatCount),
    note: fields.note?.trim() ? fields.note.trim() : undefined,
    libraryId: fields.libraryId,
    createdAt: now,
    updatedAt: now,
  };
}

export function makeCompletion(taskId: string, at?: number): Completion {
  const now = Date.now();
  return { id: makeId('c'), taskId, at: at ?? now, createdAt: now };
}

export function activeTasks(tasks: MaintenanceTask[]): MaintenanceTask[] {
  return tasks.filter((t) => t.deletedAt == null);
}

export function activeCompletions(completions: Completion[]): Completion[] {
  return completions.filter((c) => c.deletedAt == null);
}

/** Active completions for one task, newest `at` first. */
export function completionsFor(taskId: string, completions: Completion[]): Completion[] {
  return activeCompletions(completions)
    .filter((c) => c.taskId === taskId)
    .sort((a, b) => b.at - a.at);
}

export function lastDoneAt(taskId: string, completions: Completion[]): number | null {
  const list = completionsFor(taskId, completions);
  return list.length ? list[0].at : null;
}

/** Start-of-day (local) so due dates align to the device's calendar, not UTC. */
export function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Next due moment: interval after the last completion (or the anchor when
 *  never done), snapped to start-of-day so "due today" means today, not a
 *  time-of-day race. */
export function dueAt(task: MaintenanceTask, completions: Completion[]): number {
  const base = lastDoneAt(task.id, completions) ?? task.anchorAt;
  return startOfDay(base) + clampIntervalDays(task.intervalDays) * DAY;
}

/** The "due soon" window scales with the interval (a yearly task warns a month
 *  out, a monthly task about a week) and stays within [2, 30] days. */
export function dueSoonWindowDays(intervalDays: number): number {
  const w = Math.round(clampIntervalDays(intervalDays) * 0.25);
  return Math.min(30, Math.max(2, w));
}

export function daysBetween(fromTs: number, toTs: number): number {
  return Math.round((startOfDay(toTs) - startOfDay(fromTs)) / DAY);
}

export function scheduleFor(
  task: MaintenanceTask,
  completions: Completion[],
  now: number
): TaskSchedule {
  const due = dueAt(task, completions);
  const days = daysBetween(now, due);
  let state: DueState;
  if (days <= 0) state = 'overdue';
  else if (days <= dueSoonWindowDays(task.intervalDays)) state = 'dueSoon';
  else state = 'upcoming';
  return { task, lastDoneAt: lastDoneAt(task.id, completions), dueAt: due, state, daysUntilDue: days };
}

/** Every active task's schedule, most urgent first (overdue by most days →
 *  soonest due). Ties break alphabetically so the order is stable. */
export function schedules(
  tasks: MaintenanceTask[],
  completions: Completion[],
  now: number
): TaskSchedule[] {
  return activeTasks(tasks)
    .map((t) => scheduleFor(t, completions, now))
    .sort((a, b) => a.dueAt - b.dueAt || a.task.name.localeCompare(b.task.name));
}

// ---------- Reminder planner (pure — the scheduling layer just executes it) ----------

/** iOS caps pending local notifications at 64; stay under it with headroom. */
export const MAX_ARMED_REMINDERS = 56;
/** Per-task ceiling so one "until done" task can't crowd out the rest. */
export const MAX_ARMED_PER_TASK = 6;
/** Iteration bound for "until done" series — reschedules refresh the tail. */
const MAX_UNTIL_DONE_STEPS = 60;

export const DEFAULT_NOTIFY_HOUR = 9;

/** The given calendar day at `hour` o'clock, local time. */
export function atHour(dayTs: number, hour: number): number {
  const d = new Date(dayTs);
  d.setHours(hour, 0, 0, 0);
  return d.getTime();
}

export type ReminderKind = 'ahead' | 'due' | 'followUp';

export interface PlannedReminder {
  taskId: string;
  taskName: string;
  /** Fire instant (ms, local). Always in the future relative to plan time. */
  at: number;
  kind: ReminderKind;
  /** Whole days from this reminder to the due day (positive = early). */
  daysBeforeDue: number;
}

/**
 * Decide every local notification to arm, from schedule state alone. The
 * series for a task is: first reminder at (due − lead) days, then follow-ups
 * every `reminderRepeatDays` until the count runs out (null = until done).
 * Deterministic from (tasks, completions, now) — no marks or side state:
 * instants in the past are simply never re-armed, so calling this on every
 * mutation/open is safe and can never nag. Soonest-first, capped globally.
 */
export function planReminders(
  tasks: MaintenanceTask[],
  completions: Completion[],
  now: number,
  notifyHour: number = DEFAULT_NOTIFY_HOUR
): PlannedReminder[] {
  const out: PlannedReminder[] = [];
  for (const s of schedules(tasks, completions, now)) {
    if (!s.task.reminder) continue;
    const interval = clampIntervalDays(s.task.intervalDays);
    // A first reminder a full interval early would predate the previous cycle.
    const lead = Math.min(clampLeadDays(s.task.reminderLeadDays), interval - 1);
    const repeat = clampRepeatDays(s.task.reminderRepeatDays);
    const count = clampRepeatCount(s.task.reminderRepeatCount);
    const firstDay = s.dueAt - lead * DAY;
    const steps = repeat == null ? 0 : (count ?? MAX_UNTIL_DONE_STEPS);
    let armed = 0;
    for (let k = 0; k <= steps && armed < MAX_ARMED_PER_TASK; k++) {
      const day = firstDay + (repeat ?? 0) * k * DAY;
      const at = atHour(day, notifyHour);
      if (at <= now) continue; // already fired or missed — never re-arm the past
      const daysBeforeDue = daysBetween(day, s.dueAt);
      const kind: ReminderKind = daysBeforeDue > 0 ? 'ahead' : daysBeforeDue === 0 ? 'due' : 'followUp';
      out.push({ taskId: s.task.id, taskName: s.task.name, at, kind, daysBeforeDue });
      armed++;
    }
  }
  return out.sort((a, b) => a.at - b.at).slice(0, MAX_ARMED_REMINDERS);
}

/** Completions with `taskId`'s last-done moved to `at`: the latest active
 *  completion's `at` is replaced (history stays one honest record per service),
 *  or a fresh completion is created when the task has none. Returns the
 *  changed/created completion so callers can persist just that row. */
export function withLastDoneAt(
  taskId: string,
  completions: Completion[],
  at: number
): { completions: Completion[]; changed: Completion } {
  const latest = completionsFor(taskId, completions)[0];
  if (!latest) {
    const fresh = makeCompletion(taskId, at);
    return { completions: [fresh, ...completions], changed: fresh };
  }
  const moved = { ...latest, at };
  return {
    completions: completions.map((c) => (c.id === latest.id ? moved : c)),
    changed: moved,
  };
}

/** Tasks linked to an appliance, for the appliance detail screen. */
export function tasksForAppliance(
  applianceId: string,
  tasks: MaintenanceTask[]
): MaintenanceTask[] {
  return activeTasks(tasks).filter((t) => t.applianceId === applianceId);
}

/** Coerce one untrusted parsed object into a safe task for additive import
 *  (canon § Backup Layer 3). Fresh id; bad shapes are skipped, not crashed on.
 *  Pure — unit-tested. Returns the task plus the source id so the importer can
 *  remap completions onto the fresh id. */
export function sanitizeImportedTask(
  raw: unknown,
  validCategories: readonly string[]
): { task: MaintenanceTask; sourceId: string | null } | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.name !== 'string' || !r.name.trim()) return null;
  if (typeof r.intervalDays !== 'number' || !Number.isFinite(r.intervalDays)) return null;
  const category = (
    typeof r.category === 'string' && validCategories.includes(r.category) ? r.category : 'general'
  ) as CategoryId;
  const task = makeTask({
    name: r.name,
    category,
    intervalDays: r.intervalDays,
    reminder: typeof r.reminder === 'boolean' ? r.reminder : true,
    // Absent keys (older exports) fall to the defaults; present keys clamp.
    reminderLeadDays: 'reminderLeadDays' in r ? clampLeadDays(r.reminderLeadDays) : undefined,
    reminderRepeatDays: 'reminderRepeatDays' in r ? clampRepeatDays(r.reminderRepeatDays) : undefined,
    reminderRepeatCount: 'reminderRepeatCount' in r ? clampRepeatCount(r.reminderRepeatCount) : undefined,
    note: typeof r.note === 'string' ? r.note : undefined,
    libraryId: typeof r.libraryId === 'string' ? r.libraryId : undefined,
    anchorAt: typeof r.anchorAt === 'number' ? r.anchorAt : undefined,
  });
  return { task, sourceId: typeof r.id === 'string' ? r.id : null };
}

/** Coerce one untrusted parsed completion; `taskId` must already be remapped
 *  to a live task id by the caller. */
export function sanitizeImportedCompletion(raw: unknown, taskId: string): Completion | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.at !== 'number' || !Number.isFinite(r.at)) return null;
  return makeCompletion(taskId, r.at);
}
