/**
 * Component test — the last-done spoke's four controls (Uplevel-3 T3 action
 * coverage): Save, the quick-pick chips, and the two day steppers.
 *
 * This sheet decides when a task was LAST serviced, and everything downstream
 * hangs off that one number — the next-due date, whether the task shows as
 * overdue, whether a reminder fires. So the assertions are on the timestamp the
 * sheet hands back, never on which chip looks filled.
 *
 * The sheet is a draft: chips and steppers move a working value, and NOTHING
 * commits until Save. That is the property worth pinning — an accidental tap on
 * "1 year ago" while reaching for the stepper must be recoverable by backing
 * out, and a stepper press must not silently rewrite the schedule on its own.
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
// findNodeHandle is a no-op under the test renderer; the pane's focus move has
// its own test (DrilldownSheet.component.test.tsx) and nothing to say here.
jest.mock('react-native/Libraries/ReactNative/RendererProxy', () => ({
  ...jest.requireActual('react-native/Libraries/ReactNative/RendererProxy'),
  findNodeHandle: jest.fn(() => 42),
}));

import { LastDoneSheet } from '../LastDoneSheet';
import { DAY, startOfDay } from '../../data/task';

function todayNoon(): number {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  return d.getTime();
}

async function renderSheet(over: Partial<React.ComponentProps<typeof LastDoneSheet>> = {}) {
  const onPick = jest.fn();
  const onClose = jest.fn();
  const view = await render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <LastDoneSheet
        visible
        value={null}
        intervalDays={90}
        allowNotDoneYet={false}
        onClose={onClose}
        onPick={onPick}
        {...over}
      />
    </SafeAreaProvider>
  );
  return { view, onPick, onClose };
}

describe('LastDoneSheet', () => {
  it('confirms today when Save is pressed with nothing changed', async () => {
    const user = userEvent.setup({ delay: 0 });
    const { onPick, onClose } = await renderSheet();

    await user.press(screen.getByRole('button', { name: 'Save' }));

    expect(onPick).toHaveBeenCalledTimes(1);
    expect(startOfDay(onPick.mock.calls[0][0])).toBe(startOfDay(todayNoon()));
    // Saving is also the way out — a sheet that commits but stays open invites
    // a second, duplicate save.
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('commits the date a quick pick chose, not the one it opened on', async () => {
    const user = userEvent.setup({ delay: 0 });
    const { onPick } = await renderSheet();

    await user.press(screen.getByRole('button', { name: '2 weeks ago' }));
    await user.press(screen.getByRole('button', { name: 'Save' }));

    expect(startOfDay(onPick.mock.calls[0][0])).toBe(startOfDay(todayNoon() - 14 * DAY));
  });

  it('holds a quick pick as a draft — nothing commits until Save', async () => {
    const user = userEvent.setup({ delay: 0 });
    const { onPick, onClose } = await renderSheet();

    await user.press(screen.getByRole('button', { name: '1 year ago' }));

    // A mis-tap on the chip grid must be walkable-back, so the chip itself
    // records nothing.
    expect(onPick).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('steps the working date back a day, and only by a day', async () => {
    const user = userEvent.setup({ delay: 0 });
    const { onPick } = await renderSheet();

    await user.press(screen.getByRole('button', { name: 'One day earlier' }));
    await user.press(screen.getByRole('button', { name: 'Save' }));

    expect(startOfDay(onPick.mock.calls[0][0])).toBe(startOfDay(todayNoon() - DAY));
  });

  it('steps forward a day, and refuses to walk past today', async () => {
    const user = userEvent.setup({ delay: 0 });
    const { onPick } = await renderSheet();

    await user.press(screen.getByRole('button', { name: 'One day earlier' }));
    await user.press(screen.getByRole('button', { name: 'One day later' }));
    // Already back at today — a service date in the future would make the task
    // read as not-yet-due for an interval it never waited.
    await user.press(screen.getByRole('button', { name: 'One day later' }));
    await user.press(screen.getByRole('button', { name: 'Save' }));

    expect(startOfDay(onPick.mock.calls[0][0])).toBe(startOfDay(todayNoon()));
  });
});
