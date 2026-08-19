/**
 * Component test — the starter library's two top-of-screen actions (Uplevel-3
 * T3 action coverage): "New custom task" and the search field.
 *
 * Both exist so the first minute never dead-ends. The custom row rides ABOVE
 * the list on purpose — a home with an unusual task must not have to scroll a
 * catalog that will never contain it — and it `replace`s rather than pushes, so
 * Back from the editor returns to where the user actually came from instead of
 * a picker they already left.
 *
 * Search is asserted through what the list shows, not through internal state:
 * a query narrows the catalog, and a query that matches nothing says so rather
 * than rendering an unexplained blank.
 */

import React from 'react';
import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
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
jest.mock('../../lib/reminderAdapter', () => ({
  syncAppReminders: jest.fn(),
  optInToReminders: jest.fn(() => Promise.resolve(true)),
}));

import LibraryPickerScreen from '../LibraryPickerScreen';
import { useTasksStore } from '../../store/tasks';
import { useAppliancesStore } from '../../store/appliances';
import { LIBRARY } from '../../data/library';

const navigation = { navigate: jest.fn(), goBack: jest.fn(), replace: jest.fn() };

function renderPicker() {
  return render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <LibraryPickerScreen
        /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
        navigation={navigation as any}
        /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
        route={{ key: 'LibraryPicker', name: 'LibraryPicker' } as any}
      />
    </SafeAreaProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  useTasksStore.setState({ tasks: [], completions: [] });
  useAppliancesStore.setState({ appliances: [] });
});

describe('LibraryPickerScreen', () => {
  it('opens a blank editor from New custom task, replacing the picker', async () => {
    const user = userEvent.setup({ delay: 0 });
    await renderPicker();

    await user.press(screen.getByRole('button', { name: 'New custom task' }));

    // `replace`, not `navigate`: Back from the editor should land where the
    // user entered from, not back on a picker they have finished with.
    expect(navigation.replace).toHaveBeenCalledWith('TaskEdit', {});
    expect(navigation.navigate).not.toHaveBeenCalled();
  });

  it('narrows the catalog to what the search matches', async () => {
    const target = LIBRARY.find((item) => /gutter/i.test(item.name));
    expect(target).toBeDefined();
    const other = LIBRARY.find((item) => !/gutter/i.test(item.name));
    const user = userEvent.setup({ delay: 0 });
    await renderPicker();

    expect(screen.getByLabelText(other!.name)).toBeTruthy();

    await user.type(screen.getByLabelText('Search tasks'), 'gutter');

    await waitFor(() => expect(screen.queryByLabelText(other!.name)).toBeNull());
    expect(screen.getByLabelText(target!.name)).toBeTruthy();
  });

  it('says so when the search matches nothing, rather than going blank', async () => {
    const user = userEvent.setup({ delay: 0 });
    await renderPicker();

    await user.type(screen.getByLabelText('Search tasks'), 'zzzznotathing');

    // An unexplained empty list reads as a broken screen.
    await waitFor(() => expect(screen.getByText('No tasks match your search.')).toBeTruthy());
  });

  it('ticks a catalog row and only offers the Add bar once something is picked', async () => {
    const item = LIBRARY[0];
    const user = userEvent.setup({ delay: 0 });
    await renderPicker();

    // Nothing picked yet — an Add bar over an empty selection is a dead button.
    expect(screen.queryByRole('button', { name: /^Add / })).toBeNull();

    await user.press(screen.getByLabelText(item.name));

    expect(screen.getByLabelText(item.name).props.accessibilityState).toMatchObject({
      checked: true,
    });
    expect(screen.getByRole('button', { name: 'Add 1' })).toBeTruthy();
  });

  it('adds exactly the ticked tasks and hands them to setup', async () => {
    const [first, second] = LIBRARY;
    const user = userEvent.setup({ delay: 0 });
    await renderPicker();

    await user.press(screen.getByLabelText(first.name));
    await user.press(screen.getByLabelText(second.name));
    await user.press(screen.getByRole('button', { name: 'Add 2' }));

    const added = useTasksStore.getState().tasks.filter((task) => task.deletedAt == null);
    expect(added.map((task) => task.name).sort()).toEqual([first.name, second.name].sort());
    // Setup is where an interval and a real last-done date get set; dropping the
    // ids here would strand the new tasks on library defaults.
    expect(navigation.replace).toHaveBeenCalledWith('TaskSetup', {
      taskIds: expect.arrayContaining(added.map((task) => task.id)),
    });
  });

  it('will not add a task the home already has', async () => {
    const item = LIBRARY[0];
    useTasksStore.getState().addTask({
      name: item.name,
      category: item.category,
      intervalDays: item.intervalDays,
      libraryId: item.id,
    });
    await renderPicker();

    // An already-added row stays visible so the catalog reads the same every
    // time, but it must not be tickable into a duplicate.
    expect(screen.getByLabelText(item.name).props.accessibilityState).toMatchObject({
      checked: true,
      disabled: true,
    });
  });
});
