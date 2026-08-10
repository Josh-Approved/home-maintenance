/**
 * Regression guard: fab-footer-clearance-sweep (defect packing-list-20260801-2
 * class — the floating "+" FAB must not cover the FundingFooter).
 *
 * Appliances/TasksScreen use the canonical workout-timer/packing-list idiom:
 * the FAB is lifted DYNAMICALLY — `bottom: footerHeight + space.s4`, with
 * footerHeight measured by usePullRevealFooter — so the footer's own height
 * cancels out of the safety math and the invariant collapses to a
 * screen-size- and font-scale-independent relationship between two tokens.
 *
 * The geometry (all offsets measured up from the scroll view's bottom edge):
 *
 *   footer box   [P, P + H]        P = listContent.paddingBottom, H = footerHeight
 *   footer text  starts at P + H - space.s5   (FundingFooter's own paddingTop)
 *   FAB          [H + space.s4, H + space.s4 + 56]
 *
 * The FAB's bottom edge intrudes into the footer's button row exactly when
 *
 *   H + space.s4  <  P + H - space.s5     ⟺     P > space.s4 + space.s5
 *
 * — note H cancels, so this holds for any footer content on any device.
 *
 * This file previously guarded a DIFFERENT, app-local idiom: a FAB pinned at a
 * fixed `bottom: space.s8` with a large `paddingBottom: space.s9` holding the
 * footer clear of it. That cleared the footer in practice, but only because of
 * the footer's actual rendered height — it could not be proven from tokens
 * alone, and it meant two idioms in the fleet for one rule. Ticket
 * hm-fab-adopt-dynamic-lift moved both screens onto the canonical lift; the
 * padding had to shrink to space.s5 in the same change, because under the lift
 * a larger padding raises the footer WITHOUT raising the FAB (the first test
 * below goes red at the old space.s9 — that is this file's failing-first proof).
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
// Both screens pull in FundingFooter + usePullRevealFooter (reanimated/worklets,
// no working jest mock wired for this SDK combo in this repo) and TipJarSheet
// (IAP) and the tasks store's reminder scheduling (expo-notifications)
// transitively — this test only needs the plain makeStyles function each screen
// exports, so stand in inert components/no-ops for the module trees this test
// never exercises rather than dragging their native deps through jest.
jest.mock('../../components/FundingFooter', () => ({ FundingFooter: () => null }));
jest.mock('../../components/usePullRevealFooter', () => ({
  usePullRevealFooter: () => ({ footerHeight: 0 }),
}));
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

// The screens' makeStyles only read colour values, so a bare stand-in is enough.
const stubColors = new Proxy({}, { get: () => '#000000' }) as unknown as Colors;

/** StyleSheet.create returns opaque ids on some RN versions; flatten defensively. */
function flatten(style: unknown): Record<string, unknown> {
  const { StyleSheet } = require('react-native');
  return (StyleSheet.flatten(style) || {}) as Record<string, unknown>;
}

describe.each([
  ['Appliances', makeAppliancesStyles],
  ['Tasks', makeTasksStyles],
])('%s screen — FAB clearance over the funding footer', (_name, makeStyles) => {
  it('keeps the list bottom padding under the FAB lift, so the FAB clears the footer buttons', () => {
    const s = makeStyles(stubColors);
    const paddingBottom = flatten(s.listContent).paddingBottom as number;

    expect(typeof paddingBottom).toBe('number');
    expect(paddingBottom).toBeLessThanOrEqual(space.s4 + space.s5);
  });

  it('still leaves the footer breathing room off the screen edge', () => {
    const s = makeStyles(stubColors);
    const paddingBottom = flatten(s.listContent).paddingBottom as number;

    expect(paddingBottom).toBeGreaterThan(0);
  });
});
