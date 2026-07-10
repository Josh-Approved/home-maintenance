/**
 * Last-done spoke: when was this task last serviced? Quick picks cover the
 * honest answers people actually have ("about a month ago"), the day stepper
 * fine-tunes, and the next-due preview shows the consequence before it lands
 * — setting a real last-service date is what keeps a new task from waiting a
 * full extra interval. Confirmed explicitly; "not done yet" returns at once.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Check, Minus, Plus } from 'lucide-react-native';
import { DAY, startOfDay } from '../data/task';
import { DrilldownSheet, SheetOption } from './DrilldownSheet';
import { t, formatDate } from '../i18n';
import {
  useTheme,
  fontFamily,
  space,
  target,
  type as ty,
  radius,
  boundedContent,
  type Colors,
} from '../theme';

function todayNoon(): number {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  return d.getTime();
}

function monthsAgo(n: number): number {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setMonth(d.getMonth() - n);
  return d.getTime();
}

const QUICK_PICKS = [
  { key: 'lastDone.today', get: () => todayNoon() },
  { key: 'lastDone.yesterday', get: () => todayNoon() - DAY },
  { key: 'lastDone.weekAgo', get: () => todayNoon() - 7 * DAY },
  { key: 'lastDone.twoWeeksAgo', get: () => todayNoon() - 14 * DAY },
  { key: 'lastDone.monthAgo', get: () => monthsAgo(1) },
  { key: 'lastDone.twoMonthsAgo', get: () => monthsAgo(2) },
  { key: 'lastDone.threeMonthsAgo', get: () => monthsAgo(3) },
  { key: 'lastDone.sixMonthsAgo', get: () => monthsAgo(6) },
  { key: 'lastDone.yearAgo', get: () => monthsAgo(12) },
] as const;

type Props = {
  visible: boolean;
  /** Current last-done date, or null when the task has never been done. */
  value: number | null;
  intervalDays: number;
  /** Offer the "not done yet" answer (new tasks — an existing history entry
   *  is corrected, not erased, so editing hides it). */
  allowNotDoneYet: boolean;
  onClose: () => void;
  onPick: (at: number | null) => void;
};

export function LastDoneSheet({
  visible,
  value,
  intervalDays,
  allowNotDoneYet,
  onClose,
  onPick,
}: Props) {
  const { c } = useTheme();
  const s = makeStyles(c);
  const [working, setWorking] = useState<number>(todayNoon());

  useEffect(() => {
    if (visible) setWorking(value ?? todayNoon());
  }, [visible, value]);

  const clamp = (ts: number) => Math.min(todayNoon(), Math.max(todayNoon() - 3650 * DAY, ts));
  const nextDue = startOfDay(working) + intervalDays * DAY;

  const pick = (at: number | null) => {
    onPick(at);
    onClose();
  };

  return (
    <DrilldownSheet
      visible={visible}
      title={t('lastDone.title')}
      onClose={onClose}
      right={
        <Pressable
          onPress={() => pick(working)}
          accessibilityRole="button"
          accessibilityLabel={t('edit.save')}
          style={({ pressed }) => [s.saveBtn, pressed && s.pressed]}
        >
          <Check size={20} color={c.inkButtonText} strokeWidth={2.5} />
        </Pressable>
      }
    >
      <ScrollView contentContainerStyle={s.body}>
        {allowNotDoneYet ? (
          <SheetOption
            label={t('lastDone.notSure')}
            detail={t('lastDone.notSureHint')}
            selected={value == null}
            onPress={() => pick(null)}
          />
        ) : null}

        <View style={s.chipWrap}>
          {QUICK_PICKS.map((q) => {
            const ts = q.get();
            const active = startOfDay(ts) === startOfDay(working);
            return (
              <Pressable
                key={q.key}
                onPress={() => setWorking(ts)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={t(q.key)}
                style={({ pressed }) => [s.chip, active && s.chipSelected, pressed && s.pressed]}
              >
                <Text style={[s.chipText, active && s.chipTextSelected]}>{t(q.key)}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={s.dateRow}>
          <Pressable
            onPress={() => setWorking((w) => clamp(w - DAY))}
            accessibilityRole="button"
            accessibilityLabel={t('lastDone.dayEarlier')}
            style={({ pressed }) => [s.stepBtn, pressed && s.pressed]}
          >
            <Minus size={20} color={c.fg} strokeWidth={2} />
          </Pressable>
          <Text style={s.dateText} accessibilityLiveRegion="polite">
            {formatDate(working, { year: 'numeric', month: 'short', day: 'numeric' })}
          </Text>
          <Pressable
            onPress={() => setWorking((w) => clamp(w + DAY))}
            accessibilityRole="button"
            accessibilityLabel={t('lastDone.dayLater')}
            style={({ pressed }) => [s.stepBtn, pressed && s.pressed]}
          >
            <Plus size={20} color={c.fg} strokeWidth={2} />
          </Pressable>
        </View>

        <Text style={s.preview}>
          {t('lastDone.nextDue', {
            date: formatDate(nextDue, { year: 'numeric', month: 'short', day: 'numeric' }),
          })}
        </Text>
      </ScrollView>
    </DrilldownSheet>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    pressed: { opacity: 0.6 },
    saveBtn: {
      width: target.min,
      height: target.min,
      borderRadius: radius.md,
      backgroundColor: c.inkButton,
      alignItems: 'center',
      justifyContent: 'center',
    },
    body: { ...boundedContent, paddingBottom: space.s9 },
    chipWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: space.s2,
      paddingHorizontal: space.s6,
      paddingTop: space.s5,
    },
    chip: {
      minHeight: target.min,
      justifyContent: 'center',
      paddingHorizontal: space.s4,
      borderRadius: radius.pill,
      backgroundColor: c.bgSubtle,
    },
    chipSelected: { backgroundColor: c.inkButton },
    chipText: { ...ty.sm, fontFamily: fontFamily.sans, color: c.fg },
    chipTextSelected: { color: c.inkButtonText, fontFamily: fontFamily.sansSemibold },
    dateRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: space.s5,
      paddingTop: space.s6,
    },
    stepBtn: {
      width: target.min,
      height: target.min,
      borderRadius: radius.md,
      backgroundColor: c.bgSubtle,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dateText: {
      ...ty.md,
      fontFamily: fontFamily.sansSemibold,
      color: c.fg,
      minWidth: 160,
      textAlign: 'center',
    },
    preview: {
      ...ty.base,
      fontFamily: fontFamily.sans,
      color: c.fgMuted,
      textAlign: 'center',
      paddingTop: space.s4,
    },
  });
}
