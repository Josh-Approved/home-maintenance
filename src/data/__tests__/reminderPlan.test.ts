/**
 * Tier-1 trust-core tests for the canonical reminder planner.
 *
 * A bug here is invisible: the user simply stops being reminded, or gets
 * reminded about something they already did. There is no telemetry that would
 * tell us, so these tests ARE the net. Treat any red here as a shipped defect.
 *
 * Coverage, per the module contract:
 *  - the iOS pending-notification cap (per item, globally, and shared fairly)
 *  - never re-arming a past instant
 *  - the notified-mark dedup for an already-overdue catch-up nudge
 *  - the first / remind-again / stop-after matrix
 */

import {
  DAY,
  DEFAULT_NOTIFY_HOUR,
  MAX_ARMED_PER_ITEM,
  MAX_ARMED_REMINDERS,
  IOS_PENDING_NOTIFICATION_CAP,
  leadPresetsFor,
  planReminders,
  type ReminderItem,
} from '../reminderPlan';

/** A fixed local reference: noon on an arbitrary Wednesday. */
const NOW = new Date(2026, 5, 10, 12, 0, 0).getTime();

/** The notify hour on the calendar day containing `ts`. */
const at = (ts: number, hour = DEFAULT_NOTIFY_HOUR) => {
  const d = new Date(ts);
  d.setHours(hour, 0, 0, 0);
  return d.getTime();
};

const item = (over: Partial<ReminderItem> = {}): ReminderItem => ({
  id: 'i1',
  label: 'Thing',
  dueAt: NOW + 5 * DAY,
  ...over,
});

describe('reminder planner — the first / again / stop-after matrix', () => {
  it('the plain case: one reminder, on the due day, at the app-wide hour', () => {
    const plan = planReminders([item()], NOW);
    expect(plan.reminders).toHaveLength(1);
    expect(plan.reminders[0].kind).toBe('due');
    expect(plan.reminders[0].daysBeforeDue).toBe(0);
    expect(plan.reminders[0].at).toBe(at(NOW + 5 * DAY));
  });

  it('honours the app-wide notification hour', () => {
    const plan = planReminders([item()], NOW, { notifyHour: 18 });
    expect(plan.reminders[0].at).toBe(at(NOW + 5 * DAY, 18));
  });

  it('a lead time moves the FIRST reminder ahead of due', () => {
    const plan = planReminders([item({ leadDays: 3 })], NOW);
    expect(plan.reminders[0].kind).toBe('ahead');
    expect(plan.reminders[0].daysBeforeDue).toBe(3);
    expect(plan.reminders[0].at).toBe(at(NOW + 2 * DAY));
  });

  it('remind again + stop after K gives the first plus exactly K follow-ups', () => {
    const plan = planReminders([item({ repeatDays: 7, repeatCount: 3 })], NOW);
    expect(plan.reminders.map((r) => r.kind)).toEqual(['due', 'followUp', 'followUp', 'followUp']);
    expect(plan.reminders[1].at).toBe(at(NOW + 12 * DAY));
    expect(plan.reminders[3].at).toBe(at(NOW + 26 * DAY));
    expect(plan.reminders[3].daysBeforeDue).toBe(-21);
  });

  it('"never repeat" is one reminder, whatever the count says', () => {
    const plan = planReminders([item({ repeatDays: null, repeatCount: 5 })], NOW);
    expect(plan.reminders).toHaveLength(1);
  });

  it('a lead + follow-ups run the series from the EARLY first reminder', () => {
    const plan = planReminders([item({ leadDays: 3, repeatDays: 3, repeatCount: 2 })], NOW);
    expect(plan.reminders.map((r) => r.kind)).toEqual(['ahead', 'due', 'followUp']);
    expect(plan.reminders[0].at).toBe(at(NOW + 2 * DAY));
    expect(plan.reminders[1].at).toBe(at(NOW + 5 * DAY));
  });

  it("caps the lead inside the item's own cycle, so it never predates the last one", () => {
    const plan = planReminders([item({ dueAt: NOW + 20 * DAY, leadDays: 30, cycleDays: 7 })], NOW);
    expect(plan.reminders[0].daysBeforeDue).toBe(6);
    expect(plan.reminders[0].at).toBe(at(NOW + 14 * DAY));
  });

  it('offers only the lead presets that fit inside the cycle', () => {
    expect(leadPresetsFor(7)).toEqual([0, 1, 3]);
    expect(leadPresetsFor(365)).toEqual([0, 1, 3, 7, 14, 30]);
    expect(leadPresetsFor(null)).toEqual([0, 1, 3, 7, 14, 30]);
  });

  it("an item the user switched off plans nothing and leaves no mark", () => {
    const plan = planReminders(
      [item({ enabled: false, catchUpWhenOverdue: true, repeatDays: 7 })],
      NOW
    );
    expect(plan.reminders).toHaveLength(0);
    expect(Object.keys(plan.marks)).toHaveLength(0);
  });

  it('fires at the exact due instant when the item asks for exact timing', () => {
    const dueAt = NOW + 3 * DAY + 37 * 60_000;
    const plan = planReminders([item({ dueAt, timing: 'exact' })], NOW);
    expect(plan.reminders[0].at).toBe(dueAt);
    expect(plan.reminders[0].kind).toBe('due');
  });

  it('hands the app back its own label, kind key and meta', () => {
    const plan = planReminders(
      [item({ kindKey: 'birthday', meta: { dateLabel: 'Birthday' } })],
      NOW
    );
    expect(plan.reminders[0].label).toBe('Thing');
    expect(plan.reminders[0].kindKey).toBe('birthday');
    expect(plan.reminders[0].meta).toEqual({ dateLabel: 'Birthday' });
  });

  it('clamps nonsense instead of throwing, and skips unusable items', () => {
    const plan = planReminders(
      [
        item({ id: 'ok', leadDays: -5, repeatDays: Number.NaN, repeatCount: Number.NaN }),
        { id: '', label: 'no id', dueAt: NOW + DAY },
        { id: 'nan', label: 'bad due', dueAt: Number.NaN },
      ],
      NOW
    );
    // A garbage repeat reads as "never repeat" — the quiet, safe direction.
    expect(plan.reminders).toHaveLength(1);
    expect(plan.reminders[0].itemId).toBe('ok');
    expect(plan.reminders[0].kind).toBe('due');
  });

  it('clamps a sub-daily repeat up to daily rather than looping', () => {
    const plan = planReminders([item({ repeatDays: 0, repeatCount: 1 })], NOW);
    expect(plan.reminders.map((r) => r.kind)).toEqual(['due', 'followUp']);
    expect(plan.reminders[1].at).toBe(at(NOW + 6 * DAY));
  });

  it('is deterministic: same inputs, same plan', () => {
    const items = [item({ repeatDays: 7, repeatCount: 3 }), item({ id: 'i2', dueAt: NOW + DAY })];
    expect(planReminders(items, NOW)).toEqual(planReminders(items, NOW));
  });
});

