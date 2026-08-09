/**
 * Canonical external links + the runtime version string. App-OWNED (sync drops
 * this once, ifAbsent, and bootstrap fills the placeholders) — one place so the
 * Settings rows and the review modal stay byte-identical (canon § Settings /
 * About, § Review prompt).
 *
 * The SHAPE here is canonical; the per-app constants below are yours to set:
 *   - IOS_APP_STORE_ID — filled once the App Store Connect record exists.
 *   - ANDROID_PACKAGE / REPO_URL / PRIVACY_URL — bootstrap fills from the slug.
 */

import { Linking, Platform } from 'react-native';
import * as Application from 'expo-application';

export const APP_NAME = 'Home Upkeep - Josh Approved';

/** Numeric App Store Connect id, from the ASC record for this bundle id. Must
 *  stay in step with `submit.production.ios.ascAppId` in eas.json. */
export const IOS_APP_STORE_ID = '6791778049';
export const ANDROID_PACKAGE = 'com.joshapproved.homemaintenance';

/**
 * Public launch date (ISO), the day this app's store listings went live — not
 * the build date and not the submission date. Drives the launch-notice window
 * (60 days, first 3 sessions). Ships in the binary; there is no remote config.
 * A malformed date fails closed, so the notice can never pin on forever.
 */
export const LAUNCHED_AT = '2026-08-09';

/**
 * TIP_JAR_ENABLED gates every support surface (Settings row, FundingFooter
 * button) — each opens the canonical TipJarSheet. Apple rejects external
 * donation links for a for-profit app (guideline 3.1.1), so the IAP tip jar
 * is the only support surface; there is no external link-out to gate.
 */
export const TIP_JAR_ENABLED: boolean = true;
export const STUDIO_URL = 'https://joshapproved.com';
export const REPO_URL = 'https://github.com/josh-approved/home-maintenance';
export const PRIVACY_URL =
  'https://github.com/josh-approved/home-maintenance/blob/main/PRIVACY.md';

/** `1.2.0 (47)` — read from the bundle at runtime, never hardcoded. */
export function versionLabel(): string {
  const v = Application.nativeApplicationVersion ?? '1.0.0';
  const b = Application.nativeBuildVersion ?? '1';
  return `${v} (${b})`;
}

export function openUrl(url: string): void {
  Linking.openURL(url).catch(() => {});
}

export function openFeedbackMail(): void {
  const subject = encodeURIComponent(`${APP_NAME} ${versionLabel()}`);
  openUrl(`mailto:feedback@joshapproved.com?subject=${subject}`);
}

/** iOS write-review deep link pinned to the modern apps.apple.com host (canon
 *  § Review prompt). Must stay byte-identical to ReviewModal.tsx. */
export function openReview(): void {
  const url =
    Platform.OS === 'ios'
      ? `itms-apps://apps.apple.com/app/id${IOS_APP_STORE_ID}?action=write-review`
      : `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}&showAllReviews=true`;
  openUrl(url);
}
