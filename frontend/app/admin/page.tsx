"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { SkeletonGrid } from "@/components/ui/Skeleton";
import { useI18n } from "@/lib/i18n/I18nProvider";

type UserItem = {
  id: string;
  email: string;
  full_name: string;
  role: "generator" | "auditor" | "admin";
  created_at: string;
  is_blocked?: boolean;
  blocked_at?: string | null;
};

type SessionItem = {
  request_id: string;
  status: string;
  course_title?: string | null;
  teacher_email?: string | null;
  teacher_name?: string | null;
  reviewer_email?: string | null;
  submitted_at?: string | null;
  reviewed_at?: string | null;
  review_started_at?: string | null;
  review_lock_expires_at?: string | null;
};

type CountSeriesPoint = {
  date: string;
  count: number;
};

type ParetoPoint = {
  label: string;
  count: number;
  share_pct: number;
  cumulative_pct: number;
};

type ProviderPoint = {
  provider: string;
  count: number;
  share_pct: number;
};

type EndpointSuccess = {
  total: number;
  success: number;
  error: number;
};

type DashboardPayload = {
  generated_at?: string;
  kpis?: {
    user_activity?: {
      total_users?: number;
      active_teachers_30d?: number;
      active_qas_30d?: number;
      signups_7d?: number;
      signups_30d?: number;
      signups_by_day_30d?: CountSeriesPoint[];
    };
    syllabus_throughput?: {
      drafted?: number;
      submitted?: number;
      in_progress?: number;
      approved?: number;
      needs_revision?: number;
      rejected?: number;
      avg_review_queue_hours?: number;
      avg_review_lock_hours?: number;
    };
    feature_adoption?: {
      source_entry_manual?: number;
      source_entry_upload?: number;
      source_entry_unknown?: number;
      generator_flow_volume?: number;
      auditor_flow_volume?: number;
    };
  };
  quality?: {
    approval?: {
      first_pass_total?: number;
      first_pass_approved?: number;
      first_pass_revision_or_reject?: number;
      first_pass_approval_rate_pct?: number;
    };
    feedback_loop?: {
      avg_char_levenshtein_distance?: number;
      avg_line_levenshtein_distance?: number;
      regenerate_field_calls?: number;
    };
    common_failure_points?: ParetoPoint[];
  };
  ai_observability?: {
    provider_traffic?: ProviderPoint[];
    fallbacks?: {
      count?: number;
      share_pct?: number;
    };
    avg_runtime_ms?: {
      generation_flow?: number;
      audit_flow?: number;
      generation_samples?: number;
      audit_samples?: number;
    };
    endpoint_success?: Record<string, EndpointSuccess>;
    tokens_and_cost?: {
      totals?: {
        prompt_tokens_est?: number;
        completion_tokens_est?: number;
        total_tokens_est?: number;
        estimated_cost_usd?: number;
      };
    };
    preflight?: {
      blocked_total?: number;
      blocked_by_layer?: Array<{ layer: string; count: number }>;
    };
  };
  system_health?: {
    health?: {
      status?: string;
    };
    storage?: {
      database?: {
        enabled?: boolean;
      };
      supabase_rest?: {
        configured?: boolean;
      };
    };
    backend_uptime_seconds?: number;
    backend_memory_mb?: number | null;
    email_delivery?: {
      total_events?: number;
      success?: number;
      failed?: number;
      skipped?: number;
      providers?: Array<{ provider: string; count: number }>;
    };
  };
  operations?: {
    sessions?: SessionItem[];
  };
};

type ReprocessResult = {
  status?: string;
  dry_run?: boolean;
  limit?: number;
  processed?: number;
  persisted?: number;
  skipped_missing_source?: number;
  verdict_counts?: Record<string, number>;
  elapsed_ms?: number;
};

function roleLabel(role: UserItem["role"]): string {
  if (role === "generator") return "Teacher";
  if (role === "auditor") return "QA";
  return "Admin";
}

function statusTone(status: string): string {
  if (status === "approve") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "needs_revision") return "border-amber-200 bg-amber-50 text-amber-700";
  if (status === "reject") return "border-rose-200 bg-rose-50 text-rose-700";
  if (status === "in_progress") return "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700";
  if (status === "submitted") return "border-sky-200 bg-sky-50 text-sky-700";
  return "border-stone-200 bg-stone-50 text-stone-700";
}

function safeNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function formatDateTime(value?: string | null): string {
  if (!value) return "N/A";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "N/A";
  return parsed.toLocaleString();
}

function formatHours(value: unknown): string {
  return `${safeNumber(value).toFixed(2)} h`;
}

