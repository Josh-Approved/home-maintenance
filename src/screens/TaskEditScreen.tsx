/**
 * Task editor — the hub screen for one maintenance task. Identity fields
 * (name, note) and the binary reminder stay inline; every deeper dimension —
 * category, repeat interval, appliance link, last-done date — is a summary
 * row that opens its own focused sheet (the hub-and-spoke pattern), so the
 * hub always reads as a receipt of the current state. Turning the reminder on
 * is the app's ONLY notification-permission ask, in context. Editing also
 * shows the completion history; delete confirms and is reachable identically
 * on both platforms (Alert.alert, never ActionSheetIOS).
 */

import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Switch, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check, CircleCheck } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { useTasksStore } from '../store/tasks';
import { useAppliancesStore } from '../store/appliances';
import { completionsFor, lastDoneAt } from '../data/task';
import { LIBRARY, type CategoryId } from '../data/library';
import { intervalText } from '../lib/format';
import { ensureNotificationPermission } from '../lib/reminders';
import { ScreenHeader } from '../components/ScreenHeader';
import { DrilldownRow } from '../components/DrilldownRow';
import { CategorySheet } from '../components/CategorySheet';
import { IntervalSheet } from '../components/IntervalSheet';
import { ApplianceSheet } from '../components/ApplianceSheet';
import { LastDoneSheet } from '../components/LastDoneSheet';
import { ReminderSheet, reminderSummary } from '../components/ReminderSheet';
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

type Props = NativeStackScreenProps<RootStackParamList, 'TaskEdit'>;
type SheetId = 'category' | 'interval' | 'appliance' | 'lastDone' | 'reminderTiming' | null;

