/**
 * Component test — the in-app language picker.
 *
 * Five actions live in this one control: open the sheet, pick a language, close
 * with Done, dismiss by tapping the scrim, and the sheet body's press-swallow
 * (the invisible one — a press that lands on the sheet's own chrome must NOT
 * fall through to the scrim and throw the sheet away mid-choice).
 *
 * The locale preference store is real, so picking Español really does switch the
 * app's language; the assertions read that back off the screen rather than out
 * of the store. Each test resets the preference so the file stays order-free.
 */

import React from 'react';
import { render, screen, userEvent, fireEvent } from '@testing-library/react-native';

jest.mock('expo-font', () => ({
  useFonts: () => [true, null],
  isLoaded: () => true,
  loadAsync: () => Promise.resolve(),
}));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import { LanguageSetting } from '../LanguageSetting';
import { setLocalePreference } from '../../i18n/localePreference';

// The row's accessible name carries the current choice ("Language, System"), so
// it is also how the test reads the choice back.
const ROW_SYSTEM = 'Language, System';

describe('LanguageSetting', () => {
  beforeEach(() => setLocalePreference('en'));
  afterAll(() => setLocalePreference('en'));

  it('opens the picker from the Settings row', async () => {
    const user = userEvent.setup({ delay: 0 });
    await render(<LanguageSetting />);

    // Closed: no options on screen.
    expect(screen.queryByRole('radio', { name: 'Español' })).toBeNull();

    await user.press(screen.getByRole('button', { name: 'Language, English' }));

    expect(screen.getByRole('radio', { name: 'Español' })).toBeTruthy();
  });

  it('switches the app language to the option you pick, and closes', async () => {
    const user = userEvent.setup({ delay: 0 });
    await render(<LanguageSetting />);

    await user.press(screen.getByRole('button', { name: 'Language, English' }));
    await user.press(screen.getByRole('radio', { name: 'Español' }));

    // Sheet is gone...
    expect(screen.queryByRole('radio', { name: 'Español' })).toBeNull();
    // ...and the row itself is now speaking Spanish, which is the whole point.
    expect(screen.getByRole('button', { name: 'Idioma, Español' })).toBeTruthy();
  });

  it('closes from Done without changing the language', async () => {
    const user = userEvent.setup({ delay: 0 });
    await setLocalePreference('system');
    await render(<LanguageSetting />);

    await user.press(screen.getByRole('button', { name: ROW_SYSTEM }));
    await user.press(screen.getByRole('button', { name: 'Done' }));

    expect(screen.queryByRole('radio', { name: 'Español' })).toBeNull();
    expect(screen.getByRole('button', { name: ROW_SYSTEM })).toBeTruthy();
  });

  it('closes when the scrim behind the sheet is tapped', async () => {
    const user = userEvent.setup({ delay: 0 });
    await setLocalePreference('system');
    await render(<LanguageSetting />);

    await user.press(screen.getByRole('button', { name: ROW_SYSTEM }));
    await user.press(screen.getByLabelText('Cancel'));

    expect(screen.queryByRole('radio', { name: 'Español' })).toBeNull();
    expect(screen.getByRole('button', { name: ROW_SYSTEM })).toBeTruthy();
  });

  it('stays open when the press lands on the sheet itself', async () => {
    const user = userEvent.setup({ delay: 0 });
    await setLocalePreference('system');
    await render(<LanguageSetting />);

    await user.press(screen.getByRole('button', { name: ROW_SYSTEM }));

    // The swallow is a deliberately invisible, unlabelled Pressable wrapping the
    // sheet, so it is driven through the visible surface sitting on top of it —
    // the options list — and fireEvent walks up to the nearest ancestor that
    // handles the press. Without the swallow that walk reaches the scrim, so
    // aiming at a language and landing on the list would dismiss the sheet.
    fireEvent.press(screen.getByLabelText('Language'));

    expect(screen.getByRole('radio', { name: 'Español' })).toBeTruthy();
  });
});
