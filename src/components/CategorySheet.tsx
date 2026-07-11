/**
 * Category spoke: pick one of the nine categories from a full list (their
 * dots included) instead of a three-row chip cloud on the editor. Single
 * select — choosing returns immediately.
 */

import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { CATEGORIES, type CategoryId } from '../data/library';
import { categoryHue } from './CategoryChip';
import { DrilldownSheet, SheetOption } from './DrilldownSheet';
import { t } from '../i18n';
import { boundedContent, space } from '../theme';

type Props = {
  visible: boolean;
  value: CategoryId;
  onClose: () => void;
  onPick: (category: CategoryId) => void;
};

export function CategorySheet({ visible, value, onClose, onPick }: Props) {
  return (
    <DrilldownSheet visible={visible} title={t('edit.category')} onClose={onClose}>
      <ScrollView contentContainerStyle={s.list}>
        {CATEGORIES.map((cat) => (
          <SheetOption
            key={cat}
            label={t(`category.${cat}`)}
            selected={value === cat}
            leading={<View style={[s.dot, { backgroundColor: categoryHue(cat) }]} />}
            onPress={() => {
              onPick(cat);
              onClose();
            }}
          />
        ))}
      </ScrollView>
    </DrilldownSheet>
  );
}

const s = StyleSheet.create({
  list: { ...boundedContent, paddingBottom: space.s9 },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
