/**
 * Component test — the task editor's three hub actions (Uplevel-3 T3 action
 * coverage): Save, the reminder switch, and Delete.
 *
 * The reminder switch is the app's ONLY notification-permission ask, so it
 * gets the most attention: turning it on must go through the adapter (which
 * computes the plan BEFORE raising the OS dialog — canon § Notifications), and
 * a refused permission must snap the switch back off rather than leaving the
 * user looking at a promise the OS will not keep. Turning it OFF must never ask
 * for anything.
 *
 * The tasks store is real with only its SQLite layer stubbed, so Save and
 * Delete are asserted against the records the store actually holds.
 */

import React from 'react';
import { act, fireEvent, render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
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

// The adapter fronts expo-notifications. Mocking it (never the screen) is what
// lets the test say whether the ask happened and what the switch did about the
// answer.
const mockOptIn = jest.fn((_draft: Record<string, unknown>) => Promise.resolve(true));
jest.mock('../../lib/reminderAdapter', () => ({
  syncAppReminders: jest.fn(),
  optInToReminders: (draft: Record<string, unknown>) => mockOptIn(draft),
}));

import TaskEditScreen from '../TaskEditScreen';
import { useTasksStore } from '../../store/tasks';

const navigation = { navigate: jest.fn(), goBack: jest.fn() };

function renderEditor(params: { taskId?: string; applianceId?: string } = {}) {
  return render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <TaskEditScreen
        /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
        navigation={navigation as any}
        /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
        route={{ key: 'TaskEdit', name: 'TaskEdit', params } as any}
      />
    </SafeAreaProvider>
  );
}

function seedTask(fields: Partial<Parameters<ReturnType<typeof useTasksStore.getState>['addTask']>[0]> = {}) {
  return useTasksStore
    .getState()
    .addTask({ name: 'Flush water heater', category: 'plumbing', intervalDays: 365, ...fields });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockOptIn.mockResolvedValue(true);
  useTasksStore.setState({ tasks: [], completions: [] });
});

describe('TaskEditScreen', () => {
  it('saves a new task into the store and returns', async () => {
    const user = userEvent.setup({ delay: 0 });
    await renderEditor();

    await user.type(screen.getByLabelText('Name'), 'Clean gutters');
    await user.press(screen.getByRole('button', { name: 'Save' }));

    const tasks = useTasksStore.getState().tasks;
    expect(tasks).toHaveLength(1);
    expect(tasks[0].name).toBe('Clean gutters');
    expect(navigation.goBack).toHaveBeenCalledTimes(1);
  });

  it('saves edits onto the existing task rather than adding a second one', async () => {
    const taskId = seedTask();
    const user = userEvent.setup({ delay: 0 });
    await renderEditor({ taskId });

    await user.type(screen.getByLabelText('Note (optional)'), 'Basement, north wall');
    await user.press(screen.getByRole('button', { name: 'Save' }));

    const tasks = useTasksStore.getState().tasks;
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({ id: taskId, note: 'Basement, north wall' });
  });

  it('will not save a task with no name', async () => {
    const user = userEvent.setup({ delay: 0 });
    await renderEditor();

    await user.press(screen.getByRole('button', { name: 'Save' }));

    expect(useTasksStore.getState().tasks).toHaveLength(0);
    expect(navigation.goBack).not.toHaveBeenCalled();
  });

  it('asks for notification permission when the reminder is switched on', async () => {
    const taskId = seedTask();
    await renderEditor({ taskId });

    // Switch is driven by its valueChange event, not a press — and the handler
    // is async (it awaits the permission answer), so act() flushes it.
    await act(async () => {
      fireEvent(screen.getByRole('switch', { name: 'Reminder' }), 'valueChange', true);
    });

    expect(mockOptIn).toHaveBeenCalledTimes(1);
    // The plan is handed to the adapter, which is what lets it decide whether
    // an ask is even warranted before raising the OS dialog.
    expect(mockOptIn.mock.calls[0][0]).toMatchObject({ intervalDays: 365 });
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Reminder' }).props.value).toBe(true));
  });

  it('snaps the reminder back off when permission is refused', async () => {
    mockOptIn.mockResolvedValue(false);
    const taskId = seedTask();
    await renderEditor({ taskId });

    // Switch is driven by its valueChange event, not a press — and the handler
    // is async (it awaits the permission answer), so act() flushes it.
    await act(async () => {
      fireEvent(screen.getByRole('switch', { name: 'Reminder' }), 'valueChange', true);
    });

    // Leaving it on would show a reminder the OS will never deliver.
    await waitFor(() =>
      expect(screen.getByRole('switch', { name: 'Reminder' }).props.value).toBe(false)
    );
  });

  it('never raises the permission dialog when the reminder is switched off', async () => {
    const taskId = seedTask({ reminder: true });
    await renderEditor({ taskId });

    await act(async () => {
      fireEvent(screen.getByRole('switch', { name: 'Reminder' }), 'valueChange', false);
    });

    expect(mockOptIn).not.toHaveBeenCalled();
  });

  it('deletes the task only after the confirm', async () => {
    const taskId = seedTask();
    let confirm: (() => void) | undefined;
    jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      confirm = buttons?.find((b) => b.style === 'destructive')?.onPress as () => void;
    });
    const user = userEvent.setup({ delay: 0 });
    await renderEditor({ taskId });

    await user.press(screen.getByRole('button', { name: 'Delete task' }));

    // A mis-tap on a destructive control must cost nothing.
    expect(useTasksStore.getState().tasks).toHaveLength(1);
    expect(confirm).toBeDefined();

    await act(async () => confirm!());

    await waitFor(() => expect(useTasksStore.getState().tasks).toHaveLength(0));
    expect(navigation.goBack).toHaveBeenCalled();
  });

  it('offers no Delete at all while the task is still being created', async () => {
    await renderEditor();

    // Nothing exists yet, so a delete control would be a dead end.
    expect(screen.queryByRole('button', { name: 'Delete task' })).toBeNull();
  });
});
