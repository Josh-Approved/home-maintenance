/**
 * Appliance spoke: link the task to an appliance, or create one on the spot
 * with just a name — brand, model, and serial can come later from the
 * Appliances tab. When the task came from the starter library with an
 * appliance hint and nothing matches yet, the create field is pre-filled
 * with that hint so linking is one tap.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Keyboard, StyleSheet } from 'react-native';
import { Plus } from 'lucide-react-native';
import { useAppliancesStore } from '../store/appliances';
import { activeAppliances } from '../data/appliance';
import { DrilldownSheet, SheetOption } from './DrilldownSheet';
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

type Props = {
  visible: boolean;
  value: string | undefined;
  /** Library appliance hint — pre-fills the create field when unmatched. */
  suggestedName?: string;
  onClose: () => void;
  onPick: (applianceId: string | undefined) => void;
};

export function ApplianceSheet({ visible, value, suggestedName, onClose, onPick }: Props) {
  const { c } = useTheme();
  const s = makeStyles(c);
  const appliances = useAppliancesStore((st) => st.appliances);
  const addAppliance = useAppliancesStore((st) => st.addAppliance);
  const active = activeAppliances(appliances);

  const suggestionTaken = Boolean(
    suggestedName && active.some((a) => a.name.toLowerCase() === suggestedName.toLowerCase())
  );
  const [newName, setNewName] = useState('');

  useEffect(() => {
    if (visible) setNewName(suggestedName && !suggestionTaken ? suggestedName : '');
  }, [visible, suggestedName, suggestionTaken]);

  const pick = (id: string | undefined) => {
    onPick(id);
    onClose();
  };

  const onCreate = () => {
    const name = newName.trim();
    if (!name) return;
    Keyboard.dismiss();
    pick(addAppliance({ name }));
  };

  return (
    <DrilldownSheet visible={visible} title={t('edit.appliance')} onClose={onClose}>
      <ScrollView contentContainerStyle={s.list} keyboardShouldPersistTaps="handled">
        <SheetOption
          label={t('edit.applianceNone')}
          selected={value == null}
          onPress={() => pick(undefined)}
        />
        {active.map((a) => (
          <SheetOption
            key={a.id}
            label={a.name}
            detail={[a.brand, a.model].filter(Boolean).join(' ') || undefined}
            selected={value === a.id}
            onPress={() => pick(a.id)}
          />
        ))}

        <Text style={s.newLabel}>{t('edit.applianceNew')}</Text>
        <View style={s.newRow}>
          <TextInput
            style={s.newInput}
            value={newName}
            onChangeText={setNewName}
            placeholder={t('appliances.namePlaceholder')}
            placeholderTextColor={c.fgSubtle}
            accessibilityLabel={t('edit.applianceNew')}
            returnKeyType="done"
            onSubmitEditing={onCreate}
          />
          <Pressable
            onPress={onCreate}
            disabled={!newName.trim()}
            accessibilityRole="button"
            accessibilityLabel={t('edit.applianceCreate')}
            style={({ pressed }) => [s.addBtn, pressed && s.pressed, !newName.trim() && s.disabled]}
          >
            <Plus size={20} color={c.inkButtonText} strokeWidth={2} />
          </Pressable>
        </View>
        <Text style={s.hint}>{t('edit.applianceNewHint')}</Text>
      </ScrollView>
    </DrilldownSheet>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    pressed: { opacity: 0.6 },
    disabled: { opacity: 0.4 },
    list: { ...boundedContent, paddingBottom: space.s9 },
    newLabel: {
      ...ty.xs,
      fontFamily: fontFamily.sansSemibold,
      color: c.fgMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      paddingHorizontal: space.s6,
      paddingTop: space.s6,
      paddingBottom: space.s3,
    },
    newRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s3,
      paddingHorizontal: space.s6,
    },
    newInput: {
      flex: 1,
      minHeight: target.min,
      paddingHorizontal: space.s4,
      borderRadius: radius.md,
      backgroundColor: c.bgSubtle,
      ...ty.base,
      fontFamily: fontFamily.sans,
      color: c.fg,
    },
    addBtn: {
      width: target.min,
      height: target.min,
      borderRadius: radius.md,
      backgroundColor: c.inkButton,
      alignItems: 'center',
      justifyContent: 'center',
    },
    hint: {
      ...ty.sm,
      fontFamily: fontFamily.sans,
      color: c.fgMuted,
      paddingHorizontal: space.s6,
      paddingTop: space.s3,
    },
  });
}