describe('reminder planner — never re-arms a past instant', () => {
  it('an overdue item keeps only its FUTURE follow-ups', () => {
    const plan = planReminders(
      [item({ dueAt: NOW - 3 * DAY, repeatDays: 7, repeatCount: 3 })],
      NOW
    );
    expect(plan.reminders).toHaveLength(3);
    expect(plan.reminders.every((r) => r.at > NOW)).toBe(true);
    expect(plan.reminders.map((r) => r.kind)).toEqual(['followUp', 'followUp', 'followUp']);
  });

  it('an overdue one-shot item stays silent (no catch-up unless it opts in)', () => {
    const plan = planReminders([item({ dueAt: NOW - 3 * DAY })], NOW);
    expect(plan.reminders).toHaveLength(0);
  });

  it("today's reminder is dropped once its hour has passed", () => {
    // NOW is noon; the default hour is 09:00, so today's slot is already gone.
    const plan = planReminders([item({ dueAt: NOW })], NOW);
    expect(plan.reminders).toHaveLength(0);
  });

  it('re-planning over and over converges instead of accumulating', () => {
    const items = [item({ repeatDays: 7, repeatCount: 3 })];
    const first = planReminders(items, NOW);
    const second = planReminders(items, NOW + DAY);
    expect(first.reminders).toHaveLength(4);
    expect(second.reminders).toHaveLength(4);
    expect(second.reminders.every((r) => r.at > NOW + DAY)).toBe(true);
  });
});

