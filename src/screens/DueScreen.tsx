/**
 * Due — the landing tab: what needs doing, most urgent first. One tap on the
 * circle marks a task done (the schedule rolls itself); a quiet inline bar
 * offers Undo for a few seconds after. Overdue / due-soon / upcoming sections
 * come straight from the trust core, so the order here is the tested order.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, SectionList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Circle, CircleCheck } from 'lucide-react-native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList, TabParamList } from '../../App';
import { useTasksStore } from '../store/tasks';
import { schedules, type TaskSchedule, type DueState } from '../data/task';
import { dueText } from '../lib/format';
import { CategoryChip } from '../components/CategoryChip';
import { EmptyState } from '../components/EmptyState';
import { FundingFooter } from '../components/FundingFooter';
import ReviewModal from '../components/ReviewModal';
import { recordSuccessfulCompletion } from '../storage/reviewPrompt';
import TipJarSheet from '../components/TipJarSheet';
import { TIP_PRODUCT_IDS } from '../constants/tipProducts';
import { APP_NAME, IOS_APP_STORE_ID, ANDROID_PACKAGE, TIP_JAR_ENABLED } from '../lib/links';
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

type Props = CompositeScreenProps<BottomTabScreenProps<TabParamList, 'Due'>, NativeStackScreenProps<RootStackParamList>>;

const SECTION_ORDER: DueState[] = ['overdue', 'dueSoon', 'upcoming'];
const SECTION_KEY: Record<DueState, string> = {
  overdue: 'due.overdue',
  dueSoon: 'due.dueSoon',
  upcoming: 'due.upcoming',
};
/** Keep the landing screen calm: everything overdue/due-soon, plus a short
 *  look-ahead of what's next. The Tasks tab is the full list. */
const UPCOMING_PREVIEW = 5;

