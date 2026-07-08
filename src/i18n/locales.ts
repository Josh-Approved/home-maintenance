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
 *   2. Fill each src/i18n/<locale>.ts with the domain translations.
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
import es from './es';
import de from './de';
import fr from './fr';
import it from './it';
import ptBR from './pt-BR';
import ja from './ja';

type Dict = { [key: string]: string | Dict };

function deepMerge(base: Dict, extra: Dict): Dict {
  const out: Dict = { ...base };
  for (const [k, v] of Object.entries(extra)) {
    const cur = out[k];
    if (v && typeof v === 'object' && cur && typeof cur === 'object') {
      out[k] = deepMerge(cur as Dict, v as Dict);
    } else {
      out[k] = v;
    }
  }
  return out;
}

const S = SHELL_LOCALES as unknown as Record<string, Dict>;

export const LOCALES: Record<string, Dict> = {
  es: deepMerge(S.es, es as unknown as Dict),
  de: deepMerge(S.de, de as unknown as Dict),
  fr: deepMerge(S.fr, fr as unknown as Dict),
  it: deepMerge(S.it, it as unknown as Dict),
  'pt-BR': deepMerge(S['pt-BR'], ptBR as unknown as Dict),
  ja: deepMerge(S.ja, ja as unknown as Dict),
};
