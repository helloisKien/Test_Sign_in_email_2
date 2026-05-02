import type { PreferredLanguage } from "@/lib/language-preference";
import { DEFAULT_LANGUAGE } from "@/lib/language-preference";

import { STRINGS_EN, STRINGS_VI } from "./strings";

const CATALOG: Record<PreferredLanguage, Record<string, string>> = {
  en: STRINGS_EN,
  vi: STRINGS_VI,
};

export function translate(locale: PreferredLanguage, key: string, vars?: Record<string, string | number>): string {
  const table = CATALOG[locale] ?? CATALOG[DEFAULT_LANGUAGE];
  let text = table[key] ?? CATALOG.en[key] ?? key;
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.split(`{${name}}`).join(String(value));
    }
  }
  return text;
}
