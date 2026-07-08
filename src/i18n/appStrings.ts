/**
 * App-specific copy for the `tracker` archetype. APP-OWNED — every user-facing
 * string in the domain screens lives here (canon § Translations); reference it
 * via t('tracker.…') from ../i18n. Rename keys to your domain when you fork.
 */

export const APP_STRINGS = {
  home: {
    title: 'Tracker',
    today: 'Today',
    last7: 'Last 7 days',
    recent: 'Recent',
    empty: 'No entries yet. Tap + to log one.',
    add: 'Log an entry',
  },
  entry: {
    value: 'Amount',
    note: 'Note (optional)',
    notePlaceholder: 'What was it?',
    save: 'Save',
    title: 'New entry',
    delete: 'Delete entry',
  },
} as const;
