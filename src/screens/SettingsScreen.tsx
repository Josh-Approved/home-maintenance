/**
 * Settings / About. App-specific settings (here: the "Your data" export/import
 * rows) sit ABOVE the canonical About block, which is the shared
 * <SettingsAbout/> component — the canonical entries are the floor, not the
 * ceiling (canon § Settings / About). Add your app's toggles/prefs above it.
 */

import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Upload, Download } from 'lucide-react-native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList, TabParamList } from '../../App';
import { useTasksStore } from '../store/tasks';
import { useAppliancesStore } from '../store/appliances';
import { exportData, pickAndParseData } from '../lib/transfer';
import { AboutRow } from '../components/AboutRow';
import { SettingsAbout } from '../components/SettingsAbout';
import { t } from '../i18n';
import {
  useTheme,
  fontFamily,
  space,
  type as ty,
  boundedContent,
  type Colors,
  AppearanceToggle,
} from '../theme';

type Props = CompositeScreenProps<BottomTabScreenProps<TabParamList, 'Me'>, NativeStackScreenProps<RootStackParamList>>;

export default function SettingsScreen({ navigation }: Props) {
  const { c } = useTheme();
  const s = makeStyles(c);
  const tasks = useTasksStore((st) => st.tasks);
  const completions = useTasksStore((st) => st.completions);
  const importData = useTasksStore((st) => st.importData);
  const appliances = useAppliancesStore((st) => st.appliances);
  const importAppliances = useAppliancesStore((st) => st.importAppliances);
  const [status, setStatus] = useState<string | null>(null);

  const onExport = useCallback(() => {
    exportData({ tasks, completions, appliances }).catch(() =>
      setStatus(t('settings.couldntExport'))
    );
  }, [tasks, completions, appliances]);

  const onImport = useCallback(async () => {
    try {
      const incoming = await pickAndParseData();
      if (incoming.tasks.length === 0 && incoming.appliances.length === 0) {
        setStatus(t('settings.nothingImported'));
        return;
      }
      importAppliances(incoming.appliances);
      importData(incoming.tasks, incoming.completions);
      setStatus(t('settings.importedToast', { count: String(incoming.tasks.length) }));
    } catch {
      setStatus(t('settings.couldntRead'));
    }
  }, [importData, importAppliances]);

  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right', 'bottom']}>
      <View style={s.header}>
        <Text style={s.title}>{t('settings.title')}</Text>
      </View>
      <ScrollView contentContainerStyle={s.content}>
        <Text style={s.sectionLabel}>{t('settings.appearance')}</Text>
        <AppearanceToggle
          labels={{
            title: t('settings.appearance'),
            system: t('settings.themeSystem'),
            light: t('settings.themeLight'),
            dark: t('settings.themeDark'),
          }}
        />

        <Text style={s.sectionLabel}>{t('settings.yourData')}</Text>
        <AboutRow label={t('settings.export')} icon={Upload} onPress={onExport} />
        <AboutRow label={t('settings.import')} icon={Download} onPress={onImport} />
        {status ? <Text style={s.status}>{status}</Text> : null}

        <SettingsAbout onAcknowledgements={() => navigation.navigate('Acknowledgements')} />
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    header: {
      ...boundedContent,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: space.s5,
      paddingVertical: space.s4,
    },
    title: { ...ty.md, fontFamily: fontFamily.sansSemibold, color: c.fg },
    content: { ...boundedContent, paddingBottom: space.s9 },
    sectionLabel: {
      ...ty.xs,
      fontFamily: fontFamily.sansSemibold,
      color: c.fgMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      paddingHorizontal: space.s6,
      paddingTop: space.s7,
      paddingBottom: space.s3,
    },
    status: {
      ...ty.sm,
      fontFamily: fontFamily.sans,
      color: c.fgMuted,
      paddingHorizontal: space.s6,
      paddingTop: space.s4,
    },
  });
}
