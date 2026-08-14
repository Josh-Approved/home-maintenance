/**
 * Voice Control names — in every language this app ships.
 *
 * Voice Control activates a control by its accessible NAME: someone says the
 * words they can see, and iOS matches them against `accessibilityLabel`. So a
 * label that wraps the visible text in a longer sentence makes that control
 * unspeakable, and the App Store's Voice Control claim stops being true.
 *
 * The trap is the locale, not the English. Label and visible text come from
 * different i18n keys, so "Support" inside "Support this app" reads as a
 * harmless prefix in English — and inverts in verb-final German and Japanese,
 * where the visible word lands at the END of the label ("Unterstützen" vs
 * "Diese App unterstützen", "支援" vs "このアプリを支援"). That is exactly how
 * this app shipped before 2026-08-09: green in English, broken in half the
 * languages on the listing.
 *
 * So these assert EQUALITY, per locale, on the label itself — not "the query
 * found a button", which resolves off the visible text and would stay green on
 * the broken code. The longer phrasing belongs in `accessibilityHint`, which
 * Voice Control ignores and VoiceOver still reads.
 *
 * Companion to `ReviewModal.linkSafety.test.tsx`, which pins the same rule in
 * English only. Every case here fails against the pre-2026-08-09 labels.
 */

import React from 'react';
import { render, screen } from '@testing-library/react-native';

jest.mock('expo-font', () => ({
  useFonts: () => [true, null],
  isLoaded: () => true,
  loadAsync: () => Promise.resolve(),
}));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
// The footer only needs the feedback sheet's opener; the provider itself pulls
// in mail composer + device diagnostics that have no bearing on a name.
jest.mock('../../feedback/FeedbackProvider', () => ({
  useFeedback: () => ({ open: jest.fn() }),
}));
// reanimated/worklets has no working jest mock for this SDK combo in this repo
// (see src/screens/__tests__/fabFooterClearance.test.ts), and the footer's
// wordmark pop is animation, not a name. Stand in the three symbols it uses.
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: { View },
    useAnimatedStyle: () => ({}),
    interpolate: () => 0,
  };
});

import { FundingFooter } from '../FundingFooter';
import ReviewModal from '../ReviewModal';
import { t, setLocaleStrings, resetToBaseStrings, CANONICAL_LOCALES } from '../../i18n';
import { LOCALES } from '../../i18n/locales';

const REVIEW_PROPS = {
  appName: 'Home Upkeep',
  iosAppStoreId: '6748000000',
  androidPackageName: 'com.joshapproved.homemaintenance',
};

/** English (no overlay) plus every locale the app ships. */
const CASES: string[] = ['en', ...CANONICAL_LOCALES];

afterEach(() => resetToBaseStrings());

describe.each(CASES)('Voice Control names (%s)', (locale) => {
  beforeEach(() => {
    if (locale === 'en') resetToBaseStrings();
    else setLocaleStrings(LOCALES[locale]);
  });

  it('names the Support button with the word printed on it', async () => {
    await render(<FundingFooter onSupport={() => {}} />);

    const visible = t('about.supportShort');
    const support = screen.getByRole('button', { name: visible });

    // The assertion that matters: the LABEL is the visible word. Querying by
    // name alone would fall back to the button's text and pass on the broken
    // "Diese App unterstützen" label.
    expect(support.props.accessibilityLabel).toBe(visible);
    expect(support).toHaveTextContent(visible);
    // The context a screen-reader user still wants lives where Voice Control
    // never looks.
    expect(support.props.accessibilityHint).toBe(t('about.support'));
  });

  it('names the Send feedback button with the words printed on it', async () => {
    await render(<FundingFooter onSupport={() => {}} />);

    const visible = t('about.feedback');
    const feedback = screen.getByRole('button', { name: visible });

    expect(feedback.props.accessibilityLabel).toBe(visible);
    expect(feedback).toHaveTextContent(visible);
  });

  it('names the review button with the words printed on it', async () => {
    await render(<ReviewModal visible onDismiss={jest.fn()} {...REVIEW_PROPS} />);

    const visible = t('about.review');
    const leave = screen.getByRole('button', { name: visible });

    expect(leave.props.accessibilityLabel).toBe(visible);
    expect(leave).toHaveTextContent(visible);
    expect(leave.props.accessibilityHint).toBe(t('review.leaveA11y'));
  });

  it('names the dismiss button with the words printed on it', async () => {
    await render(<ReviewModal visible onDismiss={jest.fn()} {...REVIEW_PROPS} />);

    const visible = t('common.notNow');
    const notNow = screen.getByRole('button', { name: visible });

    expect(notNow.props.accessibilityLabel).toBe(visible);
    expect(notNow).toHaveTextContent(visible);
  });
});
