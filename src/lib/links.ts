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

export const APP_NAME = 'Home Maintenance - Josh Approved';

/** Numeric App Store Connect id — filled once the ASC record exists (store
 *  setup). Empty is the known pre-store state; the review deep link no-ops
 *  cleanly until then. */
export const IOS_APP_STORE_ID = '';
export const ANDROID_PACKAGE = 'com.joshapproved.homemaintenance';

export const BMAC_URL = 'https://buymeacoffee.com/jtysonwilliams';

/**
 * DONATIONS_ENABLED gates every Buy Me a Coffee surface. It stays false --
 * Apple rejects external donation links for a for-profit app (guideline
 * 3.1.1); the IAP tip jar replaces the link-out.
 * TIP_JAR_ENABLED gates the sanctioned replacement: the same support
 * placements, each opening the canonical TipJarSheet.
 */
export const DONATIONS_ENABLED: boolean = false;
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

export function openBmac(): void {
  openUrl(BMAC_URL);
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
