/**
 * Domain SQLite persistence for the `tracker` archetype. Opens the SAME
 * connection the shell's storage/kv.ts owns (one file, one backup unit — canon
 * § Backup Layer 1) and adds the one domain table. Rename `entries` to your
 * domain when you fork this. Writes are fire-and-forget; hydrate() is awaited
 * once at app start.
 */

import { getDb } from '../storage/kv';
import type { Entry } from '../data/entry';

let _ready: Promise<void> | null = null;

async function ensureTable(): Promise<void> {
  if (_ready) return _ready;
  _ready = (async () => {
    const db = await getDb();
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS entries (
        id        TEXT PRIMARY KEY NOT NULL,
        value     REAL NOT NULL,
        note      TEXT,
        at        INTEGER NOT NULL,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL,
        deletedAt INTEGER
      );
    `);
  })();
  return _ready;
}

export async function loadAllEntries(): Promise<Entry[]> {
  await ensureTable();
  const db = await getDb();
  const rows = await db.getAllAsync<Entry>(
    'SELECT * FROM entries WHERE deletedAt IS NULL ORDER BY at DESC'
  );
  return rows.map((r) => ({ ...r, note: r.note ?? undefined }));
}

export async function saveEntry(e: Entry): Promise<void> {
  await ensureTable();
  const db = await getDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO entries (id, value, note, at, createdAt, updatedAt, deletedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [e.id, e.value, e.note ?? null, e.at, e.createdAt, e.updatedAt, e.deletedAt ?? null]
  );
}

export async function deleteEntryFromDb(id: string): Promise<void> {
  await ensureTable();
  const db = await getDb();
  await db.runAsync('DELETE FROM entries WHERE id = ?', [id]);
}
