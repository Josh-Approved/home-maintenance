/**
 * Reminder-timing spoke: three preset pickers on one sheet — when the first
 * reminder fires (on the due day or ahead of it), whether it repeats while
 * the task stays not-done, and how many follow-ups before going quiet. All
 * presets, no free-form numbers; each tap applies to the hub's draft
 * immediately (single-select rows, like the category spoke).
 */

import React from 'react';
import { Text, ScrollView, StyleSheet } from 'react-native';
import {
  REMINDER_LEAD_PRESETS,
  REMINDER_REPEAT_PRESETS,
  REMINDER_COUNT_PRESETS,
} from '../data/task';
import { DrilldownSheet, SheetOption } from './DrilldownSheet';
import { t } from '../i18n';
import { useTheme, fontFamily, space, type as ty, boundedContent, type Colors } from '../theme';

/** Label for a first-reminder offset; tolerates non-preset (imported) values. */
export function leadLabel(leadDays: number): string {
  return (REMINDER_LEAD_PRESETS as readonly number[]).includes(leadDays)
    ? t(`edit.lead${leadDays}`)
    : t('edit.leadCustom', { days: String(leadDays) });
}

/** Label for a follow-up cadence; null = just once. */
export function repeatLabel(repeatDays: number | null): string {
  if (repeatDays == null) return t('edit.repeatNever');
  return (REMINDER_REPEAT_PRESETS as readonly (number | null)[]).includes(repeatDays)
    ? t(`edit.repeat${repeatDays}`)
    : t('edit.repeatCustom', { days: String(repeatDays) });
}

/** Label for a follow-up count; null = until done. */
export function countLabel(repeatCount: number | null): string {
  if (repeatCount == null) return t('edit.countUntilDone');
  return (REMINDER_COUNT_PRESETS as readonly (number | null)[]).includes(repeatCount)
    ? t(`edit.count${repeatCount}`)
    : t('edit.countCustom', { count: String(repeatCount) });
}

/** One-line receipt for the hub row: "1 week early · Every week". */
export function reminderSummary(leadDays: number, repeatDays: number | null): string {
  const lead = leadLabel(leadDays);
  return repeatDays == null ? lead : `${lead} · ${repeatLabel(repeatDays)}`;
}

type Props = {
  visible: boolean;
  leadDays: number;
  repeatDays: number | null;
  repeatCount: number | null;
  /** The task's repeat interval — first-reminder offsets must stay inside it. */
  intervalDays: number;
  onClose: () => void;
  onChange: (next: {
    leadDays?: number;
    repeatDays?: number | null;
    repeatCount?: number | null;
  }) => void;
};

export function ReminderSheet({
  visible,
  leadDays,
  repeatDays,
  repeatCount,
  intervalDays,
  onClose,
  onChange,
}: Props) {
  const { c } = useTheme();
  const s = makeStyles(c);
  const leadChoices = REMINDER_LEAD_PRESETS.filter((p) => p === 0 || p < intervalDays);

  return (
    <DrilldownSheet visible={visible} title={t('edit.reminderTiming')} onClose={onClose}>
      <ScrollView contentContainerStyle={s.body}>
        <Text style={s.sectionLabel}>{t('edit.firstReminder')}</Text>
        {leadChoices.map((p) => (
          <SheetOption
            key={p}
            label={leadLabel(p)}
            selected={leadDays === p}
            onPress={() => onChange({ leadDays: p })}
          />
        ))}

        <Text style={s.sectionLabel}>{t('edit.remindAgain')}</Text>
        <Text style={s.sectionHint}>{t('edit.remindAgainHint')}</Text>
        {REMINDER_REPEAT_PRESETS.map((p) => (
          <SheetOption
            key={String(p)}
            label={repeatLabel(p)}
            selected={repeatDays === p}
            onPress={() => onChange({ repeatDays: p })}
          />
        ))}

        {repeatDays != null ? (
          <>
            <Text style={s.sectionLabel}>{t('edit.stopAfter')}</Text>
            {REMINDER_COUNT_PRESETS.map((p) => (
              <SheetOption
                key={String(p)}
                label={countLabel(p)}
                selected={repeatCount === p}
                onPress={() => onChange({ repeatCount: p })}
              />
            ))}
          </>
        ) : null}
      </ScrollView>
    </DrilldownSheet>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    body: { paddingBottom: space.s9 },
    sectionLabel: {
      ...boundedContent,
      ...ty.xs,
      fontFamily: fontFamily.sansSemibold,
      color: c.fgMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      paddingHorizontal: space.s6,
      paddingTop: space.s6,
      paddingBottom: space.s2,
    },
    sectionHint: {
      ...boundedContent,
      ...ty.sm,
      fontFamily: fontFamily.sans,
      color: c.fgMuted,
      paddingHorizontal: space.s6,
      paddingBottom: space.s2,
    },
  });
}
