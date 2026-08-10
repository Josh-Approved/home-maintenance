/**
 * Tasks — the full schedule, grouped by category. Rows open the task editor;
 * the + offers the starter library first (custom task lives inside the
 * picker, so both paths are one tap away).
 */

import React from 'react';
import { View, Text, Pressable, SectionList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GestureDetector } from 'react-native-gesture-handler';
import { Plus } from 'lucide-react-native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList, TabParamList } from '../../App';
import { useTasksStore } from '../store/tasks';
import { activeTasks, lastDoneAt } from '../data/task';
import { CATEGORIES } from '../data/library';
import { intervalText } from '../lib/format';
import { categoryHue } from '../components/CategoryChip';
import { EmptyState } from '../components/EmptyState';
import { FundingFooter } from '../components/FundingFooter';
import { usePullRevealFooter } from '../components/usePullRevealFooter';
import TipJarSheet from '../components/TipJarSheet';
import { TIP_PRODUCT_IDS } from '../constants/tipProducts';
import { TIP_JAR_ENABLED } from '../lib/links';
import { t, formatDate } from '../i18n';
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

type Props = CompositeScreenProps<BottomTabScreenProps<TabParamList, 'Tasks'>, NativeStackScreenProps<RootStackParamList>>;

export default function TasksScreen({ navigation }: Props) {
  const { c } = useTheme();
  const s = makeStyles(c);
  const [tipVisible, setTipVisible] = React.useState(false);
  const tasks = useTasksStore((st) => st.tasks);
  const completions = useTasksStore((st) => st.completions);

  const active = activeTasks(tasks);
  const sections = CATEGORIES.map((cat) => ({
    category: cat,
    title: t(`category.${cat}`),
    data: active
      .filter((task) => task.category === cat)
      .sort((a, b) => a.name.localeCompare(b.name)),
  })).filter((sec) => sec.data.length > 0);

  // Pull-to-reveal funding footer (rests at the bottom of the scroll; the
  // wordmark pops on over-pull) — and the measured footer height the FAB lifts
  // itself by, so the + always clears the footer's buttons.
  const {
    pullToReveal,
    reveal,
    gesture,
    onScrollJS,
    onScrollViewLayout,
    onContentSizeChange,
    footerHeight,
    onFooterLayout,
  } = usePullRevealFooter();

  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
      <View style={s.header}>
        <Text style={s.title}>{t('tasks.title')}</Text>
      </View>

      {active.length === 0 ? (
        <>
          <EmptyState message={t('tasks.empty')} />
          {/* Measured here too, so the FAB lifts by the real footer height on
              the empty screen as well (nothing scrolls, so no pull-to-reveal). */}
          <View onLayout={onFooterLayout}>
            <FundingFooter onSupport={TIP_JAR_ENABLED ? () => setTipVisible(true) : undefined} />
          </View>
        </>
      ) : (
        <GestureDetector gesture={gesture}>
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={[s.listContent, s.grow]}
          onScroll={pullToReveal ? onScrollJS : undefined}
          scrollEventThrottle={16}
          alwaysBounceVertical={pullToReveal}
          overScrollMode={pullToReveal ? 'never' : 'auto'}
          onLayout={onScrollViewLayout}
          onContentSizeChange={onContentSizeChange}
          ListFooterComponent={
            <View style={s.footerHolder} onLayout={onFooterLayout}>
              <FundingFooter
                onSupport={TIP_JAR_ENABLED ? () => setTipVisible(true) : undefined}
                reveal={reveal}
                pullToReveal={pullToReveal}
              />
            </View>
          }
          renderSectionHeader={({ section }) => (
            <View style={s.sectionRow}>
              <View style={[s.dot, { backgroundColor: categoryHue(section.category) }]} />
              <Text style={s.sectionLabel}>{section.title}</Text>
            </View>
          )}
          renderItem={({ item }) => {
            const last = lastDoneAt(item.id, completions);
            return (
              <Pressable
                style={({ pressed }) => [s.row, pressed && s.pressed]}
                onPress={() => navigation.navigate('TaskEdit', { taskId: item.id })}
                accessibilityRole="button"
                accessibilityLabel={item.name}
              >
                <View style={s.rowText}>
                  <Text style={s.rowName}>{item.name}</Text>
                  <Text style={s.rowMeta}>
                    {intervalText(item.intervalDays)}
                    {' · '}
                    {last
                      ? t('tasks.lastDone', {
                          date: formatDate(last, { month: 'short', day: 'numeric' }),
                        })
                      : t('tasks.neverDone')}
                  </Text>
                </View>
              </Pressable>
            );
          }}
        />
        </GestureDetector>
      )}

      <Pressable
        style={({ pressed }) => [s.fab, { bottom: footerHeight + space.s4 }, pressed && s.fabPressed]}
        onPress={() => navigation.navigate('LibraryPicker')}
        accessibilityRole="button"
        accessibilityLabel={t('tasks.add')}
      >
        <Plus size={24} color={c.inkButtonText} strokeWidth={2} />
      </Pressable>
      {tipVisible && (
        <TipJarSheet visible onDismiss={() => setTipVisible(false)} productIds={TIP_PRODUCT_IDS} />
      )}
    </SafeAreaView>
  );
}

export function makeStyles(c: Colors) {
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
    sectionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s2,
      paddingHorizontal: space.s6,
      paddingTop: space.s5,
      paddingBottom: space.s3,
    },
    dot: { width: 8, height: 8, borderRadius: 4 },
    sectionLabel: {
      ...ty.xs,
      fontFamily: fontFamily.sansSemibold,
      color: c.fgMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    // The funding footer is pinned to the bottom of this content (footerHolder
    // marginTop:auto) and the FAB lifts itself above it by footerHeight, so
    // this padding is only the footer's breathing room off the screen edge.
    // It must stay SMALL: every extra pixel here raises the footer without
    // raising the FAB (see __tests__/fabFooterClearance.test.ts).
    listContent: { ...boundedContent, paddingBottom: space.s5 },
    grow: { flexGrow: 1 },
    footerHolder: { marginTop: 'auto' },
    row: {
      minHeight: target.min + 6,
      justifyContent: 'center',
      paddingHorizontal: space.s6,
      borderBottomWidth: hairline,
      borderBottomColor: c.hairline,
    },
    rowText: { paddingVertical: space.s3, gap: 2 },
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
