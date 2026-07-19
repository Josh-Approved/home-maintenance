/**
 * Local, on-device reminder scheduling (canon: no server, no account). Given
 * the current tasks + completions, it cancels every scheduled reminder and
 * re-arms the plan from the pure planner in data/task.ts: a first reminder
 * (optionally days ahead of due), then bounded follow-ups while the task
 * stays not-done. The fire hour is one app-wide setting.
 *
 * Permission is only ever *requested* on an explicit opt-in (turning a task's
 * reminder on) — never on cold launch. Store mutations reschedule only if
 * already granted, so the app never nags. Everything is best-effort and
 * defensive: if permission is denied or the OS throws, it no-ops; the app
 * never depends on it. Copy via t().
 *
 * The planner keeps the armed set under iOS's 64-pending cap and never re-arms
 * a past instant, so rescheduling on every mutation/open is safe by design.
 */

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import {
  type MaintenanceTask,
  type Completion,
  type PlannedReminder,
  planReminders,
  DEFAULT_NOTIFY_HOUR,
} from '../data/task';
import { getAppSetting, setAppSetting } from '../storage/kv';
import { t } from '../i18n';
import { QA_MODE } from '../qa/qaMode';

// ---------- App-wide notification hour ----------

const NOTIFY_HOUR_KEY = 'notifyHour';
/** Hours offered in Settings (formatted per locale in the UI). */
export const NOTIFY_HOUR_PRESETS = [7, 9, 12, 18] as const;

export async function getNotifyHour(): Promise<number> {
  try {
    const raw = await getAppSetting(NOTIFY_HOUR_KEY);
    const n = raw == null ? NaN : parseInt(raw, 10);
    return Number.isFinite(n) && n >= 0 && n <= 23 ? n : DEFAULT_NOTIFY_HOUR;
  } catch {
    return DEFAULT_NOTIFY_HOUR;
  }
}

/** Persist the hour; the caller follows up with syncReminders(). */
export async function setNotifyHour(hour: number): Promise<void> {
  try {
    await setAppSetting(NOTIFY_HOUR_KEY, String(hour));
  } catch {
    // best-effort — the default hour still works
  }
}

// Show scheduled reminders even if the app is foregrounded when one fires.
try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
} catch {
  // handler shape differs across versions — non-fatal
}

async function hasPermission(): Promise<boolean> {
  try {
    const current = await Notifications.getPermissionsAsync();
    return current.granted;
  } catch {
    return false;
  }
}

/** Request permission — call only on an explicit user opt-in. */
export async function ensureNotificationPermission(): Promise<boolean> {
  try {
    if (await hasPermission()) return true;
    const req = await Notifications.requestPermissionsAsync();
    return req.granted;
  } catch {
    return false;
  }
}

async function ensureChannel(): Promise<void> {
  // Notification channels are an Android-only concept; a no-op elsewhere.
  if (Platform.OS === 'android') {
    try {
      await Notifications.setNotificationChannelAsync('reminders', {
        name: 'Reminders',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    } catch {
      // non-fatal
    }
  }
}

async function scheduleAt(ms: number, title: string, body: string): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title, body },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(ms) },
    });
  } catch {
    // a single bad trigger shouldn't sink the rest
  }
}

/** Copy for one planned reminder, resolved through i18n. */
function copyFor(r: PlannedReminder): { title: string; body: string } {
  const title = t('notify.dueTitle', { name: r.taskName });
  if (r.kind === 'ahead') {
    const body =
      r.daysBeforeDue === 1
        ? t('notify.aheadTomorrowBody')
        : t('notify.aheadBody', { days: String(r.daysBeforeDue) });
    return { title, body };
  }
  if (r.kind === 'followUp') return { title, body: t('notify.followUpBody') };
  return { title, body: t('notify.dueBody') };
}

/**
 * Cancel all and re-schedule from the current schedule state. Safe to call
 * often. Pass { prompt: true } only from an explicit opt-in; otherwise it
 * reschedules only when permission is already granted and never prompts.
 */
export async function rescheduleAll(
  tasks: MaintenanceTask[],
  completions: Completion[],
  opts: { prompt?: boolean } = {}
): Promise<void> {
  try {
    if (QA_MODE) return; // deterministic capture frames — no OS prompts/banners
    const ok = opts.prompt ? await ensureNotificationPermission() : await hasPermission();
    if (!ok) return;
    await ensureChannel();
    const notifyHour = await getNotifyHour();
    const plan = planReminders(tasks, completions, Date.now(), notifyHour);
    await Notifications.cancelAllScheduledNotificationsAsync();
    for (const r of plan) {
      const { title, body } = copyFor(r);
      await scheduleAt(r.at, title, body);
    }
  } catch {
    // never throw into the UI
  }
}

/** Fire-and-forget wrapper the stores call after every schedule-moving
 *  mutation. Never prompts. */
export function syncReminders(tasks: MaintenanceTask[], completions: Completion[]): void {
  void rescheduleAll(tasks, completions);
}
