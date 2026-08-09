/**
 * Canonical reminder SCHEDULER — the executing half of the factory's
 * `reminders` module. Canonical, app-agnostic; synced by `sync.mjs reminders`.
 * Do not fork it: the app-specific part is the adapter (`reminderAdapter.ts`),
 * which turns the app's domain into neutral `ReminderItem`s and resolves copy.
 *
 * Every fire-time decision lives in the pure planner (`../data/reminderPlan`).
 * This file only: reads the persisted settings, asks the planner what to arm,
 * asks the OS for permission at the right moment, and arms it.
 *
 * Canon (`canonical-requirements.md` § Notifications), enforced here:
 *  - ALL LOCAL. `expo-notifications` local scheduling only. No push service, no
 *    server, no delivery SDK.
 *  - PERMISSION ONLY ON AN EXPLICIT OPT-IN, AT THE POINT OF VALUE. The plan is
 *    computed BEFORE the ask, so an opt-in that would arm nothing (a date
 *    already past this year, a cadence of "none") never raises the OS dialog.
 *  - NEVER RE-ASKED AFTER DENIAL. If the OS says it can't ask again, we don't.
 *  - BACKGROUND RESCHEDULING ONLY IF ALREADY GRANTED. `syncReminders` never
 *    prompts, so a store mutation can't nag.
 *  - DENIAL IS A SUPPORTED STATE. Everything is best-effort: if permission is
 *    refused or the OS throws, this no-ops and the app carries on.
 *  - CALM CONTENT. Sound off, no badge counts, no urgency theatre. (These apps
 *    are not the timer/alarm archetype that gets the sound carve-out.)
 *  - QA MODE ARMS NOTHING, so a deterministic capture run never meets an OS
 *    permission dialog or a banner landing mid-screenshot.
 *
 * SDK SPREAD: the fleet straddles expo-notifications ~56 and ~57, so every call
 * into the library is wrapped and every request object is built defensively
 * (structurally, then cast at the call site) rather than pinned to one SDK's
 * exported types. A single bad trigger must never sink the rest of the plan.
 */

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { getAppSetting, setAppSetting } from '../storage/kv';
import { QA_MODE } from '../qa/qaMode';
import {
  DEFAULT_NOTIFY_HOUR,
  clampNotifyHour,
  planReminders,
  type PlannedReminder,
  type ReminderItem,
  type ReminderMarks,
} from '../data/reminderPlan';

export {
  DEFAULT_NOTIFY_HOUR,
  NOTIFY_HOUR_PRESETS,
  REMINDER_LEAD_PRESETS,
  REMINDER_REPEAT_PRESETS,
  REMINDER_COUNT_PRESETS,
  leadPresetsFor,
} from '../data/reminderPlan';
export type { ReminderItem, PlannedReminder } from '../data/reminderPlan';

// ---------- Persisted settings ----------

/** App-wide notification hour. Shared by every 'hour'-timed reminder. */
const NOTIFY_HOUR_KEY = 'notifyHour';
/** item id -> the due instant already nudged for (see the planner's marks). */
const MARKS_KEY = 'reminderMarks';

const DEFAULT_CHANNEL_ID = 'reminders';

export async function getNotifyHour(): Promise<number> {
  try {
    const raw = await getAppSetting(NOTIFY_HOUR_KEY);
    const n = raw == null ? NaN : parseInt(raw, 10);
    return Number.isFinite(n) && n >= 0 && n <= 23 ? n : DEFAULT_NOTIFY_HOUR;
  } catch {
    return DEFAULT_NOTIFY_HOUR;
  }
}

/** Persist the hour; the caller follows up with a reschedule. */
export async function setNotifyHour(hour: number): Promise<void> {
  try {
    await setAppSetting(NOTIFY_HOUR_KEY, String(clampNotifyHour(hour)));
  } catch {
    // best-effort — the default hour still works
  }
}

async function loadMarks(): Promise<ReminderMarks> {
  try {
    const raw = await getAppSetting(MARKS_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as ReminderMarks) : {};
  } catch {
    return {};
  }
}

async function saveMarks(marks: ReminderMarks): Promise<void> {
  try {
    await setAppSetting(MARKS_KEY, JSON.stringify(marks));
  } catch {
    // best-effort; a lost mark can only cost one extra nudge, never a missed one
  }
}

// ---------- OS plumbing (defensive across expo-notifications versions) ----------

// Show a scheduled reminder even if the app happens to be foregrounded when it
// fires. Both the modern (banner/list) and legacy (alert) keys are set — the
// unused one is ignored — and the whole object is cast at the call site so a
// type rename between SDKs can't break the build.
try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldShowAlert: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  } as unknown as Parameters<typeof Notifications.setNotificationHandler>[0]);
} catch {
  // handler shape differs across versions — non-fatal
}

/** True when the OS has already granted permission. Never prompts. */
export async function hasNotificationPermission(): Promise<boolean> {
  try {
    const current = await Notifications.getPermissionsAsync();
    return current.granted === true;
  } catch {
    return false;
  }
}

/**
 * Request permission. Call ONLY from an explicit user opt-in, at the point of
 * value. Returns the current answer without prompting when the OS says it can't
 * ask again (canon: never re-ask after denial).
 */
