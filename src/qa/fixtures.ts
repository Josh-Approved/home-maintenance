/**
 * QA fixtures — deterministic data the app boots with under QA_MODE (the
 * capture pipeline builds with EXPO_PUBLIC_QA_MODE=1). Built with the app's
 * OWN constructors so it's valid by construction. Schedules are placed
 * relative to "now" so the Due screen always shows a real mix of overdue /
 * due-soon / caught-up regardless of the capture date.
 */

import { makeTask, makeCompletion, type MaintenanceTask, type Completion, DAY } from '../data/task';
import { makeAppliance, type Appliance } from '../data/appliance';

let _tasks: MaintenanceTask[] | null = null;
let _appliances: Appliance[] | null = null;

function build(): void {
  const now = Date.now();
  const fridge = makeAppliance({ name: 'Refrigerator', brand: 'LG', model: 'LFXS26973S' });
  const furnace = makeAppliance({ name: 'Furnace', brand: 'Carrier', model: '59SC2C' });
  const opener = makeAppliance({ name: 'Garage door opener' });
  _appliances = [fridge, furnace, opener];

  _tasks = [
    // Overdue: anchored well past its interval.
    makeTask({ name: 'Replace HVAC filter', category: 'hvac', intervalDays: 90, anchorAt: now - 110 * DAY, applianceId: furnace.id, libraryId: 'hvac-filter' }),
    makeTask({ name: 'Test smoke detectors', category: 'safety', intervalDays: 180, anchorAt: now - 200 * DAY, libraryId: 'smoke-detector-test' }),
    // Due soon: inside the window but not yet due.
    makeTask({ name: 'Vacuum refrigerator coils', category: 'appliances', intervalDays: 180, anchorAt: now - 150 * DAY, applianceId: fridge.id, libraryId: 'fridge-coils' }),
    makeTask({ name: 'Clean gutters', category: 'exterior', intervalDays: 180, anchorAt: now - 160 * DAY, libraryId: 'gutter-clean' }),
    // Comfortably upcoming.
    makeTask({ name: 'Flush water heater', category: 'plumbing', intervalDays: 365, anchorAt: now - 30 * DAY, libraryId: 'water-heater-flush' }),
    makeTask({ name: 'Deep clean dryer vent', category: 'appliances', intervalDays: 365, anchorAt: now - 60 * DAY, libraryId: 'dryer-vent-clean' }),
    makeTask({ name: 'Touch up exterior paint', category: 'exterior', intervalDays: 730, anchorAt: now - 100 * DAY, libraryId: 'paint-touchup' }),
  ];
}

export function qaTasks(): MaintenanceTask[] {
  if (!_tasks) build();
  return _tasks!;
}

export function qaAppliances(): Appliance[] {
  if (!_appliances) build();
  return _appliances!;
}

export function qaCompletions(): Completion[] {
  // One task has history so the detail screen's history section renders.
  const t = qaTasks()[0];
  const now = Date.now();
  return [makeCompletion(t.id, now - 110 * DAY), makeCompletion(t.id, now - 205 * DAY)];
}