describe('reminder planner — the notified-mark dedup', () => {
  const overdue = item({ id: 'p1', dueAt: NOW - 2 * DAY, catchUpWhenOverdue: true });

  it('nudges once for an item that was already overdue when the plan ran', () => {
    const plan = planReminders([overdue], NOW);
    expect(plan.reminders).toHaveLength(1);
    expect(plan.reminders[0].kind).toBe('catchUp');
    expect(plan.reminders[0].at).toBe(NOW + 60_000);
    expect(plan.marks).toEqual({ p1: NOW - 2 * DAY });
  });

  it('does NOT nudge again once the due-cycle is marked (the reopen case)', () => {
    const first = planReminders([overdue], NOW);
    const second = planReminders([overdue], NOW + 60 * 60_000, { marks: first.marks });
    expect(second.reminders).toHaveLength(0);
    expect(second.marks).toEqual(first.marks);
  });

  it('nudges again once the item moves to a NEW due-cycle', () => {
    const first = planReminders([overdue], NOW);
    const moved = item({ id: 'p1', dueAt: NOW - DAY, catchUpWhenOverdue: true });
    const second = planReminders([moved], NOW, { marks: first.marks });
    expect(second.reminders).toHaveLength(1);
    expect(second.reminders[0].kind).toBe('catchUp');
  });

  it('marks a FUTURE due-cycle too, so the reopen after it fires stays quiet', () => {
    const soon = item({ id: 'p1', dueAt: NOW + DAY, timing: 'exact', catchUpWhenOverdue: true });
    const first = planReminders([soon], NOW);
    expect(first.reminders[0].at).toBe(NOW + DAY);
    expect(first.marks).toEqual({ p1: NOW + DAY });
    // The OS delivered it; the user reopens the app two days later.
    const after = planReminders([soon], NOW + 3 * DAY, { marks: first.marks });
    expect(after.reminders).toHaveLength(0);
  });

  it('skips the catch-up when a future follow-up is already armed for the item', () => {
    const withFollowUps = item({
      id: 'p1',
      dueAt: NOW - 2 * DAY,
      repeatDays: 7,
      repeatCount: 3,
      catchUpWhenOverdue: true,
    });
    const plan = planReminders([withFollowUps], NOW);
    expect(plan.reminders.every((r) => r.kind === 'followUp')).toBe(true);
  });

  it('prunes marks for items that no longer exist', () => {
    const stale = { gone: NOW - 10 * DAY, p1: NOW - 2 * DAY };
    const plan = planReminders([overdue], NOW, { marks: stale });
    expect(Object.keys(plan.marks)).toEqual(['p1']);
  });
});

describe('reminder planner — the iOS 64-pending cap', () => {
  it('stays under the OS ceiling with headroom', () => {
    expect(MAX_ARMED_REMINDERS).toBeLessThan(IOS_PENDING_NOTIFICATION_CAP);
  });

  it('caps one "until done" series so it cannot crowd the rest out', () => {
    const plan = planReminders([item({ repeatDays: 1, repeatCount: null })], NOW);
    expect(plan.reminders).toHaveLength(MAX_ARMED_PER_ITEM);
  });

  it('never arms more than the global cap, however many items there are', () => {
    const many: ReminderItem[] = [];
    for (let i = 0; i < 40; i++) {
      many.push(item({ id: `i${i}`, dueAt: NOW + (1 + i) * DAY, repeatDays: 1, repeatCount: null }));
    }
    const plan = planReminders(many, NOW);
    expect(plan.reminders).toHaveLength(MAX_ARMED_REMINDERS);
    expect(plan.reminders.every((r) => r.at > NOW)).toBe(true);
  });

  it('shares the budget FAIRLY — every item gets its first reminder before any item gets a second', () => {
    // Staggered so a naive soonest-first slice would spend the whole budget on
    // the first nine items and silently drop the other eleven. This is the
    // defect a person with many people plus birthdays would have hit.
    const many: ReminderItem[] = [];
    for (let i = 0; i < 20; i++) {
      many.push(
        item({ id: `i${i}`, dueAt: NOW + (1 + i * 30) * DAY, repeatDays: 1, repeatCount: null })
      );
    }
    const plan = planReminders(many, NOW);
    expect(plan.reminders).toHaveLength(MAX_ARMED_REMINDERS);
    const covered = new Set(plan.reminders.map((r) => r.itemId));
    expect(covered.size).toBe(20);
  });

  it('keeps the soonest reminders when the cap binds', () => {
    const many: ReminderItem[] = [];
    for (let i = 0; i < 10; i++) {
      many.push(item({ id: `i${i}`, dueAt: NOW + (1 + i) * DAY }));
    }
    const plan = planReminders(many, NOW, { maxTotal: 3 });
    expect(plan.reminders.map((r) => r.itemId)).toEqual(['i0', 'i1', 'i2']);
  });

  it('returns reminders sorted soonest first', () => {
    const plan = planReminders(
      [item({ id: 'late', dueAt: NOW + 9 * DAY }), item({ id: 'soon', dueAt: NOW + 2 * DAY })],
      NOW
    );
    expect(plan.reminders.map((r) => r.itemId)).toEqual(['soon', 'late']);
  });
});
