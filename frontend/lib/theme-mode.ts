"use client";

export type ThemeMode = "light" | "dark";

const THEME_KEY = "smart-syllabus-theme";

function preferredSystemTheme(): ThemeMode {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function getInitialTheme(): ThemeMode {
  if (typeof window === "undefined") return "light";
  const stored = (window.localStorage.getItem(THEME_KEY) || "").trim();
  if (stored === "light" || stored === "dark") return stored;
  return preferredSystemTheme();
}

export function applyTheme(nextTheme: ThemeMode): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", nextTheme);
  window.localStorage.setItem(THEME_KEY, nextTheme);
}

export function initializeTheme(): ThemeMode {
  const next = getInitialTheme();
  applyTheme(next);
  return next;
}
