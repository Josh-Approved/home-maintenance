/**
 * App root. The shell (<AppShell/>) owns all the chrome; this file owns only
 * the readiness gate (fonts + store hydration) and the navigation shape:
 * four bottom tabs (Due / Tasks / Appliances / Me) with the edit + picker
 * screens stacked above them.
 */

import React, { useEffect } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { CalendarClock, ListChecks, Refrigerator, CircleUserRound } from 'lucide-react-native';
import { useAppFonts, useTheme, fontFamily } from './src/theme';
import { AppShell } from './src/shell/AppShell';
import { useTasksStore } from './src/store/tasks';
import { useAppliancesStore } from './src/store/appliances';
import DueScreen from './src/screens/DueScreen';
import TasksScreen from './src/screens/TasksScreen';
import TaskEditScreen from './src/screens/TaskEditScreen';
import LibraryPickerScreen from './src/screens/LibraryPickerScreen';
import AppliancesScreen from './src/screens/AppliancesScreen';
import ApplianceEditScreen from './src/screens/ApplianceEditScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import Credits from './src/components/Credits';
import { t } from './src/i18n';
import { QA_MODE } from './src/qa/qaMode';

// Hold the native launch screen until the JS splash takes over (no icon blink).
// Must run at module scope, before first paint. Skipped under QA_MODE so the
// capture harness sees deterministic frames.
if (!QA_MODE) {
  SplashScreen.preventAutoHideAsync().catch(() => {});
}

export type RootStackParamList = {
  Tabs: undefined;
  TaskEdit: { taskId?: string; applianceId?: string };
  LibraryPicker: undefined;
  ApplianceEdit: { applianceId?: string };
  Acknowledgements: undefined;
};

export type TabParamList = {
  Due: undefined;
  Tasks: undefined;
  Appliances: undefined;
  Me: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

function Tabs() {
  const { c } = useTheme();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.fg,
        tabBarInactiveTintColor: c.fgSubtle,
        tabBarStyle: { backgroundColor: c.bg, borderTopColor: c.hairline },
        tabBarLabelStyle: { fontFamily: fontFamily.sans, fontSize: 11 },
      }}
    >
      <Tab.Screen
        name="Due"
        component={DueScreen}
        options={{
          tabBarLabel: t('tabs.due'),
          tabBarButtonTestID: 'tab-due',
          tabBarIcon: ({ color, size }) => <CalendarClock size={size} color={color} strokeWidth={1.5} />,
        }}
      />
      <Tab.Screen
        name="Tasks"
        component={TasksScreen}
        options={{
          tabBarLabel: t('tabs.tasks'),
          tabBarButtonTestID: 'tab-tasks',
          tabBarIcon: ({ color, size }) => <ListChecks size={size} color={color} strokeWidth={1.5} />,
        }}
      />
      <Tab.Screen
        name="Appliances"
        component={AppliancesScreen}
        options={{
          tabBarLabel: t('tabs.appliances'),
          tabBarButtonTestID: 'tab-appliances',
          tabBarIcon: ({ color, size }) => <Refrigerator size={size} color={color} strokeWidth={1.5} />,
        }}
      />
      <Tab.Screen
        name="Me"
        component={SettingsScreen}
        options={{
          tabBarLabel: t('tabs.me'),
          tabBarButtonTestID: 'tab-me',
          tabBarIcon: ({ color, size }) => <CircleUserRound size={size} color={color} strokeWidth={1.5} />,
        }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  const [fontsLoaded] = useAppFonts();
  const tasksHydrated = useTasksStore((s) => s.hydrated);
  const hydrateTasks = useTasksStore((s) => s.hydrate);
  const appliancesHydrated = useAppliancesStore((s) => s.hydrated);
  const hydrateAppliances = useAppliancesStore((s) => s.hydrate);

  useEffect(() => {
    hydrateTasks();
    hydrateAppliances();
  }, [hydrateTasks, hydrateAppliances]);

  const ready = fontsLoaded && tasksHydrated && appliancesHydrated;

  return (
    <AppShell ready={ready}>
      <Stack.Navigator
        initialRouteName="Tabs"
        screenOptions={{ headerShown: false, animation: QA_MODE ? 'none' : undefined }}
      >
        <Stack.Screen name="Tabs" component={Tabs} />
        <Stack.Screen name="TaskEdit" component={TaskEditScreen} options={{ presentation: 'modal' }} />
        <Stack.Screen
          name="LibraryPicker"
          component={LibraryPickerScreen}
          options={{ presentation: 'modal' }}
        />
        <Stack.Screen
          name="ApplianceEdit"
          component={ApplianceEditScreen}
          options={{ presentation: 'modal' }}
        />
        <Stack.Screen name="Acknowledgements">
          {(props) => <Credits onBack={() => props.navigation.goBack()} />}
        </Stack.Screen>
      </Stack.Navigator>
    </AppShell>
  );
}
