/**
 * Trust-core tests — the scheduling math every due date, badge, and reminder
 * hangs off. If these fail the app lies to the user about what their house
 * needs; treat any red here as a shipped-defect-in-waiting.
 */

import {
  DAY,
  clampIntervalDays,
  makeTask,
  makeCompletion,
  dueAt,
  dueSoonWindowDays,
  scheduleFor,
  schedules,
  lastDoneAt,
  completionsFor,
  startOfDay,
  daysBetween,
  tasksForAppliance,
  sanitizeImportedTask,
  sanitizeImportedCompletion,
  type MaintenanceTask,
} from '../task';
import {
  makeAppliance,
  manualSearchUrl,
  canFindManual,
  activeAppliances,
  sanitizeImportedAppliance,
} from '../appliance';
import { CATEGORIES } from '../library';

/** A fixed local reference: noon on an arbitrary Wednesday. */
const NOW = new Date(2026, 5, 10, 12, 0, 0).getTime();

function task(over: Partial<MaintenanceTask> = {}): MaintenanceTask {
  return {
    ...makeTask({ name: 'Replace HVAC filter', category: 'hvac', intervalDays: 90 }),
    anchorAt: NOW,
    ...over,
  };
}

describe('interval clamping', () => {
  it('rounds and bounds intervals into [1, 3650]', () => {
    expect(clampIntervalDays(0)).toBe(1);
    expect(clampIntervalDays(-5)).toBe(1);
    expect(clampIntervalDays(90.4)).toBe(90);
    expect(clampIntervalDays(99999)).toBe(3650);
  });
  it('falls back to 30 for non-finite garbage, never NaN', () => {
    expect(clampIntervalDays(NaN)).toBe(30);
    expect(clampIntervalDays(Infinity)).toBe(30);
  });
});

describe('due math', () => {
  it('a never-done task is due one interval after its anchor day', () => {
    const t = task({ intervalDays: 90 });
    expect(dueAt(t, [])).toBe(startOfDay(NOW) + 90 * DAY);
  });

  it('completing rolls the due date forward from the completion day', () => {
    const t = task({ intervalDays: 30 });
    const done = makeCompletion(t.id, NOW + 5 * DAY);
    expect(dueAt(t, [done])).toBe(startOfDay(NOW + 5 * DAY) + 30 * DAY);
  });

  it('uses the LATEST completion, and a backdated completion does not regress the schedule', () => {
    const t = task({ intervalDays: 30 });
    const recent = makeCompletion(t.id, NOW);
    const backdated = makeCompletion(t.id, NOW - 20 * DAY);
    expect(dueAt(t, [backdated, recent])).toBe(startOfDay(NOW) + 30 * DAY);
    expect(dueAt(t, [recent, backdated])).toBe(startOfDay(NOW) + 30 * DAY);
  });

  it('undo (tombstoning the latest completion) reverts the due date', () => {
    const t = task({ intervalDays: 30 });
    const first = makeCompletion(t.id, NOW - 10 * DAY);
    const second = { ...makeCompletion(t.id, NOW), deletedAt: NOW };
    expect(dueAt(t, [first, second])).toBe(startOfDay(NOW - 10 * DAY) + 30 * DAY);
  });

  it('due dates snap to start-of-day — no time-of-day drift across completions', () => {
    const t = task({ intervalDays: 7 });
    const lateNight = makeCompletion(t.id, new Date(2026, 5, 10, 23, 55).getTime());
    const dawn = makeCompletion(t.id, new Date(2026, 5, 10, 0, 5).getTime());
    expect(dueAt(t, [lateNight])).toBe(dueAt(t, [dawn]));
  });
});

describe('due state', () => {
  it('classifies overdue / dueSoon / upcoming with stable day counts', () => {
    const t = task({ intervalDays: 30, anchorAt: NOW - 40 * DAY }); // due 10 days ago
    const s = scheduleFor(t, [], NOW);
    expect(s.state).toBe('overdue');
    expect(s.daysUntilDue).toBe(-10);

    const soon = scheduleFor(task({ intervalDays: 30, anchorAt: NOW - 25 * DAY }), [], NOW);
    expect(soon.state).toBe('dueSoon'); // 5 days out, window ≈ 8
    expect(soon.daysUntilDue).toBe(5);

    const later = scheduleFor(task({ intervalDays: 90 }), [], NOW);
    expect(later.state).toBe('upcoming');
  });

  it('due TODAY counts as overdue (needs doing), not upcoming', () => {
    const t = task({ intervalDays: 30, anchorAt: NOW - 30 * DAY });
    expect(scheduleFor(t, [], NOW).state).toBe('overdue');
    expect(scheduleFor(t, [], NOW).daysUntilDue).toBe(0);
  });

  it('the due-soon window scales with the interval and stays within [2, 30]', () => {
    expect(dueSoonWindowDays(7)).toBe(2);
    expect(dueSoonWindowDays(30)).toBe(8);
    expect(dueSoonWindowDays(365)).toBe(30);
    expect(dueSoonWindowDays(1)).toBe(2);
  });

  it('never-done state reports lastDoneAt null', () => {
    expect(scheduleFor(task(), [], NOW).lastDoneAt).toBeNull();
  });
});

