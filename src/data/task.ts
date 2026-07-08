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

export function makeTask(
  fields: Pick<MaintenanceTask, 'name' | 'category' | 'intervalDays'> &
    Partial<Pick<MaintenanceTask, 'applianceId' | 'reminder' | 'note' | 'libraryId' | 'anchorAt'>>
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
