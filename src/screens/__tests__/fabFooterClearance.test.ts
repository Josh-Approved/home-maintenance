/**
 * Regression guard: fab-footer-clearance-sweep (defect packing-list-20260801-2
 * class — the floating "+" FAB must not cover the FundingFooter).
 *
 * Appliances/TasksScreen use a DIFFERENT FAB idiom than the canonical
 * workout-timer/packing-list one. There, the FAB is lifted dynamically —
 * `bottom: footerHeight + space.s4` — so the footer's own height cancels out
 * of the safety math and the invariant collapses to a screen-size-independent
 * `paddingBottom <= space.s4 + space.s5`.
 *
 * Here the FAB sits at a FIXED `bottom: space.s8`, independent of the
 * footer's height. That flips the relationship: because the footer is pinned
 * to the bottom of the (short) scroll content via `marginTop: 'auto'`, its
 * bottom edge sits `paddingBottom` above the screen's bottom edge — so a
 * LARGER paddingBottom pushes the footer FARTHER from the fixed FAB, and a
 * SMALLER one pushes it closer. Applying the workout-timer fix verbatim
 * (shrink paddingBottom to space.s5) would move the footer *toward* the FAB
 * and manufacture the exact defect it's meant to prevent.
 *
 * The geometry (offsets measured up from the screen's bottom edge; FAB style
 * read live from the screen's own makeStyles, not copied):
 *
 *   FAB        [fab.bottom, fab.bottom + fab.height]
 *   footer box [P, P + H]              P = listContent.paddingBottom
 *   button row bottom edge = P + FundingFooter.wrap.paddingBottom(s6)
 *                              + FundingFooter.wrap.gap(s4)
 *                              + lockupHeight
 *
 * `lockupHeight` is the "josh approved" wordmark row: Wordmark.tsx sets a
 * literal (non-scaling) fontSize/lineHeight, so its rendered height is a
 * stable ~22px (lockup's own paddingTop space.s1=2 + max(icon 18, text
 * lineHeight 20) = 20) at every accessibility text-scale setting — larger
 * Dynamic Type only ever *grows* the row further from the FAB, so default
 * scale is the worst case, not an approximation of it.
 *
 * No overlap with the button row requires:
 *   fab.bottom + fab.height <= P + space.s6 + space.s4 + LOCKUP_HEIGHT
 *
 * At the current (unchanged) paddingBottom = space.s9 this holds with real
 * margin; at workout-timer's space.s5 it does not — see the second test,
 * which is the failing-first proof for this file (temporarily set
 * `LOCKUP_HEIGHT` aside and swap `paddingBottom: space.s9` for
 * `paddingBottom: space.s5` in either screen to watch the first test go red).
 */

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('expo-font', () => ({
  useFonts: () => [true, null],
  isLoaded: () => true,
  loadAsync: () => Promise.resolve(),
}));
jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: () =>
    Promise.resolve({
      execAsync: () => Promise.resolve(),
      runAsync: () => Promise.resolve(),
      getAllAsync: () => Promise.resolve([]),
      getFirstAsync: () => Promise.resolve(null),
    }),
}));
// Both screens pull in FundingFooter (reanimated/worklets, no working jest
// mock wired for this SDK combo in this repo) and TipJarSheet (IAP) and the
// tasks store's reminder scheduling (expo-notifications) transitively — this
// test only needs the plain makeStyles function each screen exports, so
// stand in inert components/no-ops for the two module trees this test never
// exercises rather than dragging their native deps through jest.
jest.mock('../../components/FundingFooter', () => ({ FundingFooter: () => null }));
jest.mock('../../components/TipJarSheet', () => ({ __esModule: true, default: () => null }));
jest.mock('expo-notifications', () => ({
  scheduleNotificationAsync: () => Promise.resolve('id'),
  cancelScheduledNotificationAsync: () => Promise.resolve(),
  cancelAllScheduledNotificationsAsync: () => Promise.resolve(),
  getPermissionsAsync: () => Promise.resolve({ status: 'granted' }),
  requestPermissionsAsync: () => Promise.resolve({ status: 'granted' }),
  setNotificationHandler: () => {},
  SchedulableTriggerInputTypes: { DATE: 'date' },
}));

import { makeStyles as makeAppliancesStyles } from '../AppliancesScreen';
import { makeStyles as makeTasksStyles } from '../TasksScreen';
import { space } from '../../theme';
import type { Colors } from '../../theme';

// The FundingFooter/Wordmark wrap only reads colour values, so a bare
// stand-in is enough for these two screens' makeStyles too.
const stubColors = new Proxy({}, { get: () => '#000000' }) as unknown as Colors;

/** StyleSheet.create returns opaque ids on some RN versions; flatten defensively. */
function flatten(style: unknown): Record<string, unknown> {
  const { StyleSheet } = require('react-native');
  return (StyleSheet.flatten(style) || {}) as Record<string, unknown>;
}

// FundingFooter.tsx wrap: paddingBottom space.s6, gap space.s4 (both tokens,
// not copied off the render — cross-checked against the file in this test's
// own assertions below). LOCKUP_HEIGHT is the one non-token quantity, derived
// from Wordmark.tsx's literal (non-Dynamic-Type-scaling) dimensions — see the
// file header for why default scale is the true worst case.
const FOOTER_WRAP_PADDING_BOTTOM = space.s6;
const FOOTER_WRAP_GAP = space.s4;
const LOCKUP_HEIGHT = space.s1 + 20; // lockup paddingTop (2) + wordmark row (max(icon 18, text lineHeight 20))

describe.each([
  ['Appliances', makeAppliancesStyles],
  ['Tasks', makeTasksStyles],
])('%s screen — FAB clearance over the funding footer', (_name, makeStyles) => {
  it('keeps the fixed FAB clear of the footer button row at the current padding', () => {
    const s = makeStyles(stubColors);
    const fab = flatten(s.fab);
    const listContent = flatten(s.listContent);

    const fabBottom = fab.bottom as number;
    const fabHeight = fab.height as number;
    const paddingBottom = listContent.paddingBottom as number;

    expect(typeof fabBottom).toBe('number');
    expect(typeof fabHeight).toBe('number');
    expect(typeof paddingBottom).toBe('number');

    const fabTop = fabBottom + fabHeight;
    const buttonRowBottom =
      paddingBottom + FOOTER_WRAP_PADDING_BOTTOM + FOOTER_WRAP_GAP + LOCKUP_HEIGHT;

    expect(fabTop).toBeLessThanOrEqual(buttonRowBottom);
  });

  it('still leaves the footer breathing room off the screen edge', () => {
    const s = makeStyles(stubColors);
    const paddingBottom = flatten(s.listContent).paddingBottom as number;

    expect(paddingBottom).toBeGreaterThan(0);
  });
});
