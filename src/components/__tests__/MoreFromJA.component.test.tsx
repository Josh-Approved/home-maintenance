/**
 * Component test — the "More from Josh Approved" cross-promo row.
 *
 * Canon allows this row as the one exception to "No ads, ever" strictly because
 * it is plain text pointing at an app that is genuinely live. Two rules follow,
 * and both are asserted here: a row opens that app's page on joshapproved.com
 * with ?install=1 (which forwards a phone to the right store), and no row is
 * drawn at all for an app with no listing on this platform. A row pointing at a
 * page whose store button does not exist would break the exception it depends on.
 */

import React from 'react';
import { render, screen, userEvent } from '@testing-library/react-native';
import { Linking, Platform } from 'react-native';

jest.mock('expo-font', () => ({
  useFonts: () => [true, null],
  isLoaded: () => true,
  loadAsync: () => Promise.resolve(),
}));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import { MoreFromJA } from '../MoreFromJA';
import { JA_CATALOG, installUrl } from '../jaCatalog';

// The catalog is the shared source of truth and apps go live over time, so the
// test derives its expectations from it instead of hardcoding a sibling app.
const liveOnIos = JA_CATALOG.filter((a) => a.iosLive && a.slug !== 'home-maintenance');

describe('MoreFromJA', () => {
  beforeEach(() => jest.restoreAllMocks());

  it('opens the app\'s page on the site for the app you tap', async () => {
    // Nothing to assert if no sibling is listed on iOS yet — the row is
    // correctly absent, which the next case covers.
    if (!liveOnIos.length) return;
    const app = liveOnIos[0];
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined as never);
    const user = userEvent.setup({ delay: 0 });

    await render(<MoreFromJA excludeSlug="home-maintenance" />);
    await user.press(screen.getByRole('button', { name: `${app.name} — ${app.blurb}` }));

    expect(openURL).toHaveBeenCalledWith(installUrl(app));
  });

  it('never lists the host app back to itself', async () => {
    await render(<MoreFromJA excludeSlug="home-maintenance" />);

    const self = JA_CATALOG.find((a) => a.slug === 'home-maintenance');
    expect(self).toBeTruthy();
    expect(screen.queryByRole('button', { name: `${self!.name} — ${self!.blurb}` })).toBeNull();
  });

  it('lists only the apps actually live on this platform, and vanishes when none are', async () => {
    // Store listings are per-platform, so the row has to follow the platform,
    // not the catalog. On Android it must show exactly the Android-listed
    // siblings — and while that set is empty the whole section disappears,
    // heading included, rather than offering a listing that does not exist.
    const original = Platform.OS;
    Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
    try {
      const liveOnAndroid = JA_CATALOG.filter((a) => a.androidLive && a.slug !== 'home-maintenance');
      await render(<MoreFromJA excludeSlug="home-maintenance" />);

      expect(screen.queryAllByRole('button')).toHaveLength(liveOnAndroid.length);
      if (!liveOnAndroid.length) {
        expect(screen.queryByText('More from Josh Approved')).toBeNull();
      }
    } finally {
      Object.defineProperty(Platform, 'OS', { value: original, configurable: true });
    }
  });
});
