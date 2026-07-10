/**
 * Starter library picker — the first-minute experience: search, tap to
 * select any number of common tasks, add them all at once. Tasks already on
 * the schedule show as added and can't be double-added (the store dedupes by
 * library id as the backstop). "New custom task" rides on top so the custom
 * path is never buried.
 */

import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, SectionList, Keyboard, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Square, SquareCheck, PencilLine } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { useTasksStore } from '../store/tasks';
import { useAppliancesStore } from '../store/appliances';
import { activeTasks } from '../data/task';
import { activeAppliances } from '../data/appliance';
import { CATEGORIES, LIBRARY, type LibraryTask } from '../data/library';
import { intervalText } from '../lib/format';
import { categoryHue } from '../components/CategoryChip';
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

type Props = NativeStackScreenProps<RootStackParamList, 'LibraryPicker'>;

export default function LibraryPickerScreen({ navigation }: Props) {
  const { c } = useTheme();
  const s = makeStyles(c);
  const tasks = useTasksStore((st) => st.tasks);
  const addFromLibrary = useTasksStore((st) => st.addFromLibrary);
  const appliances = useAppliancesStore((st) => st.appliances);

  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const alreadyAdded = useMemo(
    () => new Set(activeTasks(tasks).map((task) => task.libraryId).filter(Boolean) as string[]),
    [tasks]
  );

  const q = query.trim().toLowerCase();
  const sections = CATEGORIES.map((cat) => ({
    category: cat,
    title: t(`category.${cat}`),
    data: LIBRARY.filter(
      (item) => item.category === cat && (!q || item.name.toLowerCase().includes(q))
    ),
  })).filter((sec) => sec.data.length > 0);

  const toggle = (item: LibraryTask) => {
    if (alreadyAdded.has(item.id)) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(item.id)) next.delete(item.id);
      else next.add(item.id);
      return next;
    });
  };

  const onAdd = () => {
    const items = LIBRARY.filter((item) => selected.has(item.id));
    // Attempt the appliance link up front: an existing appliance whose name
    // matches the library hint is linked silently; the rest is offered on the
    // setup step that follows.
    const byName = new Map(activeAppliances(appliances).map((a) => [a.name.toLowerCase(), a.id]));
    const ids = addFromLibrary(
      items.map((item) => ({
        ...item,
        applianceId: item.appliance ? byName.get(item.appliance.toLowerCase()) : undefined,
      }))
    );
    Keyboard.dismiss();
    if (ids.length > 0) navigation.replace('TaskSetup', { taskIds: ids });
    else navigation.goBack();
  };

  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right', 'bottom']}>
      <ScreenHeader title={t('library.title')} onBack={() => navigation.goBack()} />

      <Pressable
        onPress={() => navigation.replace('TaskEdit', {})}
        accessibilityRole="button"
        accessibilityLabel={t('tasks.custom')}
        style={({ pressed }) => [s.customRow, pressed && s.pressed]}
      >
        <PencilLine size={18} color={c.fg} strokeWidth={1.5} />
        <Text style={s.customText}>{t('tasks.custom')}</Text>
      </Pressable>

      <TextInput
        style={s.search}
        value={query}
        onChangeText={setQuery}
        placeholder={t('library.search')}
        placeholderTextColor={c.fgSubtle}
        accessibilityLabel={t('library.search')}
        returnKeyType="done"
        onSubmitEditing={Keyboard.dismiss}
      />
      <Text style={s.subtitle}>{t('library.subtitle')}</Text>

      {sections.length === 0 ? (
        <Text style={s.noMatch}>{t('library.empty')}</Text>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={s.listContent}
          keyboardShouldPersistTaps="handled"
          renderSectionHeader={({ section }) => (
            <View style={s.sectionRow}>
              <View style={[s.dot, { backgroundColor: categoryHue(section.category) }]} />
              <Text style={s.sectionLabel}>{section.title}</Text>
            </View>
          )}
          renderItem={({ item }) => {
            const added = alreadyAdded.has(item.id);
            const isSelected = selected.has(item.id);
            return (
              <Pressable
                onPress={() => toggle(item)}
                disabled={added}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: added || isSelected, disabled: added }}
                accessibilityLabel={item.name}
                style={({ pressed }) => [s.row, pressed && s.pressed, added && s.rowAdded]}
              >
                {added || isSelected ? (
                  <SquareCheck size={22} color={added ? c.fgSubtle : c.fg} strokeWidth={1.5} />
                ) : (
                  <Square size={22} color={c.fgSubtle} strokeWidth={1.5} />
                )}
                <View style={s.rowText}>
                  <Text style={[s.rowName, added && s.rowNameAdded]}>{item.name}</Text>
                  <Text style={s.rowMeta}>
                    {intervalText(item.intervalDays)}
                    {added ? ` · ${t('library.added')}` : ''}
                  </Text>
                </View>
              </Pressable>
            );
          }}
        />
      )}

      {selected.size > 0 ? (
        <View style={s.addBarHolder}>
          <Pressable
            onPress={onAdd}
            accessibilityRole="button"
            accessibilityLabel={
              selected.size === 1 ? t('library.addOne') : t('library.add', { count: String(selected.size) })
            }
            style={({ pressed }) => [s.addBar, pressed && s.pressed]}
          >
            <Text style={s.addBarText}>
              {selected.size === 1
                ? t('library.addOne')
                : t('library.add', { count: String(selected.size) })}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    pressed: { opacity: 0.6 },
    customRow: {
      ...boundedContent,
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s3,
      minHeight: target.min,
      paddingHorizontal: space.s6,
      borderBottomWidth: hairline,
      borderBottomColor: c.hairline,
    },
    customText: { ...ty.base, fontFamily: fontFamily.sansSemibold, color: c.fg },
    search: {
      ...boundedContent,
      minHeight: target.min,
      marginHorizontal: space.s5,
      marginTop: space.s4,
      paddingHorizontal: space.s4,
      borderRadius: radius.md,
      backgroundColor: c.bgSubtle,
      ...ty.base,
      fontFamily: fontFamily.sans,
      color: c.fg,
    },
    subtitle: {
      ...ty.sm,
      fontFamily: fontFamily.sans,
      color: c.fgMuted,
      paddingHorizontal: space.s6,
      paddingTop: space.s3,
    },
    noMatch: {
      ...ty.base,
      fontFamily: fontFamily.sans,
      color: c.fgMuted,
      padding: space.s6,
    },
    listContent: { ...boundedContent, paddingBottom: space.s9 },
    sectionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s2,
      paddingHorizontal: space.s6,
      paddingTop: space.s5,
      paddingBottom: space.s3,
    },
    dot: { width: 8, height: 8, borderRadius: 4 },
    sectionLabel: {
      ...ty.xs,
      fontFamily: fontFamily.sansSemibold,
      color: c.fgMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s4,
      minHeight: target.min + 6,
      paddingHorizontal: space.s6,
      borderBottomWidth: hairline,
      borderBottomColor: c.hairline,
    },
    rowAdded: { opacity: 0.7 },
    rowText: { flex: 1, paddingVertical: space.s3, gap: 2 },
    rowName: { ...ty.base, fontFamily: fontFamily.sans, color: c.fg },
    rowNameAdded: { color: c.fgMuted },
    rowMeta: { ...ty.sm, fontFamily: fontFamily.sans, color: c.fgMuted },
    addBarHolder: { ...boundedContent, padding: space.s5 },
    addBar: {
      minHeight: target.min + 4,
      borderRadius: radius.md,
      backgroundColor: c.inkButton,
      alignItems: 'center',
      justifyContent: 'center',
    },
    addBarText: { ...ty.base, fontFamily: fontFamily.sansSemibold, color: c.inkButtonText },
  });
}
