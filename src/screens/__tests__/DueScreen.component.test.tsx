/**
 * Component test — the landing tab's two authored actions (Uplevel-3 T3 action
 * coverage): the first-run "Add common tasks" call to action, and Undo on the
 * bar that appears after a task is marked done.
 *
 * Undo is the one that has to be real rather than cosmetic: marking a task done
 * rolls its whole schedule forward, so an Undo that only hides the bar would
 * leave the user's calendar quietly wrong. The tasks store is real (only its
 * SQLite layer is stubbed), so the test asserts the completion is actually gone
 * afterwards, not merely that the bar disappeared.
 *
 * The first-run CTA is canon § First-run moment's only way out of an empty
 * schedule — a dead one strands a brand-new install on a blank screen.
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
// The wordmark's pull-to-reveal animation is reanimated-backed; its worklets
// runtime is native and has nothing to say about which control was pressed.
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: { View },
    useAnimatedStyle: (fn: () => unknown) => fn(),
    interpolate: (v: number, inRange: number[], outRange: number[]) =>
      outRange[0] + (v - inRange[0]) * (outRange[1] - outRange[0]),
  };
});
jest.mock('../../feedback/FeedbackProvider', () => ({ useFeedback: () => ({ open: jest.fn() }) }));

import DueScreen from '../DueScreen';
import { useTasksStore } from '../../store/tasks';

const navigation = { navigate: jest.fn(), goBack: jest.fn() };

function renderDue() {
  return render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <DueScreen
        /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
        navigation={navigation as any}
        /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
        route={{ key: 'Due', name: 'Due' } as any}
      />
    </SafeAreaProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  useTasksStore.setState({ tasks: [], completions: [] });
});

describe('DueScreen', () => {
  it('sends a brand-new install to the starter library from the empty state', async () => {
    const user = userEvent.setup({ delay: 0 });
    await renderDue();

    await user.press(screen.getByRole('button', { name: 'Add common tasks' }));

    expect(navigation.navigate).toHaveBeenCalledWith('LibraryPicker');
  });

  it('offers no first-run call to action once there is a schedule', async () => {
    useTasksStore.getState().addTask({ name: 'Clean gutters', category: 'exterior', intervalDays: 180 });
    await renderDue();

    // The CTA belongs to the empty state only; leaving it up would be a second
    // add affordance competing with the Tasks tab's own.
    expect(screen.queryByRole('button', { name: 'Add common tasks' })).toBeNull();
  });

  it('undoes a completion for real, not just the bar', async () => {
    const id = useTasksStore
      .getState()
      .addTask({ name: 'Clean gutters', category: 'exterior', intervalDays: 180 });
    const user = userEvent.setup({ delay: 0 });
    await renderDue();

    await user.press(screen.getByRole('button', { name: 'Done: Clean gutters' }));

    expect(useTasksStore.getState().completions).toHaveLength(1);
    const undo = await screen.findByRole('button', { name: 'Undo' });

    await user.press(undo);

    // The schedule has to come back with it — a hidden bar over a rolled-
    // forward due date is the failure this guards.
    await waitFor(() =>
      expect(useTasksStore.getState().completions.filter((c) => c.taskId === id && !c.deletedAt))
        .toHaveLength(0)
    );
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
  });

  it('marks a task done from its own circle, and only that task', async () => {
    const store = useTasksStore.getState();
    const gutters = store.addTask({ name: 'Clean gutters', category: 'exterior', intervalDays: 180 });
    store.addTask({ name: 'Flush water heater', category: 'plumbing', intervalDays: 365 });
    const user = userEvent.setup({ delay: 0 });
    await renderDue();

    await user.press(screen.getByRole('button', { name: 'Done: Clean gutters' }));

    // Every row draws the same circle, so the row's own task id has to reach
    // the handler — a shared-closure slip would tick the neighbour instead.
    const live = useTasksStore.getState().completions.filter((c) => !c.deletedAt);
    expect(live).toHaveLength(1);
    expect(live[0].taskId).toBe(gutters);
  });

  it('opens the task a row names rather than completing it', async () => {
    const id = useTasksStore
      .getState()
      .addTask({ name: 'Clean gutters', category: 'exterior', intervalDays: 180 });
    const user = userEvent.setup({ delay: 0 });
    await renderDue();

    await user.press(screen.getByRole('button', { name: 'Clean gutters' }));

    expect(navigation.navigate).toHaveBeenCalledWith('TaskEdit', { taskId: id });
    // The circle and the row body sit side by side; reading the details must
    // never be recorded as having done the work.
    expect(useTasksStore.getState().completions).toHaveLength(0);
  });
});
