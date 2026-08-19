/**
 * Component test — the first-run launch notice (Uplevel-3 T3 action coverage).
 *
 * The card exists to buy grace before a rough edge becomes a permanent one-star,
 * and its whole design rests on having exactly ONE way out. A second control
 * here — a store link, a review ask — is a store-policy problem, not a taste
 * one, so the count of buttons is asserted, not just that Got it works.
 *
 * Showing the card is what counts it against the 3-session cap, so the mount
 * side-effect is asserted too: a card that renders without marking itself would
 * follow the user around forever.
 */

import React from 'react';
import { render, screen, userEvent, waitFor } from '@testing-library/react-native';

jest.mock('expo-font', () => ({
  useFonts: () => [true, null],
  isLoaded: () => true,
  loadAsync: () => Promise.resolve(),
}));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Prefixed `mock` so jest's hoisted factory may reference it.
const mockMarkLaunchNoticeShown = jest.fn().mockResolvedValue(undefined);
jest.mock('../../storage/launchNotice', () => ({
  markLaunchNoticeShown: (...a: unknown[]) => mockMarkLaunchNoticeShown(...a),
}));

import LaunchNoticeModal from '../LaunchNoticeModal';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('LaunchNoticeModal', () => {
  it('dismisses when Got it is pressed', async () => {
    const onDismiss = jest.fn();
    const user = userEvent.setup({ delay: 0 });

    await render(<LaunchNoticeModal visible onDismiss={onDismiss} />);

    await user.press(screen.getByRole('button', { name: 'Got it' }));

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('offers exactly one action — no store link, no second button', async () => {
    await render(<LaunchNoticeModal visible onDismiss={jest.fn()} />);

    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('counts the showing on display, so the card cannot repeat forever', async () => {
    await render(<LaunchNoticeModal visible onDismiss={jest.fn()} />);

    await waitFor(() => expect(mockMarkLaunchNoticeShown).toHaveBeenCalledTimes(1));
  });
});
