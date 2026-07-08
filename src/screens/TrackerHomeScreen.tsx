/**
 * Home — the tracker dashboard: a Today total, a Last-7-days total, and the
 * recent entries. The + logs a new entry. Empty state + funding footer are
 * canon (§ Funding & feedback, design system).
 *
 * Summary numbers come from the pure trust core (src/data/entry.ts), so the
 * math is unit-tested, not duplicated here.
 */

import React from 'react';
import { View, Text, Pressable, FlatList, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Settings as SettingsIcon, Plus, Trash2 } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { useEntriesStore } from '../store/entries';
import {
  activeEntries,
  entriesInRange,
  summarize,
  todayRange,
  last7Range,
  type Entry,
} from '../data/entry';
import { EmptyState } from '../components/EmptyState';
import { FundingFooter } from '../components/FundingFooter';
import { usePullRevealFooter } from '../components/usePullRevealFooter';
import { t, formatNumber, formatDate } from '../i18n';
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

type Props = NativeStackScreenProps<RootStackParamList, 'TrackerHome'>;

export default function TrackerHomeScreen({ navigation }: Props) {
  const { c } = useTheme();
  const s = makeStyles(c);
  const entries = useEntriesStore((st) => st.entries);
  const deleteEntry = useEntriesStore((st) => st.deleteEntry);
  const { pullToReveal, reveal, onScroll, footerHeight, onFooterLayout } = usePullRevealFooter();

  const now = Date.now();
  const today = summarize(entriesInRange(entries, ...todayRange(now)));
  const week = summarize(entriesInRange(entries, ...last7Range(now)));
  const recent = activeEntries(entries).sort((a, b) => b.at - a.at);

  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
      <View style={s.header}>
        <Text style={s.title}>{t('home.title')}</Text>
        <Pressable
          onPress={() => navigation.navigate('Settings')}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('settings.title')}
          style={({ pressed }) => [s.iconBtn, pressed && s.pressed]}
        >
          <SettingsIcon size={22} color={c.fg} strokeWidth={1.5} />
        </Pressable>
      </View>

      <View style={s.cards}>
        <SummaryCard styles={s} label={t('home.today')} value={formatNumber(today.total)} />
        <SummaryCard styles={s} label={t('home.last7')} value={formatNumber(week.total)} />
      </View>

      {recent.length === 0 ? (
        <>
          <EmptyState message={t('home.empty')} />
          <FundingFooter />
        </>
      ) : (
        <Animated.FlatList
          data={recent}
          keyExtractor={(e) => e.id}
          onScroll={pullToReveal ? onScroll : undefined}
          scrollEventThrottle={16}
          alwaysBounceVertical={pullToReveal}
          contentContainerStyle={[s.listContent, s.grow]}
          ListHeaderComponent={<Text style={s.sectionLabel}>{t('home.recent')}</Text>}
          ListFooterComponent={
            <View style={s.footerHolder} onLayout={onFooterLayout}>
              <FundingFooter reveal={reveal} pullToReveal={pullToReveal} />
            </View>
          }
          renderItem={({ item }) => (
            <View style={s.row} accessibilityLabel={item.note ?? formatNumber(item.value)}>
              <Text style={s.rowValue}>{formatNumber(item.value)}</Text>
              <View style={s.rowText}>
                {item.note ? <Text style={s.rowNote}>{item.note}</Text> : null}
                <Text style={s.rowDate}>
                  {formatDate(item.at, { month: 'short', day: 'numeric' })}
                </Text>
              </View>
              <Pressable
                onPress={() => deleteEntry(item.id)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t('entry.delete')}
                style={({ pressed }) => [s.iconBtn, pressed && s.pressed]}
              >
                <Trash2 size={18} color={c.fgSubtle} strokeWidth={1.5} />
              </Pressable>
            </View>
          )}
        />
      )}

      <Pressable
        style={({ pressed }) => [s.fab, { bottom: footerHeight + space.s4 }, pressed && s.fabPressed]}
        onPress={() => navigation.navigate('AddEntry')}
        accessibilityRole="button"
        accessibilityLabel={t('home.add')}
      >
        <Plus size={24} color={c.fgOnInk} strokeWidth={2} />
      </Pressable>
    </SafeAreaView>
  );
}

function SummaryCard({
  styles,
  label,
  value,
}: {
  styles: ReturnType<typeof makeStyles>;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardValue}>{value}</Text>
      <Text style={styles.cardLabel}>{label}</Text>
    </View>
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
    iconBtn: {
      width: target.min,
      height: target.min,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cards: {
      ...boundedContent,
      flexDirection: 'row',
      gap: space.s4,
      paddingHorizontal: space.s5,
      paddingBottom: space.s4,
    },
    card: {
      flex: 1,
      backgroundColor: c.bgSubtle,
      borderRadius: radius.lg,
      padding: space.s5,
      gap: space.s2,
    },
    cardValue: { fontFamily: fontFamily.mono, fontSize: 32, lineHeight: 38, color: c.fg },
    cardLabel: { ...ty.sm, fontFamily: fontFamily.sans, color: c.fgMuted },
    sectionLabel: {
      ...ty.xs,
      fontFamily: fontFamily.sansSemibold,
      color: c.fgMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      paddingHorizontal: space.s6,
      paddingTop: space.s4,
      paddingBottom: space.s3,
    },
    listContent: { ...boundedContent, paddingBottom: space.s9 },
    grow: { flexGrow: 1 },
    footerHolder: { marginTop: 'auto' },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s4,
      minHeight: target.min + 6,
      paddingHorizontal: space.s5,
      borderBottomWidth: hairline,
      borderBottomColor: c.hairline,
    },
    rowValue: {
      ...ty.md,
      fontFamily: fontFamily.mono,
      color: c.fg,
      minWidth: 40,
    },
    rowText: { flex: 1 },
    rowNote: { ...ty.base, fontFamily: fontFamily.sans, color: c.fg },
    rowDate: { ...ty.sm, fontFamily: fontFamily.sans, color: c.fgMuted },
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
