/**
 * Component test — DrilldownSheet screen-reader behavior (regression for
 * defect home-maintenance-20260719-1: opening the Timing pane left VoiceOver
 * focused on an arbitrary mid-pane element, a "Stop after" chip). A custom
 * pane gets none of a native Modal's focus handling, so it must (a) mark
 * itself accessibilityViewIsModal and (b) MOVE screen-reader focus to its
 * title once the slide-in settles. Companion lint: qa-canonical
 * a11y/pane-focus.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import { Text, AccessibilityInfo } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

jest.mock('expo-font', () => ({
  useFonts: () => [true, null],
  isLoaded: () => true,
  loadAsync: () => Promise.resolve(),
}));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
// findNodeHandle is a no-op under the test renderer; give it a stable tag so
// the focus path is exercised end-to-end.
jest.mock('react-native/Libraries/ReactNative/RendererProxy', () => ({
  ...jest.requireActual('react-native/Libraries/ReactNative/RendererProxy'),
  findNodeHandle: jest.fn(() => 42),
}));

import { DrilldownSheet } from '../DrilldownSheet';

jest.useFakeTimers();

afterEach(() => {
  jest.clearAllTimers();
  jest.clearAllMocks();
  jest.restoreAllMocks();
});

// The pane is absolutely positioned, so it applies its OWN safe-area insets
// (a parent SafeAreaView's padding never reaches it) — which means it needs a
// provider above it, exactly as the real app root supplies one.
const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 59, left: 0, right: 0, bottom: 34 },
};

function renderPane(visible: boolean) {
  return render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <DrilldownSheet visible={visible} title="Timing" onClose={() => {}}>
        <Text>pane content</Text>
      </DrilldownSheet>
    </SafeAreaProvider>
  );
}

async function advance(ms: number) {
  await new Promise((r) => {
    jest.advanceTimersByTime(ms);
    r(null);
  });
}

it('moves screen-reader focus to the pane title once the slide-in settles', async () => {
  const focus = jest.spyOn(AccessibilityInfo, 'setAccessibilityFocus').mockImplementation(() => {});
  await renderPane(true);
  expect(focus).not.toHaveBeenCalled(); // not before the pane has settled
  await advance(400);
  await waitFor(() => expect(focus).toHaveBeenCalledWith(42));
  expect(focus).toHaveBeenCalledTimes(1);
});

it('does not steal screen-reader focus while closed', async () => {
  const focus = jest.spyOn(AccessibilityInfo, 'setAccessibilityFocus').mockImplementation(() => {});
  await renderPane(false);
  await advance(400);
  expect(focus).not.toHaveBeenCalled();
});

it('contains screen readers (accessibilityViewIsModal) and titles itself as a header', async () => {
  jest.spyOn(AccessibilityInfo, 'setAccessibilityFocus').mockImplementation(() => {});
  await renderPane(true);
  const title = screen.getByRole('header', { name: 'Timing' });
  expect(title).toBeTruthy();
  expect(JSON.stringify(screen.toJSON())).toContain('"accessibilityViewIsModal":true');
});