export default function DueScreen({ navigation }: Props) {
  const { c } = useTheme();
  const s = makeStyles(c);
  const tasks = useTasksStore((st) => st.tasks);
  const completions = useTasksStore((st) => st.completions);
  const markDone = useTasksStore((st) => st.markDone);
  const undoLastDone = useTasksStore((st) => st.undoLastDone);

  const [undoFor, setUndoFor] = useState<{ id: string; name: string } | null>(null);
  const [reviewVisible, setReviewVisible] = useState(false);
  const [tipVisible, setTipVisible] = useState(false);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (undoTimer.current) clearTimeout(undoTimer.current);
    },
    []
  );

  const onDone = useCallback(
    (sched: TaskSchedule) => {
      markDone(sched.task.id);
      setUndoFor({ id: sched.task.id, name: sched.task.name });
      if (undoTimer.current) clearTimeout(undoTimer.current);
      undoTimer.current = setTimeout(() => setUndoFor(null), 6000);
      // Marking a task done is this app's genuine "satisfying success" — the
      // canonical review prompt's only trigger (never on launch/error).
      recordSuccessfulCompletion()
        .then((show) => {
          if (show) setReviewVisible(true);
        })
        .catch(() => {});
    },
    [markDone]
  );

  const onUndo = useCallback(() => {
    if (!undoFor) return;
    undoLastDone(undoFor.id);
    setUndoFor(null);
    if (undoTimer.current) clearTimeout(undoTimer.current);
  }, [undoFor, undoLastDone]);

  const all = schedules(tasks, completions, Date.now());
  const sections = SECTION_ORDER.map((state) => ({
    state,
    title: t(SECTION_KEY[state]),
    data:
      state === 'upcoming'
        ? all.filter((x) => x.state === state).slice(0, UPCOMING_PREVIEW)
        : all.filter((x) => x.state === state),
  })).filter((sec) => sec.data.length > 0);

  const noTasksAtAll = all.length === 0;
  const allCaughtUp = !noTasksAtAll && sections.every((sec) => sec.state === 'upcoming');

  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
      <View style={s.header}>
        <Text style={s.title}>{t('due.title')}</Text>
      </View>

      {noTasksAtAll ? (
        <>
          <EmptyState message={t('due.emptyNoTasks')} />
          <Pressable
            onPress={() => navigation.navigate('LibraryPicker')}
            accessibilityRole="button"
            accessibilityLabel={t('due.emptyNoTasksCta')}
            style={({ pressed }) => [s.cta, pressed && s.pressed]}
          >
            <Text style={s.ctaText}>{t('due.emptyNoTasksCta')}</Text>
          </Pressable>
          <FundingFooter onSupport={TIP_JAR_ENABLED ? () => setTipVisible(true) : undefined} />
        </>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.task.id}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={[s.listContent, s.grow]}
          ListHeaderComponent={
            allCaughtUp ? <Text style={s.caughtUp}>{t('due.empty')}</Text> : null
          }
          ListFooterComponent={
            <View style={s.footerHolder}>
              <FundingFooter onSupport={TIP_JAR_ENABLED ? () => setTipVisible(true) : undefined} />
            </View>
          }
          renderSectionHeader={({ section }) => (
            <Text style={s.sectionLabel}>{section.title}</Text>
          )}
          renderItem={({ item }) => (
            <View style={s.row}>
              <Pressable
                onPress={() => onDone(item)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`${t('due.done')}: ${item.task.name}`}
                style={({ pressed }) => [s.doneBtn, pressed && s.pressed]}
              >
                <Circle size={26} color={item.state === 'overdue' ? c.fg : c.fgSubtle} strokeWidth={1.5} />
              </Pressable>
              <Pressable
                style={({ pressed }) => [s.rowBody, pressed && s.pressed]}
                onPress={() => navigation.navigate('TaskEdit', { taskId: item.task.id })}
                accessibilityRole="button"
                accessibilityLabel={item.task.name}
              >
                <Text style={s.rowName}>{item.task.name}</Text>
                <View style={s.rowMeta}>
                  <CategoryChip category={item.task.category} />
                  <Text style={[s.rowDue, item.state === 'overdue' && s.rowOverdue]}>
                    {dueText(item)}
                  </Text>
                </View>
              </Pressable>
            </View>
          )}
        />
      )}

      {undoFor ? (
        <View style={s.undoBar} accessibilityLiveRegion="polite">
          <CircleCheck size={18} color={c.inkButtonText} strokeWidth={2} />
          <Text style={s.undoText} numberOfLines={1}>
            {t('due.doneToast')}: {undoFor.name}
          </Text>
          <Pressable
            onPress={onUndo}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('due.undo')}
            style={({ pressed }) => [s.undoBtn, pressed && s.pressed]}
          >
            <Text style={s.undoBtnText}>{t('due.undo')}</Text>
          </Pressable>
        </View>
      ) : null}

      <ReviewModal
        visible={reviewVisible}
        onDismiss={() => setReviewVisible(false)}
        appName={APP_NAME}
        iosAppStoreId={IOS_APP_STORE_ID}
        androidPackageName={ANDROID_PACKAGE}
      />
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
    caughtUp: {
      ...ty.base,
      fontFamily: fontFamily.sans,
      color: c.fgMuted,
      paddingHorizontal: space.s6,
      paddingTop: space.s4,
    },
    sectionLabel: {
      ...ty.xs,
      fontFamily: fontFamily.sansSemibold,
      color: c.fgMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      paddingHorizontal: space.s6,
      paddingTop: space.s5,
      paddingBottom: space.s3,
    },
    listContent: { ...boundedContent, paddingBottom: space.s9 },
    grow: { flexGrow: 1 },
    footerHolder: { marginTop: 'auto' },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s3,
      minHeight: target.min + 10,
      paddingHorizontal: space.s5,
      borderBottomWidth: hairline,
      borderBottomColor: c.hairline,
    },
    doneBtn: {
      width: target.min,
      height: target.min,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowBody: { flex: 1, paddingVertical: space.s3, gap: 2 },
    rowName: { ...ty.base, fontFamily: fontFamily.sans, color: c.fg },
    rowMeta: { flexDirection: 'row', alignItems: 'center', gap: space.s4 },
    rowDue: { ...ty.sm, fontFamily: fontFamily.sans, color: c.fgMuted },
    rowOverdue: { color: c.fg, fontFamily: fontFamily.sansSemibold },
    cta: {
      alignSelf: 'center',
      minHeight: target.min,
      justifyContent: 'center',
      paddingHorizontal: space.s6,
      borderRadius: radius.md,
      backgroundColor: c.inkButton,
      marginBottom: space.s6,
    },
    ctaText: { ...ty.base, fontFamily: fontFamily.sansSemibold, color: c.inkButtonText },
    undoBar: {
      position: 'absolute',
      left: space.s5,
      right: space.s5,
      bottom: space.s5,
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s3,
      backgroundColor: c.inkButton,
      borderRadius: radius.lg,
      paddingHorizontal: space.s5,
      minHeight: target.min,
    },
    undoText: { ...ty.sm, fontFamily: fontFamily.sans, color: c.inkButtonText, flex: 1 },
    undoBtn: { minHeight: target.min, justifyContent: 'center', paddingHorizontal: space.s3 },
    undoBtnText: { ...ty.sm, fontFamily: fontFamily.sansSemibold, color: c.inkButtonText },
  });
}
