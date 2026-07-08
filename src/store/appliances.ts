/**
 * Appliance registry store — same idiom as tasks.ts: synchronous Zustand
 * updates, fire-and-forget SQLite persistence, tombstoned deletes.
 */

import { create } from 'zustand';
import { type Appliance, makeAppliance } from '../data/appliance';
import { putTombstone } from '../storage/kv';
import { loadAllAppliances, saveAppliance, hardDelete } from './db';
import { QA_MODE } from '../qa/qaMode';
import { qaAppliances } from '../qa/fixtures';

export type NewApplianceFields = Parameters<typeof makeAppliance>[0];
export type ApplianceEdits = Partial<
  Pick<Appliance, 'name' | 'brand' | 'model' | 'serial' | 'purchasedAt' | 'note'>
>;

interface AppliancesState {
  appliances: Appliance[];
  hydrated: boolean;
  hydrate: () => Promise<void>;

  addAppliance: (fields: NewApplianceFields) => string;
  updateAppliance: (id: string, edits: ApplianceEdits) => void;
  deleteAppliance: (id: string) => void;
  importAppliances: (incoming: Appliance[]) => number;
}

function persist(a: Appliance): void {
  saveAppliance(a).catch((err) => console.warn('home-maintenance: failed to persist appliance', err));
}

export const useAppliancesStore = create<AppliancesState>()((set, get) => ({
  appliances: [],
  hydrated: false,

  hydrate: async () => {
    try {
      const loaded = await loadAllAppliances();
      if (QA_MODE && loaded.length === 0) {
        set({ appliances: qaAppliances(), hydrated: true });
        return;
      }
      set({ appliances: loaded, hydrated: true });
    } catch (err) {
      console.warn('home-maintenance: failed to load appliances', err);
      set({ hydrated: true });
    }
  },

  addAppliance: (fields) => {
    const appliance = makeAppliance(fields);
    set((s) => ({ appliances: [appliance, ...s.appliances] }));
    persist(appliance);
    return appliance.id;
  },

  updateAppliance: (id, edits) => {
    set((s) => ({
      appliances: s.appliances.map((a) => {
        if (a.id !== id) return a;
        const clean = (v?: string) => (v?.trim() ? v.trim() : undefined);
        const next: Appliance = {
          ...a,
          name: edits.name !== undefined ? edits.name.trim() || a.name : a.name,
          brand: edits.brand !== undefined ? clean(edits.brand) : a.brand,
          model: edits.model !== undefined ? clean(edits.model) : a.model,
          serial: edits.serial !== undefined ? clean(edits.serial) : a.serial,
          purchasedAt: edits.purchasedAt !== undefined ? edits.purchasedAt : a.purchasedAt,
          note: edits.note !== undefined ? clean(edits.note) : a.note,
          updatedAt: Date.now(),
        };
        persist(next);
        return next;
      }),
    }));
  },

  deleteAppliance: (id) => {
    set((s) => ({ appliances: s.appliances.filter((a) => a.id !== id) }));
    hardDelete('appliances', id).catch((err) =>
      console.warn('home-maintenance: failed to delete appliance', err)
    );
    putTombstone(id, Date.now()).catch(() => {});
  },

  importAppliances: (incoming) => {
    if (incoming.length === 0) return 0;
    set((s) => ({ appliances: [...incoming, ...s.appliances] }));
    for (const a of incoming) persist(a);
    return incoming.length;
  },
}));
