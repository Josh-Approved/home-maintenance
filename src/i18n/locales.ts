/**
 * The per-locale string overlays this app ships. APP-OWNED — sync drops this
 * once (ifAbsent) and never overwrites it. By default it re-exports just the
 * canonical SHELL translations (so Settings/About are localized with zero work);
 * add this app's DOMAIN translations on top, per locale.
 *
 * `i18n/index.ts` reads `LOCALES` and applies the device locale on import
 * (no-op when English or when no match). Keys overlay the English SHELL+APP
 * dictionary, so a partial locale dict is fine — untranslated keys fall back to
 * English, never to a missing-key crash.
 *
 * To translate this app's domain strings (canon § Translations, P7):
 *   1. node scripts/translate.mjs --strings <app>      # scaffolds locale skeletons from APP_STRINGS
 *   2. Claude fills each src/i18n/<locale>.ts with the domain translations.
 *   3. DEEP-merge them onto each shell entry below, e.g.:
 *        import es from './es';
 *        export const LOCALES = { es: deepMerge(SHELL_LOCALES.es, es), ... };
 *   The shell half is already done — you only own the domain half.
 *
 * Use a DEEP merge, not a shallow spread (`{ ...SHELL_LOCALES.es, ...es }`): when
 * a domain locale re-states a shell namespace (its own `common`/`settings` keys),
 * a shallow spread REPLACES the whole shell namespace and silently drops the
 * shell's translations for keys the app didn't re-list (back/save/delete…), which
 * then fall back to English. The fleet i18n pass uses a small `deepMerge` here
 * (see any shipped app's locales.ts, 2026-06-14).
 */

import { SHELL_LOCALES } from './shellLocales';

type Dict = { [key: string]: string | Dict };

// Default: shell chrome localized, no domain strings yet. The translate workflow
// rewrites this map to merge per-app domain dicts on top of each SHELL_LOCALES
// entry (see the header). Shape: { [locale]: Dict }.
export const LOCALES: Record<string, Dict> = { ...(SHELL_LOCALES as Record<string, Dict>) };
