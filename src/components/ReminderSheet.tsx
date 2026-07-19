/**
 * Reminder-timing spoke: three preset pickers on one pane — when the first
 * reminder fires (on the due day or ahead of it), whether it repeats while
 * the task stays not-done, and how many follow-ups before going quiet. Each
 * group is a short single-select set, so it renders as OptionChips (design
 * system § Hub-and-spoke drill-downs), applying to the hub's draft
 * immediately on tap.
 */

import React from 'react';
import { Text, ScrollView, StyleSheet } from 'react-native';
import {
  REMINDER_LEAD_PRESETS,
  REMINDER_REPEAT_PRESETS,
  REMINDER_COUNT_PRESETS,
} from '../data/task';
import { DrilldownSheet } from './DrilldownSheet';
import { OptionChips } from './OptionChips';
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
        <OptionChips
          options={leadChoices.map((p) => ({ key: String(p), label: leadLabel(p) }))}
          selectedKey={String(leadDays)}
          onPick={(k) => onChange({ leadDays: Number(k) })}
        />

        <Text style={s.sectionLabel}>{t('edit.remindAgain')}</Text>
        <Text style={s.sectionHint}>{t('edit.remindAgainHint')}</Text>
        <OptionChips
          options={REMINDER_REPEAT_PRESETS.map((p) => ({
            key: p == null ? 'never' : String(p),
            label: repeatLabel(p),
          }))}
          selectedKey={repeatDays == null ? 'never' : String(repeatDays)}
          onPick={(k) => onChange({ repeatDays: k === 'never' ? null : Number(k) })}
        />

        {repeatDays != null ? (
          <>
            <Text style={s.sectionLabel}>{t('edit.stopAfter')}</Text>
            <OptionChips
              options={REMINDER_COUNT_PRESETS.map((p) => ({
                key: p == null ? 'untilDone' : String(p),
                label: countLabel(p),
              }))}
              selectedKey={repeatCount == null ? 'untilDone' : String(repeatCount)}
              onPick={(k) => onChange({ repeatCount: k === 'untilDone' ? null : Number(k) })}
            />
          </>
        ) : null}
      </ScrollView>
    </DrilldownSheet>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    body: {
      ...boundedContent,
      paddingHorizontal: space.s6,
      paddingBottom: space.s9,
    },
    sectionLabel: {
      ...ty.xs,
      fontFamily: fontFamily.sansSemibold,
      color: c.fgMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      paddingTop: space.s6,
      paddingBottom: space.s3,
    },
    sectionHint: {
      ...ty.sm,
      fontFamily: fontFamily.sans,
      color: c.fgMuted,
      paddingBottom: space.s3,
    },
  });
}
