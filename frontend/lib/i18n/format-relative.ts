import type { PreferredLanguage } from "@/lib/language-preference";

import { translate } from "./t";

export function formatRelativeTime(iso: string | null | undefined, locale: PreferredLanguage): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return translate(locale, "time.just_now");
  if (mins < 60) return translate(locale, "time.minutes_ago", { n: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return translate(locale, "time.hours_ago", { n: hours });
  return translate(locale, "time.days_ago", { n: Math.floor(hours / 24) });
}

export function formatLocaleDateTime(iso: string | null | undefined, locale: PreferredLanguage): string {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleString(locale === "vi" ? "vi-VN" : "en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
