/**
 * Manual export / import (canon § Backup & restore Layer 3). The generic
 * file/share/pick plumbing lives in the shell's lib/backup.ts; this file owns
 * the domain part — what goes in the payload and how an imported payload is
 * sanitized (additive, never destructive: every id is re-minted, and the
 * task→completion and appliance→task links are remapped onto the fresh ids).
 * The remap logic is pure and unit-tested (src/lib/__tests__/transfer.test.ts).
 */

import { exportEnvelope, pickEnvelope } from './backup';
import {
  type MaintenanceTask,
  type Completion,
  sanitizeImportedTask,
  sanitizeImportedCompletion,
} from '../data/task';
import { type Appliance, sanitizeImportedAppliance } from '../data/appliance';
import { CATEGORIES } from '../data/library';

const APP_SLUG = 'home-maintenance';
const EXPORT_VERSION = 1;

export interface HomePayload {
  tasks: MaintenanceTask[];
  completions: Completion[];
  appliances: Appliance[];
}

export async function exportData(payload: HomePayload): Promise<void> {
  await exportEnvelope(APP_SLUG, EXPORT_VERSION, payload);
}

/** Pure sanitizer — parse an untrusted payload into safe, freshly-minted
 *  records with links remapped. Exported for tests. */
export function sanitizePayload(payload: unknown): HomePayload {
  const p = (payload ?? {}) as Record<string, unknown>;
  const rawAppliances = Array.isArray(p.appliances) ? p.appliances : [];
  const rawTasks = Array.isArray(p.tasks) ? p.tasks : [];
  const rawCompletions = Array.isArray(p.completions) ? p.completions : [];

  const appliances: Appliance[] = [];
  const applianceIdMap = new Map<string, string>();
  for (const r of rawAppliances) {
    const got = sanitizeImportedAppliance(r);
    if (!got) continue;
    appliances.push(got.appliance);
    if (got.sourceId) applianceIdMap.set(got.sourceId, got.appliance.id);
  }

  const tasks: MaintenanceTask[] = [];
  const taskIdMap = new Map<string, string>();
  for (const r of rawTasks) {
    const got = sanitizeImportedTask(r, CATEGORIES);
    if (!got) continue;
    // Remap the appliance link onto the freshly-minted id; drop dangling links.
    const srcApplianceId = (r as Record<string, unknown>).applianceId;
    got.task.applianceId =
      typeof srcApplianceId === 'string' ? applianceIdMap.get(srcApplianceId) : undefined;
    tasks.push(got.task);
    if (got.sourceId) taskIdMap.set(got.sourceId, got.task.id);
  }

  const completions: Completion[] = [];
  for (const r of rawCompletions) {
    const srcTaskId = (r as Record<string, unknown> | null)?.taskId;
    const newTaskId = typeof srcTaskId === 'string' ? taskIdMap.get(srcTaskId) : undefined;
    if (!newTaskId) continue; // a completion without its task is meaningless
    const safe = sanitizeImportedCompletion(r, newTaskId);
    if (safe) completions.push(safe);
  }

  return { tasks, completions, appliances };
}

/** Pick a file and return the records to add. Empty payload on cancel / bad file. */
export async function pickAndParseData(): Promise<HomePayload> {
  const env = await pickEnvelope();
  if (!env) return { tasks: [], completions: [], appliances: [] };
  return sanitizePayload(env.payload);
}
