/**
 * Regression net for defect home-maintenance-20260918-1: SIGSEGV
 * (SEGV_MAPERR) in FabricUIManagerBinding::findNextFocusableElement, found by
 * the seeded monkey run (seed 20260918, event 27969, IME hiding).
 *
 * Root cause is upstream: on React Native 0.86 the flag-OFF branch of
 * UIManager::findShadowNodeByTag_DEPRECATED takes a RAW pointer to the root
 * shadow node inside tryCommit and walks it after the lock is released — a
 * concurrent commit frees it. RN ships the fix behind the feature flag
 * `fixFindShadowNodeByTagRaceCondition`, which defaults to false and is not
 * turned on by any release level, so the only cure on SDK 57 is to force the
 * flag on in MainApplication.kt — what plugins/withFabricFindNodeRaceFix.js does.
 *
 * A native data race cannot be reproduced in Jest. What CAN silently regress is
 * the plugin no longer LANDING the override — dropped from app.json, the Expo
 * template moving the anchor, the emitted Kotlin drifting off the release-level
 * base provider. Those are what these tests pin.
 */

/* eslint-disable @typescript-eslint/no-var-requires */

// The pure transform is what's under test; expo/config-plugins pulls ESM-only
// deps (xcode) Jest can't load, so stub the one mod helper the plugin imports.
// The stub runs the mod callback inline, so the wrapper's gating (Kotlin only,
// flag still declared by react-native) is exercised too — not just the string
// transform.
jest.mock('expo/config-plugins', () => ({
  withMainApplication: (config: unknown, mod: (c: unknown) => unknown) => mod(config),
}));

import appJson from '../../app.json';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const plugin = require('../withFabricFindNodeRaceFix.js');

const PLUGIN_REF = './plugins/withFabricFindNodeRaceFix';
const OVERRIDE_LINE = 'override fun fixFindShadowNodeByTagRaceCondition(): Boolean = true';

/** What `expo prebuild` writes for this app, shaped like the SDK 57 template. */
const MAIN_APPLICATION_KT = `package com.joshapproved.homemaintenance

class MainApplication : Application(), ReactApplication {
  override fun onCreate() {
    super.onCreate()
    DefaultNewArchitectureEntryPoint.releaseLevel = try {
      ReleaseLevel.valueOf(BuildConfig.REACT_NATIVE_RELEASE_LEVEL.uppercase())
    } catch (e: IllegalArgumentException) {
      ReleaseLevel.STABLE
    }
    loadReactNative(this)
    ApplicationLifecycleDispatcher.onApplicationCreate(this)
  }
}
`;

/** The MainApplication.kt `expo prebuild` will actually write, read out of the
 *  prebuild template bundled in node_modules/expo. This is the file the plugin
 *  has to anchor into; pinning it here turns "the Expo template moved" into a
 *  red `npm test` instead of a Kotlin compile error 45 minutes into a build. */
function expoTemplateMainApplication(): string {
  const tgz = path.join(path.dirname(require.resolve('expo/package.json')), 'template.tgz');
  const entry = 'package/android/app/src/main/java/com/helloworld/MainApplication.kt';
  return execFileSync('tar', ['xzOf', tgz, entry], { encoding: 'utf8' });
}

/** A throwaway project root whose react-native provider does / doesn't declare
 *  the flag — the switch the plugin self-retires on. */
function fakeProjectRoot(withFlag: boolean): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'home-maintenance-rnflag-'));
  const rn = path.join(root, 'node_modules', 'react-native');
  const dir = path.join(rn, 'ReactAndroid/src/main/java/com/facebook/react/internal/featureflags');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(rn, 'package.json'),
    JSON.stringify({ name: 'react-native', version: '0.0.0' })
  );
  fs.writeFileSync(
    path.join(dir, 'ReactNativeFeatureFlagsProvider.kt'),
    'public interface ReactNativeFeatureFlagsProvider {\n' +
      (withFlag ? '  @DoNotStrip public fun fixFindShadowNodeByTagRaceCondition(): Boolean\n' : '') +
      '  @DoNotStrip public fun enableFabricRenderer(): Boolean\n}\n'
  );
  return root;
}

/** Drive the exported config plugin (mod callback runs inline via the mock). */
function runPlugin(projectRoot: string, contents = MAIN_APPLICATION_KT, language = 'kt'): string {
  const cfg = plugin({ modResults: { language, contents }, modRequest: { projectRoot } });
  return cfg.modResults.contents;
}

