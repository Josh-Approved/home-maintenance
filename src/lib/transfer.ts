/**
 * Manual export / import (canon § Backup & restore Layer 3) for the `tracker`
 * archetype. The generic file/share/pick plumbing lives in the shell's
 * lib/backup.ts; this file owns the domain part — what goes in the payload and
 * how an imported payload is sanitized (additive, never destructive: a
 * colliding id is re-minted by sanitizeImportedEntry).
 */

import { exportEnvelope, pickEnvelope } from './backup';
import { type Entry, sanitizeImportedEntry } from '../data/entry';

const APP_SLUG = 'home-maintenance';
const EXPORT_VERSION = 1;

export async function exportEntries(entries: Entry[]): Promise<void> {
  await exportEnvelope(APP_SLUG, EXPORT_VERSION, { entries });
}

/** Pick a file and return the entries to add. Returns [] on cancel / bad file. */
export async function pickAndParseEntries(): Promise<Entry[]> {
  const env = await pickEnvelope();
  const payload = env?.payload as { entries?: unknown[] } | undefined;
  const raw = Array.isArray(payload?.entries) ? payload!.entries : [];
  const out: Entry[] = [];
  for (const r of raw) {
    const safe = sanitizeImportedEntry(r);
    if (safe) out.push(safe);
  }
  return out;
}
