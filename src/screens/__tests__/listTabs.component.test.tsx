/**
 * Component test — the two list tabs' authored actions (Uplevel-3 T3 action
 * coverage): the add FAB (Tasks → the starter library, Appliances → a blank
 * appliance editor) and the list row that opens an existing item.
 *
 * Both tabs are covered in one file because the assertions are the same shape
 * and the setup (real stores, stubbed SQLite, stubbed pull-reveal animation) is
 * identical — one file keeps the mock preamble from being copy-pasted twice.
 *
 * Each tab must offer exactly ONE add affordance. A second one is the defect
 * this guards against: it shipped on tend's People tab (an icon-only control in
 * the header alongside the FAB), and two buttons that both add the same thing
 * make a screen-reader user pick between synonyms.
 *
 * The row taps are asserted on the id they carry, not merely on "navigate was
 * called": both tabs render every row from one renderItem, so a row that passed
 * the wrong id — or none, opening a blank editor — would still look right and
 * would quietly edit somebody else's record.
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
// The pull-to-reveal footer is gesture-handler + reanimated worklets — native
// machinery with nothing to say about which button was pressed. Stub the hook
// and let the GestureDetector be a plain wrapper; the screens' own layout and
// controls stay real.
jest.mock('../../components/usePullRevealFooter', () => ({
  usePullRevealFooter: () => ({
    pullToReveal: false,
    reveal: { value: 0 },
    gesture: {},
    onScroll: undefined,
    onScrollJS: jest.fn(),
    onScrollViewLayout: jest.fn(),
    onContentSizeChange: jest.fn(),
    footerHeight: 0,
    onFooterLayout: jest.fn(),
  }),
}));
jest.mock('react-native-gesture-handler', () => {
  const { View } = require('react-native');
  return {
    GestureDetector: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
    GestureHandlerRootView: View,
  };
});

import TasksScreen from '../TasksScreen';
import AppliancesScreen from '../AppliancesScreen';
import { useTasksStore } from '../../store/tasks';
import { useAppliancesStore } from '../../store/appliances';

const navigation = { navigate: jest.fn(), goBack: jest.fn(), replace: jest.fn() };

/* eslint-disable @typescript-eslint/no-explicit-any */
function renderTab(Screen: React.ComponentType<any>, name: string) {
  return render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <Screen navigation={navigation as any} route={{ key: name, name } as any} />
    </SafeAreaProvider>
  );
}
/* eslint-enable @typescript-eslint/no-explicit-any */

beforeEach(() => {
  jest.clearAllMocks();
  useTasksStore.setState({ tasks: [], completions: [] });
  useAppliancesStore.setState({ appliances: [] });
});

describe('Tasks tab', () => {
  it('opens the starter library from the add FAB', async () => {
    const user = userEvent.setup({ delay: 0 });
    await renderTab(TasksScreen, 'Tasks');

    await user.press(screen.getByRole('button', { name: 'Add task' }));

    expect(navigation.navigate).toHaveBeenCalledWith('LibraryPicker');
  });

  it('offers exactly one add affordance once the tab has tasks', async () => {
    useTasksStore.getState().addTask({ name: 'Clean gutters', category: 'exterior', intervalDays: 180 });
    await renderTab(TasksScreen, 'Tasks');

    expect(screen.getAllByRole('button', { name: 'Add task' })).toHaveLength(1);
  });

  it('opens the task a row names, carrying that task id', async () => {
    const store = useTasksStore.getState();
    store.addTask({ name: 'Clean gutters', category: 'exterior', intervalDays: 180 });
    const wanted = store.addTask({ name: 'Flush water heater', category: 'plumbing', intervalDays: 365 });
    const user = userEvent.setup({ delay: 0 });
    await renderTab(TasksScreen, 'Tasks');

    await user.press(screen.getByRole('button', { name: 'Flush water heater' }));

    expect(navigation.navigate).toHaveBeenCalledWith('TaskEdit', { taskId: wanted });
  });
});

describe('Appliances tab', () => {
  it('opens a blank appliance editor from the add FAB', async () => {
    const user = userEvent.setup({ delay: 0 });
    await renderTab(AppliancesScreen, 'Appliances');

    await user.press(screen.getByRole('button', { name: 'Add appliance' }));

    // No applianceId — the editor has to open in create mode, not on whatever
    // was last viewed.
    expect(navigation.navigate).toHaveBeenCalledWith('ApplianceEdit', {});
  });

  it('offers exactly one add affordance once the registry has appliances', async () => {
    useAppliancesStore.getState().addAppliance({ name: 'Furnace' });
    await renderTab(AppliancesScreen, 'Appliances');

    expect(screen.getAllByRole('button', { name: 'Add appliance' })).toHaveLength(1);
  });

  it('opens the appliance a row names, carrying that appliance id', async () => {
    const store = useAppliancesStore.getState();
    store.addAppliance({ name: 'Furnace' });
    const wanted = store.addAppliance({ name: 'Water heater' });
    const user = userEvent.setup({ delay: 0 });
    await renderTab(AppliancesScreen, 'Appliances');

    await user.press(screen.getByRole('button', { name: 'Water heater' }));

    expect(navigation.navigate).toHaveBeenCalledWith('ApplianceEdit', { applianceId: wanted });
  });
});
