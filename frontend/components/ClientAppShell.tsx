"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

import { ToastContainer } from "@/components/ui/Toast";
import { OnboardingGuide } from "@/components/onboarding/OnboardingGuide";
import { I18nProvider, useI18n } from "@/lib/i18n/I18nProvider";
import { usePageTitle } from "@/lib/usePageTitle";

function HtmlLangSync() {
  const { locale } = useI18n();
  useEffect(() => {
    document.documentElement.lang = locale === "vi" ? "vi" : "en";
  }, [locale]);
  return null;
}

function RouteTitleSync() {
  const pathname = usePathname();
  const { t } = useI18n();

  const titleMap: Record<string, string> = {
    "/": t("nav.home"),
    "/generator": t("wizloc.gen.title"),
    "/auditor": t("wizloc.audit.title"),
    "/history": t("history.title"),
    "/result": t("result.default_title"),
    "/regenerate": t("regenerate.title"),
    "/user": t("user.title"),
    "/admin": t("admin.title"),
    "/admin/support": t("admin.support_inbox"),
    "/updates": t("nav.updates"),
    "/faq": t("faq.title"),
    "/login": t("login.title"),
    "/signup": t("signup.title"),
  };

  usePageTitle(titleMap[pathname] || "Smart Syllabus Studio");
  return null;
}

export function ClientAppShell({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider>
      <HtmlLangSync />
      <RouteTitleSync />
      {children}
      <OnboardingGuide />
      <ToastContainer />
    </I18nProvider>
  );
}
