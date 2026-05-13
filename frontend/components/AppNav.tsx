"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { getPublicApiBase } from "@/lib/backend-api";
import { useAuthMe, invalidateAuthMeCache } from "@/lib/client-auth";
import {
  DEFAULT_LANGUAGE,
  getPreferredLanguage,
  languageChangedEventName,
  setPreferredLanguage,
  type PreferredLanguage,
} from "@/lib/language-preference";
import { clearStoredResults } from "@/lib/result-session";
import { fetchWithStaleCache } from "@/lib/stale-cache";
import { formatRelativeTime } from "@/lib/i18n/format-relative";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { initializeTheme, applyTheme, type ThemeMode } from "@/lib/theme-mode";

type NotificationItem = {
  id: number;
  message: string;
  notification_type: string;
  related_request_id: string | null;
  related_course_title: string | null;
  is_read: boolean;
  created_at: string | null;
};

function linkClass(active: boolean): string {
  return `rounded-full px-4 py-2.5 text-sm font-bold tracking-normal transition ${
    active
      ? "bg-[#111827] text-white shadow-[0_6px_16px_rgba(15,23,42,0.14)]"
      : "text-stone-700 hover:bg-[#f3f4f6] hover:text-stone-950"
  }`;
}


function isActivePath(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

function avatarFallback(fullName: string | undefined): string {
  const first = (fullName || "").trim().charAt(0).toUpperCase();
  return first || "U";
}

export function AppNav() {
  const { t, locale } = useI18n();
  const apiBase = getPublicApiBase();
  const pathname = usePathname();
  const router = useRouter();
  const { user, refresh } = useAuthMe();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>(() => initializeTheme());
  const [language, setLanguage] = useState<PreferredLanguage>(DEFAULT_LANGUAGE);
  const [tabVisible, setTabVisible] = useState(true);
  const navRef = useRef<HTMLElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);
  const notificationButtonRef = useRef<HTMLButtonElement>(null);
  const menuItemClass =
    "block rounded-xl px-3 py-2 text-[15px] leading-6 text-stone-700 transition-colors hover:bg-stone-100";

  const workspaceLink = useMemo(() => {
    if (!user) return null;
    if (user.role === "Teacher") return { href: "/generator", label: t("nav.generate") };
    if (user.role === "QA") return { href: "/auditor", label: t("nav.audit") };
    return { href: "/generator", label: t("nav.generate_audit") };
  }, [user, t]);

  const navLinks = useMemo(
    () =>
      [
        { href: "/", label: t("nav.home") },
        workspaceLink,
        ...(user ? [{ href: "/history", label: t("nav.history") }] : []),
        { href: "/updates", label: t("nav.updates") },
        { href: "/faq", label: t("nav.faq") },
      ].filter(Boolean) as Array<{ href: string; label: string }>,
    [user, workspaceLink, t],
  );

  const avatarUrl = user?.avatarUrl
    ? user.avatarUrl.startsWith("http://") || user.avatarUrl.startsWith("https://")
      ? user.avatarUrl
      : `${apiBase}${user.avatarUrl}`
    : null;

  useEffect(() => {
    navLinks.forEach((link) => router.prefetch(link.href));
    if (user) {
      router.prefetch("/result");
      router.prefetch("/user");
      if (user.role === "Admin") {
        router.prefetch("/admin");
        router.prefetch("/admin/support");
      }
    }
  }, [navLinks, router, user]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void refresh();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [pathname, refresh]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setLanguage(getPreferredLanguage());
    }, 0);
    const syncLanguage = () => setLanguage(getPreferredLanguage());
    window.addEventListener(languageChangedEventName(), syncLanguage as EventListener);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(languageChangedEventName(), syncLanguage as EventListener);
    };
  }, []);

  const fetchNotifications = useCallback(async (email: string) => {
    const key = `notifications:${email.toLowerCase()}`;
    const data = await fetchWithStaleCache<{ items?: NotificationItem[]; unread_count?: number }>(
      key,
      async () => {
        const response = await fetch(`${apiBase}/api/notifications?email=${encodeURIComponent(email)}`);
        if (!response.ok) {
          throw new Error("notifications unavailable");
        }
        return (await response.json().catch(() => ({}))) as {
          items?: NotificationItem[];
          unread_count?: number;
        };
      },
      25_000,
    ).catch(() => null);
    if (!data) return;
    setNotifications(Array.isArray(data.items) ? data.items.slice(0, 20) : []);
    setUnreadCount(typeof data.unread_count === "number" ? data.unread_count : 0);
  }, [apiBase]);

  useEffect(() => {
    const onVisibilityChange = () => {
      setTabVisible(document.visibilityState !== "hidden");
    };
    onVisibilityChange();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  useEffect(() => {
    if (!user?.email) {
      const clear = window.setTimeout(() => {
        setNotifications([]);
        setUnreadCount(0);
      }, 0);
      return () => window.clearTimeout(clear);
    }
    const email = user.email;
    const load = window.setTimeout(() => {
      void fetchNotifications(email);
    }, 0);
    const interval = tabVisible ? window.setInterval(() => void fetchNotifications(email), 30_000) : null;
    return () => {
      window.clearTimeout(load);
      if (interval) {
        window.clearInterval(interval);
      }
    };
  }, [user?.email, fetchNotifications, tabVisible]);

  useEffect(() => {
    function handleClickOutside(event: PointerEvent) {
      const target = event.target as Node;
      if (navRef.current && !navRef.current.contains(target)) {
        setShowNotifications(false);
        setShowAccountMenu(false);
        setMobileOpen(false);
        return;
      }
      if (notificationRef.current && !notificationRef.current.contains(target)) {
        setShowNotifications(false);
      }
      if (accountRef.current && !accountRef.current.contains(target)) {
        setShowAccountMenu(false);
      }
    }
    document.addEventListener("pointerdown", handleClickOutside);
    return () => document.removeEventListener("pointerdown", handleClickOutside);
  }, []);

  useEffect(() => {
    const closeMenus = window.setTimeout(() => {
      setShowNotifications(false);
      setShowAccountMenu(false);
      setMobileOpen(false);
    }, 0);
    return () => window.clearTimeout(closeMenus);
  }, [pathname]);

  async function markAllRead() {
    if (!user?.email) return;
    await fetch(`${apiBase}/api/notifications/read-all?email=${encodeURIComponent(user.email)}`, {
      method: "POST",
    }).catch(() => null);
    setNotifications((prev) => prev.map((item) => ({ ...item, is_read: true })));
    setUnreadCount(0);
  }

  async function markOneRead(id: number) {
    await fetch(`${apiBase}/api/notifications/${id}/read`, { method: "POST" }).catch(() => null);
    setNotifications((prev) => prev.map((item) => (item.id === id ? { ...item, is_read: true } : item)));
    setUnreadCount((prev) => Math.max(0, prev - 1));
  }

  function notificationHref(notification: NotificationItem): string {
    if (
      user?.role === "Admin" &&
      notification.notification_type === "support_message" &&
      notification.related_request_id?.startsWith("support-")
    ) {
      const supportId = notification.related_request_id.replace("support-", "");
      return `/admin/support?highlight=${encodeURIComponent(supportId)}`;
    }
    if (notification.related_request_id) {
      return `/history?highlight=${encodeURIComponent(notification.related_request_id)}`;
    }
    return "/history";
  }

  async function signOut() {
    window.google?.accounts?.id?.disableAutoSelect?.();
    window.google?.accounts?.id?.cancel?.();
    clearStoredResults();
    invalidateAuthMeCache();
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    window.location.href = "/login";
  }

  function toggleTheme() {
    const nextTheme: ThemeMode = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    applyTheme(nextTheme);
    setShowAccountMenu(false);
    setMobileOpen(false);
  }

  function changeLanguage(nextLanguage: PreferredLanguage) {
    setLanguage(nextLanguage);
    setPreferredLanguage(nextLanguage);
    setShowAccountMenu(false);
    setMobileOpen(false);
  }

  return (
    <header
      ref={navRef}
      data-guide="main-navbar"
      className="sticky top-0 z-40 border-b border-[#ece9df] bg-[rgba(251,250,247,0.92)] backdrop-blur"
    >
      <nav className="mx-auto max-w-7xl px-4 py-3.5">
        <div className="flex items-center justify-between gap-3">
          <Link href="/" className="flex min-w-0 items-center gap-3 text-base font-black tracking-normal text-[#e66f00] sm:text-xl">
            <svg className="h-5 w-5 shrink-0 text-stone-950" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 3L5 5.8V11c0 4.2 2.8 7.8 7 9.2 4.2-1.4 7-5 7-9.2V5.8L12 3Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
              <path d="M9.4 12l1.7 1.7 3.6-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="truncate">{t("nav.brand")}</span>
          </Link>

          <div data-guide="main-navbar-links" className="hidden flex-1 items-center justify-center gap-2 lg:flex">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                data-guide={workspaceLink && link.href === workspaceLink.href ? "workspace-link" : undefined}
                className={linkClass(isActivePath(pathname, link.href))}
                onMouseEnter={() => router.prefetch(link.href)}
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {user ? (
              <div className="relative" ref={notificationRef}>
                <button
                  type="button"
                  ref={notificationButtonRef}
                  className="relative rounded-full border border-[#e0e4ea] bg-white/90 p-2.5 text-stone-600 hover:bg-stone-100 hover:text-stone-900"
                  onClick={() => {
                    setShowNotifications((value) => !value);
                    setShowAccountMenu(false);
                  }}
                  aria-label={t("nav.notifications")}
                  aria-expanded={showNotifications}
                  aria-haspopup="menu"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
                  </svg>
                  {unreadCount > 0 ? (
                    <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  ) : null}
                </button>
                {showNotifications ? (
                  <div className="z-50 max-lg:fixed max-lg:inset-x-3 max-lg:top-[4.5rem] max-lg:flex max-lg:justify-center lg:contents">
                    <div
                      className="w-full max-w-[23rem] overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-xl lg:absolute lg:right-0 lg:top-full lg:z-50 lg:mt-2 lg:w-[min(23rem,calc(100vw-1.5rem))]"
                      role="menu"
                      aria-label={t("nav.notifications")}
                      onKeyDown={(event) => {
                        if (event.key === "Escape") {
                          event.preventDefault();
                          setShowNotifications(false);
                          notificationButtonRef.current?.focus();
                        }
                      }}
                    >
                      <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
                        <span className="text-sm font-semibold text-stone-900">{t("nav.notifications")}</span>
                        {unreadCount > 0 ? (
                          <button
                            type="button"
                            className="text-xs font-semibold text-teal-700 hover:text-teal-900"
                            onClick={() => void markAllRead()}
                          >
                            {t("nav.mark_all_read")}
                          </button>
                        ) : null}
                      </div>
                      <div className="max-h-80 overflow-y-auto">
                        {notifications.length === 0 ? (
                          <div className="px-4 py-6 text-center text-sm text-stone-400">{t("nav.no_notifications")}</div>
                        ) : (
                          notifications.map((item) => (
                            <Link
                              key={item.id}
                              href={notificationHref(item)}
                              role="menuitem"
                              tabIndex={0}
                              className={`block border-b border-stone-50 px-4 py-3 transition-colors hover:bg-stone-50 ${
                                !item.is_read ? "bg-teal-50/50" : ""
                              }`}
                              onClick={() => {
                                if (!item.is_read) void markOneRead(item.id);
                                setShowNotifications(false);
                              }}
                            >
                              <p className="text-sm text-stone-800">{item.message}</p>
                              <p className="mt-1 text-xs text-stone-500">{formatRelativeTime(item.created_at, locale)}</p>
                            </Link>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="relative" ref={accountRef}>
              <button
                type="button"
                className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border border-[#e0e4ea] bg-white text-sm font-bold text-stone-700 shadow-sm hover:border-[#d8b16b]"
                onClick={() => {
                  setShowAccountMenu((value) => !value);
                  setShowNotifications(false);
                }}
                aria-label={t("nav.account_menu")}
              >
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt={t("nav.avatar_alt")} className="h-full w-full object-cover" />
                ) : (
                  avatarFallback(user?.fullName)
                )}
              </button>

              {showAccountMenu ? (
                <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-2xl border border-stone-200 bg-white p-2 shadow-xl">
                  {user ? (
                    <div className="mb-2 rounded-xl bg-stone-50 px-3 py-2">
                      <p className="truncate text-sm font-semibold text-stone-900">{user.fullName}</p>
                      <p className="truncate text-xs text-stone-500">{user.email}</p>
                      <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-teal-700">
                        {user.role}
                      </p>
                    </div>
                  ) : null}

                  {user ? (
                    <Link
                      href="/user"
                      className={menuItemClass}
                      onClick={() => setShowAccountMenu(false)}
                    >
                      {t("nav.view_account")}
                    </Link>
                  ) : (
                    <Link
                      href="/login"
                      className={menuItemClass}
                      onClick={() => setShowAccountMenu(false)}
                    >
                      {t("nav.sign_in")}
                    </Link>
                  )}

                  <button
                    type="button"
                    className={`mt-1 w-full text-left ${menuItemClass}`}
                    onClick={toggleTheme}
                  >
                    {t("nav.switch_theme", { mode: theme === "dark" ? t("nav.theme_light") : t("nav.theme_dark") })}
                  </button>

                  <div className="mt-1 rounded-xl px-3 py-2">
                    <label htmlFor="account-language" className="block text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">
                      {t("nav.language_label")}
                    </label>
                    <select
                      id="account-language"
                      className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-[15px] leading-6 text-stone-700 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                      value={language}
                      onChange={(event) => changeLanguage(event.target.value === "en" ? "en" : "vi")}
                    >
                      <option value="vi">{t("nav.lang_vi")}</option>
                      <option value="en">{t("nav.lang_en")}</option>
                    </select>
                  </div>

                  <Link
                    href="/faq?support=1"
                    className={`mt-1 ${menuItemClass}`}
                    onClick={() => setShowAccountMenu(false)}
                  >
                    {t("nav.help_support")}
                  </Link>

                  {user?.role === "Admin" ? (
                    <Link
                      href="/admin"
                      className={`mt-1 ${menuItemClass}`}
                      onClick={() => setShowAccountMenu(false)}
                    >
                      {t("nav.admin_console")}
                    </Link>
                  ) : null}

                  {user ? (
                    <button
                      type="button"
                      className={`mt-1 w-full text-left ${menuItemClass}`}
                      onClick={() => void signOut()}
                    >
                      {t("nav.sign_out")}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>

            <button
              type="button"
              data-guide="mobile-menu-toggle"
              className="rounded-full border border-[#e0e4ea] bg-white px-3.5 py-2.5 text-sm font-bold text-stone-700 hover:bg-stone-50 lg:hidden"
              onClick={() => setMobileOpen((value) => !value)}
              aria-expanded={mobileOpen}
              aria-label={t("nav.toggle_menu")}
            >
              <span className="sr-only">{mobileOpen ? t("nav.close") : t("nav.menu")}</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                {mobileOpen ? (
                  <>
                    <path d="M6 6l12 12" />
                    <path d="M18 6L6 18" />
                  </>
                ) : (
                  <>
                    <path d="M3 6h18" />
                    <path d="M3 12h18" />
                    <path d="M3 18h18" />
                  </>
                )}
              </svg>
            </button>
          </div>
        </div>

        {mobileOpen ? (
          <div
            data-guide="mobile-nav-menu"
            className="mt-3 space-y-3 rounded-3xl border border-stone-200 bg-white/95 p-4 shadow-[0_20px_50px_rgba(15,23,42,0.12)] lg:hidden"
          >
            {user ? (
              <div className="rounded-2xl border border-teal-200 bg-teal-50 px-4 py-3">
                <p className="truncate text-sm font-semibold text-stone-900">{user.fullName}</p>
                <p className="truncate text-xs text-stone-500">{user.email}</p>
              </div>
            ) : null}
            <div className="grid gap-2 sm:grid-cols-2">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  data-guide={workspaceLink && link.href === workspaceLink.href ? "workspace-link" : undefined}
                  className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${
                    isActivePath(pathname, link.href)
                      ? "border-stone-900 bg-stone-900 text-white"
                      : "border-stone-200 bg-stone-50 text-stone-700 hover:border-teal-300 hover:bg-teal-50"
                  }`}
                  onClick={() => setMobileOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </nav>
    </header>
  );
}
