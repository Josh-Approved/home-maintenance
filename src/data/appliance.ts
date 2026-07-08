/**
 * Appliance registry model + the manual-finder URL builder. Pure (no expo /
 * RN imports) — unit-tested alongside the task trust core. The manual finder
 * deliberately builds a search URL and hands it to the system browser: we
 * never host, proxy, or log what anyone owns (spec tenet 5).
 */

import { makeId } from '../lib/id';

export interface Appliance {
  id: string;
  name: string;
  brand?: string;
  model?: string;
  serial?: string;
  /** Purchase date (ms), optional. */
  purchasedAt?: number;
  note?: string;
  createdAt: number;
  updatedAt: number;
  /** Soft-delete tombstone (canon § Backup #5) — null/undefined = active. */
  deletedAt?: number;
}

export function makeAppliance(
  fields: Pick<Appliance, 'name'> &
    Partial<Pick<Appliance, 'brand' | 'model' | 'serial' | 'purchasedAt' | 'note'>>
): Appliance {
  const now = Date.now();
  const clean = (s?: string) => (s?.trim() ? s.trim() : undefined);
  return {
    id: makeId('a'),
    name: fields.name.trim(),
    brand: clean(fields.brand),
    model: clean(fields.model),
    serial: clean(fields.serial),
    purchasedAt: fields.purchasedAt,
    note: clean(fields.note),
    createdAt: now,
    updatedAt: now,
  };
}

export function activeAppliances(appliances: Appliance[]): Appliance[] {
  return appliances
    .filter((a) => a.deletedAt == null)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** True when there's enough identifying detail for a useful manual search. */
export function canFindManual(a: Pick<Appliance, 'name' | 'brand' | 'model'>): boolean {
  return Boolean(a.brand?.trim() || a.model?.trim());
}

/** DuckDuckGo search for the appliance's manual — a privacy-respecting default
 *  (no account, no search history tied to the user). Brand + model pin the
 *  result; the appliance name fills in when either is missing. */
export function manualSearchUrl(a: Pick<Appliance, 'name' | 'brand' | 'model'>): string {
  const q = [a.brand, a.model, !a.brand && !a.model ? a.name : undefined, 'manual']
    .map((s) => s?.trim())
    .filter(Boolean)
    .join(' ');
  return `https://duckduckgo.com/?q=${encodeURIComponent(q)}`;
}

/** Coerce one untrusted parsed object into a safe appliance for additive
 *  import (canon § Backup Layer 3). Fresh id; bad shapes skipped. */
export function sanitizeImportedAppliance(
  raw: unknown
): { appliance: Appliance; sourceId: string | null } | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.name !== 'string' || !r.name.trim()) return null;
  const str = (v: unknown) => (typeof v === 'string' ? v : undefined);
  const appliance = makeAppliance({
    name: r.name,
    brand: str(r.brand),
    model: str(r.model),
    serial: str(r.serial),
    purchasedAt:
      typeof r.purchasedAt === 'number' && Number.isFinite(r.purchasedAt)
        ? r.purchasedAt
        : undefined,
    note: str(r.note),
  });
  return { appliance, sourceId: typeof r.id === 'string' ? r.id : null };
}
