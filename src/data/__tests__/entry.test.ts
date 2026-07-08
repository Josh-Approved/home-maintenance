/**
 * Trust-core unit tests (canon § QA & testing Tier 1) for the `tracker`
 * archetype. The trust core is the summary math: period ranges align to the
 * device's calendar, tombstoned entries are excluded everywhere, and totals /
 * averages never go NaN. A bug here silently corrupts every number the user
 * sees. Expand for your domain.
 */

import { describe, it, expect } from '@jest/globals';
import {
  makeEntry,
  activeEntries,
  entriesInRange,
  summarize,
  startOfDay,
  todayRange,
  last7Range,
  sanitizeImportedEntry,
} from '../entry';

const DAY = 24 * 60 * 60 * 1000;
const NOON = startOfDay(Date.now()) + 12 * 60 * 60 * 1000; // today, noon (stable)

describe('makeEntry', () => {
  it('keeps a finite value, trims the note, defaults at to now', () => {
    const e = makeEntry(3.5, '  Coffee  ');
    expect(e.value).toBe(3.5);
    expect(e.note).toBe('Coffee');
    expect(e.id).toMatch(/^e/);
    expect(e.at).toBeGreaterThan(0);
  });
  it('coerces a non-finite value to 0 and drops an empty note', () => {
    const e = makeEntry(NaN, '   ');
    expect(e.value).toBe(0);
    expect(e.note).toBeUndefined();
  });
});

describe('summarize', () => {
  it('totals, counts, and averages active entries', () => {
    const sum = summarize([makeEntry(2), makeEntry(4), makeEntry(6)]);
    expect(sum).toEqual({ total: 12, count: 3, average: 4 });
  });
  it('excludes tombstoned entries and never returns NaN', () => {
    const a = makeEntry(5);
    a.deletedAt = Date.now();
    expect(activeEntries([a])).toHaveLength(0);
    expect(summarize([a])).toEqual({ total: 0, count: 0, average: 0 });
  });
});

describe('period ranges', () => {
  it('todayRange keeps an entry from today and drops yesterday', () => {
    const today = [makeEntry(1, 'now', NOON), makeEntry(1, 'yest', NOON - DAY)];
    const inToday = entriesInRange(today, ...todayRange(NOON));
    expect(inToday.map((e) => e.note)).toEqual(['now']);
  });
  it('last7Range includes today..6-days-ago and excludes 7-days-ago', () => {
    const entries = [
      makeEntry(1, 'today', NOON),
      makeEntry(1, 'six', NOON - 6 * DAY),
      makeEntry(1, 'seven', NOON - 7 * DAY),
    ];
    const got = entriesInRange(entries, ...last7Range(NOON)).map((e) => e.note);
    expect(got).toContain('today');
    expect(got).toContain('six');
    expect(got).not.toContain('seven');
  });
  it('entriesInRange returns newest-first', () => {
    const entries = [makeEntry(1, 'a', NOON - 2000), makeEntry(1, 'b', NOON - 1000)];
    expect(entriesInRange(entries, NOON - DAY, NOON + DAY).map((e) => e.note)).toEqual(['b', 'a']);
  });
});

describe('sanitizeImportedEntry', () => {
  it('re-mints a valid entry and rejects junk', () => {
    const ok = sanitizeImportedEntry({ value: 9, note: 'x', at: 123 });
    expect(ok?.value).toBe(9);
    expect(ok?.at).toBe(123);
    expect(ok?.id).toMatch(/^e/);
    expect(sanitizeImportedEntry({ note: 'no value' })).toBeNull();
    expect(sanitizeImportedEntry({ value: Infinity })).toBeNull();
    expect(sanitizeImportedEntry(null)).toBeNull();
  });
});
