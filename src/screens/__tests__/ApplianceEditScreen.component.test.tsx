/**
 * Component test — the appliance editor's four actions (Uplevel-3 T3 action
 * coverage): Save, Find manual, Add a task for this appliance, and Delete.
 *
 * Both stores are real with only their SQLite layer stubbed, so Save is
 * asserted against the record the registry actually holds and Delete against
 * what survives it. Delete is the one that matters most: the screen promises
 * "linked tasks stay, but lose their link to it", and a store that cascaded
 * would quietly destroy maintenance history — so the test reads the linked
 * task back after the delete rather than trusting the copy.
 *
 * Find manual opens a constructed manufacturer search in the system browser;
 * the assertion is the URL, because "a browser opened" is not the promise —
 * "the browser opened a search for THIS appliance" is.
 */

import React from 'react';
import { act, render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { Alert, Linking } from 'react-native';
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
jest.mock('../../store/db', () => ({
  loadAllTasks: () => Promise.resolve([]),
  loadAllCompletions: () => Promise.resolve([]),
  loadAllAppliances: () => Promise.resolve([]),
  saveTask: () => Promise.resolve(),
  saveCompletion: () => Promise.resolve(),
  saveAppliance: () => Promise.resolve(),
  hardDelete: () => Promise.resolve(),
}));
jest.mock('../../storage/kv', () => ({ putTombstone: () => Promise.resolve() }));
// Reminder scheduling is expo-notifications behind a thin adapter; nothing on
// this screen is about notifications.
jest.mock('../../lib/reminderAdapter', () => ({
  syncAppReminders: jest.fn(),
  optInToReminders: jest.fn(() => Promise.resolve(true)),
}));

import ApplianceEditScreen from '../ApplianceEditScreen';
import { useAppliancesStore } from '../../store/appliances';
import { useTasksStore } from '../../store/tasks';

const navigation = { navigate: jest.fn(), goBack: jest.fn() };

function renderEditor(params: { applianceId?: string } = {}) {
  return render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <ApplianceEditScreen
        /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
        navigation={navigation as any}
        /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
        route={{ key: 'ApplianceEdit', name: 'ApplianceEdit', params } as any}
      />
    </SafeAreaProvider>
  );
}

/** Seed one appliance with a task linked to it, and hand both ids back. */
function seedLinkedPair() {
  const applianceId = useAppliancesStore
    .getState()
    .addAppliance({ name: 'Furnace', brand: 'Carrier', model: '59SC5A' });
  const taskId = useTasksStore
    .getState()
    .addTask({ name: 'Replace furnace filter', category: 'hvac', intervalDays: 90, applianceId });
  return { applianceId, taskId };
}

beforeEach(() => {
  jest.clearAllMocks();
  useAppliancesStore.setState({ appliances: [] });
  useTasksStore.setState({ tasks: [], completions: [] });
});

describe('ApplianceEditScreen', () => {
  it('saves a new appliance into the registry and returns', async () => {
    const user = userEvent.setup({ delay: 0 });
    await renderEditor();

    await user.type(screen.getByLabelText('Name'), 'Water heater');
    await user.type(screen.getByLabelText('Brand'), 'Rheem');
    await user.press(screen.getByRole('button', { name: 'Save' }));

    const saved = useAppliancesStore.getState().appliances;
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ name: 'Water heater', brand: 'Rheem' });
    expect(navigation.goBack).toHaveBeenCalledTimes(1);
  });

  it('saves edits onto the existing appliance rather than adding a second one', async () => {
    const { applianceId } = seedLinkedPair();
    const user = userEvent.setup({ delay: 0 });
    await renderEditor({ applianceId });

    await user.clear(screen.getByLabelText('Model'));
    await user.type(screen.getByLabelText('Model'), '58MVC');
    await user.press(screen.getByRole('button', { name: 'Save' }));

    const saved = useAppliancesStore.getState().appliances;
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ id: applianceId, name: 'Furnace', model: '58MVC' });
  });

  it('will not save an appliance with no name', async () => {
    const user = userEvent.setup({ delay: 0 });
    await renderEditor();

    await user.press(screen.getByRole('button', { name: 'Save' }));

    expect(useAppliancesStore.getState().appliances).toHaveLength(0);
    expect(navigation.goBack).not.toHaveBeenCalled();
  });

  it('opens a manufacturer search for this appliance from Find manual', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined as never);
    const { applianceId } = seedLinkedPair();
    const user = userEvent.setup({ delay: 0 });
    await renderEditor({ applianceId });

    await user.press(screen.getByRole('button', { name: 'Find manual' }));

    expect(openURL).toHaveBeenCalledTimes(1);
    const url = openURL.mock.calls[0][0];
    // The search has to carry what identifies the unit, or it is just a web
    // search the user could have done themselves.
    expect(url).toMatch(/^https:/);
    expect(decodeURIComponent(url)).toContain('Carrier');
    expect(decodeURIComponent(url)).toContain('59SC5A');
  });

  it('starts a new task already linked to this appliance', async () => {
    const { applianceId } = seedLinkedPair();
    const user = userEvent.setup({ delay: 0 });
    await renderEditor({ applianceId });

    await user.press(screen.getByRole('button', { name: 'Add a task for this appliance' }));

    // The link is the whole point of entering from here — landing on a blank
    // editor would make the user re-pick the appliance they came from.
    expect(navigation.navigate).toHaveBeenCalledWith('TaskEdit', { applianceId });
  });

  it('opens a linked task from its row in the maintenance list', async () => {
    const { applianceId, taskId } = seedLinkedPair();
    const user = userEvent.setup({ delay: 0 });
    await renderEditor({ applianceId });

    await user.press(screen.getByRole('button', { name: 'Replace furnace filter' }));

    // This row is the only path from an appliance to the work it needs; it must
    // carry the task id, not open the blank editor the FAB below it opens.
    expect(navigation.navigate).toHaveBeenCalledWith('TaskEdit', { taskId });
  });

  it('deletes the appliance only after the confirm, and leaves linked tasks alive', async () => {
    const { applianceId, taskId } = seedLinkedPair();
    let confirm: (() => void) | undefined;
    jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      confirm = buttons?.find((b) => b.style === 'destructive')?.onPress as () => void;
    });
    const user = userEvent.setup({ delay: 0 });
    await renderEditor({ applianceId });

    await user.press(screen.getByRole('button', { name: 'Delete appliance' }));

    // Nothing is gone yet — a destructive action must survive a mis-tap.
    expect(useAppliancesStore.getState().appliances).toHaveLength(1);
    expect(confirm).toBeDefined();

    // The confirm handler is invoked by the OS dialog, outside React's event
    // loop — act() stands in for that boundary.
    await act(async () => confirm!());

    await waitFor(() => expect(useAppliancesStore.getState().appliances).toHaveLength(0));
    // The task survives and has simply lost its link — a cascade here would
    // take maintenance history with it.
    const task = useTasksStore.getState().tasks.find((t) => t.id === taskId);
    expect(task).toBeDefined();
    expect(task!.applianceId).toBeUndefined();
    expect(navigation.goBack).toHaveBeenCalled();
  });
});
