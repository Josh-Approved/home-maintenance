/**
 * Appliances — the registry list. Rows open the editor (which owns Find
 * manual + linked tasks); the + adds a new appliance. The empty state sells
 * the point of the tab: details in one place, manual one tap away.
 */

import React from 'react';
import { View, Text, Pressable, FlatList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus, ChevronRight } from 'lucide-react-native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList, TabParamList } from '../../App';
import { useAppliancesStore } from '../store/appliances';
import { useTasksStore } from '../store/tasks';
import { activeAppliances } from '../data/appliance';
import { tasksForAppliance } from '../data/task';
import { EmptyState } from '../components/EmptyState';
import { FundingFooter } from '../components/FundingFooter';
import TipJarSheet from '../components/TipJarSheet';
import { TIP_PRODUCT_IDS } from '../constants/tipProducts';
import { TIP_JAR_ENABLED } from '../lib/links';
import { t } from '../i18n';
import {
  useTheme,
  fontFamily,
  space,
  target,
  type as ty,
  hairline,
  radius,
  boundedContent,
  type Colors,
} from '../theme';

type Props = CompositeScreenProps<BottomTabScreenProps<TabParamList, 'Appliances'>, NativeStackScreenProps<RootStackParamList>>;

export default function AppliancesScreen({ navigation }: Props) {
  const { c } = useTheme();
  const s = makeStyles(c);
  const [tipVisible, setTipVisible] = React.useState(false);
  const appliances = useAppliancesStore((st) => st.appliances);
  const tasks = useTasksStore((st) => st.tasks);

  const list = activeAppliances(appliances);

  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
      <View style={s.header}>
        <Text style={s.title}>{t('appliances.title')}</Text>
      </View>

      {list.length === 0 ? (
        <>
          <EmptyState message={t('appliances.empty')} />
          <FundingFooter onSupport={TIP_JAR_ENABLED ? () => setTipVisible(true) : undefined} />
        </>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(a) => a.id}
          contentContainerStyle={[s.listContent, s.grow]}
          ListFooterComponent={
            <View style={s.footerHolder}>
              <FundingFooter onSupport={TIP_JAR_ENABLED ? () => setTipVisible(true) : undefined} />
            </View>
          }
          renderItem={({ item }) => {
            const linked = tasksForAppliance(item.id, tasks).length;
            const detail = [item.brand, item.model].filter(Boolean).join(' ');
            return (
              <Pressable
                style={({ pressed }) => [s.row, pressed && s.pressed]}
                onPress={() => navigation.navigate('ApplianceEdit', { applianceId: item.id })}
                accessibilityRole="button"
                accessibilityLabel={item.name}
              >
                <View style={s.rowText}>
                  <Text style={s.rowName}>{item.name}</Text>
                  <Text style={s.rowMeta}>
                    {detail || t('appliances.findManualHint')}
                    {linked > 0 ? ` · ${t('appliances.linkedCount', { count: String(linked) })}` : ''}
                  </Text>
                </View>
                <ChevronRight size={18} color={c.fgSubtle} strokeWidth={1.5} />
              </Pressable>
            );
          }}
        />
      )}

      <Pressable
        style={({ pressed }) => [s.fab, pressed && s.fabPressed]}
        onPress={() => navigation.navigate('ApplianceEdit', {})}
        accessibilityRole="button"
        accessibilityLabel={t('appliances.add')}
      >
        <Plus size={24} color={c.inkButtonText} strokeWidth={2} />
      </Pressable>
      {tipVisible && (
        <TipJarSheet visible onDismiss={() => setTipVisible(false)} productIds={TIP_PRODUCT_IDS} />
      )}
    </SafeAreaView>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    pressed: { opacity: 0.6 },
    header: {
      ...boundedContent,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: space.s5,
      paddingVertical: space.s4,
    },
    title: { ...ty.md, fontFamily: fontFamily.sansSemibold, color: c.fg },
    listContent: { ...boundedContent, paddingBottom: space.s9 },
    grow: { flexGrow: 1 },
    footerHolder: { marginTop: 'auto' },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s3,
      minHeight: target.min + 10,
      paddingHorizontal: space.s6,
      borderBottomWidth: hairline,
      borderBottomColor: c.hairline,
    },
    rowText: { flex: 1, paddingVertical: space.s3, gap: 2 },
    rowName: { ...ty.base, fontFamily: fontFamily.sans, color: c.fg },
    rowMeta: { ...ty.sm, fontFamily: fontFamily.sans, color: c.fgMuted },
    fab: {
      position: 'absolute',
      right: space.s6,
      bottom: space.s8,
      width: 56,
      height: 56,
      borderRadius: radius.pill,
      backgroundColor: c.inkButton,
      alignItems: 'center',
      justifyContent: 'center',
    },
    fabPressed: { opacity: 0.85 },
  });
}
