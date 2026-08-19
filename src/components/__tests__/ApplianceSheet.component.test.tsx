/**
 * Component test — the appliance-link sheet (Uplevel-3 T3 action coverage).
 *
 * The sheet's two authored controls are the "New appliance" field and the +
 * that creates from it. Creating is the interesting one: it must both add the
 * appliance to the registry AND link the task to the appliance it just made —
 * a create that leaves the task unlinked reads to a user as "nothing happened".
 * So the test drives the REAL appliances store (only its SQLite layer is
 * stubbed) and asserts the id handed to onPick is the id the registry now holds.
 *
 * The + is also gated on a non-blank name, because a nameless appliance is
 * unfindable forever after; that guard is asserted rather than assumed.
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
// The store is real; only its durable half is stubbed — SQLite is a native
// module and has nothing to say about which appliance got linked.
jest.mock('../../store/db', () => ({
  loadAllAppliances: () => Promise.resolve([]),
  saveAppliance: () => Promise.resolve(),
  hardDelete: () => Promise.resolve(),
}));
jest.mock('../../storage/kv', () => ({ putTombstone: () => Promise.resolve() }));

import { ApplianceSheet } from '../ApplianceSheet';
import { useAppliancesStore } from '../../store/appliances';

function renderSheet(props: Partial<React.ComponentProps<typeof ApplianceSheet>> = {}) {
  const onPick = jest.fn();
  const onClose = jest.fn();
  return {
    onPick,
    onClose,
    result: render(
      <SafeAreaProvider initialMetrics={METRICS}>
        <ApplianceSheet visible value={undefined} onPick={onPick} onClose={onClose} {...props} />
      </SafeAreaProvider>
    ),
  };
}

beforeEach(() => {
  useAppliancesStore.setState({ appliances: [] });
});

describe('ApplianceSheet', () => {
  it('creates the appliance and links the task to the one it just made', async () => {
    const user = userEvent.setup({ delay: 0 });
    const { onPick, result } = renderSheet();
    await result;

    await user.type(screen.getByLabelText('New appliance'), 'Dishwasher');
    await user.press(screen.getByRole('button', { name: 'Add appliance' }));

    const registry = useAppliancesStore.getState().appliances;
    expect(registry.map((a) => a.name)).toEqual(['Dishwasher']);
    // The link is the half that silently goes missing: the sheet must hand back
    // the id of the appliance it created, not undefined.
    expect(onPick).toHaveBeenCalledWith(registry[0].id);
  });

  it('will not create a nameless appliance', async () => {
    const user = userEvent.setup({ delay: 0 });
    const { onPick, result } = renderSheet();
    await result;

    // Whitespace only — a name that would leave the row blank in the registry.
    await user.type(screen.getByLabelText('New appliance'), '   ');
    await user.press(screen.getByRole('button', { name: 'Add appliance' }));

    expect(useAppliancesStore.getState().appliances).toHaveLength(0);
    expect(onPick).not.toHaveBeenCalled();
  });

  it('pre-fills the new-appliance field from a library hint', async () => {
    const { result } = renderSheet({ suggestedName: 'Furnace' });
    await result;

    // One tap to link, rather than retyping what the library already knew.
    expect(screen.getByLabelText('New appliance').props.value).toBe('Furnace');
  });
});
