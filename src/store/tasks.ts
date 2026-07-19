/**
 * Tasks + completions store — Zustand state with disk-backed persistence.
 * React state updates synchronously (UI feels instant); the SQLite save runs
 * fire-and-forget. The store is the in-memory source of truth; db.ts is
 * durable backup.
 *
 * Every mutation that can move a due date ends with syncReminders() — the
 * scheduled local notifications always mirror the current schedule state.
 *
 * Note the curried `create<State>()(...)` form — Zustand v5 requires it
 * (stack/zustand.md); the v4-style `create<State>(...)` type-checks but fails
 * silently at runtime.
 */

import { create } from 'zustand';
import {
  type MaintenanceTask,
  type Completion,
  makeTask,
  makeCompletion,
  completionsFor,
  withLastDoneAt,
} from '../data/task';
import type { LibraryTask } from '../data/library';
import { putTombstone } from '../storage/kv';
import { loadAllTasks, loadAllCompletions, saveTask, saveCompletion, hardDelete } from './db';
import { syncReminders } from '../lib/reminders';
import { QA_MODE } from '../qa/qaMode';
import { qaTasks, qaCompletions } from '../qa/fixtures';

export type NewTaskFields = Parameters<typeof makeTask>[0];
export type TaskEdits = Partial<
  Pick<
    MaintenanceTask,
    | 'name'
    | 'category'
    | 'intervalDays'
    | 'applianceId'
    | 'reminder'
    | 'reminderLeadDays'
    | 'reminderRepeatDays'
    | 'reminderRepeatCount'
    | 'note'
  >
>;

interface TasksState {
  tasks: MaintenanceTask[];
  completions: Completion[];
  hydrated: boolean;
  hydrate: () => Promise<void>;

  addTask: (fields: NewTaskFields) => string;
  /** Add several library tasks at once (the starter-library picker). Items may
   *  arrive with an already-resolved applianceId (name-matched by the caller).
   *  Returns the ids of the tasks actually created, for the setup step. */
  addFromLibrary: (items: (LibraryTask & { applianceId?: string })[]) => string[];
  updateTask: (id: string, edits: TaskEdits) => void;
  deleteTask: (id: string) => void;

  /** One-tap done: stamps a completion (backdatable) and rolls the schedule. */
  markDone: (taskId: string, at?: number) => void;
  /** Set or correct when this task was last serviced: moves the latest
   *  completion to `at`, or records one if the task was never done. */
  setLastDone: (taskId: string, at: number) => void;
  /** Undo the most recent completion (tombstone — the history stays honest). */
  undoLastDone: (taskId: string) => void;

  importData: (tasks: MaintenanceTask[], completions: Completion[]) => number;
}

function persistTask(t: MaintenanceTask): void {
  saveTask(t).catch((err) => console.warn('home-maintenance: failed to persist task', err));
}
function persistCompletion(c: Completion): void {
  saveCompletion(c).catch((err) => console.warn('home-maintenance: failed to persist completion', err));
}

export const useTasksStore = create<TasksState>()((set, get) => ({
  tasks: [],
  completions: [],
  hydrated: false,

  hydrate: async () => {
    try {
      const [tasks, completions] = await Promise.all([loadAllTasks(), loadAllCompletions()]);
      if (QA_MODE && tasks.length === 0) {
        set({ tasks: qaTasks(), completions: qaCompletions(), hydrated: true });
        return;
      }
      set({ tasks, completions, hydrated: true });
      syncReminders(get().tasks, get().completions);
    } catch (err) {
      console.warn('home-maintenance: failed to load from disk', err);
      set({ hydrated: true });
    }
  },

  addTask: (fields) => {
    const task = makeTask(fields);
    set((s) => ({ tasks: [task, ...s.tasks] }));
    persistTask(task);
    syncReminders(get().tasks, get().completions);
    return task.id;
  },

  addFromLibrary: (items) => {
    const existing = new Set(
      get().tasks.filter((t) => t.deletedAt == null && t.libraryId).map((t) => t.libraryId)
    );
    const fresh = items
      .filter((i) => !existing.has(i.id))
      .map((i) =>
        makeTask({
          name: i.name,
          category: i.category,
          intervalDays: i.intervalDays,
          note: i.note,
          libraryId: i.id,
          applianceId: i.applianceId,
        })
      );
    if (fresh.length === 0) return [];
    set((s) => ({ tasks: [...fresh, ...s.tasks] }));
    for (const t of fresh) persistTask(t);
    syncReminders(get().tasks, get().completions);
    return fresh.map((t) => t.id);
  },

  updateTask: (id, edits) => {
    set((s) => ({
      tasks: s.tasks.map((t) => {
        if (t.id !== id) return t;
        const next = { ...t, ...edits, updatedAt: Date.now() };
        if (edits.name !== undefined) next.name = edits.name.trim() || t.name;
        if (edits.note !== undefined) next.note = edits.note?.trim() ? edits.note.trim() : undefined;
        persistTask(next);
        return next;
      }),
    }));
    syncReminders(get().tasks, get().completions);
  },

  deleteTask: (id) => {
    set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }));
    hardDelete('tasks', id).catch((err) => console.warn('home-maintenance: failed to delete', err));
    putTombstone(id, Date.now()).catch(() => {});
    syncReminders(get().tasks, get().completions);
  },

  markDone: (taskId, at) => {
    const completion = makeCompletion(taskId, at);
    set((s) => ({ completions: [completion, ...s.completions] }));
    persistCompletion(completion);
    syncReminders(get().tasks, get().completions);
  },

  setLastDone: (taskId, at) => {
    const { completions, changed } = withLastDoneAt(taskId, get().completions, at);
    set({ completions });
    persistCompletion(changed);
    syncReminders(get().tasks, get().completions);
  },

  undoLastDone: (taskId) => {
    const latest = completionsFor(taskId, get().completions)[0];
    if (!latest) return;
    const dead = { ...latest, deletedAt: Date.now() };
    set((s) => ({ completions: s.completions.map((c) => (c.id === latest.id ? dead : c)) }));
    persistCompletion(dead);
    syncReminders(get().tasks, get().completions);
  },

  importData: (tasks, completions) => {
    if (tasks.length === 0 && completions.length === 0) return 0;
    set((s) => ({
      tasks: [...tasks, ...s.tasks],
      completions: [...completions, ...s.completions],
    }));
    for (const t of tasks) persistTask(t);
    for (const c of completions) persistCompletion(c);
    syncReminders(get().tasks, get().completions);
    return tasks.length;
  },
}));
