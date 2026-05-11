"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { DEFAULT_LANGUAGE, getPreferredLanguage, languageChangedEventName, type PreferredLanguage } from "@/lib/language-preference";

import { translate } from "./t";

type I18nContextValue = {
  locale: PreferredLanguage;
  t: (key: string, vars?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<PreferredLanguage>(DEFAULT_LANGUAGE);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setLocale(getPreferredLanguage());
    }, 0);
    const onLang = () => setLocale(getPreferredLanguage());
    window.addEventListener(languageChangedEventName(), onLang as EventListener);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(languageChangedEventName(), onLang as EventListener);
    };
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars),
    [locale],
  );

  const value = useMemo(() => ({ locale, t }), [locale, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return ctx;
}
