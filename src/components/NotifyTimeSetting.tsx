/**
 * App-wide notification-time setting: one preset hour every reminder fires
 * at (per-task times would be flexibility nobody needs). Presets, locale-
 * formatted; picking one persists and reschedules everything immediately.
 */

import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { atHour, DEFAULT_NOTIFY_HOUR } from '../data/task';
import { getNotifyHour, setNotifyHour, syncReminders, NOTIFY_HOUR_PRESETS } from '../lib/reminders';
import { useTasksStore } from '../store/tasks';
import { DrilldownRow } from './DrilldownRow';
import { DrilldownSheet, SheetOption } from './DrilldownSheet';
import { t, formatDate } from '../i18n';

function hourText(hour: number): string {
  return formatDate(atHour(Date.now(), hour), { hour: 'numeric', minute: '2-digit' });
}

export function NotifyTimeSetting() {
  const [hour, setHour] = useState<number>(DEFAULT_NOTIFY_HOUR);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    getNotifyHour().then(setHour).catch(() => {});
  }, []);

  const onPick = (next: number) => {
    setHour(next);
    setOpen(false);
    void setNotifyHour(next).then(() => {
      const { tasks, completions } = useTasksStore.getState();
      syncReminders(tasks, completions);
    });
  };

  return (
    <View>
      <DrilldownRow
        label={t('settings.notifyTime')}
        value={hourText(hour)}
        onPress={() => setOpen(true)}
      />
      <DrilldownSheet visible={open} title={t('settings.notifyTime')} onClose={() => setOpen(false)}>
        {NOTIFY_HOUR_PRESETS.map((h) => (
          <SheetOption key={h} label={hourText(h)} selected={hour === h} onPress={() => onPick(h)} />
        ))}
      </DrilldownSheet>
    </View>
  );
}