export default function TaskEditScreen({ navigation, route }: Props) {
  const { c } = useTheme();
  const s = makeStyles(c);
  const { taskId, applianceId: prelinkedApplianceId } = route.params ?? {};

  const tasks = useTasksStore((st) => st.tasks);
  const completions = useTasksStore((st) => st.completions);
  const addTask = useTasksStore((st) => st.addTask);
  const updateTask = useTasksStore((st) => st.updateTask);
  const deleteTask = useTasksStore((st) => st.deleteTask);
  const markDone = useTasksStore((st) => st.markDone);
  const setLastDone = useTasksStore((st) => st.setLastDone);
  const appliances = useAppliancesStore((st) => st.appliances);

  const existing = taskId ? tasks.find((task) => task.id === taskId) : undefined;
  const existingLastDone = existing ? lastDoneAt(existing.id, completions) : null;

  const [name, setName] = useState(existing?.name ?? '');
  const [category, setCategory] = useState<CategoryId>(existing?.category ?? 'general');
  const [intervalDays, setIntervalDays] = useState(existing?.intervalDays ?? 90);
  const [applianceId, setApplianceId] = useState<string | undefined>(
    existing?.applianceId ?? prelinkedApplianceId
  );
  const [reminder, setReminder] = useState(existing?.reminder ?? true);
  const [reminderLeadDays, setReminderLeadDays] = useState(existing?.reminderLeadDays ?? 0);
  const [reminderRepeatDays, setReminderRepeatDays] = useState<number | null>(
    existing ? existing.reminderRepeatDays : 7
  );
  const [reminderRepeatCount, setReminderRepeatCount] = useState<number | null>(
    existing ? existing.reminderRepeatCount : 3
  );
  const [note, setNote] = useState(existing?.note ?? '');
  /** Draft last-done date; applied on save so backing out abandons it. */
  const [lastDone, setLastDoneDraft] = useState<number | null>(existingLastDone);
  const [sheet, setSheet] = useState<SheetId>(null);

  const valid = name.trim().length > 0;
  const history = existing ? completionsFor(existing.id, completions) : [];
  const linkedAppliance = applianceId ? appliances.find((a) => a.id === applianceId) : undefined;
  const suggestedAppliance = existing?.libraryId
    ? LIBRARY.find((item) => item.id === existing.libraryId)?.appliance
    : undefined;

  const onToggleReminder = async (next: boolean) => {
    setReminder(next);
    if (next) {
      const ok = await ensureNotificationPermission();
      if (!ok) setReminder(false);
    }
  };

  const onSave = () => {
    if (!valid) return;
    const fields = {
      name,
      category,
      intervalDays,
      applianceId,
      reminder,
      reminderLeadDays,
      reminderRepeatDays,
      reminderRepeatCount,
      note: note || undefined,
    };
    if (existing) {
      updateTask(existing.id, fields);
      if (lastDone != null && lastDone !== existingLastDone) setLastDone(existing.id, lastDone);
    } else {
      const id = addTask(fields);
      if (lastDone != null) markDone(id, lastDone);
    }
    navigation.goBack();
  };

  const onDelete = () => {
    if (!existing) return;
    Alert.alert(t('edit.deleteConfirmTitle'), t('edit.deleteConfirmBody'), [
      { text: t('edit.cancel'), style: 'cancel' },
      {
        text: t('edit.deleteConfirm'),
        style: 'destructive',
        onPress: () => {
          deleteTask(existing.id);
          navigation.goBack();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right', 'bottom']}>
      <View
        style={s.hub}
        accessibilityElementsHidden={sheet != null}
        importantForAccessibility={sheet != null ? 'no-hide-descendants' : 'auto'}
      >
      <ScreenHeader
        title={existing ? t('edit.titleEdit') : t('edit.titleNew')}
        onBack={() => navigation.goBack()}
        right={
          <Pressable
            onPress={onSave}
            disabled={!valid}
            accessibilityRole="button"
            accessibilityLabel={t('edit.save')}
            style={({ pressed }) => [s.saveBtn, pressed && s.pressed, !valid && s.disabled]}
          >
            <Check size={20} color={c.inkButtonText} strokeWidth={2.5} />
          </Pressable>
        }
      />

      <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
        <Text style={s.label}>{t('edit.name')}</Text>
        <TextInput
          style={s.input}
          value={name}
          onChangeText={setName}
          placeholder={t('edit.namePlaceholder')}
          placeholderTextColor={c.fgSubtle}
          accessibilityLabel={t('edit.name')}
          autoFocus={!existing}
          returnKeyType="done"
        />

        <View style={s.rows}>
          <DrilldownRow
            label={t('edit.category')}
            value={t(`category.${category}`)}
            onPress={() => setSheet('category')}
          />
          <DrilldownRow
            label={t('edit.repeats')}
            value={intervalText(intervalDays)}
            onPress={() => setSheet('interval')}
          />
          <DrilldownRow
            label={t('edit.appliance')}
            value={linkedAppliance?.name ?? t('edit.applianceNone')}
            placeholder={!linkedAppliance}
            onPress={() => setSheet('appliance')}
          />
          <DrilldownRow
            label={t('edit.lastDone')}
            value={
              lastDone != null
                ? formatDate(lastDone, { year: 'numeric', month: 'short', day: 'numeric' })
                : t('edit.lastDoneNotSet')
            }
            placeholder={lastDone == null}
            onPress={() => setSheet('lastDone')}
          />
        </View>

        <View style={s.reminderRow}>
          <View style={s.reminderText}>
            <Text style={s.reminderTitle}>{t('edit.reminder')}</Text>
            <Text style={s.reminderHint}>{t('edit.reminderHint')}</Text>
          </View>
          <Switch
            value={reminder}
            onValueChange={onToggleReminder}
            accessibilityLabel={t('edit.reminder')}
          />
        </View>

        {reminder ? (
          <View style={s.rows}>
            <DrilldownRow
              label={t('edit.reminderTiming')}
              value={reminderSummary(reminderLeadDays, reminderRepeatDays)}
              onPress={() => setSheet('reminderTiming')}
            />
          </View>
        ) : null}

        <Text style={s.label}>{t('edit.note')}</Text>
        <TextInput
          style={[s.input, s.noteInput]}
          value={note}
          onChangeText={setNote}
          placeholder={t('edit.notePlaceholder')}
          placeholderTextColor={c.fgSubtle}
          accessibilityLabel={t('edit.note')}
          multiline
          textAlignVertical="top"
        />

        {existing && history.length > 0 ? (
          <>
            <Text style={s.label}>{t('edit.history')}</Text>
            {history.map((h) => (
              <View key={h.id} style={s.historyRow}>
                <CircleCheck size={16} color={c.success} strokeWidth={1.5} />
                <Text style={s.historyDate}>
                  {formatDate(h.at, { year: 'numeric', month: 'short', day: 'numeric' })}
                </Text>
              </View>
            ))}
          </>
        ) : null}

        {existing ? (
          <Pressable
            onPress={onDelete}
            accessibilityRole="button"
            accessibilityLabel={t('edit.delete')}
            style={({ pressed }) => [s.deleteBtn, pressed && s.pressed]}
          >
            <Text style={s.deleteText}>{t('edit.delete')}</Text>
          </Pressable>
        ) : null}
      </ScrollView>
      </View>

      <CategorySheet
        visible={sheet === 'category'}
        value={category}
        onClose={() => setSheet(null)}
        onPick={setCategory}
      />
      <IntervalSheet
        visible={sheet === 'interval'}
        value={intervalDays}
        onClose={() => setSheet(null)}
        onPick={(days) => {
          setIntervalDays(days);
          // A first reminder can't lead by a full interval — keep the receipt honest.
          if (reminderLeadDays >= days) setReminderLeadDays(0);
        }}
      />
      <ApplianceSheet
        visible={sheet === 'appliance'}
        value={applianceId}
        suggestedName={suggestedAppliance}
        onClose={() => setSheet(null)}
        onPick={setApplianceId}
      />
      <LastDoneSheet
        visible={sheet === 'lastDone'}
        value={lastDone}
        intervalDays={intervalDays}
        allowNotDoneYet={history.length === 0}
        onClose={() => setSheet(null)}
        onPick={setLastDoneDraft}
      />
      <ReminderSheet
        visible={sheet === 'reminderTiming'}
        leadDays={reminderLeadDays}
        repeatDays={reminderRepeatDays}
        repeatCount={reminderRepeatCount}
        intervalDays={intervalDays}
        onClose={() => setSheet(null)}
        onChange={(next) => {
          if (next.leadDays !== undefined) setReminderLeadDays(next.leadDays);
          if (next.repeatDays !== undefined) setReminderRepeatDays(next.repeatDays);
          if (next.repeatCount !== undefined) setReminderRepeatCount(next.repeatCount);
        }}
      />
    </SafeAreaView>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    hub: { flex: 1 },
    pressed: { opacity: 0.6 },
    disabled: { opacity: 0.4 },
    saveBtn: {
      width: target.min,
      height: target.min,
      borderRadius: radius.md,
      backgroundColor: c.inkButton,
      alignItems: 'center',
      justifyContent: 'center',
    },
    body: { ...boundedContent, paddingHorizontal: space.s6, paddingBottom: space.s9, gap: space.s3 },
    label: {
      ...ty.xs,
      fontFamily: fontFamily.sansSemibold,
      color: c.fgMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      paddingTop: space.s5,
    },
    input: {
      minHeight: target.min,
      paddingHorizontal: space.s4,
      borderRadius: radius.md,
      backgroundColor: c.bgSubtle,
      ...ty.base,
      fontFamily: fontFamily.sans,
      color: c.fg,
    },
    noteInput: {
      minHeight: target.min * 1.6,
      paddingTop: space.s3,
      paddingBottom: space.s3,
    },
    rows: { paddingTop: space.s3 },
    reminderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s4,
      paddingTop: space.s5,
      minHeight: target.min,
    },
    reminderText: { flex: 1, gap: 2 },
    reminderTitle: { ...ty.base, fontFamily: fontFamily.sans, color: c.fg },
    reminderHint: { ...ty.sm, fontFamily: fontFamily.sans, color: c.fgMuted },
    historyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s3,
      minHeight: 32,
      borderBottomWidth: hairline,
      borderBottomColor: c.hairline,
    },
    historyDate: { ...ty.sm, fontFamily: fontFamily.sans, color: c.fgMuted },
    deleteBtn: {
      marginTop: space.s7,
      minHeight: target.min,
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: radius.md,
      borderWidth: hairline,
      borderColor: c.hairline,
    },
    deleteText: { ...ty.base, fontFamily: fontFamily.sans, color: c.danger },
  });
}
