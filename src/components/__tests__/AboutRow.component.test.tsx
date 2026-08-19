/**
 * Component test — the shared Settings/About row.
 *
 * One component draws every canonical About entry, in two shapes: a static
 * value row (the version stamp) and a tappable row (Privacy policy, Source
 * code…). The distinction matters to a screen-reader user, so it is what this
 * asserts: only the tappable shape is a button, and it is reachable by its
 * visible label.
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

import { AboutRow } from '../AboutRow';

describe('AboutRow', () => {
  it('runs its action when a tappable row is pressed', async () => {
    const onPress = jest.fn();
    const user = userEvent.setup({ delay: 0 });

    await render(<AboutRow label="Privacy policy" onPress={onPress} />);

    await user.press(screen.getByRole('button', { name: 'Privacy policy' }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('shows a value row as plain content, not as a button', async () => {
    await render(<AboutRow label="Version" value="1.2.0 (14)" />);

    expect(screen.getByText('1.2.0 (14)')).toBeTruthy();
    // A row with nothing to press must not announce itself as pressable —
    // otherwise a screen-reader user is invited to tap a dead end.
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});
