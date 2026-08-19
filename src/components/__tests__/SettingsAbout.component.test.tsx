/**
 * Component test — the About block's studio stamp (Uplevel-3 T3 action coverage).
 *
 * The six About ROWS are all one component (AboutRow) and are pinned by its own
 * test; the one press this block owns directly is the "Learn more" stamp under
 * the wordmark. It is easy to lose in a re-style because it is a bare word, not
 * a row, and losing it takes the only link to the studio with it.
 *
 * The label/hint split is asserted alongside the press: the visible words are
 * the accessible name, and the destination lives in the hint. Folding the domain
 * into the name broke Voice Control in verb-final locales, where the visible
 * word landed at the END of the composed sentence.
 */

import React from 'react';
import { render, screen, userEvent } from '@testing-library/react-native';

jest.mock('expo-font', () => ({
  useFonts: () => [true, null],
  isLoaded: () => true,
  loadAsync: () => Promise.resolve(),
}));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Keep the real URL constants stable and observe the link-opening functions
// without touching the native bridge.
jest.mock('../../lib/links', () => ({
  PRIVACY_URL: 'https://example.test/privacy',
  REPO_URL: 'https://github.com/josh-approved/home-maintenance',
  STUDIO_URL: 'https://joshapproved.com',
  openReview: jest.fn(),
  openUrl: jest.fn(),
  versionLabel: () => '1.0.0 (1)',
}));

// Supply the feedback context. (Prefixed `mock` for jest's hoisted factory.)
const mockOpenFeedback = jest.fn();
jest.mock('../../feedback/FeedbackProvider', () => ({
  useFeedback: () => ({ open: mockOpenFeedback }),
}));

// The cross-promo row is covered by its own test.
jest.mock('../MoreFromJA', () => ({ MoreFromJA: () => null }));

import { SettingsAbout } from '../SettingsAbout';
import { openUrl, STUDIO_URL } from '../../lib/links';

beforeEach(() => {
  jest.clearAllMocks();
});

async function renderBlock() {
  await render(
    <SettingsAbout onAcknowledgements={jest.fn()} onSupport={jest.fn()} />
  );
}

describe('SettingsAbout — studio stamp', () => {
  it('opens the studio site when Learn more is pressed', async () => {
    const user = userEvent.setup({ delay: 0 });
    await renderBlock();

    await user.press(screen.getByRole('button', { name: 'Learn more' }));

    expect(openUrl).toHaveBeenCalledWith(STUDIO_URL);
  });

  it('keeps the destination in the hint, not in the speakable name', async () => {
    await renderBlock();

    const stamp = screen.getByRole('button', { name: 'Learn more' });
    expect(stamp.props.accessibilityHint).toBe('Learn more at joshapproved.com');
  });
});
