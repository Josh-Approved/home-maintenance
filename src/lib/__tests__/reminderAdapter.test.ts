/**
 * Trust-core tests for the seam between maintenance tasks and the canonical
 * reminder module. The planner itself is pinned by
 * src/data/__tests__/reminderPlan.test.ts; what is tested here is the part only
 * this app owns — that a task's schedule state, opt-in, and timing settings map
 * onto the neutral item shape correctly, and that the copy the user reads comes
 * out right.
 *
 * A bug here is invisible in the product: the user simply stops being reminded.
 * Treat any red as a shipped defect.
 */

// The scheduler is the OS half of the module (expo-notifications plus the
// SQLite-backed settings); everything tested here is the pure half, so it is
// stubbed out rather than dragged into a headless run.
jest.mock('../reminderScheduler', () => ({
  ensureNotificationPermission: jest.fn(async () => true),
  getNotifyHour: jest.fn(async () => 9),
  syncReminders: jest.fn(),
}));

import { reminderItems, reminderCopy, optInToReminders } from '../reminderAdapter';
import { ensureNotificationPermission } from '../reminderScheduler';
import {
  DAY,
  makeTask,
  makeCompletion,
  dueAt,
  type MaintenanceTask,
} from '../../data/task';
import {
  planReminders,
  MAX_ARMED_PER_ITEM,
  MAX_ARMED_REMINDERS,
  type PlannedReminder,
} from '../../data/reminderPlan';

/** A fixed local reference: noon on an arbitrary Wednesday. */
const NOW = new Date(2026, 5, 10, 12, 0, 0).getTime();

function task(over: Partial<MaintenanceTask> = {}): MaintenanceTask {
  return {
    ...makeTask({ name: 'Replace HVAC filter', category: 'hvac', intervalDays: 90 }),
    anchorAt: NOW,
    ...over,
  };
}

/** The notify hour on the calendar day containing `ts`. */
const at9 = (ts: number, hour = 9) => {
  const d = new Date(ts);
  d.setHours(hour, 0, 0, 0);
  return d.getTime();
};

describe('task → reminder item mapping', () => {
  it('carries the task’s due date, name and timing settings onto the item', () => {
    const t1 = task({
      name: 'Flush water heater',
      anchorAt: NOW - 10 * DAY,
      intervalDays: 30,
      reminderLeadDays: 3,
      reminderRepeatDays: 7,
      reminderRepeatCount: 3,
    });
    const [item] = reminderItems([t1], []);
    expect(item.id).toBe(t1.id);
    expect(item.label).toBe('Flush water heater');
    expect(item.dueAt).toBe(dueAt(t1, []));
    expect(item.leadDays).toBe(3);
    expect(item.repeatDays).toBe(7);
    expect(item.repeatCount).toBe(3);
    // The task's own interval, so a first reminder can't predate the last cycle.
    expect(item.cycleDays).toBe(30);
  });

  it('leaves out tasks with the reminder switched off, and deleted tasks', () => {
    const off = task({ reminder: false });
    const gone = task({ deletedAt: NOW });
    const on = task();
    expect(reminderItems([off, gone, on], []).map((i) => i.id)).toEqual([on.id]);
  });

  it('follows the completion history: marking done rolls the item to the next cycle', () => {
    const t1 = task({ anchorAt: NOW - 33 * DAY, intervalDays: 30 });
    const done = makeCompletion(t1.id, NOW);
    expect(reminderItems([t1], [])[0].dueAt).toBe(dueAt(t1, []));
    expect(reminderItems([t1], [done])[0].dueAt).toBe(dueAt(t1, [done]));
  });

  it('never asks for the catch-up nudge, so an overdue task stays quiet', () => {
    // This app deliberately has no "overdue" nudge a minute after you open it.
    const overdue = task({
      anchorAt: NOW - 120 * DAY,
      intervalDays: 30,
      reminderRepeatDays: null,
    });
    const items = reminderItems([overdue], []);
    expect(items[0].catchUpWhenOverdue).toBeUndefined();
    const plan = planReminders(items, NOW);
    expect(plan.reminders).toHaveLength(0);
    expect(plan.marks).toEqual({});
  });
});

