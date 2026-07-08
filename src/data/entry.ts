/**
 * Domain model + summary math for the `tracker` archetype — the app's TRUST
 * CORE. A tracker logs a numeric value at a point in time (glasses of water,
 * dollars spent, a mood 1–5, cigarettes, reps) and rolls those entries up into
 * period totals. THIS IS THE APP'S OWN CODE: rename `Entry` to your domain and
 * grow it. Kept pure (no expo / RN imports) so jest-expo tests the summary math
 * directly (src/data/__tests__/entry.test.ts) — a bug here silently corrupts
 * every number the user sees.
 */

import { makeId } from '../lib/id';

export interface Entry {
  id: string;
  value: number;
  note?: string;
  /** When the entry happened (ms). Defaults to creation time but is its own
   *  field so an entry can be backdated. */
  at: number;
  createdAt: number;
  updatedAt: number;
  /** Soft-delete tombstone (canon § Backup #5) — null/undefined = active. */
  deletedAt?: number;
}

export interface Summary {
  total: number;
  count: number;
  average: number;
}

export function makeEntry(value: number, note?: string, at?: number): Entry {
  const now = Date.now();
  const v = Number.isFinite(value) ? value : 0;
  return {
    id: makeId('e'),
    value: v,
    note: note?.trim() ? note.trim() : undefined,
    at: at ?? now,
    createdAt: now,
    updatedAt: now,
  };
}

export function activeEntries(entries: Entry[]): Entry[] {
  return entries.filter((e) => e.deletedAt == null);
}

/** Active entries whose `at` falls in [from, to), newest first. */
export function entriesInRange(entries: Entry[], from: number, to: number): Entry[] {
  return activeEntries(entries)
    .filter((e) => e.at >= from && e.at < to)
    .sort((a, b) => b.at - a.at);
}

/** Sum / count / average of a set of entries (the period summary). Average is
 *  0 for an empty set, never NaN. */
export function summarize(entries: Entry[]): Summary {
  const active = activeEntries(entries);
  const count = active.length;
  const total = active.reduce((acc, e) => acc + e.value, 0);
  return { total, count, average: count ? total / count : 0 };
}

/** Start-of-day (local) for a timestamp. The period helpers build on this so
 *  "today" / "last 7 days" align to the device's calendar, not UTC. */
export function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** [start-of-today, start-of-tomorrow). */
export function todayRange(now: number): [number, number] {
  const start = startOfDay(now);
  return [start, start + 24 * 60 * 60 * 1000];
}

/** The trailing 7 calendar days including today: [start-of-6-days-ago, tomorrow). */
export function last7Range(now: number): [number, number] {
  const [, end] = todayRange(now);
  return [startOfDay(now) - 6 * 24 * 60 * 60 * 1000, end];
}

/** Coerce one untrusted parsed object into a safe Entry for additive import
 *  (canon § Backup Layer 3). Fresh id; bad shapes are skipped, not crashed on.
 *  Pure — unit-tested. */
export function sanitizeImportedEntry(raw: unknown): Entry | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.value !== 'number' || !Number.isFinite(r.value)) return null;
  const at = typeof r.at === 'number' ? r.at : Date.now();
  return makeEntry(r.value, typeof r.note === 'string' ? r.note : undefined, at);
}
