/**
 * App root for the `tracker` archetype. The shell (<AppShell/>) owns all the
 * chrome; this file owns only the readiness gate (fonts + store hydration) and
 * the screen list.
 *
 * Rename the screens/params to your domain; the shape stays the same.
 */

import React, { useEffect } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAppFonts } from './src/theme';
import { AppShell } from './src/shell/AppShell';
import { useEntriesStore } from './src/store/entries';
import TrackerHomeScreen from './src/screens/TrackerHomeScreen';
import AddEntryScreen from './src/screens/AddEntryScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import Credits from './src/components/Credits';
import { QA_MODE } from './src/qa/qaMode';

// Hold the native launch screen until the JS splash takes over (no icon blink).
// Must run at module scope, before first paint. Skipped under QA_MODE so the
// capture harness sees deterministic frames.
if (!QA_MODE) {
  SplashScreen.preventAutoHideAsync().catch(() => {});
}

export type RootStackParamList = {
  TrackerHome: undefined;
  AddEntry: undefined;
  Settings: undefined;
  Acknowledgements: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const [fontsLoaded] = useAppFonts();
  const hydrated = useEntriesStore((s) => s.hydrated);
  const hydrate = useEntriesStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const ready = fontsLoaded && hydrated;

  return (
    <AppShell ready={ready}>
      <Stack.Navigator
        initialRouteName="TrackerHome"
        screenOptions={{ headerShown: false, animation: QA_MODE ? 'none' : undefined }}
      >
        <Stack.Screen name="TrackerHome" component={TrackerHomeScreen} />
        <Stack.Screen
          name="AddEntry"
          component={AddEntryScreen}
          options={{ presentation: 'modal' }}
        />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen name="Acknowledgements">
          {(props) => <Credits onBack={() => props.navigation.goBack()} />}
        </Stack.Screen>
      </Stack.Navigator>
    </AppShell>
  );
}