describe('planning real task schedules', () => {
  it('the default task: a reminder on the due day, then three weekly follow-ups', () => {
    const t1 = task({ anchorAt: NOW - 10 * DAY, intervalDays: 30 });
    const due = dueAt(t1, []);
    const { reminders } = planReminders(reminderItems([t1], []), NOW);
    expect(reminders.map((r) => r.kind)).toEqual(['due', 'followUp', 'followUp', 'followUp']);
    expect(reminders[0].at).toBe(at9(due));
    expect(reminders[3].at).toBe(at9(due + 21 * DAY));
  });

  it('a lead time moves the first reminder ahead of due, and the series with it', () => {
    const t1 = task({ anchorAt: NOW - 10 * DAY, intervalDays: 60, reminderLeadDays: 7 });
    const due = dueAt(t1, []);
    const { reminders } = planReminders(reminderItems([t1], []), NOW);
    expect(reminders[0].at).toBe(at9(due - 7 * DAY));
    expect(reminders[0].kind).toBe('ahead');
    expect(reminders[0].daysBeforeDue).toBe(7);
    expect(reminders[1].at).toBe(at9(due));
  });

  it('clamps a first reminder inside the task’s own interval', () => {
    const t1 = task({ anchorAt: NOW, intervalDays: 3, reminderLeadDays: 30, reminderRepeatDays: null });
    const due = dueAt(t1, []);
    const { reminders } = planReminders(reminderItems([t1], []), NOW);
    expect(reminders[0].at).toBe(at9(due - 2 * DAY));
  });

  it('never re-arms the past: an overdue task keeps only its future follow-ups', () => {
    const t1 = task({ anchorAt: NOW - 33 * DAY, intervalDays: 30 });
    const { reminders } = planReminders(reminderItems([t1], []), NOW);
    expect(reminders.every((r) => r.at > NOW)).toBe(true);
    expect(reminders.map((r) => r.kind)).toEqual(['followUp', 'followUp', 'followUp']);
  });

  it('honours the app-wide notification hour', () => {
    const t1 = task({ anchorAt: NOW - 10 * DAY, intervalDays: 30 });
    const { reminders } = planReminders(reminderItems([t1], []), NOW, { notifyHour: 18 });
    expect(new Date(reminders[0].at).getHours()).toBe(18);
  });

  it('caps one "keep reminding until done" task so it can’t crowd the others out', () => {
    const t1 = task({
      anchorAt: NOW - 29 * DAY,
      intervalDays: 30,
      reminderRepeatDays: 1,
      reminderRepeatCount: null,
    });
    expect(planReminders(reminderItems([t1], []), NOW).reminders).toHaveLength(MAX_ARMED_PER_ITEM);
  });
});

/**
 * BEHAVIOUR CHANGE, adopted deliberately with the canonical module (2026-08-09).
 *
 * The app used to fill the iOS pending-notification budget soonest-first, which
 * means a handful of frequently-repeating tasks eat all 56 slots and everything
 * further down the list is silently never reminded about. The module shares the
 * budget out round by round instead: every task's FIRST reminder is armed
 * before any task's second. These numbers are the record of that choice — if
 * they change, the change was deliberate.
 */
