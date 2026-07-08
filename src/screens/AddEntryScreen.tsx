/**
 * Log a new entry — the core action of the archetype: a numeric amount + an
 * optional note. Save writes it and returns home, where the summaries update.
 * This is the Tier-2 outcome assertion in qa/journey.json (a noted entry is
 * absent before save, present after).
 */

import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { useEntriesStore } from '../store/entries';
import { ScreenHeader } from '../components/ScreenHeader';
import { t } from '../i18n';
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

type Props = NativeStackScreenProps<RootStackParamList, 'AddEntry'>;

export default function AddEntryScreen({ navigation }: Props) {
  const { c } = useTheme();
  const s = makeStyles(c);
  const addEntry = useEntriesStore((st) => st.addEntry);

  const [valueText, setValueText] = useState('1');
  const [note, setNote] = useState('');

  const value = parseFloat(valueText.replace(',', '.'));
  const valid = Number.isFinite(value);

  const onSave = () => {
    if (!valid) return;
    addEntry(value, note);
    navigation.goBack();
  };

  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right', 'bottom']}>
      <ScreenHeader
        title={t('entry.title')}
        onBack={() => navigation.goBack()}
        right={
          <Pressable
            onPress={onSave}
            disabled={!valid}
            accessibilityRole="button"
            accessibilityLabel={t('entry.save')}
            style={({ pressed }) => [s.saveBtn, pressed && s.pressed, !valid && s.disabled]}
          >
            <Check size={20} color={c.fgOnInk} strokeWidth={2.5} />
          </Pressable>
        }
      />

      <View style={s.body}>
        <Text style={s.label}>{t('entry.value')}</Text>
        <TextInput
          style={s.valueInput}
          value={valueText}
          onChangeText={setValueText}
          keyboardType="numeric"
          accessibilityLabel={t('entry.value')}
          selectTextOnFocus
          autoFocus
        />

        <Text style={s.label}>{t('entry.note')}</Text>
        <TextInput
          style={s.noteInput}
          value={note}
          onChangeText={setNote}
          onSubmitEditing={onSave}
          placeholder={t('entry.notePlaceholder')}
          accessibilityLabel={t('entry.note')}
          placeholderTextColor={c.fgSubtle}
          returnKeyType="done"
        />
      </View>
    </SafeAreaView>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    pressed: { opacity: 0.6 },
    disabled: { opacity: 0.4 },
    body: { ...boundedContent, paddingHorizontal: space.s6, paddingTop: space.s5, gap: space.s3 },
    label: {
      ...ty.xs,
      fontFamily: fontFamily.sansSemibold,
      color: c.fgMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      paddingTop: space.s4,
    },
    valueInput: {
      fontFamily: fontFamily.mono,
      fontSize: 40,
      lineHeight: 48,
      color: c.fg,
      paddingVertical: space.s2,
    },
    noteInput: {
      minHeight: target.min,
      paddingHorizontal: space.s4,
      borderRadius: radius.md,
      backgroundColor: c.bgSubtle,
      ...ty.base,
      fontFamily: fontFamily.sans,
      color: c.fg,
    },
    saveBtn: {
      width: target.min,
      height: target.min,
      borderRadius: radius.md,
      backgroundColor: c.inkButton,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}
