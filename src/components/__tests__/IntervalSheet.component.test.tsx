/**
 * Component test — the repeat-interval spoke's Save (Uplevel-3 T3 action
 * coverage).
 *
 * The count and the unit only mean anything together, so Save is the whole
 * control: it multiplies them into a day count and hands that back. The unit
 * chips are the canonical OptionChips (pinned by DrilldownKit's own test); what
 * this file owns is that Save reports the PRODUCT and that it cannot fire on an
 * unusable count.
 *
 * A blank or zero count reaching the store would be a task with no schedule at
 * all — permanently due or permanently silent — so the disabled state is
 * asserted as behaviour (no callback), not as styling.
 */

import React from 'react';
import { render, screen, userEvent } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

jest.mock('expo-font', () => ({
  useFonts: () => [true, null],
  isLoaded: () => true,
  loadAsync: () => Promise.resolve(),
}));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('react-native/Libraries/ReactNative/RendererProxy', () => ({
  ...jest.requireActual('react-native/Libraries/ReactNative/RendererProxy'),
  findNodeHandle: jest.fn(() => 42),
}));

import { IntervalSheet } from '../IntervalSheet';

async function renderSheet(value = 90) {
  const onPick = jest.fn();
  const onClose = jest.fn();
  const view = await render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <IntervalSheet visible value={value} onClose={onClose} onPick={onPick} />
    </SafeAreaProvider>
  );
  return { view, onPick, onClose };
}

describe('IntervalSheet', () => {
  it('confirms the interval it opened with when Save is pressed', async () => {
    const user = userEvent.setup({ delay: 0 });
    const { onPick, onClose } = await renderSheet(90);

    await user.press(screen.getByRole('button', { name: 'Save' }));

    // 90 days decomposes to "every 3 months" and must round-trip unchanged —
    // merely opening a spoke may not alter the schedule.
    expect(onPick).toHaveBeenCalledWith(90);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('saves count times unit, not the count on its own', async () => {
    const user = userEvent.setup({ delay: 0 });
    const { onPick } = await renderSheet(90);

    await user.clear(screen.getByLabelText('Repeat every'));
    await user.type(screen.getByLabelText('Repeat every'), '2');
    await user.press(screen.getByRole('button', { name: 'years' }));
    await user.press(screen.getByRole('button', { name: 'Save' }));

    expect(onPick).toHaveBeenCalledWith(730);
  });

  it('will not save a blank count', async () => {
    const user = userEvent.setup({ delay: 0 });
    const { onPick, onClose } = await renderSheet(90);

    await user.clear(screen.getByLabelText('Repeat every'));
    await user.press(screen.getByRole('button', { name: 'Save' }));

    // A task with no interval has no schedule; the sheet has to hold the user
    // here rather than write one.
    expect(onPick).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
