/**
 * Task editor — create or edit one maintenance task. The interval is a count
 * plus a unit (every 3 months) stored canonically as days. Turning the
 * reminder on is the app's ONLY notification-permission ask, in context.
 * Editing also shows the completion history; delete confirms and is
 * reachable identically on both platforms (Alert.alert, never ActionSheetIOS).
 */

import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Switch, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check, CircleCheck } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { useTasksStore } from '../store/tasks';
import { useAppliancesStore } from '../store/appliances';
import { completionsFor, clampIntervalDays, DAY } from '../data/task';
import { activeAppliances } from '../data/appliance';
import { CATEGORIES, type CategoryId } from '../data/library';
import { ensureNotificationPermission } from '../lib/reminders';
import { ScreenHeader } from '../components/ScreenHeader';
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

const UNITS = [
  { key: 'intervalDays', days: 1 },
  { key: 'intervalWeeks', days: 7 },
  { key: 'intervalMonths', days: 30 },
  { key: 'intervalYears', days: 365 },
] as const;

function decompose(intervalDays: number): { count: string; unitDays: number } {
  for (const unit of [...UNITS].reverse()) {
    if (intervalDays % unit.days === 0 && intervalDays >= unit.days) {
      return { count: String(intervalDays / unit.days), unitDays: unit.days };
    }
  }
  return { count: String(intervalDays), unitDays: 1 };
}

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
  const appliances = useAppliancesStore((st) => st.appliances);

  const existing = taskId ? tasks.find((task) => task.id === taskId) : undefined;
  const initial = useMemo(() => decompose(existing?.intervalDays ?? 90), [existing?.intervalDays]);

  const [name, setName] = useState(existing?.name ?? '');
  const [category, setCategory] = useState<CategoryId>(existing?.category ?? 'general');
  const [countText, setCountText] = useState(initial.count);
  const [unitDays, setUnitDays] = useState(initial.unitDays);
  const [applianceId, setApplianceId] = useState<string | undefined>(
    existing?.applianceId ?? prelinkedApplianceId
  );
  const [reminder, setReminder] = useState(existing?.reminder ?? true);
  const [note, setNote] = useState(existing?.note ?? '');
  // New tasks only: when was this last done? 'unknown' anchors now (due in one
  // interval); 'today' records a completion; 'ago' anchors one interval back so
  // the task starts due today (the add-an-already-overdue-task case).
  const [lastDone, setLastDone] = useState<'unknown' | 'today' | 'ago'>('unknown');

  const count = parseInt(countText, 10);
  const valid = name.trim().length > 0 && Number.isFinite(count) && count > 0;
  const history = existing ? completionsFor(existing.id, completions) : [];
  const linkableAppliances = activeAppliances(appliances);

  const onToggleReminder = async (next: boolean) => {
    setReminder(next);
    if (next) {
      const ok = await ensureNotificationPermission();
      if (!ok) setReminder(false);
    }
  };

  const onSave = () => {
    if (!valid) return;
    const intervalDays = clampIntervalDays(count * unitDays);
    const fields = {
      name,
      category,
      intervalDays,
      applianceId,
      reminder,
      note: note || undefined,
    };
    if (existing) {
      updateTask(existing.id, fields);
    } else {
      const anchorAt = lastDone === 'ago' ? Date.now() - intervalDays * DAY : undefined;
      const id = addTask({ ...fields, anchorAt });
      if (lastDone === 'today') markDone(id);
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

        <Text style={s.label}>{t('edit.category')}</Text>
        <View style={s.chipWrap}>
          {CATEGORIES.map((cat) => (
            <Pressable
              key={cat}
              onPress={() => setCategory(cat)}
              accessibilityRole="button"
              accessibilityState={{ selected: category === cat }}
              accessibilityLabel={t(`category.${cat}`)}
              style={({ pressed }) => [
                s.chip,
                category === cat && s.chipSelected,
                pressed && s.pressed,
              ]}
            >
              <Text style={[s.chipText, category === cat && s.chipTextSelected]}>
                {t(`category.${cat}`)}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={s.label}>{t('edit.interval')}</Text>
        <View style={s.intervalRow}>
          <TextInput
            style={s.countInput}
            value={countText}
            onChangeText={setCountText}
            keyboardType="number-pad"
            accessibilityLabel={t('edit.interval')}
            selectTextOnFocus
            returnKeyType="done"
          />
          <View style={s.unitRow}>
            {UNITS.map((unit) => (
              <Pressable
                key={unit.key}
                onPress={() => setUnitDays(unit.days)}
                accessibilityRole="button"
                accessibilityState={{ selected: unitDays === unit.days }}
                accessibilityLabel={t(`edit.${unit.key}`)}
                style={({ pressed }) => [
                  s.chip,
                  unitDays === unit.days && s.chipSelected,
                  pressed && s.pressed,
                ]}
              >
                <Text style={[s.chipText, unitDays === unit.days && s.chipTextSelected]}>
                  {t(`edit.${unit.key}`)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {!existing ? (
          <>
            <Text style={s.label}>{t('edit.lastDoneQuestion')}</Text>
            <View style={s.chipWrap}>
              {([
                ['unknown', 'edit.lastDoneSkip'],
                ['today', 'edit.lastDoneToday'],
                ['ago', 'edit.lastDoneAgo'],
              ] as const).map(([key, labelKey]) => (
                <Pressable
                  key={key}
                  onPress={() => setLastDone(key)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: lastDone === key }}
                  accessibilityLabel={t(labelKey)}
                  style={({ pressed }) => [
                    s.chip,
                    lastDone === key && s.chipSelected,
                    pressed && s.pressed,
                  ]}
                >
                  <Text style={[s.chipText, lastDone === key && s.chipTextSelected]}>
                    {t(labelKey)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}

        {linkableAppliances.length > 0 ? (
          <>
            <Text style={s.label}>{t('edit.appliance')}</Text>
            <View style={s.chipWrap}>
              <Pressable
                onPress={() => setApplianceId(undefined)}
                accessibilityRole="button"
                accessibilityState={{ selected: applianceId == null }}
                accessibilityLabel={t('edit.applianceNone')}
                style={({ pressed }) => [
                  s.chip,
                  applianceId == null && s.chipSelected,
                  pressed && s.pressed,
                ]}
              >
                <Text style={[s.chipText, applianceId == null && s.chipTextSelected]}>
                  {t('edit.applianceNone')}
                </Text>
              </Pressable>
              {linkableAppliances.map((a) => (
                <Pressable
                  key={a.id}
                  onPress={() => setApplianceId(a.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: applianceId === a.id }}
                  accessibilityLabel={a.name}
                  style={({ pressed }) => [
                    s.chip,
                    applianceId === a.id && s.chipSelected,
                    pressed && s.pressed,
                  ]}
                >
                  <Text style={[s.chipText, applianceId === a.id && s.chipTextSelected]}>
                    {a.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}

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

        <Text style={s.label}>{t('edit.note')}</Text>
        <TextInput
          style={s.input}
          value={note}
          onChangeText={setNote}
          placeholder={t('edit.notePlaceholder')}
          placeholderTextColor={c.fgSubtle}
          accessibilityLabel={t('edit.note')}
          returnKeyType="done"
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
    </SafeAreaView>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
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
    chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s2 },
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
    intervalRow: { gap: space.s3 },
    countInput: {
      minHeight: target.min,
      width: 96,
      paddingHorizontal: space.s4,
      borderRadius: radius.md,
      backgroundColor: c.bgSubtle,
      fontFamily: fontFamily.mono,
      fontSize: 20,
      color: c.fg,
    },
    unitRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s2 },
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