describe('withFabricFindNodeRaceFix (home-maintenance-20260918-1)', () => {
  it('is registered in app.json plugins', () => {
    expect(appJson.expo.plugins).toContain(PLUGIN_REF);
  });

  it('forces the flag on after loadReactNative and before lifecycle dispatch', () => {
    const out: string = plugin.applyFlagOverride(MAIN_APPLICATION_KT);
    const load = out.indexOf('loadReactNative(this)');
    const marker = out.indexOf(plugin.MARKER);
    const force = out.indexOf('ReactNativeFeatureFlags.dangerouslyForceOverride(');
    const override = out.indexOf(OVERRIDE_LINE);
    const dispatch = out.indexOf('ApplicationLifecycleDispatcher.onApplicationCreate');
    expect(load).toBeGreaterThan(-1);
    expect(marker).toBeGreaterThan(load);
    expect(force).toBeGreaterThan(marker);
    expect(override).toBeGreaterThan(force);
    expect(dispatch).toBeGreaterThan(override);
  });

  it('keeps the release-level base provider instead of replacing it', () => {
    const out: string = plugin.applyFlagOverride(MAIN_APPLICATION_KT);
    expect(out).toContain('ReactNativeFeatureFlagsOverrides_RNOSS_Stable_Android()');
    expect(out).toContain('ReactNativeFeatureFlagsOverrides_RNOSS_Canary_Android()');
    expect(out).toContain('ReactNativeFeatureFlagsOverrides_RNOSS_Experimental_Android()');
    expect(out).toContain('ReactNativeFeatureFlagsProvider by base');
    expect(out).toContain('DefaultNewArchitectureEntryPoint.releaseLevel');
  });

  it('is idempotent — the pure transform', () => {
    const once: string = plugin.applyFlagOverride(MAIN_APPLICATION_KT);
    expect(plugin.applyFlagOverride(once)).toBe(once);
    expect(once.split(plugin.MARKER).length - 1).toBe(1);
  });

  it('is idempotent across repeated prebuilds — the config plugin', () => {
    const root = fakeProjectRoot(true);
    const once = runPlugin(root);
    expect(runPlugin(root, once)).toBe(once);
    expect(once.split(plugin.MARKER).length - 1).toBe(1);
  });

  it('applies the override while react-native still declares the flag', () => {
    const out = runPlugin(fakeProjectRoot(true));
    expect(out).toContain(plugin.MARKER);
    expect(out).toContain(OVERRIDE_LINE);
  });

  it('self-retires: a no-op once react-native drops the flag (0.87+, fix always on)', () => {
    const root = fakeProjectRoot(false);
    expect(plugin.reactNativeHasFlag(root)).toBe(false);
    expect(runPlugin(root)).toBe(MAIN_APPLICATION_KT);
  });

  it('the installed react-native still declares the flag (so the fix is still needed)', () => {
    const rn = require('react-native/package.json');
    if (/^0\.86\./.test(rn.version)) {
      expect(plugin.reactNativeHasFlag(process.cwd())).toBe(true);
    }
  });

  it('is a no-op for a Java MainApplication', () => {
    const src = 'class MainApplication {}';
    expect(runPlugin(fakeProjectRoot(true), src, 'java')).toBe(src);
  });

  it('throws loudly when the anchor moved, instead of shipping without the fix', () => {
    expect(() => runPlugin(fakeProjectRoot(true), 'class MainApplication { fun onCreate() {} }')).toThrow(
      /NOT applied/
    );
  });

  it('anchors into the real Expo prebuild template, whose imports cover the Kotlin we emit', () => {
    const src = expoTemplateMainApplication();
    // The anchor the plugin keys off must exist in the file prebuild writes.
    expect(src).toMatch(/^[ \t]*loadReactNative\(this\)[ \t]*$/m);
    // The emitted block names DefaultNewArchitectureEntryPoint unqualified, so
    // the template must import it (everything else we emit is fully qualified).
    expect(src).toContain('import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint');

    const out: string = plugin.applyFlagOverride(src);
    expect(out).not.toBe(src);
    const load = out.indexOf('loadReactNative(this)');
    const force = out.indexOf('ReactNativeFeatureFlags.dangerouslyForceOverride(');
    const dispatch = out.indexOf('ApplicationLifecycleDispatcher.onApplicationCreate');
    expect(force).toBeGreaterThan(load);
    expect(dispatch).toBeGreaterThan(force);
  });
});
