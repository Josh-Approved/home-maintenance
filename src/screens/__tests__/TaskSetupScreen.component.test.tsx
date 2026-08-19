/**
 * Component test — the post-add setup step's two authored actions (Uplevel-3 T3
 * action coverage): "Add & link" on an appliance group, and Done.
 *
 * This screen is what turns one-tap library adds into a schedule that matches a
 * real house. Its appliance section is the only place the app creates an
 * appliance FOR you, from the library hint, so the link has to reach every task
 * in the group — a partial link leaves the same appliance recorded twice under
 * two half-filled entries once the user finishes the job by hand.
 *
 * Done is the escape hatch. Everything here is optional by design, so it must
 * simply leave: a Done that validated, or that undid the work already recorded,
 * would make an optional step feel like a gate.
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

import TaskSetupScreen from '../TaskSetupScreen';
import { useTasksStore } from '../../store/tasks';
import { useAppliancesStore } from '../../store/appliances';
import { LIBRARY } from '../../data/library';

const navigation = { navigate: jest.fn(), goBack: jest.fn(), replace: jest.fn() };

/**
 * Add the library items that share one appliance hint, exactly as the picker
 * would, and hand back their ids plus the hint the screen will group them under.
 */
function seedApplianceGroup() {
  const hint = LIBRARY.find((item) => item.appliance)?.appliance as string;
  expect(hint).toBeDefined();
  const items = LIBRARY.filter((item) => item.appliance === hint);
  const taskIds = useTasksStore.getState().addFromLibrary(items);
  return { hint, taskIds, count: items.length };
}

function renderSetup(taskIds: string[]) {
  return render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <TaskSetupScreen
        /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
        navigation={navigation as any}
        /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
        route={{ key: 'TaskSetup', name: 'TaskSetup', params: { taskIds } } as any}
      />
    </SafeAreaProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  useTasksStore.setState({ tasks: [], completions: [] });
  useAppliancesStore.setState({ appliances: [] });
});

describe('TaskSetupScreen', () => {
  it('creates the appliance and links every task in the group', async () => {
    const { hint, taskIds } = seedApplianceGroup();
    const user = userEvent.setup({ delay: 0 });
    await renderSetup(taskIds);

    await user.press(screen.getByRole('button', { name: `Add & link: ${hint}` }));

    const appliances = useAppliancesStore.getState().appliances;
    expect(appliances).toHaveLength(1);
    expect(appliances[0].name).toBe(hint);
    // Every task, not just the row's own — a half-linked group is how the same
    // appliance ends up entered twice.
    const linked = useTasksStore
      .getState()
      .tasks.filter((task) => taskIds.includes(task.id));
    for (const task of linked) expect(task.applianceId).toBe(appliances[0].id);
  });

  it('reuses an appliance the home already has rather than adding a twin', async () => {
    const { hint, taskIds } = seedApplianceGroup();
    const existing = useAppliancesStore.getState().addAppliance({ name: hint.toUpperCase() });
    const user = userEvent.setup({ delay: 0 });
    await renderSetup(taskIds);

    await user.press(screen.getByRole('button', { name: `Add & link: ${hint}` }));

    // Matched case-insensitively — "Furnace" and "furnace" are one appliance,
    // and a duplicate would split its maintenance history in two.
    expect(useAppliancesStore.getState().appliances).toHaveLength(1);
    expect(
      useTasksStore.getState().tasks.find((task) => task.id === taskIds[0])!.applianceId
    ).toBe(existing);
  });

  it('offers no second link once the group is linked', async () => {
    const { hint, taskIds } = seedApplianceGroup();
    const user = userEvent.setup({ delay: 0 });
    await renderSetup(taskIds);

    await user.press(screen.getByRole('button', { name: `Add & link: ${hint}` }));

    // The button is replaced by the linked tick; leaving it up invites a second
    // press that would create nothing and look broken.
    expect(screen.queryByRole('button', { name: `Add & link: ${hint}` })).toBeNull();
  });

  it('leaves on Done without undoing what was set', async () => {
    const { hint, taskIds } = seedApplianceGroup();
    const user = userEvent.setup({ delay: 0 });
    await renderSetup(taskIds);

    await user.press(screen.getByRole('button', { name: `Add & link: ${hint}` }));
    await user.press(screen.getByRole('button', { name: 'Done' }));

    expect(navigation.goBack).toHaveBeenCalledTimes(1);
    // The whole screen is optional, so Done validates nothing and reverts
    // nothing — it just gets out of the way.
    expect(useAppliancesStore.getState().appliances).toHaveLength(1);
  });
});
