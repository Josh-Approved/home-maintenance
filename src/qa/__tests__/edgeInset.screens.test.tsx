/**
 * Edge-inset audit over this app's own screens — APP-OWNED: seeded once by
 * `sync.mjs qa`, never overwritten.
 *
 * src/qa/edgeInset.ts (canonical) fails when text or an icon sits closer than
 * 8pt to the inside edge of a card, sheet, row or button; the canonical
 * edgeInset.proof.test.tsx proves it catches the shape that shipped.
 *
 * What belongs here: Settings, and every screen, sheet or pane that draws a
 * card, a filled or bordered row, or a labelled button. Each renders with a
 * task and an appliance on file so its rows and cards actually appear. A new
 * screen or sheet gets a line here in the same PR. qa-canonical
 * `test/edge-inset-screens` warns while this file renders none of the app's
 * screens or components.
 *
 * Fixing a finding: give the content room inside the surface, usually the
 * container's own `paddingHorizontal` (space.s5 or space.s6, matching the rows
 * around it), rather than padding each row.
 */

import React from 'react';

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
// Real price buttons, so the audit sees the tip tiers as they render.
jest.mock('../../lib/tipJar', () => {
  const { TIP_PRODUCT_IDS } = require('../../constants/tipProducts');
  return {
    isStoreKnownUnavailable: () => false,
    useTipJar: () => ({
      status: 'ready',
      products: TIP_PRODUCT_IDS.map((id: string) => ({ id, displayPrice: '$2.99' })),
      pendingSku: null,
      tip: jest.fn(),
    }),
  };
});
// The pull-to-reveal footer is reanimated + gesture-handler worklets: native
// machinery with no bearing on padding. The screens' own layout stays real.
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

import { auditScreen } from '../edgeInsetAudit';
import SettingsScreen from '../../screens/SettingsScreen';
import DueScreen from '../../screens/DueScreen';
import TasksScreen from '../../screens/TasksScreen';
import AppliancesScreen from '../../screens/AppliancesScreen';
import TaskEditScreen from '../../screens/TaskEditScreen';
import TaskSetupScreen from '../../screens/TaskSetupScreen';
import ApplianceEditScreen from '../../screens/ApplianceEditScreen';
import LibraryPickerScreen from '../../screens/LibraryPickerScreen';
import { NotifyTimePane } from '../../components/NotifyTimeSetting';
import { CategorySheet } from '../../components/CategorySheet';
import { IntervalSheet } from '../../components/IntervalSheet';
import { ReminderSheet } from '../../components/ReminderSheet';
import { ApplianceSheet } from '../../components/ApplianceSheet';
import { LastDoneSheet } from '../../components/LastDoneSheet';
import TipJarSheet from '../../components/TipJarSheet';
import { TIP_PRODUCT_IDS } from '../../constants/tipProducts';
import { useTasksStore } from '../../store/tasks';
import { useAppliancesStore } from '../../store/appliances';

/* eslint-disable @typescript-eslint/no-explicit-any */
const navigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  replace: jest.fn(),
  setOptions: jest.fn(),
  addListener: jest.fn(() => () => {}),
} as any;
const route = (name: string, params?: object) => ({ key: name, name, params }) as any;
/* eslint-enable @typescript-eslint/no-explicit-any */
const noop = () => {};

let taskId = '';
let applianceId = '';

beforeEach(() => {
  useTasksStore.setState({ tasks: [], completions: [] });
  useAppliancesStore.setState({ appliances: [] });
  applianceId = useAppliancesStore.getState().addAppliance({ name: 'Furnace' });
  taskId = useTasksStore
    .getState()
    .addTask({ name: 'Replace furnace filter', category: 'hvac', intervalDays: 90, applianceId });
});

describe("edge-inset audit — this app's screens", () => {
  it('Settings', async () => {
    expect(
      await auditScreen(<SettingsScreen navigation={navigation} route={route('Me')} />, {
        readyText: 'Notification time',
      })
    ).toEqual([]);
  });

  it('Due', async () => {
    expect(await auditScreen(<DueScreen navigation={navigation} route={route('Due')} />)).toEqual([]);
  });

  it('Tasks', async () => {
    expect(await auditScreen(<TasksScreen navigation={navigation} route={route('Tasks')} />)).toEqual([]);
  });

  it('Appliances', async () => {
    expect(
      await auditScreen(<AppliancesScreen navigation={navigation} route={route('Appliances')} />)
    ).toEqual([]);
  });

  it('Task editor (existing task)', async () => {
    expect(
      await auditScreen(<TaskEditScreen navigation={navigation} route={route('TaskEdit', { taskId })} />)
    ).toEqual([]);
  });

  it('Task setup', async () => {
    expect(
      await auditScreen(
        <TaskSetupScreen navigation={navigation} route={route('TaskSetup', { taskIds: [taskId] })} />
      )
    ).toEqual([]);
  });

  it('Appliance editor (existing appliance)', async () => {
    expect(
      await auditScreen(
        <ApplianceEditScreen navigation={navigation} route={route('ApplianceEdit', { applianceId })} />
      )
    ).toEqual([]);
  });

  it('Starter library', async () => {
    expect(
      await auditScreen(<LibraryPickerScreen navigation={navigation} route={route('LibraryPicker')} />)
    ).toEqual([]);
  });

  it('Notification time pane', async () => {
    expect(await auditScreen(<NotifyTimePane visible hour={9} onClose={noop} onPick={noop} />)).toEqual([]);
  });

  it('Category sheet', async () => {
    expect(await auditScreen(<CategorySheet visible value="hvac" onClose={noop} onPick={noop} />)).toEqual([]);
  });

  it('Interval sheet', async () => {
    expect(await auditScreen(<IntervalSheet visible value={90} onClose={noop} onPick={noop} />)).toEqual([]);
  });

  it('Reminder sheet', async () => {
    expect(
      await auditScreen(
        <ReminderSheet
          visible
          leadDays={0}
          repeatDays={7}
          repeatCount={null}
          intervalDays={90}
          onClose={noop}
          onChange={noop}
        />
      )
    ).toEqual([]);
  });

  it('Appliance sheet', async () => {
    expect(
      await auditScreen(<ApplianceSheet visible value={applianceId} onClose={noop} onPick={noop} />)
    ).toEqual([]);
  });

  it('Last done sheet', async () => {
    expect(
      await auditScreen(
        <LastDoneSheet visible value={null} intervalDays={90} allowNotDoneYet onClose={noop} onPick={noop} />
      )
    ).toEqual([]);
  });

  it('Tip jar sheet', async () => {
    expect(
      await auditScreen(<TipJarSheet visible onDismiss={noop} productIds={TIP_PRODUCT_IDS} />)
    ).toEqual([]);
  });
});
