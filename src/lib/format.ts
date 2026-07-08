/**
 * Small copy formatters shared by the screens. Kept out of the components so
 * the wording rules (today / tomorrow / N days / overdue) stay in one place.
 */

import type { TaskSchedule } from '../data/task';
import { t } from '../i18n';

export function dueText(s: TaskSchedule): string {
  const d = s.daysUntilDue;
  if (d < -1) return t('due.overdueByDays', { days: String(-d) });
  if (d === -1) return t('due.overdueYesterday');
  if (d === 0) return t('due.dueToday');
  if (d === 1) return t('due.dueTomorrow');
  return t('due.dueInDays', { days: String(d) });
}

/** "Every N days/weeks/months/years" — picks the largest unit that divides
 *  cleanly so 90 days reads as months only when exact (90 → days; 84 → weeks). */
export function intervalText(intervalDays: number): string {
  if (intervalDays % 365 === 0 && intervalDays >= 365) {
    const n = intervalDays / 365;
    return t(n === 1 ? 'interval.everyYear' : 'interval.everyYears', { count: String(n) });
  }
  if (intervalDays % 30 === 0 && intervalDays >= 30) {
    const n = intervalDays / 30;
    return t(n === 1 ? 'interval.everyMonth' : 'interval.everyMonths', { count: String(n) });
  }
  if (intervalDays % 7 === 0 && intervalDays >= 7) {
    const n = intervalDays / 7;
    return t(n === 1 ? 'interval.everyWeek' : 'interval.everyWeeks', { count: String(n) });
  }
  return t(intervalDays === 1 ? 'interval.everyDay' : 'interval.everyDays', {
    count: String(intervalDays),
  });
}
