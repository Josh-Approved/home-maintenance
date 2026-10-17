const { withMainApplication } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

// Turn on React Native's own fix for a native crash on Android. App-agnostic:
// every app on RN 0.86 is exposed (first filed as tend-20260914-1 and
// home-maintenance-20260918-1, the same backtrace in two apps).
//
// The crash: SIGSEGV (null deref) inside libreactnative.so, reached from
//   ReactEditText.onCreateInputConnection -> ReactScrollView.focusSearch
//   -> FabricUIManager.findNextFocusableElement
//   -> UIManager::findShadowNodeByTag_DEPRECATED
// i.e. a text field inside a ScrollView regaining focus (window focus gain,
// e.g. coming back to the app) while the JS thread commits a new tree.
//
// Root cause, upstream: findShadowNodeByTag_DEPRECATED grabbed a RAW pointer to
// the root shadow node inside tryCommit and walked it after the lock was
// released; a concurrent commit frees that root -> use-after-free. Fixed in
// facebook/react-native#55751 ("Fix SIGSEGV in ShadowNode::getTag() caused by
// use-after-free in findShadowNodeByTag_DEPRECATED"), but on 0.86.x the fix is
// gated behind the feature flag `fixFindShadowNodeByTagRaceCondition`, which
// defaults to false and is not enabled by any release level (Stable, Canary or
// Experimental). #56850 made it unconditional in 0.87, which Expo SDK 57 does
// not ship. So on SDK 57 the only way to get the fix is to set the flag.
//
// How: right after loadReactNative(this) has installed the release-level
// overrides, force-override with the SAME release-level provider plus this one
// flag. The React host is lazy, so no JS/Fabric thread is reading flags yet.
//
// Self-retiring: applied only while react-native's provider interface still
// declares the flag. On 0.87+ the flag is gone (fix is always on), the plugin
// becomes a no-op, and Kotlin never sees an override of a missing method.

const FLAG = 'fixFindShadowNodeByTagRaceCondition';
const MARKER = '// josh-approved: fixFindShadowNodeByTagRaceCondition';
const ANCHOR = /^([ \t]*)loadReactNative\(this\)[ \t]*$/m;

/** Pure: does this react-native still expose the flag? Reads the provider
 *  interface source shipped in node_modules. */
function reactNativeHasFlag(projectRoot) {
  try {
    const rnPkg = require.resolve('react-native/package.json', { paths: [projectRoot] });
    const provider = path.join(
      path.dirname(rnPkg),
      'ReactAndroid/src/main/java/com/facebook/react/internal/featureflags/ReactNativeFeatureFlagsProvider.kt'
    );
    return fs.readFileSync(provider, 'utf8').includes(`fun ${FLAG}()`);
  } catch {
    return false;
  }
}

/** Pure: insert the override block after loadReactNative(this). Idempotent;
 *  returns the input unchanged when already applied or the anchor is absent. */
function applyFlagOverride(src) {
  if (src.includes(MARKER)) return src;
  const m = src.match(ANCHOR);
  if (!m) return src;
  const i = m[1];
  const ff = 'com.facebook.react.internal.featureflags';
  const block = [
    `${i}${MARKER} (RN 0.86 use-after-free in focus search; upstream #55751)`,
    `${i}run {`,
    `${i}  val base: ${ff}.ReactNativeFeatureFlagsProvider =`,
    `${i}    when (DefaultNewArchitectureEntryPoint.releaseLevel) {`,
    `${i}      com.facebook.react.common.ReleaseLevel.EXPERIMENTAL -> ${ff}.ReactNativeFeatureFlagsOverrides_RNOSS_Experimental_Android()`,
    `${i}      com.facebook.react.common.ReleaseLevel.CANARY -> ${ff}.ReactNativeFeatureFlagsOverrides_RNOSS_Canary_Android()`,
    `${i}      com.facebook.react.common.ReleaseLevel.STABLE -> ${ff}.ReactNativeFeatureFlagsOverrides_RNOSS_Stable_Android()`,
    `${i}    }`,
    `${i}  ${ff}.ReactNativeFeatureFlags.dangerouslyForceOverride(`,
    `${i}    object : ${ff}.ReactNativeFeatureFlagsProvider by base {`,
    `${i}      override fun ${FLAG}(): Boolean = true`,
    `${i}    }`,
    `${i}  )`,
    `${i}}`,
  ].join('\n');
  return src.slice(0, m.index + m[0].length) + '\n' + block + src.slice(m.index + m[0].length);
}

module.exports = function withFabricFindNodeRaceFix(config) {
  return withMainApplication(config, (cfg) => {
    if (cfg.modResults.language !== 'kt') return cfg;
    if (!reactNativeHasFlag(cfg.modRequest.projectRoot)) return cfg;
    const next = applyFlagOverride(cfg.modResults.contents);
    if (next === cfg.modResults.contents && !next.includes(MARKER)) {
      throw new Error(
        `withFabricFindNodeRaceFix: could not find "loadReactNative(this)" in MainApplication.kt; ` +
          `the Fabric focus-search crash fix was NOT applied. Update the plugin anchor.`
      );
    }
    cfg.modResults.contents = next;
    return cfg;
  });
};

module.exports.applyFlagOverride = applyFlagOverride;
module.exports.reactNativeHasFlag = reactNativeHasFlag;
module.exports.MARKER = MARKER;