describe('schedules list', () => {
  it('sorts most-urgent first with a stable alphabetical tiebreak, excluding tombstones', () => {
    const a = task({ name: 'B gutter', intervalDays: 30, anchorAt: NOW - 60 * DAY });
    const b = task({ name: 'A filter', intervalDays: 30, anchorAt: NOW - 60 * DAY });
    const c = task({ name: 'C later', intervalDays: 365 });
    const dead = task({ name: 'D deleted', deletedAt: NOW });
    const list = schedules([c, a, b, dead], [], NOW);
    expect(list.map((s) => s.task.name)).toEqual(['A filter', 'B gutter', 'C later']);
  });

  it('completion history is per-task: one task done does not roll its siblings', () => {
    const a = task({ name: 'A', intervalDays: 30, anchorAt: NOW - 40 * DAY });
    const b = task({ name: 'B', intervalDays: 30, anchorAt: NOW - 40 * DAY });
    const doneA = makeCompletion(a.id, NOW);
    const list = schedules([a, b], [doneA], NOW);
    expect(list.find((s) => s.task.id === a.id)!.state).toBe('upcoming');
    expect(list.find((s) => s.task.id === b.id)!.state).toBe('overdue');
  });

  it('completionsFor returns newest-first and lastDoneAt tracks it', () => {
    const t = task();
    const c1 = makeCompletion(t.id, NOW - 10 * DAY);
    const c2 = makeCompletion(t.id, NOW - 2 * DAY);
    expect(completionsFor(t.id, [c1, c2]).map((c) => c.at)).toEqual([NOW - 2 * DAY, NOW - 10 * DAY]);
    expect(lastDoneAt(t.id, [c1, c2])).toBe(NOW - 2 * DAY);
  });
});

describe('appliance linkage', () => {
  it('tasksForAppliance filters by link and skips tombstones', () => {
    const fridge = makeAppliance({ name: 'Refrigerator' });
    const linked = task({ name: 'Clean coils', applianceId: fridge.id });
    const gone = task({ name: 'Old', applianceId: fridge.id, deletedAt: NOW });
    const other = task({ name: 'Unrelated' });
    expect(tasksForAppliance(fridge.id, [linked, gone, other]).map((t) => t.name)).toEqual([
      'Clean coils',
    ]);
  });
});

describe('manual finder', () => {
  it('builds a brand+model search and encodes it', () => {
    const a = makeAppliance({ name: 'Washer', brand: 'LG', model: 'WM4000HWA' });
    expect(manualSearchUrl(a)).toBe('https://duckduckgo.com/?q=LG%20WM4000HWA%20manual');
  });
  it('falls back to the appliance name when brand and model are missing', () => {
    const a = makeAppliance({ name: 'Garage door opener' });
    expect(manualSearchUrl(a)).toBe(
      'https://duckduckgo.com/?q=Garage%20door%20opener%20manual'
    );
    expect(canFindManual(a)).toBe(false);
  });
  it('canFindManual is true with either brand or model', () => {
    expect(canFindManual(makeAppliance({ name: 'W', brand: 'LG' }))).toBe(true);
    expect(canFindManual(makeAppliance({ name: 'W', model: 'X100' }))).toBe(true);
  });
  it('activeAppliances sorts by name and drops tombstones', () => {
    const a = makeAppliance({ name: 'Washer' });
    const b = makeAppliance({ name: 'Dryer' });
    const dead = { ...makeAppliance({ name: 'Ancient' }), deletedAt: NOW };
    expect(activeAppliances([a, dead, b]).map((x) => x.name)).toEqual(['Dryer', 'Washer']);
  });
});

describe('import sanitizers (canon § Backup Layer 3)', () => {
  it('accepts a sane task, remaps category garbage to general, keeps source id', () => {
    const got = sanitizeImportedTask(
      { id: 'src-1', name: 'Flush water heater', category: 'nonsense', intervalDays: 365 },
      CATEGORIES
    );
    expect(got).not.toBeNull();
    expect(got!.task.category).toBe('general');
    expect(got!.sourceId).toBe('src-1');
    expect(got!.task.id).not.toBe('src-1');
  });
  it('rejects shapes without a name or finite interval', () => {
    expect(sanitizeImportedTask(null, CATEGORIES)).toBeNull();
    expect(sanitizeImportedTask({ name: '  ' , intervalDays: 30 }, CATEGORIES)).toBeNull();
    expect(sanitizeImportedTask({ name: 'x', intervalDays: NaN }, CATEGORIES)).toBeNull();
  });
  it('completions require a finite timestamp and take the remapped task id', () => {
    expect(sanitizeImportedCompletion({ at: 'yesterday' }, 't-new')).toBeNull();
    const ok = sanitizeImportedCompletion({ at: NOW }, 't-new');
    expect(ok!.taskId).toBe('t-new');
  });
  it('appliance sanitizer keeps strings, drops junk, survives missing fields', () => {
    const got = sanitizeImportedAppliance({ id: 'a9', name: 'Furnace', brand: 7, model: 'F80' });
    expect(got!.appliance.brand).toBeUndefined();
    expect(got!.appliance.model).toBe('F80');
    expect(got!.sourceId).toBe('a9');
    expect(sanitizeImportedAppliance({ brand: 'LG' })).toBeNull();
  });
});

describe('calendar helpers', () => {
  it('daysBetween counts calendar days, not 24h blocks', () => {
    const lateTonight = new Date(2026, 5, 10, 23, 0).getTime();
    const earlyTomorrow = new Date(2026, 5, 11, 1, 0).getTime();
    expect(daysBetween(lateTonight, earlyTomorrow)).toBe(1);
  });
});
