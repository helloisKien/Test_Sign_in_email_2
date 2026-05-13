"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { getPublicApiBase } from "@/lib/backend-api";
import { useAuthMe } from "@/lib/client-auth";
import { formatLocaleDateTime, formatRelativeTime } from "@/lib/i18n/format-relative";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { saveResultPayload } from "@/lib/result-session";
import { fetchWithStaleCache } from "@/lib/stale-cache";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { SkeletonGrid } from "@/components/ui/Skeleton";

type HistoryItem = {
  request_id: string;
  content: string;
  syllabus_markdown?: string | null;
  qa_report_markdown?: string | null;
  output_format?: string | null;
  source_markdown?: string;
  status: string;
  mode?: string;
  course_code?: string | null;
  course_title?: string | null;
  teacher_note?: string | null;
  qa_feedback?: string | null;
  teacher_email?: string | null;
  teacher_name?: string | null;
  reviewer_email?: string | null;
  verdict?: string | null;
  submitted_at?: string | null;
  review_started_at?: string | null;
  reviewed_at?: string | null;
  saved_at?: string | null;
};

const STATUS_STYLE: Record<string, { bg: string; text: string; dot: string }> = {
  draft: { bg: "bg-stone-100", text: "text-stone-700", dot: "bg-stone-400" },
  submitted: { bg: "bg-sky-50", text: "text-sky-700", dot: "bg-sky-500" },
  in_progress: { bg: "bg-fuchsia-50", text: "text-fuchsia-700", dot: "bg-fuchsia-500" },
  needs_revision: { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500" },
  approve: { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
  reject: { bg: "bg-rose-50", text: "text-rose-700", dot: "bg-rose-500" },
};

function statusLabelKey(status: string): string {
  const map: Record<string, string> = {
    draft: "status.draft",
    submitted: "status.submitted",
    in_progress: "status.in_progress",
    needs_revision: "status.needs_revision",
    approve: "status.approve",
    reject: "status.reject",
  };
  return map[status] || "status.draft";
}

function statusBadge(status: string, t: (key: string) => string) {
  const config = STATUS_STYLE[status] || STATUS_STYLE.draft;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${config.bg} ${config.text}`}>
      <span className={`h-2 w-2 rounded-full ${config.dot}`} />
      {t(statusLabelKey(status))}
    </span>
  );
}

function HistoryPageContent() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const apiBase = getPublicApiBase();
  const { user: authUser, refresh } = useAuthMe();
  const highlight = searchParams.get("highlight");

  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [deletingRequestId, setDeletingRequestId] = useState<string | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [selectedRequestIds, setSelectedRequestIds] = useState<string[]>([]);
  const [page, setPage] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<HistoryItem | null>(null);
  const [confirmBulkDeleteOpen, setConfirmBulkDeleteOpen] = useState(false);

  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterSubject, setFilterSubject] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const pageSize = 12;

  const user = authUser
    ? { email: authUser.email, fullName: authUser.fullName, role: authUser.role }
    : null;
  const isAdmin = user?.role === "Admin";
  const isQa = user?.role === "QA";
  const isTeacher = user?.role === "Teacher";

  function canTeacherRegenerateWithQa(item: HistoryItem): boolean {
    if (!isTeacher) {
      return false;
    }
    if ((item.mode || "generate") !== "generate") {
      return false;
    }
    if (!["approve", "needs_revision", "reject"].includes(item.status)) {
      return false;
    }
    return Boolean(item.reviewed_at);
  }

  async function loadHistory() {
    setLoading(true);
    try {
      const me = authUser || (await refresh());
      const currentEmail = typeof me?.email === "string" ? me.email : null;
      const currentRole = typeof me?.role === "string" ? me.role : null;

      const params = new URLSearchParams();
      if (currentRole === "Teacher") {
        params.set("teacher_email", currentEmail || "");
      } else if (currentRole === "QA") {
        params.set("reviewer_email", currentEmail || "");
        params.set("include_unreviewed", "true");
      }

      if (filterStatus !== "all") {
        params.set("status", filterStatus);
      }
      if (filterSubject.trim()) {
        params.set("course_title", filterSubject.trim());
      }
      if (filterDateFrom) {
        params.set("date_from", filterDateFrom);
      }
      if (filterDateTo) {
        params.set("date_to", filterDateTo);
      }
      params.set("limit", String(pageSize));
      params.set("offset", String(page * pageSize));

      const cacheKey = `history:${params.toString()}:${currentEmail || "anon"}`;
      const payload = await fetchWithStaleCache<{ items?: HistoryItem[]; total?: number; has_more?: boolean }>(
        cacheKey,
        async () => {
          const response = await fetch(`${apiBase}/api/review/submissions?${params.toString()}`);
          return (await response.json().catch(() => ({ items: [] }))) as { items?: HistoryItem[]; total?: number; has_more?: boolean };
        },
        20_000,
      );
      setItems(Array.isArray(payload?.items) ? payload.items : []);
      setTotalItems(typeof payload?.total === "number" ? payload.total : 0);
      setHasMore(Boolean(payload?.has_more));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadHistory();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [filterStatus, filterDateFrom, filterDateTo, page]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadHistory();
    }, 400);
    return () => window.clearTimeout(timeout);
  }, [filterSubject, page]); // eslint-disable-line react-hooks/exhaustive-deps

  async function claimForQa(item: HistoryItem): Promise<boolean> {
    if (!isQa || !["submitted", "in_progress"].includes(item.status)) {
      return true;
    }

    const response = await fetch(`/api/review/submissions/${encodeURIComponent(item.request_id)}/claim`, {
      method: "POST",
    });
    const payload = await response.json().catch(() => null);
    if (response.ok) {
      return true;
    }
    setMessage(payload?.error || t("history.msg_claim"));
    await loadHistory();
    return false;
  }

  async function openResult(item: HistoryItem) {
    setMessage(null);
    if (!(await claimForQa(item))) {
      return;
    }

    saveResultPayload(
      {
        mode: isQa ? "audit" : "generate",
        ownerEmail: user?.email || null,
        requestId: item.request_id,
        content: (item.syllabus_markdown || item.content) as string,
        outputFormat: item.output_format || "markdown",
        courseTitle: item.course_title || t("untitled_syllabus"),
        sourceMarkdown: item.source_markdown || "",
        reviewingRequestId: isQa ? item.request_id : null,
        qaReportMarkdown: item.qa_report_markdown || null,
      },
      user?.email || null,
    );
    router.push("/result");
  }

  function openRegenerateFromHistory(item: HistoryItem) {
    router.push(`/regenerate?request_id=${encodeURIComponent(item.request_id)}`);
  }

  async function continueInWizard(item: HistoryItem) {
    setMessage(null);
    if (!(await claimForQa(item))) {
      return;
    }
    const targetPath = isQa ? "/auditor" : "/generator";
    router.push(`${targetPath}?resume=${encodeURIComponent(item.request_id)}`);
  }

  async function deleteSingleSession(item: HistoryItem) {
    setMessage(null);
    setDeletingRequestId(item.request_id);
    try {
      const response = await fetch(`/api/admin/sessions/${encodeURIComponent(item.request_id)}`, {
        method: "DELETE",
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setMessage(payload?.error || t("history.msg_could_not_delete"));
        return;
      }
      setSelectedRequestIds((prev) => prev.filter((requestId) => requestId !== item.request_id));
      setMessage(t("history.msg_deleted"));
      await loadHistory();
    } catch {
      setMessage(t("history.msg_net_session"));
    } finally {
      setDeletingRequestId(null);
    }
  }

  async function deleteSelectedSessions() {
    if (visibleSelectedRequestIds.length === 0) {
      return;
    }
    setMessage(null);
    setBulkDeleting(true);
    try {
      let failedCount = 0;
      for (const requestId of visibleSelectedRequestIds) {
        const response = await fetch(`/api/admin/sessions/${encodeURIComponent(requestId)}`, {
          method: "DELETE",
        });
        if (!response.ok) {
          failedCount += 1;
        }
      }
      setSelectedRequestIds([]);
      setMessage(failedCount === 0 ? t("history.msg_bulk_ok") : t("history.msg_bulk_partial", { n: failedCount }));
      if (page > 0 && items.length === visibleSelectedRequestIds.length) {
        setPage((current) => Math.max(0, current - 1));
      }
      await loadHistory();
    } catch {
      setMessage(t("history.msg_net_del"));
    } finally {
      setBulkDeleting(false);
    }
  }

  function toggleSelected(requestId: string) {
    setSelectedRequestIds((prev) =>
      prev.includes(requestId)
        ? prev.filter((value) => value !== requestId)
        : [...prev, requestId],
    );
  }

  function toggleSelectAllVisible() {
    if (visibleSelectedRequestIds.length === items.length && items.length > 0) {
      setSelectedRequestIds([]);
      return;
    }
    setSelectedRequestIds(items.map((item) => item.request_id));
  }

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: items.length };
    for (const item of items) {
      counts[item.status] = (counts[item.status] || 0) + 1;
    }
    return counts;
  }, [items]);
  const visibleSelectedRequestIds = selectedRequestIds.filter((requestId) =>
    items.some((item) => item.request_id === requestId),
  );

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(255,239,189,0.4),_transparent_20%),radial-gradient(circle_at_top_right,_rgba(200,247,238,0.46),_transparent_22%),linear-gradient(180deg,_#fbfaf7_0%,_#f5f3ec_100%)] px-4 py-5 sm:py-6">
      <div className="mx-auto max-w-6xl space-y-4">
        <header className="rounded-[1.45rem] border border-[#ece9df] bg-white/90 px-5 py-4 shadow-[0_18px_60px_rgba(15,23,42,0.08)] backdrop-blur">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#647084]">{t("history.kicker")}</p>
              <h1 className="mt-2 font-sans text-[2rem] font-black text-stone-950 sm:text-[2.35rem]">{t("history.title")}</h1>
              {user ? (
                <p className="mt-1 text-[1rem] text-stone-500">
                  {user.email} | <span className="capitalize">{user.role}</span>
                </p>
              ) : null}
            </div>
            <button
              type="button"
              className="rounded-full border border-[#d9dee8] bg-[#ffffff] px-4 py-2.5 text-sm font-bold text-[#111827] shadow-[0_4px_12px_rgba(15,23,42,0.08)] transition-transform hover:border-[#c6cdd9] active:scale-[0.98]"
              onClick={() => void loadHistory()}
            >
              {t("common.refresh")}
            </button>
          </div>
        </header>

        {message ? (
          <div className="rounded-2xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-900 shadow-sm">
            {message}
          </div>
        ) : null}

        <section
          data-guide="history-filters"
          className="rounded-[1.45rem] border border-[#ece9df] bg-white/90 p-4 shadow-[0_18px_60px_rgba(15,23,42,0.08)] backdrop-blur"
        >
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">{t("history.filters")}</div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div>
              <label htmlFor="filter-subject" className="mb-1 block text-xs font-medium text-stone-600">
                {t("history.subject")}
              </label>
              <input
                id="filter-subject"
                type="text"
                placeholder={t("history.subject_ph")}
                className="w-full rounded-xl border border-[#d9dee8] bg-[#fbfbfc] px-3 py-2.5 text-sm text-[#091225] outline-none focus:border-[#e67700] focus:ring-2 focus:ring-[#e67700]/20"
                value={filterSubject}
                onChange={(event) => {
                  setPage(0);
                  setFilterSubject(event.target.value);
                }}
              />
            </div>

            <div>
              <label htmlFor="filter-status" className="mb-1 block text-xs font-medium text-stone-600">
                {t("history.status")}
              </label>
              <select
                id="filter-status"
                className="w-full rounded-xl border border-[#d9dee8] bg-[#fbfbfc] px-3 py-2.5 text-sm text-[#091225] outline-none focus:border-[#e67700] focus:ring-2 focus:ring-[#e67700]/20"
                value={filterStatus}
                onChange={(event) => {
                  setPage(0);
                  setFilterStatus(event.target.value);
                }}
              >
                <option value="all">{t("history.opt_all")}</option>
                <option value="draft">{t("status.draft")}</option>
                <option value="submitted">{t("status.submitted")}</option>
                <option value="in_progress">{t("status.in_progress")}</option>
                <option value="needs_revision">{t("status.needs_revision")}</option>
                <option value="approve">{t("status.approve")}</option>
                <option value="reject">{t("status.reject")}</option>
              </select>
            </div>

            <div>
              <label htmlFor="filter-date-from" className="mb-1 block text-xs font-medium text-stone-600">
                {t("history.from")}
              </label>
              <input
                id="filter-date-from"
                type="date"
                className="w-full rounded-xl border border-[#d9dee8] bg-[#fbfbfc] px-3 py-2.5 text-sm text-[#091225] outline-none focus:border-[#e67700] focus:ring-2 focus:ring-[#e67700]/20"
                value={filterDateFrom}
                onChange={(event) => {
                  setPage(0);
                  setFilterDateFrom(event.target.value);
                }}
              />
            </div>

            <div>
              <label htmlFor="filter-date-to" className="mb-1 block text-xs font-medium text-stone-600">
                {t("history.to")}
              </label>
              <input
                id="filter-date-to"
                type="date"
                className="w-full rounded-xl border border-[#d9dee8] bg-[#fbfbfc] px-3 py-2.5 text-sm text-[#091225] outline-none focus:border-[#e67700] focus:ring-2 focus:ring-[#e67700]/20"
                value={filterDateTo}
                onChange={(event) => {
                  setPage(0);
                  setFilterDateTo(event.target.value);
                }}
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {Object.entries(STATUS_STYLE).map(([key, config]) =>
              (statusCounts[key] || 0) > 0 ? (
                <button
                  key={key}
                  type="button"
                  className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                    filterStatus === key
                      ? `${config.bg} ${config.text} ring-2 ring-offset-1`
                      : "bg-stone-50 text-stone-500 hover:bg-stone-100"
                  }`}
                  onClick={() => {
                    setPage(0);
                    setFilterStatus(filterStatus === key ? "all" : key);
                  }}
                >
                  {t(statusLabelKey(key))} ({statusCounts[key]})
                </button>
              ) : null,
            )}
            {filterStatus !== "all" ? (
              <button
                type="button"
                className="rounded-full px-2.5 py-1 text-xs font-medium text-stone-500 underline hover:text-stone-700"
                onClick={() => {
                  setPage(0);
                  setFilterStatus("all");
                }}
              >
                {t("history.clear_filter")}
              </button>
            ) : null}
          </div>
        </section>

        {isAdmin ? (
          <section className="rounded-[1.45rem] border border-[#ece9df] bg-white/90 p-4 shadow-[0_18px_60px_rgba(15,23,42,0.08)] backdrop-blur">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-sm font-semibold text-stone-950">{t("history.bulk_title")}</div>
                <p className="text-xs text-stone-500">{t("history.bulk_hint")}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50"
                  onClick={toggleSelectAllVisible}
                  disabled={items.length === 0}
                >
                  {visibleSelectedRequestIds.length === items.length && items.length > 0
                    ? t("history.clear_visible")
                    : t("history.select_visible")}
                </button>
                <button
                  type="button"
                  className="rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                  onClick={() => setConfirmBulkDeleteOpen(true)}
                  disabled={visibleSelectedRequestIds.length === 0 || bulkDeleting}
                >
                  {bulkDeleting
                    ? t("common.deleting")
                    : t("history.delete_selected", { n: visibleSelectedRequestIds.length })}
                </button>
              </div>
            </div>
          </section>
        ) : null}

        <section className="grid gap-3">
          {loading ? (
            <SkeletonGrid cards={6} />
          ) : items.length === 0 ? (
              <div className="rounded-[1.45rem] border border-[#ece9df] bg-white/90 p-5 text-center shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
              <p className="text-stone-500">{t("history.empty")}</p>
              <p className="mt-1 text-xs text-stone-400">{t("history.empty_hint")}</p>
            </div>
          ) : (
            items.map((item) => {
              const isSelected = visibleSelectedRequestIds.includes(item.request_id);
              const topTimestamp = item.reviewed_at || item.review_started_at || item.submitted_at || item.saved_at;
              return (
                <article
                  key={item.request_id}
                  className={`rounded-[1.45rem] border bg-white/92 p-4 shadow-[0_18px_60px_rgba(15,23,42,0.08)] transition-all ${
                    highlight === item.request_id
                      ? "border-teal-400 ring-2 ring-teal-200"
                      : isSelected
                        ? "border-rose-300 ring-2 ring-rose-100"
                        : "border-white/60 hover:border-stone-300"
                  }`}
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start gap-3">
                        {isAdmin ? (
                          <label className="mt-1 flex items-center gap-2 text-xs font-medium text-stone-500">
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-stone-300 text-rose-600 focus:ring-rose-500"
                              checked={isSelected}
                              onChange={() => toggleSelected(item.request_id)}
                            />
                            {t("history.select")}
                          </label>
                        ) : null}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-sans text-[1.3rem] font-black text-stone-950">{item.course_title || t("untitled_syllabus")}</h3>
                            {statusBadge(item.status, t)}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-500">
                            {item.course_code ? (
                              <span>
                                {t("history.course_code")} {item.course_code}
                              </span>
                            ) : null}
                            {item.teacher_email ? (
                              <span>
                                {t("history.author")} {item.teacher_name || item.teacher_email}
                              </span>
                            ) : null}
                            {item.reviewer_email ? (
                              <span>
                                {t("history.reviewer")} {item.reviewer_email}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      {item.qa_feedback ? (
                        <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-800">{t("history.qa_feedback")}</p>
                          <p className="mt-1 text-sm text-amber-950">{item.qa_feedback}</p>
                        </div>
                      ) : item.teacher_note ? (
                        <div className="mt-3 rounded-2xl border border-sky-200 bg-sky-50 px-3 py-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-800">{t("history.extra_notes")}</p>
                          <p className="mt-1 text-sm text-sky-950">{item.teacher_note}</p>
                        </div>
                      ) : null}
                    </div>

                    <div className="w-full shrink-0 rounded-[1.1rem] border border-stone-200 bg-stone-50 px-4 py-3 lg:w-64">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">{t("history.timeline")}</p>
                      <div className="mt-2 space-y-1 text-sm text-stone-700">
                        <p>
                          {t("history.recent")} {formatRelativeTime(topTimestamp, locale)}
                        </p>
                        {item.submitted_at ? (
                          <p>
                            {t("history.submitted")} {formatLocaleDateTime(item.submitted_at, locale)}
                          </p>
                        ) : null}
                        {item.review_started_at ? (
                          <p>
                            {t("history.started")} {formatLocaleDateTime(item.review_started_at, locale)}
                          </p>
                        ) : null}
                        {item.reviewed_at ? (
                          <p>
                            {t("history.reviewed")} {formatLocaleDateTime(item.reviewed_at, locale)}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2 border-t border-stone-100 pt-4">
                    <button
                      type="button"
                      className="rounded-full border border-[#d9dee8] bg-[#ffffff] px-3 py-2 text-xs font-bold text-[#111827] hover:bg-[#f3f4f6]"
                      onClick={() => void openResult(item)}
                    >
                      {t("history.view_result")}
                    </button>
                    <button
                      type="button"
                      className="rounded-full bg-[#e67700] px-3 py-2 text-xs font-bold text-white hover:bg-[#c75f00]"
                      onClick={() => void continueInWizard(item)}
                    >
                      {t("history.continue_wizard")}
                    </button>
                    {canTeacherRegenerateWithQa(item) ? (
                      <button
                        type="button"
                        className="rounded-full border border-teal-600 bg-teal-50 px-3 py-2 text-xs font-bold text-teal-900 hover:bg-teal-100"
                        onClick={() => openRegenerateFromHistory(item)}
                      >
                        {t("history.edit_with_qa")}
                      </button>
                    ) : null}
                    {isAdmin ? (
                      <button
                        type="button"
                        className="rounded-full border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                        onClick={() => setPendingDelete(item)}
                        disabled={deletingRequestId === item.request_id}
                      >
                        {deletingRequestId === item.request_id ? t("common.deleting") : t("history.delete_session")}
                      </button>
                    ) : null}
                  </div>
                </article>
              );
            })
          )}
        </section>

        {!loading && items.length > 0 ? (
          <div className="flex flex-wrap items-center justify-center gap-3 text-center text-xs text-stone-500">
            <p>{t("history.showing", { n: items.length })}</p>
            <p>{t("history.total", { n: totalItems })}</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded-lg border border-[#d9dee8] bg-[#ffffff] px-3 py-1.5 font-bold text-[#111827] shadow-[0_4px_12px_rgba(15,23,42,0.08)] transition-transform hover:border-[#c6cdd9] disabled:opacity-40"
                onClick={() => setPage((current) => Math.max(0, current - 1))}
                disabled={page === 0}
              >
                {t("history.prev_page")}
              </button>
              <button
                type="button"
                className="rounded-lg border border-[#d9dee8] bg-[#ffffff] px-3 py-1.5 font-bold text-[#111827] shadow-[0_4px_12px_rgba(15,23,42,0.08)] transition-transform hover:border-[#c6cdd9] disabled:opacity-40"
                onClick={() => setPage((current) => current + 1)}
                disabled={!hasMore}
              >
                {t("history.next_page")}
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title={t("history.delete_session")}
        description={t("history.confirm_delete_one", { title: pendingDelete?.course_title || t("untitled_syllabus") })}
        confirmLabel={t("history.delete_session")}
        cancelLabel={t("common.back")}
        variant="danger"
        onConfirm={() => {
          const item = pendingDelete;
          setPendingDelete(null);
          if (item) {
            void deleteSingleSession(item);
          }
        }}
        onCancel={() => setPendingDelete(null)}
      />

      <ConfirmDialog
        open={confirmBulkDeleteOpen}
        title={t("history.bulk_title")}
        description={t("history.confirm_delete_bulk", { n: visibleSelectedRequestIds.length })}
        confirmLabel={t("history.delete_selected", { n: visibleSelectedRequestIds.length })}
        cancelLabel={t("common.back")}
        variant="danger"
        onConfirm={() => {
          setConfirmBulkDeleteOpen(false);
          void deleteSelectedSessions();
        }}
        onCancel={() => setConfirmBulkDeleteOpen(false)}
      />
    </main>
  );
}

function HistoryLoadingFallback() {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,_#fbfaf7_0%,_#f5f3ec_100%)] px-4 py-6">
      <div className="mx-auto max-w-6xl">
        <SkeletonGrid cards={6} />
      </div>
    </main>
  );
}

export default function HistoryPage() {
  return (
    <Suspense fallback={<HistoryLoadingFallback />}>
      <HistoryPageContent />
    </Suspense>
  );
}
