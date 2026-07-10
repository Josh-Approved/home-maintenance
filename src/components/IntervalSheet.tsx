/**
 * Repeat-interval spoke: a count plus a unit (every 3 months), confirmed
 * explicitly since the two fields only make sense together. The preview line
 * restates the choice in words so a slip (3 years vs 3 months) is visible
 * before it lands.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { Check } from 'lucide-react-native';
import { clampIntervalDays } from '../data/task';
import { intervalText } from '../lib/format';
import { DrilldownSheet } from './DrilldownSheet';
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

export const UNITS = [
  { key: 'intervalDays', days: 1 },
  { key: 'intervalWeeks', days: 7 },
  { key: 'intervalMonths', days: 30 },
  { key: 'intervalYears', days: 365 },
] as const;

export function decompose(intervalDays: number): { count: string; unitDays: number } {
  for (const unit of [...UNITS].reverse()) {
    if (intervalDays % unit.days === 0 && intervalDays >= unit.days) {
      return { count: String(intervalDays / unit.days), unitDays: unit.days };
    }
  }
  return { count: String(intervalDays), unitDays: 1 };
}

type Props = {
  visible: boolean;
  value: number;
  onClose: () => void;
  onPick: (intervalDays: number) => void;
};

export function IntervalSheet({ visible, value, onClose, onPick }: Props) {
  const { c } = useTheme();
  const s = makeStyles(c);
  const [countText, setCountText] = useState('3');
  const [unitDays, setUnitDays] = useState(30);

  useEffect(() => {
    if (visible) {
      const initial = decompose(value);
      setCountText(initial.count);
      setUnitDays(initial.unitDays);
    }
  }, [visible, value]);

  const count = parseInt(countText, 10);
  const valid = Number.isFinite(count) && count > 0;
  const intervalDays = valid ? clampIntervalDays(count * unitDays) : null;

  const onConfirm = () => {
    if (intervalDays == null) return;
    onPick(intervalDays);
    onClose();
  };

  return (
    <DrilldownSheet
      visible={visible}
      title={t('edit.interval')}
      onClose={onClose}
      right={
        <Pressable
          onPress={onConfirm}
          disabled={!valid}
          accessibilityRole="button"
          accessibilityLabel={t('edit.save')}
          style={({ pressed }) => [s.saveBtn, pressed && s.pressed, !valid && s.disabled]}
        >
          <Check size={20} color={c.inkButtonText} strokeWidth={2.5} />
        </Pressable>
      }
    >
      <View style={s.body}>
        <View style={s.intervalRow}>
          <TextInput
            style={s.countInput}
            value={countText}
            onChangeText={setCountText}
            keyboardType="number-pad"
            accessibilityLabel={t('edit.interval')}
            selectTextOnFocus
            autoFocus
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
        {intervalDays != null ? <Text style={s.preview}>{intervalText(intervalDays)}</Text> : null}
      </View>
    </DrilldownSheet>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
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
    body: { ...boundedContent, paddingHorizontal: space.s6, paddingTop: space.s5, gap: space.s4 },
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
    preview: { ...ty.base, fontFamily: fontFamily.sansSemibold, color: c.fg },
  });
}
