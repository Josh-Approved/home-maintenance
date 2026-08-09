/**
 * APP-OWNED bridge between this app's domain and the canonical reminder module.
 * The planner (`data/reminderPlan`) and the scheduler (`lib/reminderScheduler`)
 * are factory-synced and know nothing about maintenance tasks; everything
 * task-shaped lives here.
 *
 * Three jobs:
 *   1. `reminderItems()` — one neutral item per active task whose reminder is
 *      on: its due instant, its timing settings, and its own repeat interval.
 *   2. `reminderCopy()` — the notification title and body, through t().
 *   3. `optInToReminders()` — the app's ONE permission ask, from the Reminder
 *      switch in the task editor. The plan is computed BEFORE the ask (canon
 *      § Notifications), so turning a reminder on for something that would arm
 *      nothing never raises the OS dialog.
 *
 * Tasks are passed in rather than read from the store, so this module stays
 * free of a store import cycle and stays directly unit-testable.
 */

import { t } from '../i18n';
import {
  DAY,
  activeTasks,
  clampIntervalDays,
  dueAt,
  startOfDay,
  type Completion,
  type MaintenanceTask,
} from '../data/task';
import { planReminders, type PlannedReminder, type ReminderItem } from '../data/reminderPlan';
import {
  ensureNotificationPermission,
  getNotifyHour,
  syncReminders,
} from './reminderScheduler';
import { QA_MODE } from '../qa/qaMode';

/**
 * Every task that can raise a reminder, as neutral items.
 *
 * `catchUpWhenOverdue` is deliberately left off: this app decided against the
 * "overdue nudge a minute after you open the app" behaviour, and the planner's
 * default is to never re-arm a past instant.
 */
export function reminderItems(
  tasks: MaintenanceTask[],
  completions: Completion[]
): ReminderItem[] {
  return activeTasks(tasks)
    .filter((task) => task.reminder)
    .map((task) => ({
      id: task.id,
      dueAt: dueAt(task, completions),
      label: task.name,
      kindKey: 'task',
      leadDays: task.reminderLeadDays,
      repeatDays: task.reminderRepeatDays,
      repeatCount: task.reminderRepeatCount,
      // The task's own interval, so a first reminder can never predate the
      // previous cycle.
      cycleDays: task.intervalDays,
    }));
}

/** Copy for one planned reminder, resolved through i18n. */
export function reminderCopy(reminder: PlannedReminder): { title: string; body: string } {
  const title = t('notify.dueTitle', { name: reminder.label });
  if (reminder.kind === 'ahead') {
    const body =
      reminder.daysBeforeDue === 1
        ? t('notify.aheadTomorrowBody')
        : t('notify.aheadBody', { days: String(reminder.daysBeforeDue) });
    return { title, body };
  }
  if (reminder.kind === 'followUp' || reminder.kind === 'catchUp') {
    return { title, body: t('notify.followUpBody') };
  }
  return { title, body: t('notify.dueBody') };
}

/**
 * Re-arm every reminder from the current schedule state. Never prompts, so any
 * store mutation can call it (canon: background rescheduling only if granted).
 */
export function syncAppReminders(tasks: MaintenanceTask[], completions: Completion[]): void {
  syncReminders(reminderItems(tasks, completions), reminderCopy, {
    channelName: t('notify.channelName'),
  });
}

/** The task being edited, before it is saved. */
export interface ReminderDraft {
  /** When the user says it was last done, or null if never. */
  lastDoneAt: number | null;
  /** Schedule anchor for a task that has never been done. Defaults to now. */
  anchorAt?: number;
  intervalDays: number;
  leadDays: number;
  repeatDays: number | null;
  repeatCount: number | null;
}

/**
 * The app's only notification-permission ask: the Reminder switch in the task
 * editor, which is the point of value.
 *
 * The draft's plan is computed first, and the OS dialog is raised only if it
 * would actually schedule something — so turning the switch on for a long
 * overdue task set to remind just once asks for nothing. Arming happens when
 * the edit is saved, through the store's syncAppReminders().
 *
 * Returns whether reminders are usable: false only when the user was asked and
 * said no (or had already refused), which is the caller's cue to put the switch
 * back.
 */
export async function optInToReminders(draft: ReminderDraft): Promise<boolean> {
  if (QA_MODE) return true; // deterministic capture frames — no OS dialogs
  try {
    const base = draft.lastDoneAt ?? draft.anchorAt ?? Date.now();
    const item: ReminderItem = {
      id: 'draft',
      dueAt: startOfDay(base) + clampIntervalDays(draft.intervalDays) * DAY,
      label: '',
      kindKey: 'task',
      leadDays: draft.leadDays,
      repeatDays: draft.repeatDays,
      repeatCount: draft.repeatCount,
      cycleDays: draft.intervalDays,
    };
    const notifyHour = await getNotifyHour();
    const plan = planReminders([item], Date.now(), { notifyHour });
    if (plan.reminders.length === 0) return true;
    return await ensureNotificationPermission();
  } catch {
    // never throw into the UI — the app does not depend on notifications
    return false;
  }
}
