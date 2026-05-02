"use client";

import { useEffect } from "react";

import { I18nProvider, useI18n } from "@/lib/i18n/I18nProvider";

function HtmlLangSync() {
  const { locale } = useI18n();
  useEffect(() => {
    document.documentElement.lang = locale === "vi" ? "vi" : "en";
  }, [locale]);
  return null;
}

export function ClientAppShell({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider>
      <HtmlLangSync />
      {children}
    </I18nProvider>
  );
}
