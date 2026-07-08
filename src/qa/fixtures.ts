/**
 * QA fixtures — deterministic data the app boots with under QA_MODE (the
 * capture pipeline builds with EXPO_PUBLIC_QA_MODE=1). Built with the app's OWN
 * constructor so it's valid by construction. Entries are placed relative to
 * "now" so the today / last-7-days summaries always read as a real, mid-week
 * tracker regardless of the capture date. Rename to your domain.
 */

import { makeEntry, type Entry } from '../data/entry';

const DAY = 24 * 60 * 60 * 1000;

export function qaEntries(): Entry[] {
  const now = Date.now();
  return [
    makeEntry(2, 'Morning', now - 1 * 60 * 60 * 1000),
    makeEntry(1, 'Lunch', now - 3 * 60 * 60 * 1000),
    makeEntry(3, 'Yesterday', now - 1 * DAY),
    makeEntry(2, 'Two days ago', now - 2 * DAY),
    makeEntry(4, 'Earlier this week', now - 4 * DAY),
  ];
}
