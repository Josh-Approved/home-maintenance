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
import { OptionChips } from './OptionChips';
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
          <OptionChips
            options={UNITS.map((unit) => ({ key: String(unit.days), label: t(`edit.${unit.key}`) }))}
            selectedKey={String(unitDays)}
            onPick={(k) => setUnitDays(Number(k))}
          />
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
    preview: { ...ty.base, fontFamily: fontFamily.sansSemibold, color: c.fg },
  });
}
