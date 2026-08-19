/**
 * Component test — the drilldown kit's three controls (Uplevel-3 T3 action
 * coverage).
 *
 * These are the canonical, app-agnostic pieces (`sync.mjs drilldown`) that every
 * hub screen is built out of, so a break here is a break in every spoke at once:
 *   • DrilldownRow — the hub row that opens a dimension's editor.
 *   • OptionChips  — the short single-select, applied on tap.
 *   • SheetOption  — the long-list row inside a spoke.
 * All three carry their state through `accessibilityState.selected` or the
 * composed label rather than colour alone, so the assertions cover the
 * greyscale-user path as well as the press.
 *
 * They are pure controlled components: the callback IS the outcome.
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

import { DrilldownRow } from '../DrilldownRow';
import { OptionChips } from '../OptionChips';
import { SheetOption } from '../DrilldownSheet';

function wrap(ui: React.ReactElement) {
  return <SafeAreaProvider initialMetrics={METRICS}>{ui}</SafeAreaProvider>;
}

describe('DrilldownRow', () => {
  it('opens its editor when pressed, and names itself label-plus-value', async () => {
    const onPress = jest.fn();
    const user = userEvent.setup({ delay: 0 });
    await render(
      wrap(<DrilldownRow label="Remind me" value="Every 3 months" onPress={onPress} />)
    );

    // The row's whole job is to say what the setting currently IS, so the value
    // has to reach a screen-reader user through the name, not just the sighted
    // right-hand column.
    await user.press(screen.getByRole('button', { name: 'Remind me: Every 3 months' }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('OptionChips', () => {
  const options = [
    { key: 'quarterly', label: 'Every 3 months' },
    { key: 'yearly', label: 'Every year' },
  ];

  it('picks the chip that was pressed', async () => {
    const onPick = jest.fn();
    const user = userEvent.setup({ delay: 0 });
    await render(wrap(<OptionChips options={options} selectedKey="quarterly" onPick={onPick} />));

    await user.press(screen.getByRole('button', { name: 'Every year' }));

    expect(onPick).toHaveBeenCalledWith('yearly');
  });

  it('announces the selected chip rather than only filling it', async () => {
    await render(wrap(<OptionChips options={options} selectedKey="quarterly" onPick={jest.fn()} />));

    expect(screen.getByRole('button', { name: 'Every 3 months' }).props.accessibilityState).toMatchObject({
      selected: true,
    });
    expect(screen.getByRole('button', { name: 'Every year' }).props.accessibilityState).toMatchObject({
      selected: false,
    });
  });
});

describe('SheetOption', () => {
  it('reports the option that was pressed', async () => {
    const onPress = jest.fn();
    const user = userEvent.setup({ delay: 0 });
    await render(
      wrap(<SheetOption label="Every two weeks" selected={false} onPress={onPress} />)
    );

    await user.press(screen.getByRole('button', { name: 'Every two weeks' }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('keeps the detail line out of its speakable name', async () => {
    await render(
      wrap(
        <SheetOption
          label="Every two weeks"
          detail="Roughly twice a month"
          selected
          onPress={jest.fn()}
        />
      )
    );

    // Voice Control matches the accessible NAME; folding the detail line into it
    // would make the visible label unspeakable.
    const option = screen.getByRole('button', { name: 'Every two weeks' });
    expect(option.props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByText('Roughly twice a month')).toBeTruthy();
  });
});