function formatMilliseconds(value: unknown): string {
  const ms = safeNumber(value);
  if (ms <= 0) return "0 ms";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

function formatDuration(seconds: unknown): string {
  const value = safeNumber(seconds);
  if (!value) return "0m";
  const days = Math.floor(value / 86400);
  const hours = Math.floor((value % 86400) / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export default function AdminPage() {
  const { t } = useI18n();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [busySessionId, setBusySessionId] = useState<string | null>(null);
  const [reprocessBusy, setReprocessBusy] = useState(false);
  const [reprocessLimit, setReprocessLimit] = useState(50);
  const [reprocessDryRun, setReprocessDryRun] = useState(false);
  const [reprocessResult, setReprocessResult] = useState<ReprocessResult | null>(null);
  const [sessionRoleScope, setSessionRoleScope] = useState<"all" | "generator" | "auditor">("all");
  const [sessionUserScope, setSessionUserScope] = useState<string>("all");
  const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>([]);
  const [bulkBusyAction, setBulkBusyAction] = useState<"release" | "delete" | null>(null);
  const [pendingDeleteUser, setPendingDeleteUser] = useState<UserItem | null>(null);
  const [pendingDeleteSession, setPendingDeleteSession] = useState<SessionItem | null>(null);
  const [confirmBulkReleaseOpen, setConfirmBulkReleaseOpen] = useState(false);
  const [confirmBulkDeleteOpen, setConfirmBulkDeleteOpen] = useState(false);

  const numberFmt = useMemo(() => new Intl.NumberFormat(), []);
  const moneyFmt = useMemo(
    () =>
      new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 4,
      }),
    [],
  );

  const sessions = useMemo(() => dashboard?.operations?.sessions ?? [], [dashboard?.operations?.sessions]);
  const teacherUsers = useMemo(
    () =>
      users
        .filter((user) => user.role === "generator")
        .sort((a, b) => a.full_name.localeCompare(b.full_name)),
    [users],
  );
  const qaUsers = useMemo(
    () =>
      users
        .filter((user) => user.role === "auditor")
        .sort((a, b) => a.full_name.localeCompare(b.full_name)),
    [users],
  );
  const scopedUserOptions = useMemo(() => {
    const teacherOptionsMap = new Map<string, string>();
    for (const user of teacherUsers) {
      teacherOptionsMap.set(
        user.email.toLowerCase(),
        `${user.full_name} (Teacher)`,
      );
    }
    for (const session of sessions) {
      const email = String(session.teacher_email || "").trim().toLowerCase();
      if (!email || teacherOptionsMap.has(email)) continue;
      const teacherName = String(session.teacher_name || "").trim();
      teacherOptionsMap.set(email, `${teacherName || email} (Teacher)`);
    }

    const qaOptionsMap = new Map<string, string>();
    for (const user of qaUsers) {
      qaOptionsMap.set(
        user.email.toLowerCase(),
        `${user.full_name} (QA)`,
      );
    }
    for (const session of sessions) {
      const email = String(session.reviewer_email || "").trim().toLowerCase();
      if (!email || qaOptionsMap.has(email)) continue;
      qaOptionsMap.set(email, `${email} (QA)`);
    }

    const teacherOptions = Array.from(teacherOptionsMap.entries()).map(([email, label]) => ({
      value: `generator:${email}`,
      label,
    }));
    const qaOptions = Array.from(qaOptionsMap.entries()).map(([email, label]) => ({
      value: `auditor:${email}`,
      label,
    }));

    if (sessionRoleScope === "generator") return teacherOptions;
    if (sessionRoleScope === "auditor") return qaOptions;
    return [...teacherOptions, ...qaOptions];
  }, [qaUsers, sessionRoleScope, sessions, teacherUsers]);

  const effectiveSessionUserScope = useMemo(() => {
    if (sessionUserScope === "all") return "all";
    return scopedUserOptions.some((option) => option.value === sessionUserScope) ? sessionUserScope : "all";
  }, [scopedUserOptions, sessionUserScope]);

  const filteredSessions = useMemo(() => {
    if (effectiveSessionUserScope === "all") return sessions;

    const [scopeRole, email] = effectiveSessionUserScope.split(":");
    if (!email) return sessions;
    const target = email.toLowerCase();
    if (scopeRole === "generator") {
      return sessions.filter((session) => String(session.teacher_email || "").toLowerCase() === target);
    }
    if (scopeRole === "auditor") {
      return sessions.filter((session) => String(session.reviewer_email || "").toLowerCase() === target);
    }
    return sessions;
  }, [effectiveSessionUserScope, sessions]);
  const visibleSessions = useMemo(() => filteredSessions.slice(0, 32), [filteredSessions]);
  const selectedSessionSet = useMemo(() => new Set(selectedSessionIds), [selectedSessionIds]);
  const selectedSessions = useMemo(
    () => filteredSessions.filter((session) => selectedSessionSet.has(session.request_id)),
    [filteredSessions, selectedSessionSet],
  );
  const releasableSelectedIds = useMemo(
    () => selectedSessions.filter((session) => session.status === "in_progress").map((session) => session.request_id),
    [selectedSessions],
  );

  const activeReviewLocks = useMemo(
    () => sessions.filter((session) => session.status === "in_progress"),
    [sessions],
  );

  async function loadAdminData() {
    setLoading(true);
    setError(null);
    try {
      const [usersResponse, dashboardResponse] = await Promise.all([
        fetch("/api/admin/users"),
        fetch("/api/admin/dashboard"),
      ]);

      const usersPayload = await usersResponse.json().catch(() => null);
      const dashboardPayload = await dashboardResponse.json().catch(() => null);

      if (!usersResponse.ok) {
        throw new Error(usersPayload?.error || "Unable to load users.");
      }
      if (!dashboardResponse.ok) {
        throw new Error(dashboardPayload?.error || "Unable to load dashboard analytics.");
      }

      setUsers(Array.isArray(usersPayload?.items) ? usersPayload.items : []);
      setDashboard((dashboardPayload || {}) as DashboardPayload);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load admin data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadAdminData();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function updateRole(userId: string, role: UserItem["role"]) {
    setBusyUserId(userId);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || "Could not update role.");
      }
      setMessage("Role updated.");
      await loadAdminData();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Role update failed.");
    } finally {
      setBusyUserId(null);
    }
  }

  async function toggleBlock(userId: string, shouldBlock: boolean) {
    setBusyUserId(userId);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/block`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_blocked: shouldBlock }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || "Could not update account status.");
      }
      setMessage(shouldBlock ? "User blocked." : "User unblocked.");
      await loadAdminData();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Block/unblock action failed.");
    } finally {
      setBusyUserId(null);
    }
  }

  async function triggerResetPassword(userId: string) {
    setBusyUserId(userId);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/reset-password`, {
        method: "POST",
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || "Could not trigger password reset.");
      }
      setMessage("Password reset email triggered.");
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Password reset trigger failed.");
    } finally {
      setBusyUserId(null);
    }
  }

  async function deleteUser(userId: string) {
    setBusyUserId(userId);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(userId)}`, {
        method: "DELETE",
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || "Could not delete user.");
      }
      setMessage("User deleted.");
      await loadAdminData();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Delete action failed.");
    } finally {
      setBusyUserId(null);
    }
  }

  async function releaseLock(requestId: string) {
    setBusySessionId(requestId);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch(`/api/review/submissions/${encodeURIComponent(requestId)}/release`, {
        method: "POST",
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || "Could not release review lock.");
      }
      setMessage("Review lock released.");
      await loadAdminData();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Lock release failed.");
    } finally {
      setBusySessionId(null);
    }
  }

  async function deleteSession(requestId: string) {
    setBusySessionId(requestId);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch(`/api/admin/sessions/${encodeURIComponent(requestId)}`, {
        method: "DELETE",
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || "Could not delete session.");
      }
      setMessage("Session deleted.");
      await loadAdminData();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Session delete failed.");
    } finally {
      setBusySessionId(null);
    }
  }

  async function runBulkRelease() {
    if (releasableSelectedIds.length === 0) return;
    setBulkBusyAction("release");
    setMessage(null);
    setError(null);
    try {
      let success = 0;
      let failed = 0;
      for (const requestId of releasableSelectedIds) {
        const response = await fetch(`/api/review/submissions/${encodeURIComponent(requestId)}/release`, {
          method: "POST",
        }).catch(() => null);
        if (response?.ok) {
          success += 1;
        } else {
          failed += 1;
        }
      }
      if (failed > 0) {
        setError(`Released ${success} lock(s), ${failed} failed.`);
      } else {
        setMessage(`Released ${success} review lock(s).`);
      }
      setSelectedSessionIds((current) => current.filter((id) => !releasableSelectedIds.includes(id)));
      await loadAdminData();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Bulk lock release failed.");
    } finally {
      setBulkBusyAction(null);
    }
  }

  async function runBulkDelete() {
    const requestIds = selectedSessions.map((session) => session.request_id);
    if (requestIds.length === 0) return;
    setBulkBusyAction("delete");
    setMessage(null);
    setError(null);
    try {
      let success = 0;
      let failed = 0;
      for (const requestId of requestIds) {
        const response = await fetch(`/api/admin/sessions/${encodeURIComponent(requestId)}`, {
          method: "DELETE",
        }).catch(() => null);
        if (response?.ok) {
          success += 1;
        } else {
          failed += 1;
        }
      }
      if (failed > 0) {
        setError(`Deleted ${success} session(s), ${failed} failed.`);
      } else {
        setMessage(`Deleted ${success} session(s).`);
      }
      setSelectedSessionIds((current) => current.filter((id) => !requestIds.includes(id)));
      await loadAdminData();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Bulk session delete failed.");
    } finally {
      setBulkBusyAction(null);
    }
  }

  function toggleSessionSelection(requestId: string) {
    setSelectedSessionIds((current) =>
      current.includes(requestId) ? current.filter((id) => id !== requestId) : [...current, requestId],
    );
  }

  function selectVisibleSessions() {
    setSelectedSessionIds((current) => {
      const merged = new Set(current);
      for (const session of visibleSessions) {
        merged.add(session.request_id);
      }
      return Array.from(merged);
    });
  }

  function clearSessionSelection() {
    setSelectedSessionIds([]);
  }

  async function runReprocess() {
    setReprocessBusy(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch("/api/admin/reprocess/abet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          limit: Math.max(1, Math.min(500, Math.round(reprocessLimit))),
          dry_run: reprocessDryRun,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || "Could not run ABET reprocessing.");
      }
      setReprocessResult((payload || {}) as ReprocessResult);
      setMessage(reprocessDryRun ? "Dry-run completed." : "ABET reprocessing completed.");
      await loadAdminData();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "ABET reprocess failed.");
    } finally {
      setReprocessBusy(false);
    }
  }

  const signups = dashboard?.kpis?.user_activity?.signups_by_day_30d || [];
  const compactSignups = signups.slice(-10);
  const maxSignupCount = compactSignups.reduce((maxValue, point) => Math.max(maxValue, safeNumber(point.count)), 1);
  const failurePoints = (dashboard?.quality?.common_failure_points || []).slice(0, 8);
  const maxFailureCount = failurePoints.reduce((maxValue, point) => Math.max(maxValue, safeNumber(point.count)), 1);
  const providers = dashboard?.ai_observability?.provider_traffic || [];
  const avgGenerationRuntimeMs = safeNumber(dashboard?.ai_observability?.avg_runtime_ms?.generation_flow);
  const avgAuditRuntimeMs = safeNumber(dashboard?.ai_observability?.avg_runtime_ms?.audit_flow);
  const generationRuntimeSamples = safeNumber(dashboard?.ai_observability?.avg_runtime_ms?.generation_samples);
  const auditRuntimeSamples = safeNumber(dashboard?.ai_observability?.avg_runtime_ms?.audit_samples);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(255,239,189,0.4),_transparent_20%),radial-gradient(circle_at_top_right,_rgba(200,247,238,0.46),_transparent_22%),linear-gradient(180deg,_#fbfaf7_0%,_#f5f3ec_100%)] px-4 py-6">
      <div className="mx-auto max-w-[1500px] space-y-4">
        <header className="rounded-[1.6rem] border border-white/70 bg-white/90 p-4 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-700">{t("admin.kicker")}</p>
              <h1 className="font-heading mt-1 text-3xl font-semibold text-stone-950">{t("admin.title")}</h1>
              <p className="mt-2 text-sm text-stone-600">
                {t("admin.last_update", { time: dashboard?.generated_at ? formatDateTime(dashboard.generated_at) : "N/A" })}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void loadAdminData()}
                className="rounded-full border border-[#d9dee8] bg-white px-4 py-2 text-sm font-bold text-[#091225] shadow-[0_4px_12px_rgba(15,23,42,0.08)] transition-transform hover:border-[#c6cdd9] active:scale-[0.98]"
              >
                {t("admin.refresh")}
              </button>
              <Link
                href="/admin/support"
                className="rounded-xl border border-teal-300 bg-teal-50 px-4 py-2 text-sm font-semibold text-teal-800 hover:bg-teal-100"
              >
                {t("admin.support_inbox")}
              </Link>
            </div>
          </div>
        </header>

        {loading ? (
          <SkeletonGrid cards={6} />
        ) : null}

        {message ? (
          <div className="rounded-2xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-900">{message}</div>
        ) : null}

        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>
        ) : null}

        <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <article className="rounded-2xl border border-cyan-200 bg-gradient-to-br from-cyan-50 to-white p-3 shadow-[0_14px_32px_rgba(8,145,178,0.15)]">
            <div className="text-xs uppercase tracking-[0.16em] text-stone-500">Active Teachers (30d)</div>
            <div className="mt-1 text-2xl font-semibold text-stone-950">
              {numberFmt.format(safeNumber(dashboard?.kpis?.user_activity?.active_teachers_30d))}
            </div>
          </article>
          <article className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-white p-3 shadow-[0_14px_32px_rgba(139,92,246,0.14)]">
            <div className="text-xs uppercase tracking-[0.16em] text-stone-500">Active QAs (30d)</div>
            <div className="mt-1 text-2xl font-semibold text-stone-950">
              {numberFmt.format(safeNumber(dashboard?.kpis?.user_activity?.active_qas_30d))}
            </div>
          </article>
          <article className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-3 shadow-[0_14px_32px_rgba(5,150,105,0.14)]">
            <div className="text-xs uppercase tracking-[0.16em] text-stone-500">First-Pass Approval</div>
            <div className="mt-1 text-2xl font-semibold text-stone-950">
              {safeNumber(dashboard?.quality?.approval?.first_pass_approval_rate_pct).toFixed(1)}%
            </div>
          </article>
          <article className="rounded-2xl border border-fuchsia-200 bg-gradient-to-br from-fuchsia-50 to-white p-3 shadow-[0_14px_32px_rgba(192,38,211,0.13)]">
            <div className="text-xs uppercase tracking-[0.16em] text-stone-500">Avg LLM Runtime (Generator)</div>
            <div className="mt-1 text-2xl font-semibold text-stone-950">{formatMilliseconds(avgGenerationRuntimeMs)}</div>
            <div className="text-[11px] text-stone-500">Samples: {numberFmt.format(generationRuntimeSamples)}</div>
          </article>
          <article className="rounded-2xl border border-orange-200 bg-gradient-to-br from-orange-50 to-white p-3 shadow-[0_14px_32px_rgba(249,115,22,0.14)]">
            <div className="text-xs uppercase tracking-[0.16em] text-stone-500">Avg LLM Runtime (Audit)</div>
            <div className="mt-1 text-2xl font-semibold text-stone-950">{formatMilliseconds(avgAuditRuntimeMs)}</div>
            <div className="text-[11px] text-stone-500">Samples: {numberFmt.format(auditRuntimeSamples)}</div>
          </article>
          <article className="rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-white p-3 shadow-[0_14px_32px_rgba(59,130,246,0.14)]">
            <div className="text-xs uppercase tracking-[0.16em] text-stone-500">Token Cost (Est.)</div>
            <div className="mt-1 text-2xl font-semibold text-stone-950">
              {moneyFmt.format(safeNumber(dashboard?.ai_observability?.tokens_and_cost?.totals?.estimated_cost_usd))}
            </div>
          </article>
        </section>

        <section className="rounded-[1.5rem] border border-white/70 bg-white/92 p-4 shadow-[0_16px_42px_rgba(15,23,42,0.08)]">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="font-heading text-lg font-semibold text-stone-950">Business & Usage KPIs</div>
              <p className="text-sm text-stone-500">Adoption, submission throughput, and feature-entry behavior.</p>
            </div>
            <div className="text-xs text-stone-500">
              7d signups: <strong>{numberFmt.format(safeNumber(dashboard?.kpis?.user_activity?.signups_7d))}</strong>
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
              <div className="text-sm font-semibold text-stone-900">Sign-ups Trend (Last 10 of 30 days)</div>
              <div className="mt-3 grid gap-1">
                {compactSignups.length === 0 ? (
                  <div className="text-xs text-stone-500">No signup data yet.</div>
                ) : (
                  compactSignups.map((point) => {
                    const widthPct = Math.max(4, (safeNumber(point.count) / maxSignupCount) * 100);
                    return (
                      <div key={point.date} className="flex items-center gap-2">
                        <div className="w-24 shrink-0 text-[11px] text-stone-500">
                          {new Date(point.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                        </div>
                        <div className="h-2.5 flex-1 rounded-full bg-stone-200">
                          <div className="h-2.5 rounded-full bg-teal-500" style={{ width: `${widthPct}%` }} />
                        </div>
                        <div className="w-8 text-right text-[11px] font-semibold text-stone-700">{point.count}</div>
                      </div>
                    );
                  })
                )}
              </div>
            </article>
            <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
              <div className="text-sm font-semibold text-stone-900">Throughput & Entry Paths</div>
              <div className="mt-3 grid gap-2 text-sm text-stone-700">
                <div>Drafted: <strong>{numberFmt.format(safeNumber(dashboard?.kpis?.syllabus_throughput?.drafted))}</strong></div>
                <div>Submitted: <strong>{numberFmt.format(safeNumber(dashboard?.kpis?.syllabus_throughput?.submitted))}</strong></div>
                <div>In Progress: <strong>{numberFmt.format(safeNumber(dashboard?.kpis?.syllabus_throughput?.in_progress))}</strong></div>
                <div>Approved: <strong>{numberFmt.format(safeNumber(dashboard?.kpis?.syllabus_throughput?.approved))}</strong></div>
                <div>Needs Revision: <strong>{numberFmt.format(safeNumber(dashboard?.kpis?.syllabus_throughput?.needs_revision))}</strong></div>
                <div>Rejected: <strong>{numberFmt.format(safeNumber(dashboard?.kpis?.syllabus_throughput?.rejected))}</strong></div>
                <div>Avg Queue Time: <strong>{formatHours(dashboard?.kpis?.syllabus_throughput?.avg_review_queue_hours)}</strong></div>
                <div>Avg Lock Hold: <strong>{formatHours(dashboard?.kpis?.syllabus_throughput?.avg_review_lock_hours)}</strong></div>
                <div>Upload Source: <strong>{numberFmt.format(safeNumber(dashboard?.kpis?.feature_adoption?.source_entry_upload))}</strong></div>
                <div>Manual Entry: <strong>{numberFmt.format(safeNumber(dashboard?.kpis?.feature_adoption?.source_entry_manual))}</strong></div>
              </div>
            </article>
          </div>
        </section>

        <section className="rounded-[1.5rem] border border-white/70 bg-white/92 p-4 shadow-[0_16px_42px_rgba(15,23,42,0.08)]">
          <div className="mb-4">
            <div className="font-heading text-lg font-semibold text-stone-950">Output Quality & ABET Compliance</div>
            <p className="text-sm text-stone-500">Deterministic quality signals and high-frequency ABET failure buckets.</p>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
              <div className="text-sm font-semibold text-stone-900">Feedback Loop Signals</div>
              <div className="mt-3 grid gap-2 text-sm text-stone-700">
                <div>Avg Char Levenshtein: <strong>{safeNumber(dashboard?.quality?.feedback_loop?.avg_char_levenshtein_distance).toFixed(2)}</strong></div>
                <div>Avg Line Levenshtein: <strong>{safeNumber(dashboard?.quality?.feedback_loop?.avg_line_levenshtein_distance).toFixed(2)}</strong></div>
                <div>Regenerate Calls: <strong>{numberFmt.format(safeNumber(dashboard?.quality?.feedback_loop?.regenerate_field_calls))}</strong></div>
                <div>
                  First-pass reviewed submissions:{" "}
                  <strong>{numberFmt.format(safeNumber(dashboard?.quality?.approval?.first_pass_total))}</strong>
                </div>
              </div>
            </article>
            <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
              <div className="text-sm font-semibold text-stone-900">Common ABET Failure Points (Pareto)</div>
              <div className="mt-3 grid gap-2">
                {failurePoints.length === 0 ? (
                  <div className="text-xs text-stone-500">No deterministic findings yet.</div>
                ) : (
                  failurePoints.map((point) => {
                    const widthPct = Math.max(6, (safeNumber(point.count) / maxFailureCount) * 100);
                    return (
                      <div key={point.label} className="space-y-1">
                        <div className="flex items-center justify-between text-[11px] text-stone-600">
                          <span className="truncate pr-2">{point.label}</span>
                          <span>{point.count} ({safeNumber(point.share_pct).toFixed(1)}%)</span>
                        </div>
                        <div className="h-2 rounded-full bg-stone-200">
                          <div className="h-2 rounded-full bg-orange-500" style={{ width: `${widthPct}%` }} />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </article>
          </div>
        </section>

        <section className="rounded-[1.5rem] border border-white/70 bg-white/92 p-4 shadow-[0_16px_42px_rgba(15,23,42,0.08)]">
          <div className="mb-4">
            <div className="font-heading text-lg font-semibold text-stone-950">AI & LLM Observability</div>
            <p className="text-sm text-stone-500">Provider split, fallback behavior, endpoint success, and estimated cost.</p>
          </div>
          <div className="grid gap-4 xl:grid-cols-3">
            <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4 xl:col-span-2">
              <div className="text-sm font-semibold text-stone-900">Provider Traffic</div>
              <div className="mt-3 grid gap-2">
                {providers.length === 0 ? (
                  <div className="text-xs text-stone-500">No provider telemetry yet.</div>
                ) : (
                  providers.map((provider) => (
                    <div key={provider.provider} className="space-y-1">
                      <div className="flex items-center justify-between text-xs text-stone-600">
                        <span>{provider.provider}</span>
                        <span>{provider.count} ({safeNumber(provider.share_pct).toFixed(1)}%)</span>
                      </div>
                      <div className="h-2 rounded-full bg-stone-200">
                        <div className="h-2 rounded-full bg-sky-500" style={{ width: `${Math.max(6, safeNumber(provider.share_pct))}%` }} />
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="mt-4 text-xs text-stone-600">
                Fallbacks: <strong>{numberFmt.format(safeNumber(dashboard?.ai_observability?.fallbacks?.count))}</strong>{" "}
                ({safeNumber(dashboard?.ai_observability?.fallbacks?.share_pct).toFixed(1)}%)
              </div>
            </article>
            <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
              <div className="text-sm font-semibold text-stone-900">Tokens & Cost (Est.)</div>
              <div className="mt-3 grid gap-2 text-xs text-stone-700">
                <div>Prompt tokens: <strong>{numberFmt.format(safeNumber(dashboard?.ai_observability?.tokens_and_cost?.totals?.prompt_tokens_est))}</strong></div>
                <div>Completion tokens: <strong>{numberFmt.format(safeNumber(dashboard?.ai_observability?.tokens_and_cost?.totals?.completion_tokens_est))}</strong></div>
                <div>Total tokens: <strong>{numberFmt.format(safeNumber(dashboard?.ai_observability?.tokens_and_cost?.totals?.total_tokens_est))}</strong></div>
                <div>Estimated cost: <strong>{moneyFmt.format(safeNumber(dashboard?.ai_observability?.tokens_and_cost?.totals?.estimated_cost_usd))}</strong></div>
                <div>Avg runtime (Generator): <strong>{formatMilliseconds(avgGenerationRuntimeMs)}</strong></div>
                <div>Avg runtime (Audit): <strong>{formatMilliseconds(avgAuditRuntimeMs)}</strong></div>
                <div>Preflight blocked: <strong>{numberFmt.format(safeNumber(dashboard?.ai_observability?.preflight?.blocked_total))}</strong></div>
              </div>
            </article>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {Object.entries(dashboard?.ai_observability?.endpoint_success || {}).map(([endpoint, stats]) => {
              const total = safeNumber(stats.total);
              const success = safeNumber(stats.success);
              const rate = total > 0 ? (success / total) * 100 : 0;
              return (
                <article key={endpoint} className="rounded-xl border border-stone-200 bg-stone-50 p-3">
                  <div className="text-xs uppercase tracking-[0.14em] text-stone-500">{endpoint.replace("_", " ")}</div>
                  <div className="mt-1 text-xl font-semibold text-stone-900">{rate.toFixed(1)}%</div>
                  <div className="text-[11px] text-stone-600">
                    {success}/{total} successful
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="rounded-[1.5rem] border border-white/70 bg-white/92 p-4 shadow-[0_16px_42px_rgba(15,23,42,0.08)]">
          <div className="mb-4">
            <div className="font-heading text-lg font-semibold text-stone-950">System Health & Infrastructure</div>
            <p className="text-sm text-stone-500">Persistence seam, backend health, uptime, and email delivery status.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <article className="rounded-xl border border-stone-200 bg-stone-50 p-3">
              <div className="text-xs uppercase tracking-[0.14em] text-stone-500">Backend Health</div>
              <div className="mt-1 text-lg font-semibold text-stone-900">{dashboard?.system_health?.health?.status || "unknown"}</div>
            </article>
            <article className="rounded-xl border border-stone-200 bg-stone-50 p-3">
              <div className="text-xs uppercase tracking-[0.14em] text-stone-500">Primary DB</div>
              <div className="mt-1 text-lg font-semibold text-stone-900">
                {dashboard?.system_health?.storage?.database?.enabled ? "Enabled" : "Disabled"}
              </div>
            </article>
            <article className="rounded-xl border border-stone-200 bg-stone-50 p-3">
              <div className="text-xs uppercase tracking-[0.14em] text-stone-500">Supabase REST</div>
              <div className="mt-1 text-lg font-semibold text-stone-900">
                {dashboard?.system_health?.storage?.supabase_rest?.configured ? "Configured" : "Not configured"}
              </div>
            </article>
            <article className="rounded-xl border border-stone-200 bg-stone-50 p-3">
              <div className="text-xs uppercase tracking-[0.14em] text-stone-500">Uptime</div>
              <div className="mt-1 text-lg font-semibold text-stone-900">{formatDuration(dashboard?.system_health?.backend_uptime_seconds)}</div>
            </article>
          </div>
          <div className="mt-4 rounded-xl border border-stone-200 bg-stone-50 p-3 text-sm text-stone-700">
            Email delivery:{" "}
            <strong>{numberFmt.format(safeNumber(dashboard?.system_health?.email_delivery?.success))} success</strong>,{" "}
            <strong>{numberFmt.format(safeNumber(dashboard?.system_health?.email_delivery?.failed))} failed</strong>,{" "}
            <strong>{numberFmt.format(safeNumber(dashboard?.system_health?.email_delivery?.skipped))} skipped</strong>.
          </div>
        </section>

        <section className="rounded-[1.5rem] border border-white/70 bg-white/92 p-4 shadow-[0_16px_42px_rgba(15,23,42,0.08)]">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-heading text-lg font-semibold text-stone-950">Operational Controls</div>
              <p className="text-sm text-stone-500">Queue intervention and deterministic ABET data reprocessing.</p>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
              <div className="text-sm font-semibold text-stone-900">Deterministic ABET Reprocessing</div>
              <div className="mt-3 flex flex-wrap items-end gap-3">
                <label className="text-xs text-stone-600">
                  Limit
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={reprocessLimit}
                    onChange={(event) => setReprocessLimit(Number(event.target.value) || 50)}
                    className="mt-1 block w-28 rounded-lg border border-stone-300 bg-white px-2 py-1 text-sm"
                  />
                </label>
                <label className="flex items-center gap-2 text-xs text-stone-700">
                  <input
                    type="checkbox"
                    checked={reprocessDryRun}
                    onChange={(event) => setReprocessDryRun(event.target.checked)}
                  />
                  Dry-run only
                </label>
                <button
                  type="button"
                  onClick={() => void runReprocess()}
                  disabled={reprocessBusy}
                  className="rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-60"
                >
                  {reprocessBusy ? "Running..." : "Run Reprocess"}
                </button>
              </div>
              {reprocessResult ? (
                <div className="mt-3 rounded-lg border border-stone-200 bg-white p-3 text-xs text-stone-700">
                  <div>Processed: <strong>{numberFmt.format(safeNumber(reprocessResult.processed))}</strong></div>
                  <div>Persisted: <strong>{numberFmt.format(safeNumber(reprocessResult.persisted))}</strong></div>
                  <div>Missing source: <strong>{numberFmt.format(safeNumber(reprocessResult.skipped_missing_source))}</strong></div>
                  <div>Elapsed: <strong>{safeNumber(reprocessResult.elapsed_ms)} ms</strong></div>
                </div>
              ) : null}
            </article>

            <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
              <div className="text-sm font-semibold text-stone-900">Review Queue Locks</div>
              <div className="mt-3 grid gap-2">
                {activeReviewLocks.length === 0 ? (
                  <div className="text-xs text-stone-500">No active review locks.</div>
                ) : (
                  activeReviewLocks.slice(0, 8).map((item) => (
                      <div key={item.request_id} className="rounded-lg border border-stone-200 bg-white p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-xs font-semibold text-stone-900">{item.course_title || "Untitled syllabus"}</div>
                          <button
                            type="button"
                            disabled={busySessionId === item.request_id}
                            onClick={() => void releaseLock(item.request_id)}
                            className="rounded-md border border-fuchsia-300 bg-fuchsia-50 px-2 py-1 text-[11px] font-semibold text-fuchsia-700 hover:bg-fuchsia-100 disabled:opacity-60"
                          >
                            Force release
                          </button>
                        </div>
                        <div className="mt-1 text-[11px] text-stone-500">
                          Reviewer: {item.reviewer_email || "N/A"} | Lock expires: {formatDateTime(item.review_lock_expires_at)}
                        </div>
                      </div>
                    ))
                )}
              </div>
            </article>
          </div>
        </section>

        <section className="rounded-[1.5rem] border border-white/70 bg-white/92 p-4 shadow-[0_16px_42px_rgba(15,23,42,0.08)]">
          <div className="mb-4">
            <div className="font-heading text-lg font-semibold text-stone-950">User Management</div>
            <p className="text-sm text-stone-500">Assign roles, block/unblock accounts, trigger reset emails, and remove users.</p>
          </div>
          <div className="hidden max-h-[420px] overflow-x-auto overflow-y-auto md:block">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="border-b border-stone-200 text-xs uppercase text-stone-500">
                <tr>
                  <th className="py-2 pr-3">Name</th>
                  <th className="py-2 pr-3">Email</th>
                  <th className="py-2 pr-3">Role</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Created</th>
                  <th className="py-2 pr-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-stone-100">
                    <td className="py-3 pr-3 font-medium text-stone-950">{user.full_name}</td>
                    <td className="py-3 pr-3 text-stone-600">{user.email}</td>
                    <td className="py-3 pr-3">
                      <select
                        className="rounded-lg border border-stone-300 bg-white px-2 py-1 text-sm"
                        value={user.role}
                        onChange={(event) => void updateRole(user.id, event.target.value as UserItem["role"])}
                        disabled={busyUserId === user.id}
                      >
                        <option value="generator">Teacher</option>
                        <option value="auditor">QA</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td className="py-3 pr-3 text-stone-600">
                      {user.is_blocked ? (
                        <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700">
                          Blocked
                        </span>
                      ) : (
                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                          Active
                        </span>
                      )}
                    </td>
                    <td className="py-3 pr-3 text-stone-500">{formatDateTime(user.created_at)}</td>
                    <td className="py-3 pr-3">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => void triggerResetPassword(user.id)}
                          disabled={busyUserId === user.id}
                          className="rounded-lg border border-sky-300 bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700 hover:bg-sky-100 disabled:opacity-60"
                        >
                          Reset password
                        </button>
                        {user.role === "admin" ? (
                          <span className="rounded-lg border border-stone-200 bg-white px-2.5 py-1 text-xs font-semibold text-stone-400">
                            Protected
                          </span>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => void toggleBlock(user.id, !user.is_blocked)}
                              disabled={busyUserId === user.id}
                              className="rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-60"
                            >
                              {user.is_blocked ? "Unblock" : "Block"}
                            </button>
                            <button
                              type="button"
                              onClick={() => setPendingDeleteUser(user)}
                              disabled={busyUserId === user.id}
                              className="rounded-lg border border-rose-300 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid max-h-[520px] gap-3 overflow-y-auto pr-1 md:hidden">
            {users.map((user) => (
              <article key={user.id} className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold text-stone-950">{user.full_name}</div>
                    <div className="mt-1 break-all text-sm text-stone-600">{user.email}</div>
                  </div>
                  <div className="rounded-full border border-stone-200 bg-white px-2 py-1 text-[11px] font-semibold text-stone-700">
                    {roleLabel(user.role)}
                  </div>
                </div>
                <div className="mt-2 text-xs text-stone-500">
                  {user.is_blocked ? "Blocked" : "Active"} | Created {formatDateTime(user.created_at)}
                </div>
                <div className="mt-3 grid gap-2">
                  <select
                    className="rounded-lg border border-stone-300 bg-white px-2 py-1 text-sm"
                    value={user.role}
                    onChange={(event) => void updateRole(user.id, event.target.value as UserItem["role"])}
                    disabled={busyUserId === user.id}
                  >
                    <option value="generator">Teacher</option>
                    <option value="auditor">QA</option>
                    <option value="admin">Admin</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => void triggerResetPassword(user.id)}
                    disabled={busyUserId === user.id}
                    className="rounded-lg border border-sky-300 bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700 hover:bg-sky-100 disabled:opacity-60"
                  >
                    Reset password
                  </button>
                  {user.role !== "admin" ? (
                    <>
                      <button
                        type="button"
                        onClick={() => void toggleBlock(user.id, !user.is_blocked)}
                        disabled={busyUserId === user.id}
                        className="rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-60"
                      >
                        {user.is_blocked ? "Unblock" : "Block"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingDeleteUser(user)}
                        disabled={busyUserId === user.id}
                        className="rounded-lg border border-rose-300 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                      >
                        Delete
                      </button>
                    </>
                  ) : (
                    <div className="rounded-lg border border-stone-200 bg-white px-2.5 py-1 text-center text-xs font-semibold text-stone-400">
                      Protected admin
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-[1.5rem] border border-white/70 bg-white/92 p-4 shadow-[0_16px_42px_rgba(15,23,42,0.08)]">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="font-heading text-lg font-semibold text-stone-950">Session History</div>
              <p className="text-sm text-stone-500">Filter by a specific teacher or QA instead of scanning every session.</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="text-xs text-stone-600">
                Role scope
                <select
                  value={sessionRoleScope}
                  onChange={(event) => {
                    const next = event.target.value as "all" | "generator" | "auditor";
                    setSessionRoleScope(next);
                    setSessionUserScope("all");
                  }}
                  className="mt-1 block w-44 rounded-lg border border-stone-300 bg-white px-2 py-1 text-sm"
                >
                  <option value="all">All roles</option>
                  <option value="generator">Teacher</option>
                  <option value="auditor">QA</option>
                </select>
              </label>
              <label className="text-xs text-stone-600">
                Specific user
                <select
                  value={effectiveSessionUserScope}
                  onChange={(event) => setSessionUserScope(event.target.value)}
                  className="mt-1 block w-56 rounded-lg border border-stone-300 bg-white px-2 py-1 text-sm"
                >
                  <option value="all">All users</option>
                  {scopedUserOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
          <div className="mb-3 text-xs text-stone-500">
            Showing <strong>{numberFmt.format(filteredSessions.length)}</strong> session(s).
          </div>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={selectVisibleSessions}
              disabled={visibleSessions.length === 0 || Boolean(bulkBusyAction)}
              className="rounded-lg border border-stone-300 bg-white px-2.5 py-1 text-xs font-semibold text-stone-700 hover:bg-stone-100 disabled:opacity-60"
            >
              Select visible
            </button>
            <button
              type="button"
              onClick={clearSessionSelection}
              disabled={selectedSessionIds.length === 0 || Boolean(bulkBusyAction)}
              className="rounded-lg border border-stone-300 bg-white px-2.5 py-1 text-xs font-semibold text-stone-700 hover:bg-stone-100 disabled:opacity-60"
            >
              Clear selection
            </button>
            <button
              type="button"
              onClick={() => setConfirmBulkReleaseOpen(true)}
              disabled={releasableSelectedIds.length === 0 || Boolean(bulkBusyAction)}
              className="rounded-lg border border-fuchsia-300 bg-fuchsia-50 px-2.5 py-1 text-xs font-semibold text-fuchsia-700 hover:bg-fuchsia-100 disabled:opacity-60"
            >
              {bulkBusyAction === "release"
                ? "Releasing..."
                : `Release selected locks (${numberFmt.format(releasableSelectedIds.length)})`}
            </button>
            <button
              type="button"
              onClick={() => setConfirmBulkDeleteOpen(true)}
              disabled={selectedSessions.length === 0 || Boolean(bulkBusyAction)}
              className="rounded-lg border border-rose-300 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
            >
              {bulkBusyAction === "delete"
                ? "Deleting..."
                : `Delete selected (${numberFmt.format(selectedSessions.length)})`}
            </button>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {filteredSessions.length === 0 ? (
              <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4 text-sm text-stone-500">
                No sessions match this filter.
              </div>
            ) : (
              visibleSessions.map((session) => (
                <article key={session.request_id} className="rounded-2xl border border-stone-200 bg-stone-50 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="font-semibold text-stone-950">{session.course_title || "Untitled syllabus"}</div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedSessionSet.has(session.request_id)}
                        onChange={() => toggleSessionSelection(session.request_id)}
                        className="h-4 w-4 rounded border-stone-300 text-teal-600 focus:ring-teal-500"
                        aria-label={`Select session ${session.request_id}`}
                      />
                      <div className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusTone(session.status)}`}>
                        {session.status.replaceAll("_", " ")}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 space-y-1 text-xs leading-5 text-stone-600">
                    <div>Teacher: {session.teacher_email || "N/A"}</div>
                    <div>QA: {session.reviewer_email || "N/A"}</div>
                    <div>Submitted: {formatDateTime(session.submitted_at)}</div>
                    <div>Reviewed: {formatDateTime(session.reviewed_at)}</div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {session.status === "in_progress" ? (
                      <button
                        type="button"
                        disabled={busySessionId === session.request_id}
                        onClick={() => void releaseLock(session.request_id)}
                        className="rounded-lg border border-fuchsia-300 bg-fuchsia-50 px-2.5 py-1 text-xs font-semibold text-fuchsia-700 hover:bg-fuchsia-100 disabled:opacity-60"
                      >
                        Release lock
                      </button>
                    ) : null}
                    <button
                      type="button"
                      disabled={busySessionId === session.request_id}
                      onClick={() => setPendingDeleteSession(session)}
                      className="rounded-lg border border-rose-300 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                    >
                      Delete session
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </div>

      <ConfirmDialog
        open={Boolean(pendingDeleteUser)}
        title="Delete user?"
        description={`Delete account "${pendingDeleteUser?.full_name || ""}"? This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel={t("common.back")}
        variant="danger"
        onConfirm={() => {
          const user = pendingDeleteUser;
          setPendingDeleteUser(null);
          if (user) {
            void deleteUser(user.id);
          }
        }}
        onCancel={() => setPendingDeleteUser(null)}
      />

      <ConfirmDialog
        open={Boolean(pendingDeleteSession)}
        title="Delete session?"
        description={`Delete session "${pendingDeleteSession?.request_id || ""}" and related feedback records?`}
        confirmLabel="Delete"
        cancelLabel={t("common.back")}
        variant="danger"
        onConfirm={() => {
          const session = pendingDeleteSession;
          setPendingDeleteSession(null);
          if (session) {
            void deleteSession(session.request_id);
          }
        }}
        onCancel={() => setPendingDeleteSession(null)}
      />

      <ConfirmDialog
        open={confirmBulkReleaseOpen}
        title="Release selected locks?"
        description={`Release ${releasableSelectedIds.length} selected in-progress lock(s)?`}
        confirmLabel="Release"
        cancelLabel={t("common.back")}
        onConfirm={() => {
          setConfirmBulkReleaseOpen(false);
          void runBulkRelease();
        }}
        onCancel={() => setConfirmBulkReleaseOpen(false)}
      />

      <ConfirmDialog
        open={confirmBulkDeleteOpen}
        title="Delete selected sessions?"
        description={`Delete ${selectedSessions.length} selected session(s) and related feedback records?`}
        confirmLabel="Delete"
        cancelLabel={t("common.back")}
        variant="danger"
        onConfirm={() => {
          setConfirmBulkDeleteOpen(false);
          void runBulkDelete();
        }}
        onCancel={() => setConfirmBulkDeleteOpen(false)}
      />
    </main>
  );
}
