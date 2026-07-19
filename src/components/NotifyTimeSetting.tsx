/**
 * App-wide notification-time setting: one preset hour every reminder fires
 * at (per-task times would be flexibility nobody needs). The row lives in
 * the Settings scroll; the pane must be rendered by the SCREEN at its root
 * (design system § Hub-and-spoke drill-downs), so this module exports the
 * pieces — a state hook, the row value formatter, and the pane — and
 * SettingsScreen composes them. Picking an hour persists and reschedules
 * everything immediately.
 */

import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { atHour, DEFAULT_NOTIFY_HOUR } from '../data/task';
import { getNotifyHour, setNotifyHour, syncReminders, NOTIFY_HOUR_PRESETS } from '../lib/reminders';
import { useTasksStore } from '../store/tasks';
import { DrilldownSheet } from './DrilldownSheet';
import { OptionChips } from './OptionChips';
import { t, formatDate } from '../i18n';
import { space, boundedContent } from '../theme';

export function hourText(hour: number): string {
  return formatDate(atHour(Date.now(), hour), { hour: 'numeric', minute: '2-digit' });
}

/** Current notify hour + a picker that persists and reschedules. */
export function useNotifyHour(): [number, (h: number) => void] {
  const [hour, setHour] = useState<number>(DEFAULT_NOTIFY_HOUR);

  useEffect(() => {
    getNotifyHour().then(setHour).catch(() => {});
  }, []);

  const pick = (next: number) => {
    setHour(next);
    void setNotifyHour(next).then(() => {
      const { tasks, completions } = useTasksStore.getState();
      syncReminders(tasks, completions);
    });
  };

  return [hour, pick];
}

type PaneProps = {
  visible: boolean;
  hour: number;
  onClose: () => void;
  onPick: (hour: number) => void;
};

export function NotifyTimePane({ visible, hour, onClose, onPick }: PaneProps) {
  return (
    <DrilldownSheet visible={visible} title={t('settings.notifyTime')} onClose={onClose}>
      <View style={s.body}>
        <OptionChips
          options={NOTIFY_HOUR_PRESETS.map((h) => ({ key: String(h), label: hourText(h) }))}
          selectedKey={String(hour)}
          onPick={(k) => onPick(Number(k))}
        />
      </View>
    </DrilldownSheet>
  );
}

const s = StyleSheet.create({
  body: { ...boundedContent, paddingHorizontal: space.s6, paddingTop: space.s5 },
});
