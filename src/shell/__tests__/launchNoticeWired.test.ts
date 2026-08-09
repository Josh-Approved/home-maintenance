/**
 * The launch-notice module's own logic is covered by
 * src/storage/__tests__/launchNotice.test.ts. This file covers the failure the
 * README actually warns about: a module synced in, and nothing calling it.
 *
 * That is not hypothetical — it is exactly how tend and tally shipped dead
 * review prompts (canon § Review prompt, "Why session-based"). The review half
 * gained a mechanical gate afterwards (`qa-canonical review-prompt/wired`); the
 * launch notice has none yet, so this app asserts its own wiring from source.
 *
 * Static assertions on purpose: mounting AppShell for real drags in navigation,
 * fonts, gesture handler and AsyncStorage, and a test that heavy tends to rot
 * into a mock check anyway.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

const root = join(__dirname, '..', '..', '..');
const read = (rel: string) => readFileSync(join(root, rel), 'utf8');

const appTsx = read('App.tsx');
const shell = read('src/shell/AppShell.tsx');

describe('launch notice wiring', () => {
  it('the app passes a launch date to the shell', () => {
    expect(appTsx).toMatch(/<AppShell[^>]*launchedAt=\{LAUNCHED_AT\}/s);
  });

  it('the launch date is a real ISO date the window math accepts', () => {
    const m = read('src/lib/links.ts').match(/LAUNCHED_AT\s*=\s*'([^']+)'/);
    expect(m).not.toBeNull();
    expect(m![1]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(Number.isNaN(Date.parse(m![1]))).toBe(false);
  });

  it('the shell asks whether to show it, and mounts the modal', () => {
    expect(shell).toContain('shouldShowLaunchNotice');
    expect(shell).toMatch(/<\s*LaunchNoticeModal\b/);
  });

  it('the notice pre-empts the review prompt, and still counts the session', () => {
    const noticeAt = shell.indexOf('setShowLaunchNotice(true)');
    const reviewAt = shell.indexOf('setShowReview(true)');
    expect(noticeAt).toBeGreaterThan(-1);
    expect(reviewAt).toBeGreaterThan(-1);
    // The notice branch resolves and returns before the review branch can show.
    expect(noticeAt).toBeLessThan(reviewAt);
    // recordSessionStart is awaited unconditionally, so a user inside the
    // launch window still accrues sessions toward the review schedule.
    expect(shell).toMatch(/await\s+recordSessionStart\(\)/);
  });
});
