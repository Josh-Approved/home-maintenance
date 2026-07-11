/**
 * Post-add setup — the step after picking starter-library tasks. One-tap add
 * stays one tap; this screen is where the schedule becomes YOURS: link the
 * tasks that belong to an appliance (created on the spot from the library's
 * hint, name only — no model number needed) and record when each task was
 * actually last done, so a filter changed a month ago isn't treated as
 * changed today. Everything here is skippable; Done leaves at any time.
 */

import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CircleCheck } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { useTasksStore } from '../store/tasks';
import { useAppliancesStore } from '../store/appliances';
import { lastDoneAt, type MaintenanceTask } from '../data/task';
import { LIBRARY } from '../data/library';
import { ScreenHeader } from '../components/ScreenHeader';
import { DrilldownRow } from '../components/DrilldownRow';
import { LastDoneSheet } from '../components/LastDoneSheet';
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

type Props = NativeStackScreenProps<RootStackParamList, 'TaskSetup'>;

const HINT_BY_LIBRARY_ID = new Map(
  LIBRARY.filter((i) => i.appliance).map((i) => [i.id, i.appliance as string])
);

export default function TaskSetupScreen({ navigation, route }: Props) {
  const { c } = useTheme();
  const s = makeStyles(c);
  const { taskIds } = route.params;

  const tasks = useTasksStore((st) => st.tasks);
  const completions = useTasksStore((st) => st.completions);
  const updateTask = useTasksStore((st) => st.updateTask);
  const setLastDone = useTasksStore((st) => st.setLastDone);
  const undoLastDone = useTasksStore((st) => st.undoLastDone);
  const appliances = useAppliancesStore((st) => st.appliances);
  const addAppliance = useAppliancesStore((st) => st.addAppliance);

  const [lastDoneFor, setLastDoneFor] = useState<string | null>(null);
  /** Tasks whose last-done was set here — lets "not sure" undo it again. */
  const [touched, setTouched] = useState<Set<string>>(new Set());

  const added = useMemo(
    () =>
      taskIds
        .map((id) => tasks.find((task) => task.id === id))
        .filter((task): task is MaintenanceTask => task != null && task.deletedAt == null),
    [taskIds, tasks]
  );

  // Distinct appliance hints among the added tasks, in first-seen order.
  const groups = useMemo(() => {
    const seen = new Map<string, { name: string; taskIds: string[] }>();
    for (const task of added) {
      const hint = task.libraryId ? HINT_BY_LIBRARY_ID.get(task.libraryId) : undefined;
      if (!hint) continue;
      const g = seen.get(hint.toLowerCase()) ?? { name: hint, taskIds: [] };
      g.taskIds.push(task.id);
      seen.set(hint.toLowerCase(), g);
    }
    return [...seen.values()];
  }, [added]);

  const linkGroup = (group: { name: string; taskIds: string[] }) => {
    const match = appliances.find(
      (a) => a.deletedAt == null && a.name.toLowerCase() === group.name.toLowerCase()
    );
    const applianceId = match?.id ?? addAppliance({ name: group.name });
    for (const id of group.taskIds) updateTask(id, { applianceId });
  };

  const activeTask = lastDoneFor ? added.find((task) => task.id === lastDoneFor) : undefined;

  const onPickLastDone = (at: number | null) => {
    if (!lastDoneFor) return;
    if (at != null) {
      setLastDone(lastDoneFor, at);
      setTouched((prev) => new Set(prev).add(lastDoneFor));
    } else if (touched.has(lastDoneFor)) {
      undoLastDone(lastDoneFor);
      setTouched((prev) => {
        const next = new Set(prev);
        next.delete(lastDoneFor);
        return next;
      });
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right', 'bottom']}>
      <ScreenHeader title={t('setup.title')} onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={s.body}>
        <Text style={s.subtitle}>{t('setup.subtitle')}</Text>

        {groups.length > 0 ? (
          <>
            <Text style={s.sectionLabel}>{t('setup.applianceSection')}</Text>
            {groups.map((group) => {
              const linkedTo = (() => {
                const ids = group.taskIds
                  .map((id) => added.find((task) => task.id === id)?.applianceId)
                  .filter(Boolean) as string[];
                if (ids.length < group.taskIds.length) return undefined;
                return appliances.find((a) => a.id === ids[0]);
              })();
              const countLabel =
                group.taskIds.length === 1
                  ? t('setup.taskCountOne')
                  : t('setup.taskCount', { count: String(group.taskIds.length) });
              return (
                <View key={group.name} style={s.groupRow}>
                  <View style={s.groupText}>
                    <Text style={s.groupName}>{group.name}</Text>
                    <Text style={s.groupMeta}>
                      {linkedTo ? t('setup.linked', { name: linkedTo.name }) : countLabel}
                    </Text>
                  </View>
                  {linkedTo ? (
                    <CircleCheck size={22} color={c.success} strokeWidth={1.5} />
                  ) : (
                    <Pressable
                      onPress={() => linkGroup(group)}
                      accessibilityRole="button"
                      accessibilityLabel={`${t('setup.link')}: ${group.name}`}
                      style={({ pressed }) => [s.linkBtn, pressed && s.pressed]}
                    >
                      <Text style={s.linkBtnText}>{t('setup.link')}</Text>
                    </Pressable>
                  )}
                </View>
              );
            })}
          </>
        ) : null}

        <Text style={s.sectionLabel}>{t('setup.lastDoneSection')}</Text>
        {added.map((task) => {
          const last = lastDoneAt(task.id, completions);
          return (
            <DrilldownRow
              key={task.id}
              label={task.name}
              value={
                last != null
                  ? formatDate(last, { month: 'short', day: 'numeric' })
                  : t('setup.notSet')
              }
              placeholder={last == null}
              onPress={() => setLastDoneFor(task.id)}
            />
          );
        })}
      </ScrollView>

      <View style={s.doneHolder}>
        <Pressable
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel={t('setup.done')}
          style={({ pressed }) => [s.doneBar, pressed && s.pressed]}
        >
          <Text style={s.doneText}>{t('setup.done')}</Text>
        </Pressable>
      </View>

      <LastDoneSheet
        visible={lastDoneFor != null}
        value={lastDoneFor ? lastDoneAt(lastDoneFor, completions) : null}
        intervalDays={activeTask?.intervalDays ?? 90}
        allowNotDoneYet
        onClose={() => setLastDoneFor(null)}
        onPick={onPickLastDone}
      />
    </SafeAreaView>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    pressed: { opacity: 0.6 },
    body: { ...boundedContent, paddingHorizontal: space.s6, paddingBottom: space.s9 },
    subtitle: { ...ty.sm, fontFamily: fontFamily.sans, color: c.fgMuted, paddingTop: space.s3 },
    sectionLabel: {
      ...ty.xs,
      fontFamily: fontFamily.sansSemibold,
      color: c.fgMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      paddingTop: space.s6,
      paddingBottom: space.s2,
    },
    groupRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s4,
      minHeight: target.min + 6,
      borderBottomWidth: hairline,
      borderBottomColor: c.hairline,
    },
    groupText: { flex: 1, paddingVertical: space.s3, gap: 2 },
    groupName: { ...ty.base, fontFamily: fontFamily.sans, color: c.fg },
    groupMeta: { ...ty.sm, fontFamily: fontFamily.sans, color: c.fgMuted },
    linkBtn: {
      minHeight: target.min,
      justifyContent: 'center',
      paddingHorizontal: space.s4,
      borderRadius: radius.md,
      backgroundColor: c.inkButton,
    },
    linkBtnText: { ...ty.sm, fontFamily: fontFamily.sansSemibold, color: c.inkButtonText },
    doneHolder: { ...boundedContent, padding: space.s5 },
    doneBar: {
      minHeight: target.min + 4,
      borderRadius: radius.md,
      backgroundColor: c.inkButton,
      alignItems: 'center',
      justifyContent: 'center',
    },
    doneText: { ...ty.base, fontFamily: fontFamily.sansSemibold, color: c.inkButtonText },
  });
}
