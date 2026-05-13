"use client";

import { usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n/I18nProvider";

function ShieldIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3L5 5.8V11c0 4.2 2.8 7.8 7 9.2 4.2-1.4 7-5 7-9.2V5.8L12 3Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M9.4 12l1.7 1.7 3.6-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function AppFooter() {
  const { t } = useI18n();
  const pathname = usePathname();

  // Hide footer on workspace and isolated pages
  const hiddenRoutes = ["/generator", "/auditor", "/admin", "/login", "/signup"];
  const isHidden = hiddenRoutes.some((route) => pathname.startsWith(route));

  if (isHidden) {
    return null;
  }

  return (
    <footer className="mt-auto border-t border-[#d9dee8] bg-white/60 px-5 py-6 sm:px-6 lg:px-8 dark:border-slate-800 dark:bg-slate-900/60 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 text-sm tracking-normal text-stone-500 sm:flex-row sm:items-center sm:justify-between dark:text-slate-400">
        <div className="flex items-center gap-3 font-black text-[#e67700]">
          <ShieldIcon className="h-5 w-5 text-stone-900 dark:text-slate-200" />
          <span>{t("home.footer_brand")}</span>
        </div>
        <p>{t("home.footer_copy")}</p>
      </div>
    </footer>
  );
}
