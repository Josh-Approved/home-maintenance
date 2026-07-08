/**
 * Import remap tests — a restored backup must keep its task→completion and
 * appliance→task links working on freshly-minted ids, and must never crash on
 * a hostile file.
 */

import { sanitizePayload } from '../transfer';

describe('sanitizePayload', () => {
  it('remints ids and remaps completion + appliance links onto them', () => {
    const got = sanitizePayload({
      appliances: [{ id: 'a1', name: 'Furnace', brand: 'Carrier' }],
      tasks: [{ id: 't1', name: 'Replace filter', category: 'hvac', intervalDays: 90, applianceId: 'a1' }],
      completions: [{ id: 'c1', taskId: 't1', at: 1750000000000 }],
    });
    expect(got.appliances).toHaveLength(1);
    expect(got.tasks).toHaveLength(1);
    expect(got.completions).toHaveLength(1);
    expect(got.tasks[0].id).not.toBe('t1');
    expect(got.tasks[0].applianceId).toBe(got.appliances[0].id);
    expect(got.completions[0].taskId).toBe(got.tasks[0].id);
  });

  it('drops completions whose task did not import, and dangling appliance links', () => {
    const got = sanitizePayload({
      tasks: [{ id: 't1', name: 'x', category: 'yard', intervalDays: 30, applianceId: 'missing' }],
      completions: [
        { id: 'c1', taskId: 't1', at: 1750000000000 },
        { id: 'c2', taskId: 'ghost', at: 1750000000000 },
      ],
    });
    expect(got.tasks[0].applianceId).toBeUndefined();
    expect(got.completions).toHaveLength(1);
  });

  it('survives garbage without throwing', () => {
    expect(sanitizePayload(null)).toEqual({ tasks: [], completions: [], appliances: [] });
    expect(sanitizePayload({ tasks: 'nope', completions: 7, appliances: [{}] })).toEqual({
      tasks: [],
      completions: [],
      appliances: [],
    });
  });
});
