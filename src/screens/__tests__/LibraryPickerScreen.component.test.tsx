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
});
