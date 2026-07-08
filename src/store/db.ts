/**
 * Domain SQLite persistence. Opens the SAME connection the shell's
 * storage/kv.ts owns (one file, one backup unit — canon § Backup Layer 1) and
 * adds the three domain tables. Writes are fire-and-forget; hydrate() is
 * awaited once at app start.
 */

import { getDb } from '../storage/kv';
import type { MaintenanceTask, Completion } from '../data/task';
import type { Appliance } from '../data/appliance';
import type { CategoryId } from '../data/library';

let _ready: Promise<void> | null = null;

async function ensureTables(): Promise<void> {
  if (_ready) return _ready;
  _ready = (async () => {
    const db = await getDb();
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS tasks (
        id           TEXT PRIMARY KEY NOT NULL,
        name         TEXT NOT NULL,
        category     TEXT NOT NULL,
        intervalDays INTEGER NOT NULL,
        anchorAt     INTEGER NOT NULL,
        applianceId  TEXT,
        reminder     INTEGER NOT NULL DEFAULT 1,
        note         TEXT,
        libraryId    TEXT,
        createdAt    INTEGER NOT NULL,
        updatedAt    INTEGER NOT NULL,
        deletedAt    INTEGER
      );
      CREATE TABLE IF NOT EXISTS completions (
        id        TEXT PRIMARY KEY NOT NULL,
        taskId    TEXT NOT NULL,
        at        INTEGER NOT NULL,
        createdAt INTEGER NOT NULL,
        deletedAt INTEGER
      );
      CREATE TABLE IF NOT EXISTS appliances (
        id          TEXT PRIMARY KEY NOT NULL,
        name        TEXT NOT NULL,
        brand       TEXT,
        model       TEXT,
        serial      TEXT,
        purchasedAt INTEGER,
        note        TEXT,
        createdAt   INTEGER NOT NULL,
        updatedAt   INTEGER NOT NULL,
        deletedAt   INTEGER
      );
    `);
  })();
  return _ready;
}

interface TaskRow {
  id: string;
  name: string;
  category: string;
  intervalDays: number;
  anchorAt: number;
  applianceId: string | null;
  reminder: number;
  note: string | null;
  libraryId: string | null;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

export async function loadAllTasks(): Promise<MaintenanceTask[]> {
  await ensureTables();
  const db = await getDb();
  const rows = await db.getAllAsync<TaskRow>('SELECT * FROM tasks WHERE deletedAt IS NULL');
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    category: r.category as CategoryId,
    intervalDays: r.intervalDays,
    anchorAt: r.anchorAt,
    applianceId: r.applianceId ?? undefined,
    reminder: r.reminder === 1,
    note: r.note ?? undefined,
    libraryId: r.libraryId ?? undefined,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));
}

export async function saveTask(t: MaintenanceTask): Promise<void> {
  await ensureTables();
  const db = await getDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO tasks
       (id, name, category, intervalDays, anchorAt, applianceId, reminder, note, libraryId, createdAt, updatedAt, deletedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      t.id, t.name, t.category, t.intervalDays, t.anchorAt,
      t.applianceId ?? null, t.reminder ? 1 : 0, t.note ?? null, t.libraryId ?? null,
      t.createdAt, t.updatedAt, t.deletedAt ?? null,
    ]
  );
}

export async function loadAllCompletions(): Promise<Completion[]> {
  await ensureTables();
  const db = await getDb();
  const rows = await db.getAllAsync<Completion & { deletedAt: number | null }>(
    'SELECT * FROM completions WHERE deletedAt IS NULL'
  );
  return rows.map((r) => ({ ...r, deletedAt: r.deletedAt ?? undefined }));
}

export async function saveCompletion(c: Completion): Promise<void> {
  await ensureTables();
  const db = await getDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO completions (id, taskId, at, createdAt, deletedAt)
     VALUES (?, ?, ?, ?, ?)`,
    [c.id, c.taskId, c.at, c.createdAt, c.deletedAt ?? null]
  );
}

export async function loadAllAppliances(): Promise<Appliance[]> {
  await ensureTables();
  const db = await getDb();
  const rows = await db.getAllAsync<
    Appliance & {
      brand: string | null; model: string | null; serial: string | null;
      purchasedAt: number | null; note: string | null; deletedAt: number | null;
    }
  >('SELECT * FROM appliances WHERE deletedAt IS NULL');
  return rows.map((r) => ({
    ...r,
    brand: r.brand ?? undefined,
    model: r.model ?? undefined,
    serial: r.serial ?? undefined,
    purchasedAt: r.purchasedAt ?? undefined,
    note: r.note ?? undefined,
    deletedAt: r.deletedAt ?? undefined,
  }));
}

export async function saveAppliance(a: Appliance): Promise<void> {
  await ensureTables();
  const db = await getDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO appliances
       (id, name, brand, model, serial, purchasedAt, note, createdAt, updatedAt, deletedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      a.id, a.name, a.brand ?? null, a.model ?? null, a.serial ?? null,
      a.purchasedAt ?? null, a.note ?? null, a.createdAt, a.updatedAt, a.deletedAt ?? null,
    ]
  );
}

const TABLES = { tasks: 'tasks', completions: 'completions', appliances: 'appliances' } as const;

/** Hard-delete a row (the store writes a tombstone to kv first — canon § Backup #5). */
export async function hardDelete(table: keyof typeof TABLES, id: string): Promise<void> {
  await ensureTables();
  const db = await getDb();
  await db.runAsync(`DELETE FROM ${TABLES[table]} WHERE id = ?`, [id]);
}
