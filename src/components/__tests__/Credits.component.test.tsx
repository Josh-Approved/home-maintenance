/**
 * Component test — the Acknowledgements screen.
 *
 * Two actions live here: Back, and each credit row opening the project's page.
 * The rows are the interesting one — they are the app's only outbound links
 * from Settings, and canon requires every published link actually resolve, so
 * the test asserts the URL that gets opened is the one in the generated credits
 * data rather than merely that "something was pressed".
 */

import React from 'react';
import { render, screen, userEvent } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

jest.mock('expo-font', () => ({
  useFonts: () => [true, null],
  isLoaded: () => true,
  loadAsync: () => Promise.resolve(),
}));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import Credits from '../Credits';
import { CREDITS } from '../../data/credits';

async function renderCredits(onBack = jest.fn()) {
  await render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <Credits onBack={onBack} />
    </SafeAreaProvider>
  );
  return onBack;
}

describe('Credits', () => {
  beforeEach(() => jest.restoreAllMocks());

  it('returns to Settings from the Back control', async () => {
    const user = userEvent.setup({ delay: 0 });
    const onBack = await renderCredits();

    await user.press(screen.getByRole('button', { name: 'Back' }));

    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('opens the project page for the credit row you tap', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined as never);
    const user = userEvent.setup({ delay: 0 });
    // Drive the first generated entry rather than a hardcoded name, so this
    // survives a dependency-list regeneration.
    const entry = CREDITS[0];
    await renderCredits();

    await user.press(
      screen.getByRole('link', { name: `${entry.name}, ${entry.license}` })
    );

    expect(openURL).toHaveBeenCalledWith(entry.url);
  });

  it('does not crash the screen when the platform refuses the link', async () => {
    jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('no handler'));
    const user = userEvent.setup({ delay: 0 });
    const entry = CREDITS[0];
    await renderCredits();

    await user.press(
      screen.getByRole('link', { name: `${entry.name}, ${entry.license}` })
    );

    // Still on the Acknowledgements screen, nothing thrown at the user.
    expect(screen.getByText(entry.name)).toBeTruthy();
  });
});
