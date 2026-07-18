/**
 * Appliance editor — create or edit one appliance, jump to its manual, and
 * see or add the maintenance tasks linked to it. Find manual opens a
 * constructed manufacturer search in the system browser (spec tenet 5: no
 * hosting, no proxying, no tracking). Delete confirms; linked tasks survive
 * and just lose their link (the store never cascades a delete).
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Alert,
  Linking,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check, BookOpen, Plus, ChevronRight } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { useAppliancesStore } from '../store/appliances';
import { useTasksStore } from '../store/tasks';
import { canFindManual, manualSearchUrl } from '../data/appliance';
import { tasksForAppliance } from '../data/task';
import { intervalText } from '../lib/format';
import { ScreenHeader } from '../components/ScreenHeader';
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

type Props = NativeStackScreenProps<RootStackParamList, 'ApplianceEdit'>;

export default function ApplianceEditScreen({ navigation, route }: Props) {
  const { c } = useTheme();
  const s = makeStyles(c);
  const { applianceId } = route.params ?? {};

  const appliances = useAppliancesStore((st) => st.appliances);
  const addAppliance = useAppliancesStore((st) => st.addAppliance);
  const updateAppliance = useAppliancesStore((st) => st.updateAppliance);
  const deleteAppliance = useAppliancesStore((st) => st.deleteAppliance);
  const tasks = useTasksStore((st) => st.tasks);
  const updateTask = useTasksStore((st) => st.updateTask);

  const existing = applianceId ? appliances.find((a) => a.id === applianceId) : undefined;

  const [name, setName] = useState(existing?.name ?? '');
  const [brand, setBrand] = useState(existing?.brand ?? '');
  const [model, setModel] = useState(existing?.model ?? '');
  const [serial, setSerial] = useState(existing?.serial ?? '');
  const [year, setYear] = useState(
    existing?.purchasedAt ? String(new Date(existing.purchasedAt).getFullYear()) : ''
  );
  const [note, setNote] = useState(existing?.note ?? '');

  const valid = name.trim().length > 0;
  const linked = existing ? tasksForAppliance(existing.id, tasks) : [];
  const manualReady = canFindManual({ name, brand, model });

  const parseYear = (): number | undefined => {
    const y = parseInt(year, 10);
    if (!Number.isFinite(y) || y < 1900 || y > new Date().getFullYear() + 1) return undefined;
    return new Date(y, 0, 1).getTime();
  };

  const onSave = () => {
    if (!valid) return;
    const fields = { name, brand, model, serial, purchasedAt: parseYear(), note };
    if (existing) {
      updateAppliance(existing.id, fields);
      navigation.goBack();
    } else {
      addAppliance(fields);
      navigation.goBack();
    }
  };

  const onFindManual = () => {
    Linking.openURL(manualSearchUrl({ name, brand, model })).catch(() => {});
  };

  const onDelete = () => {
    if (!existing) return;
    Alert.alert(t('appliances.deleteConfirmTitle'), t('appliances.deleteConfirmBody'), [
      { text: t('edit.cancel'), style: 'cancel' },
      {
        text: t('appliances.deleteConfirm'),
        style: 'destructive',
        onPress: () => {
          for (const task of linked) updateTask(task.id, { applianceId: undefined });
          deleteAppliance(existing.id);
          navigation.goBack();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right', 'bottom']}>
      <ScreenHeader
        title={existing ? t('appliances.titleEdit') : t('appliances.titleNew')}
        onBack={() => navigation.goBack()}
        right={
          <Pressable
            onPress={onSave}
            disabled={!valid}
            accessibilityRole="button"
            accessibilityLabel={t('appliances.save')}
            style={({ pressed }) => [s.saveBtn, pressed && s.pressed, !valid && s.disabled]}
          >
            <Check size={20} color={c.inkButtonText} strokeWidth={2.5} />
          </Pressable>
        }
      />

      <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
        <Text style={s.label}>{t('appliances.name')}</Text>
        <TextInput
          style={s.input}
          value={name}
          onChangeText={setName}
          placeholder={t('appliances.namePlaceholder')}
          placeholderTextColor={c.fgSubtle}
          accessibilityLabel={t('appliances.name')}
          autoFocus={!existing}
          returnKeyType="done"
        />

        <View style={s.pairRow}>
          <View style={s.pairCol}>
            <Text style={s.label}>{t('appliances.brand')}</Text>
            <TextInput
              style={s.input}
              value={brand}
              onChangeText={setBrand}
              accessibilityLabel={t('appliances.brand')}
              autoCapitalize="words"
              returnKeyType="done"
            />
          </View>
          <View style={s.pairCol}>
            <Text style={s.label}>{t('appliances.model')}</Text>
            <TextInput
              style={s.input}
              value={model}
              onChangeText={setModel}
              accessibilityLabel={t('appliances.model')}
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="done"
            />
          </View>
        </View>

        <Pressable
          onPress={onFindManual}
          disabled={!manualReady}
          accessibilityRole="button"
          accessibilityLabel={t('appliances.findManual')}
          style={({ pressed }) => [s.manualBtn, pressed && s.pressed, !manualReady && s.disabled]}
        >
          <BookOpen size={18} color={c.inkButtonText} strokeWidth={1.5} />
          <Text style={s.manualText}>{t('appliances.findManual')}</Text>
        </Pressable>
        {!manualReady ? <Text style={s.hint}>{t('appliances.findManualHint')}</Text> : null}

        <View style={s.pairRow}>
          <View style={s.pairCol}>
            <Text style={s.label}>{t('appliances.serial')}</Text>
            <TextInput
              style={s.input}
              value={serial}
              onChangeText={setSerial}
              accessibilityLabel={t('appliances.serial')}
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="done"
            />
          </View>
          <View style={s.pairCol}>
            <Text style={s.label}>{t('appliances.purchased')}</Text>
            <TextInput
              style={s.input}
              value={year}
              onChangeText={setYear}
              keyboardType="number-pad"
              accessibilityLabel={t('appliances.purchased')}
              returnKeyType="done"
            />
          </View>
        </View>

        <Text style={s.label}>{t('appliances.note')}</Text>
        <TextInput
          style={[s.input, s.noteInput]}
          value={note}
          onChangeText={setNote}
          accessibilityLabel={t('appliances.note')}
          multiline
          textAlignVertical="top"
        />

        {existing ? (
          <>
            <Text style={s.label}>{t('appliances.linkedTasks')}</Text>
            {linked.length === 0 ? (
              <Text style={s.hint}>{t('appliances.noLinkedTasks')}</Text>
            ) : (
              linked.map((task) => (
                <Pressable
                  key={task.id}
                  onPress={() => navigation.navigate('TaskEdit', { taskId: task.id })}
                  accessibilityRole="button"
                  accessibilityLabel={task.name}
                  style={({ pressed }) => [s.linkedRow, pressed && s.pressed]}
                >
                  <View style={s.linkedText}>
                    <Text style={s.linkedName}>{task.name}</Text>
                    <Text style={s.linkedMeta}>{intervalText(task.intervalDays)}</Text>
                  </View>
                  <ChevronRight size={16} color={c.fgSubtle} strokeWidth={1.5} />
                </Pressable>
              ))
            )}
            <Pressable
              onPress={() => navigation.navigate('TaskEdit', { applianceId: existing.id })}
              accessibilityRole="button"
              accessibilityLabel={t('appliances.addLinkedTask')}
              style={({ pressed }) => [s.addLinked, pressed && s.pressed]}
            >
              <Plus size={16} color={c.fg} strokeWidth={2} />
              <Text style={s.addLinkedText}>{t('appliances.addLinkedTask')}</Text>
            </Pressable>

            <Pressable
              onPress={onDelete}
              accessibilityRole="button"
              accessibilityLabel={t('appliances.delete')}
              style={({ pressed }) => [s.deleteBtn, pressed && s.pressed]}
            >
              <Text style={s.deleteText}>{t('appliances.delete')}</Text>
            </Pressable>
          </>
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
    noteInput: {
      minHeight: target.min * 1.6,
      paddingTop: space.s3,
      paddingBottom: space.s3,
    },
    pairRow: { flexDirection: 'row', gap: space.s4 },
    pairCol: { flex: 1, gap: space.s3 },
    manualBtn: {
      marginTop: space.s5,
      minHeight: target.min,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: space.s3,
      borderRadius: radius.md,
      backgroundColor: c.inkButton,
    },
    manualText: { ...ty.base, fontFamily: fontFamily.sansSemibold, color: c.inkButtonText },
    hint: { ...ty.sm, fontFamily: fontFamily.sans, color: c.fgMuted },
    linkedRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s3,
      minHeight: target.min,
      borderBottomWidth: hairline,
      borderBottomColor: c.hairline,
    },
    linkedText: { flex: 1, gap: 2 },
    linkedName: { ...ty.base, fontFamily: fontFamily.sans, color: c.fg },
    linkedMeta: { ...ty.sm, fontFamily: fontFamily.sans, color: c.fgMuted },
    addLinked: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s2,
      minHeight: target.min,
    },
    addLinkedText: { ...ty.base, fontFamily: fontFamily.sansSemibold, color: c.fg },
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
