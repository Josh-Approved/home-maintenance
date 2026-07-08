/**
 * Small category tag used on task rows: a colored dot from the design
 * system's categorical palette (never the accent, never approval green) plus
 * a muted label. The dot is keyed stably off the category's position so a
 * category keeps its hue everywhere; the label carries the meaning, so the
 * hue never has to pass text-contrast duty in either scheme.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CATEGORIES, type CategoryId } from '../data/library';
import { t } from '../i18n';
import { useTheme, fontFamily, space, categoryColor, CATEGORY_COLOR_TOKENS } from '../theme';

export function categoryHue(category: CategoryId): string {
  const token = CATEGORY_COLOR_TOKENS[CATEGORIES.indexOf(category) % CATEGORY_COLOR_TOKENS.length];
  return categoryColor(token);
}

export function CategoryChip({ category }: { category: CategoryId }) {
  const { c } = useTheme();
  return (
    <View style={styles.chip}>
      <View style={[styles.dot, { backgroundColor: categoryHue(category) }]} />
      <Text style={[styles.label, { color: c.fgMuted, fontFamily: fontFamily.sans }]}>
        {t(`category.${category}`)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', gap: space.s2 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  label: { fontSize: 12, lineHeight: 16 },
});
