/**
 * Settings / About. App-specific settings (here: the "Your data" export/import
 * rows) sit ABOVE the canonical About block, which is the shared
 * <SettingsAbout/> component — the canonical entries are the floor, not the
 * ceiling (canon § Settings / About). Add your app's toggles/prefs above it.
 */

import React, { useCallback, useState } from 'react';
import { Text, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Upload, Download } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { useEntriesStore } from '../store/entries';
import { exportEntries, pickAndParseEntries } from '../lib/transfer';
import { AboutRow } from '../components/AboutRow';
import { SettingsAbout } from '../components/SettingsAbout';
import { ScreenHeader } from '../components/ScreenHeader';
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

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

export default function SettingsScreen({ navigation }: Props) {
  const { c } = useTheme();
  const s = makeStyles(c);
  const entries = useEntriesStore((st) => st.entries);
  const importEntries = useEntriesStore((st) => st.importEntries);
  const [status, setStatus] = useState<string | null>(null);

  const onExport = useCallback(() => {
    exportEntries(entries).catch(() => setStatus(t('settings.couldntExport')));
  }, [entries]);

  const onImport = useCallback(async () => {
    try {
      const incoming = await pickAndParseEntries();
      if (incoming.length === 0) {
        setStatus(t('settings.nothingImported'));
        return;
      }
      importEntries(incoming);
    } catch {
      setStatus(t('settings.couldntRead'));
    }
  }, [importEntries]);

  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right', 'bottom']}>
      <ScreenHeader title={t('settings.title')} onBack={() => navigation.goBack()} />
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
