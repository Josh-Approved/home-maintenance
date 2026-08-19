/**
 * Component test — the main-screen funding + feedback footer.
 *
 * Feedback is the studio's lifeline and the tip jar is the only funding surface
 * canon allows, so both buttons have to be reachable by the name a user (or
 * Voice Control) can see. The Support button is also conditional: an app that
 * has not wired a tip jar must render NO support control at all, never a dead
 * one — that is the assertion in the second case.
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

// The wordmark's pull-to-reveal animation is reanimated-backed; its worklets
// runtime is a native module with nothing to say about which button was
// pressed, so the three pieces the footer actually imports are stubbed to their
// plain-React equivalents.
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: { View },
    useAnimatedStyle: (fn: () => unknown) => fn(),
    interpolate: (v: number, inRange: number[], outRange: number[]) =>
      outRange[0] + (v - inRange[0]) * (outRange[1] - outRange[0]),
  };
});

// The footer opens feedback through the provider's context; stub the transport,
// keep the component real.
const mockOpenFeedback = jest.fn();
jest.mock('../../feedback/FeedbackProvider', () => ({
  useFeedback: () => ({ open: mockOpenFeedback }),
}));

import { FundingFooter } from '../FundingFooter';

describe('FundingFooter', () => {
  beforeEach(() => mockOpenFeedback.mockClear());

  it('opens the feedback sheet from Send feedback', async () => {
    const user = userEvent.setup({ delay: 0 });

    await render(<FundingFooter onSupport={jest.fn()} />);
    await user.press(screen.getByRole('button', { name: 'Send feedback' }));

    expect(mockOpenFeedback).toHaveBeenCalledTimes(1);
  });

  it('opens the tip jar from Support', async () => {
    const onSupport = jest.fn();
    const user = userEvent.setup({ delay: 0 });

    await render(<FundingFooter onSupport={onSupport} />);
    await user.press(screen.getByRole('button', { name: 'Support' }));

    expect(onSupport).toHaveBeenCalledTimes(1);
  });

  it('renders no Support button at all when the app has no tip jar wired', async () => {
    await render(<FundingFooter />);

    expect(screen.queryByRole('button', { name: 'Support' })).toBeNull();
    // Feedback still stands on its own — the footer is never empty.
    expect(screen.getByRole('button', { name: 'Send feedback' })).toBeTruthy();
  });
});
