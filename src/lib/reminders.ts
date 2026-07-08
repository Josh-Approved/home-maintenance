/**
 * Local, on-device reminder scheduling (canon: no server, no account). Given
 * the current tasks + completions, it cancels every scheduled reminder and
 * re-schedules one 9am notification per reminder-enabled task at its due date.
 *
 * Permission is only ever *requested* on an explicit opt-in (turning a task's
 * reminder on) — never on cold launch. Store mutations reschedule only if
 * already granted, so the app never nags. Everything is best-effort and
 * defensive: if permission is denied or the OS throws, it no-ops; the app
 * never depends on it. Copy via t().
 *
 * iOS caps pending local notifications at 64, so only the soonest-due
 * REMINDER_CAP tasks get one — the cap self-heals because every completion
 * triggers a reschedule.
 */

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { type MaintenanceTask, type Completion, schedules } from '../data/task';
import { t } from '../i18n';
import { QA_MODE } from '../qa/qaMode';

const REMINDER_CAP = 48;

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
    await Notifications.cancelAllScheduledNotificationsAsync();
    const now = Date.now();
    const due = schedules(tasks, completions, now).filter((s) => s.task.reminder);
    for (const s of due.slice(0, REMINDER_CAP)) {
      const morning = new Date(s.dueAt);
      morning.setHours(9, 0, 0, 0);
      const when = Math.max(morning.getTime(), now + 60_000); // never in the past
      await scheduleAt(
        when,
        t('notify.dueTitle', { name: s.task.name }),
        t('notify.dueBody')
      );
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