describe('the iOS budget is shared fairly across a long task list', () => {
  /** 20 tasks that keep reminding until done, due a month apart. */
  const longList = () =>
    Array.from({ length: 20 }, (_, i) =>
      task({
        name: `Task ${i}`,
        anchorAt: NOW + (i * 30 - 29) * DAY,
        intervalDays: 30,
        reminderRepeatDays: 1,
        reminderRepeatCount: null,
      })
    );

  it('reminds about every task, instead of spending the whole budget on the first few', () => {
    const tasks = longList();
    const { reminders } = planReminders(reminderItems(tasks, []), NOW);
    expect(reminders).toHaveLength(MAX_ARMED_REMINDERS);
    // Soonest-first would have covered only the first nine or ten tasks.
    expect(new Set(reminders.map((r) => r.itemId)).size).toBe(20);
    for (const t of tasks) {
      expect(reminders.some((r) => r.itemId === t.id)).toBe(true);
    }
  });

  it('spends the leftover slots on the soonest tasks, in order', () => {
    const tasks = longList();
    const { reminders } = planReminders(reminderItems(tasks, []), NOW);
    const countFor = (id: string) => reminders.filter((r) => r.itemId === id).length;
    // 56 slots over 20 tasks: two full rounds, then 16 third reminders that go
    // to the 16 soonest-due tasks.
    expect(countFor(tasks[0].id)).toBe(3);
    expect(countFor(tasks[15].id)).toBe(3);
    expect(countFor(tasks[16].id)).toBe(2);
    expect(countFor(tasks[19].id)).toBe(2);
  });

  it('would have starved the back half of the list under the old policy', () => {
    // The proof that this is a real change and not a coincidence: take the same
    // full set of candidate reminders and fill the budget purely soonest-first,
    // the way the app used to. Tasks near the bottom of the list get nothing.
    const tasks = longList();
    const all = planReminders(reminderItems(tasks, []), NOW, { maxTotal: 1000 }).reminders;
    const soonestFirst = [...all]
      .sort((a, b) => a.at - b.at)
      .slice(0, MAX_ARMED_REMINDERS);
    expect(new Set(soonestFirst.map((r) => r.itemId)).size).toBeLessThan(20);
    expect(soonestFirst.some((r) => r.itemId === tasks[19].id)).toBe(false);
  });

  it('still keeps the whole plan in the future and soonest-first', () => {
    const { reminders } = planReminders(reminderItems(longList(), []), NOW);
    expect(reminders.every((r) => r.at > NOW)).toBe(true);
    for (let i = 1; i < reminders.length; i++) {
      expect(reminders[i].at).toBeGreaterThanOrEqual(reminders[i - 1].at);
    }
  });
});

/**
 * The improvement this app gained with the module (canon § Notifications):
 * the plan is computed BEFORE the permission dialog, so an opt-in that would
 * schedule nothing never raises one. Before, turning the switch on always
 * asked.
 */
describe('the permission ask waits until there is something to arm', () => {
  const ask = ensureNotificationPermission as jest.MockedFunction<
    () => Promise<boolean>
  >;

  beforeEach(() => {
    ask.mockClear();
    ask.mockResolvedValue(true);
  });

  it('asks when turning the switch on would actually schedule a reminder', async () => {
    const ok = await optInToReminders({
      lastDoneAt: null,
      anchorAt: Date.now(),
      intervalDays: 30,
      leadDays: 0,
      repeatDays: 7,
      repeatCount: 3,
    });
    expect(ask).toHaveBeenCalledTimes(1);
    expect(ok).toBe(true);
  });

  it('stays silent when the whole series is already in the past', async () => {
    // Last done a year ago, remind just once: every instant has been and gone,
    // so there is nothing to arm and nothing to ask about.
    const ok = await optInToReminders({
      lastDoneAt: Date.now() - 365 * DAY,
      intervalDays: 30,
      leadDays: 0,
      repeatDays: null,
      repeatCount: null,
    });
    expect(ask).not.toHaveBeenCalled();
    expect(ok).toBe(true);
  });

  it('reports a refusal back, so the switch can go off again', async () => {
    ask.mockResolvedValue(false);
    const ok = await optInToReminders({
      lastDoneAt: null,
      anchorAt: Date.now(),
      intervalDays: 30,
      leadDays: 0,
      repeatDays: 7,
      repeatCount: 3,
    });
    expect(ok).toBe(false);
  });
});

describe('notification copy', () => {
  const planned = (over: Partial<PlannedReminder> = {}): PlannedReminder => ({
    key: 't1#0',
    itemId: 't1',
    label: 'Clean gutters',
    kindKey: 'task',
    at: NOW + DAY,
    kind: 'due',
    daysBeforeDue: 0,
    ...over,
  });

  it('titles every reminder with the task’s own name', () => {
    expect(reminderCopy(planned()).title).toBe('Clean gutters');
  });

  it('says what is due today, tomorrow, and further ahead', () => {
    expect(reminderCopy(planned()).body).toBe(
      'Due today. A few minutes now saves a repair later.'
    );
    expect(reminderCopy(planned({ kind: 'ahead', daysBeforeDue: 1 })).body).toBe('Due tomorrow.');
    expect(reminderCopy(planned({ kind: 'ahead', daysBeforeDue: 3 })).body).toBe('Due in 3 days.');
  });

  it('keeps a follow-up calm and free of urgency', () => {
    expect(reminderCopy(planned({ kind: 'followUp', daysBeforeDue: -7 })).body).toBe(
      'Still due, when you have a few minutes.'
    );
  });
});
