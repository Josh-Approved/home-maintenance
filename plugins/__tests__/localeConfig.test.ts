/**
 * Drift guard for canon § Translations, "Declare localizations in the build".
 *
 * Three places name this app's languages and all three must agree, or the store
 * Languages field and the OS per-app language screen quietly disagree with what
 * the app actually speaks:
 *   1. src/i18n — CANONICAL_LOCALES, the dictionaries that really exist.
 *   2. app.json — ios.infoPlist.CFBundleLocalizations (Apple).
 *   3. plugins/withAndroidLocaleConfig.js — LOCALES (Android locales_config.xml).
 *
 * Adding a language means adding a dictionary; this test then fails until both
 * declarations follow, which is the whole point.
 */

import appJson from '../../app.json';
import { CANONICAL_LOCALES } from '../../src/i18n';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const plugin = require('../withAndroidLocaleConfig.js');

/** en is the build language and is never in CANONICAL_LOCALES (which lists the
 *  translations layered over it), but both store declarations must carry it. */
const EXPECTED = ['en', ...CANONICAL_LOCALES];

describe('declared localizations', () => {
  it('iOS CFBundleLocalizations matches the translated locale set', () => {
    expect(appJson.expo.ios.infoPlist.CFBundleLocalizations).toEqual(EXPECTED);
  });

  it('Android locale-config matches the translated locale set', () => {
    expect(plugin.LOCALES).toEqual(EXPECTED);
  });

  it('the Android plugin is registered in app.json', () => {
    expect(appJson.expo.plugins).toContain('./plugins/withAndroidLocaleConfig');
  });

  it('emits a locale-config resource Android can parse', () => {
    const xml = plugin.buildLocalesConfigXml(plugin.LOCALES);
    expect(xml).toContain('<locale-config xmlns:android="http://schemas.android.com/apk/res/android">');
    for (const tag of EXPECTED) {
      expect(xml).toContain(`<locale android:name="${tag}"/>`);
    }
    // BCP-47 tags, not Java-style underscores — Android silently ignores pt_BR.
    expect(xml).not.toMatch(/android:name="[a-z]{2}_/);
  });
});
