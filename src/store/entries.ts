/**
 * Entries store — Zustand state with disk-backed persistence. React state
 * updates synchronously (UI feels instant); the SQLite save runs
 * fire-and-forget. The store is the in-memory source of truth; db.ts is durable
 * backup.
 *
 * Note the curried `create<State>()(...)` form — Zustand v5 requires it
 * (stack/zustand.md); the v4-style `create<State>(...)` type-checks but fails
 * silently at runtime.
 */

import { create } from 'zustand';
import { type Entry, makeEntry } from '../data/entry';
import { putTombstone } from '../storage/kv';
import { loadAllEntries, saveEntry, deleteEntryFromDb } from './db';
import { QA_MODE } from '../qa/qaMode';
import { qaEntries } from '../qa/fixtures';

interface EntriesState {
  entries: Entry[];
  hydrated: boolean;
  hydrate: () => Promise<void>;

  addEntry: (value: number, note?: string, at?: number) => string;
  deleteEntry: (id: string) => void;
  importEntries: (incoming: Entry[]) => number;
}

function persist(e: Entry): void {
  saveEntry(e).catch((err) => console.warn('tracker: failed to persist', err));
}

export const useEntriesStore = create<EntriesState>()((set, get) => ({
  entries: [],
  hydrated: false,

  hydrate: async () => {
    try {
      const loaded = await loadAllEntries();
      if (QA_MODE && loaded.length === 0) {
        set({ entries: qaEntries(), hydrated: true });
        return;
      }
      set({ entries: loaded, hydrated: true });
    } catch (err) {
      console.warn('tracker: failed to load from disk', err);
      set({ hydrated: true });
    }
  },

  addEntry: (value, note, at) => {
    const entry = makeEntry(value, note, at);
    set((s) => ({ entries: [entry, ...s.entries] }));
    persist(entry);
    return entry.id;
  },

  deleteEntry: (id) => {
    set((s) => ({ entries: s.entries.filter((e) => e.id !== id) }));
    deleteEntryFromDb(id).catch((err) => console.warn('tracker: failed to delete', err));
    putTombstone(id, Date.now()).catch(() => {});
  },

  importEntries: (incoming) => {
    if (incoming.length === 0) return 0;
    set((s) => ({ entries: [...incoming, ...s.entries] }));
    for (const e of incoming) persist(e);
    return incoming.length;
  },
}));