export async function ensureNotificationPermission(): Promise<boolean> {
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted === true) return true;
    if (current.canAskAgain === false) return false;
    const req = await Notifications.requestPermissionsAsync();
    return req.granted === true;
  } catch {
    return false;
  }
}

async function ensureChannel(channelId: string, channelName: string): Promise<void> {
  // Notification channels are an Android-only concept; a no-op elsewhere.
  // Written as a POSITIVE branch, not `if (Platform.OS !== 'android') return`:
  // the fleet's parity linter (`parity/no-platform-early-return`) reads any
  // Platform.OS early return as a feature being gated off one platform, and it
  // cannot tell this OS-plumbing case apart from a real descope. Same behaviour,
  // and the shape the rest of the fleet already uses.
  if (Platform.OS === 'android') {
    try {
      const importance =
        (Notifications as unknown as { AndroidImportance?: Record<string, number> })
          .AndroidImportance?.DEFAULT ?? 3;
      await Notifications.setNotificationChannelAsync(channelId, {
        name: channelName,
        importance,
        sound: null, // canon: sound off by default
        showBadge: false, // canon: no badge counts
      } as unknown as Parameters<typeof Notifications.setNotificationChannelAsync>[1]);
    } catch {
      // non-fatal
    }
  }
}

/** A one-shot date trigger, built for whichever SDK is installed. */
function dateTrigger(ms: number): unknown {
  const date = new Date(ms);
  const type = (Notifications as unknown as {
    SchedulableTriggerInputTypes?: Record<string, unknown>;
  }).SchedulableTriggerInputTypes?.DATE;
  return type === undefined ? { date } : { type, date };
}

async function scheduleAt(
  ms: number,
  title: string,
  body: string,
  channelId: string
): Promise<boolean> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: false, // canon: sound off (this is not the timer/alarm archetype)
      },
      trigger: dateTrigger(ms),
    } as unknown as Parameters<typeof Notifications.scheduleNotificationAsync>[0]);
    return true;
  } catch {
    // a single bad trigger shouldn't sink the rest of the plan
    return false;
  }
}

/** Drop every pending reminder. Used on reschedule and by a global opt-out. */
export async function cancelAllReminders(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    // best-effort
  }
}

// ---------- The one entry point apps call ----------

/** Copy for one planned reminder. The app resolves it through `t()`. */
export interface ReminderCopy {
  title: string;
  body: string;
}

export type ReminderCopyResolver = (reminder: PlannedReminder) => ReminderCopy;

export interface RescheduleOptions {
  /**
   * Pass true ONLY from an explicit opt-in (the user turned a reminder on, set
   * a cadence, saved a date). It prompts for permission — and only when the
   * plan would actually arm something.
   */
  prompt?: boolean;
  /** Localized Android channel name. Defaults to the plain English fallback. */
  channelName?: string;
  channelId?: string;
  /** Override the persisted hour (tests, or a Settings preview). */
  notifyHour?: number;
}

export interface RescheduleResult {
  /** How many reminders are now armed with the OS. */
  armed: number;
  /** Whether notification permission is granted right now. */
  permission: boolean;
  /** True when the run was skipped wholesale (QA capture mode). */
  skipped: boolean;
}

/**
 * Cancel everything pending and re-arm the current plan. Safe to call often —
 * the planner never re-arms a past instant, so re-running on every mutation and
 * every app open converges rather than accumulating.
 *
 * ORDER MATTERS and is the union of what the two source apps each got right:
 *   1. QA mode short-circuits before any OS call.
 *   2. The plan is computed BEFORE the permission ask, so an opt-in that would
 *      arm nothing never raises the dialog.
 *   3. Marks are persisted only AFTER the arm succeeded, so a denied or failed
 *      run can't mark a nudge as delivered.
 */
export async function rescheduleReminders(
  items: ReminderItem[],
  copy: ReminderCopyResolver,
  opts: RescheduleOptions = {}
): Promise<RescheduleResult> {
  if (QA_MODE) return { armed: 0, permission: false, skipped: true };

  try {
    const notifyHour = opts.notifyHour ?? (await getNotifyHour());
    const prevMarks = await loadMarks();
    const plan = planReminders(items, Date.now(), { notifyHour, marks: prevMarks });

    const ok =
      opts.prompt && plan.reminders.length > 0
        ? await ensureNotificationPermission()
        : await hasNotificationPermission();
    if (!ok) return { armed: 0, permission: false, skipped: false };

    const channelId = opts.channelId ?? DEFAULT_CHANNEL_ID;
    await ensureChannel(channelId, opts.channelName ?? 'Reminders');
    await cancelAllReminders();

    let armed = 0;
    for (const reminder of plan.reminders) {
      const { title, body } = copy(reminder);
      if (await scheduleAt(reminder.at, title, body, channelId)) armed++;
    }

    await saveMarks(plan.marks);
    return { armed, permission: true, skipped: false };
  } catch {
    // never throw into the UI — the app does not depend on notifications
    return { armed: 0, permission: false, skipped: false };
  }
}

/**
 * Fire-and-forget wrapper for stores to call after every schedule-moving
 * mutation. NEVER prompts (canon: background rescheduling only if granted).
 */
export function syncReminders(
  items: ReminderItem[],
  copy: ReminderCopyResolver,
  opts: Omit<RescheduleOptions, 'prompt'> = {}
): void {
  void rescheduleReminders(items, copy, { ...opts, prompt: false });
}
