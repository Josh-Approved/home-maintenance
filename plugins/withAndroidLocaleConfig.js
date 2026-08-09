const { withAndroidManifest, withDangerousMod, AndroidConfig } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

// Declare the app's translated languages to Android (canon § Translations,
// "Declare localizations in the build").
//
// Our translations are runtime-only — the i18n dictionary swaps inside the JS
// bundle — so the OS has no way to know this app speaks seven languages. Two
// user-visible surfaces depend on the declaration: Android 13+'s per-app
// language screen (Settings > Apps > Home Upkeep > Language), and Play's own
// listing languages. Without it the app looks English-only.
//
// Android reads this from a `res/xml/locales_config.xml` resource referenced by
// `android:localeConfig` on <application>. Expo SDK 57's app config has NO
// `android.localeConfig` key (checked against @expo/config-types' Android
// interface for this SDK — the key does not exist, so writing it into app.json
// would silently do nothing), and `expo.locales` is a different feature (it
// localizes permission prompt strings, not the language set). Hence this local
// config plugin, matching the withGradleJvmArgs pattern: it writes the resource
// and sets the attribute at prebuild, so both survive CNG regeneration.
//
// The iOS half of the same requirement is `ios.infoPlist.CFBundleLocalizations`
// in app.json, which Expo does support directly. LOCALES here and that array
// are kept in step by plugins/__tests__/localeConfig.test.ts.

/** en is the build language; the rest are the canon § Translations locale set.
 *  BCP-47 tags, the form both locales_config.xml and CFBundleLocalizations take. */
const LOCALES = ['en', 'es', 'de', 'fr', 'it', 'pt-BR', 'ja'];

const RESOURCE_NAME = 'locales_config';

/** Pure: the locales_config.xml body. Exported so the drift test can read it
 *  without running a prebuild. */
function buildLocalesConfigXml(locales) {
  const entries = locales.map((l) => `    <locale android:name="${l}"/>`).join('\n');
  return (
    '<?xml version="1.0" encoding="utf-8"?>\n' +
    '<locale-config xmlns:android="http://schemas.android.com/apk/res/android">\n' +
    `${entries}\n` +
    '</locale-config>\n'
  );
}

function withLocalesConfigResource(config, locales) {
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const xmlDir = path.join(
        cfg.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'res',
        'xml'
      );
      fs.mkdirSync(xmlDir, { recursive: true });
      fs.writeFileSync(
        path.join(xmlDir, `${RESOURCE_NAME}.xml`),
        buildLocalesConfigXml(locales)
      );
      return cfg;
    },
  ]);
}

function withLocaleConfigAttribute(config) {
  return withAndroidManifest(config, (cfg) => {
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(cfg.modResults);
    application.$['android:localeConfig'] = `@xml/${RESOURCE_NAME}`;
    return cfg;
  });
}

module.exports = function withAndroidLocaleConfig(config, { locales = LOCALES } = {}) {
  return withLocaleConfigAttribute(withLocalesConfigResource(config, locales));
};

module.exports.LOCALES = LOCALES;
module.exports.buildLocalesConfigXml = buildLocalesConfigXml;
