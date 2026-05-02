"use client";

export type PreferredLanguage = "vi" | "en";

const LANGUAGE_KEY = "smart-syllabus-language";
const LANGUAGE_CHANGED_EVENT = "smart-syllabus-language-changed";
export const DEFAULT_LANGUAGE: PreferredLanguage = "vi";

export function getPreferredLanguage(): PreferredLanguage {
  if (typeof window === "undefined") {
    return DEFAULT_LANGUAGE;
  }
  const value = (window.localStorage.getItem(LANGUAGE_KEY) || "").trim().toLowerCase();
  return value === "en" ? "en" : "vi";
}

export function setPreferredLanguage(language: PreferredLanguage): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(LANGUAGE_KEY, language);
  window.dispatchEvent(
    new CustomEvent(LANGUAGE_CHANGED_EVENT, {
      detail: { language },
    }),
  );
}

export function languageChangedEventName(): string {
  return LANGUAGE_CHANGED_EVENT;
}

