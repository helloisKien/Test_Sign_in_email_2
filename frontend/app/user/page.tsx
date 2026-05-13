"use client";

import { useEffect, useState } from "react";
import { getPublicApiBase } from "@/lib/backend-api";
import { invalidateAuthMeCache, useAuthMe } from "@/lib/client-auth";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { showToast } from "@/components/ui/Toast";
import { SkeletonCard } from "@/components/ui/Skeleton";

type UserPayload = {
  fullName: string;
  email: string;
  role: string;
  employeeId?: string;
  phoneNumber?: string;
  department?: string;
  teachingSubject?: string;
  avatarUrl?: string | null;
};

type ProfileForm = {
  employeeId: string;
  phoneNumber: string;
  department: string;
  teachingSubject: string;
};

type TeacherStats = {
  generated: number;
  submitted: number;
  approved: number;
  needs_revision: number;
  rejected: number;
};

const emptyForm: ProfileForm = {
  employeeId: "",
  phoneNumber: "",
  department: "",
  teachingSubject: "",
};

export default function UserPage() {
  const apiBase = getPublicApiBase();
  const { user: authUser, refresh } = useAuthMe();
  const { t } = useI18n();
  const [user, setUser] = useState<UserPayload | null>(null);
  const [form, setForm] = useState<ProfileForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [stats, setStats] = useState<TeacherStats | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void (async () => {
        try {
          const payload = authUser || (await refresh());
          setUser(payload);
          setForm({
            employeeId: payload?.employeeId || "",
            phoneNumber: payload?.phoneNumber || "",
            department: payload?.department || "",
            teachingSubject: payload?.teachingSubject || "",
          });
        } catch {
          setUser(null);
        } finally {
          setLoading(false);
        }
      })();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [authUser, refresh]);

  // Fetch teacher analytics
  useEffect(() => {
    if (!user?.email) return;
    void (async () => {
      try {
        const res = await fetch(`${apiBase}/api/review/submissions?teacher_email=${encodeURIComponent(user.email)}&limit=500`);
        if (!res.ok) return;
        const data = await res.json().catch(() => null);
        const items = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : []);
        const counters: TeacherStats = { generated: items.length, submitted: 0, approved: 0, needs_revision: 0, rejected: 0 };
        for (const item of items) {
          const status = String(item.status || "").toLowerCase();
          if (status === "submitted") counters.submitted++;
          else if (status === "approve") counters.approved++;
          else if (status === "needs_revision") counters.needs_revision++;
          else if (status === "reject") counters.rejected++;
        }
        setStats(counters);
      } catch {
        /* Analytics are best-effort */
      }
    })();
  }, [apiBase, user?.email]);

  async function saveProfile() {
    setSaving(true);
    try {
      const response = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employee_id: form.employeeId.trim() || null,
          phone_number: form.phoneNumber.trim() || null,
          department: form.department.trim() || null,
          teaching_subject: user?.role === "Teacher" ? form.teachingSubject.trim() || null : null,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        showToast(payload?.error || t("user.err_profile"), "error");
        return;
      }
      setUser(payload);
      setForm({
        employeeId: payload?.employeeId || "",
        phoneNumber: payload?.phoneNumber || "",
        department: payload?.department || "",
        teachingSubject: payload?.teachingSubject || "",
      });
      invalidateAuthMeCache();
      await refresh();
      showToast(t("user.ok_profile"), "success");
    } catch {
      showToast(t("user.err_net_profile"), "error");
    } finally {
      setSaving(false);
    }
  }

  async function uploadAvatar(file: File) {
    const formData = new FormData();
    formData.append("avatar", file);
    setUploadingAvatar(true);
    try {
      const response = await fetch("/api/users/me/avatar", {
        method: "POST",
        body: formData,
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        showToast(payload?.error || t("user.err_avatar"), "error");
        return;
      }
      setUser(payload);
      invalidateAuthMeCache();
      await refresh();
      showToast(t("user.ok_avatar"), "success");
    } catch {
      showToast(t("user.err_net_avatar"), "error");
    } finally {
      setUploadingAvatar(false);
    }
  }

  const statItems: { label: string; value: number; color: string }[] = stats
    ? [
        { label: t("user.analytics_generated"), value: stats.generated, color: "border-sky-200 bg-sky-50 text-sky-800" },
        { label: t("user.analytics_submitted"), value: stats.submitted, color: "border-indigo-200 bg-indigo-50 text-indigo-800" },
        { label: t("user.analytics_approved"), value: stats.approved, color: "border-emerald-200 bg-emerald-50 text-emerald-800" },
        { label: t("user.analytics_needs_revision"), value: stats.needs_revision, color: "border-amber-200 bg-amber-50 text-amber-800" },
        { label: t("user.analytics_rejected"), value: stats.rejected, color: "border-rose-200 bg-rose-50 text-rose-800" },
      ]
    : [];

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(20,184,166,0.12),_transparent_24%),radial-gradient(circle_at_top_right,_rgba(251,146,60,0.12),_transparent_18%),linear-gradient(180deg,_#faf7f2_0%,_#f2ede4_100%)] px-4 py-8">
      <div className="mx-auto max-w-5xl space-y-5">
        <header className="rounded-[1.8rem] border border-white/70 bg-white/90 px-5 py-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-700">{t("user.kicker")}</p>
          <h1 className="mt-2 text-3xl font-semibold text-stone-950">{t("user.title")}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">
            {t("user.subtitle")}
          </p>
        </header>

        {loading ? (
          <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
            <SkeletonCard lines={5} />
            <SkeletonCard lines={5} />
          </div>
        ) : user ? (
          <>
            {/* Teacher analytics widget */}
            {stats && user.role === "Teacher" ? (
              <section className="rounded-[1.8rem] border border-white/70 bg-white/90 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">{t("user.analytics_title")}</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-5">
                  {statItems.map((item) => (
                    <div key={item.label} className={`rounded-2xl border p-3 text-center ${item.color}`}>
                      <div className="text-2xl font-semibold">{item.value}</div>
                      <div className="mt-1 text-[11px] font-semibold">{item.label}</div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
              <section className="rounded-[1.8rem] border border-white/70 bg-white/90 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">{t("user.summary")}</p>
                <div className="mt-4 grid gap-3">
                  <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">{t("user.avatar")}</div>
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-stone-200 bg-white text-lg font-semibold text-stone-700">
                        {user.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={user.avatarUrl.startsWith("http") ? user.avatarUrl : `${apiBase}${user.avatarUrl}`} alt="Avatar" className="h-full w-full object-cover" />
                        ) : (
                          user.fullName?.trim().charAt(0).toUpperCase() || "U"
                        )}
                      </div>
                      <label className="cursor-pointer rounded-xl border border-[#d9dee8] bg-[#fbfbfc] px-3 py-2 text-xs font-bold text-[#091225] hover:bg-[#f3f4f6]">
                        {uploadingAvatar ? t("user.uploading_avatar") : t("user.choose_avatar")}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={uploadingAvatar}
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (!file) return;
                            void uploadAvatar(file);
                          }}
                        />
                      </label>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">{t("user.full_name")}</div>
                    <div className="mt-1 text-lg font-semibold text-stone-950">{user.fullName}</div>
                  </div>
                  <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">{t("user.email")}</div>
                    <div className="mt-1 break-all text-stone-800">{user.email}</div>
                  </div>
                  <div className="rounded-2xl border border-teal-200 bg-teal-50 p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-700">{t("user.role")}</div>
                    <div className="mt-1 text-stone-950">{user.role}</div>
                  </div>
                </div>
              </section>

              <section
                data-guide="user-editable"
                className="rounded-[1.8rem] border border-white/70 bg-white/90 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)]"
              >
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">{t("user.editable")}</p>
                    <h2 className="mt-1 text-xl font-semibold text-stone-950">{t("user.institutional")}</h2>
                  </div>
                  <button
                    type="button"
                    className="rounded-full bg-[#e67700] px-6 py-2.5 text-sm font-bold text-white shadow-[0_8px_16px_rgba(230,119,0,0.2)] transition-transform hover:bg-[#c75f00] disabled:opacity-50"
                    onClick={() => void saveProfile()}
                    disabled={saving}
                  >
                    {saving ? t("user.saving") : t("user.save")}
                  </button>
                </div>

                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-2">
                    <span className="text-sm font-medium text-[#374151]">{t("user.employee_id")}</span>
                    <input
                      className="w-full rounded-xl border border-[#d9dee8] bg-[#fbfbfc] px-4 py-3 text-sm text-[#091225] outline-none transition-colors placeholder:text-[#647084] focus:border-[#e67700] focus:ring-2 focus:ring-[#e67700]/20"
                      value={form.employeeId}
                      onChange={(event) => setForm((current) => ({ ...current, employeeId: event.target.value }))}
                      placeholder={t("user.ph_employee")}
                    />
                  </label>

                  <label className="grid gap-2">
                    <span className="text-sm font-medium text-[#374151]">{t("user.phone")}</span>
                    <input
                      className="w-full rounded-xl border border-[#d9dee8] bg-[#fbfbfc] px-4 py-3 text-sm text-[#091225] outline-none transition-colors placeholder:text-[#647084] focus:border-[#e67700] focus:ring-2 focus:ring-[#e67700]/20"
                      value={form.phoneNumber}
                      onChange={(event) => setForm((current) => ({ ...current, phoneNumber: event.target.value }))}
                      placeholder={t("user.ph_phone")}
                    />
                  </label>

                  <label className="grid gap-2 sm:col-span-2">
                    <span className="text-sm font-medium text-[#374151]">{t("user.department")}</span>
                    <input
                      className="w-full rounded-xl border border-[#d9dee8] bg-[#fbfbfc] px-4 py-3 text-sm text-[#091225] outline-none transition-colors placeholder:text-[#647084] focus:border-[#e67700] focus:ring-2 focus:ring-[#e67700]/20"
                      value={form.department}
                      onChange={(event) => setForm((current) => ({ ...current, department: event.target.value }))}
                      placeholder={t("user.ph_department")}
                    />
                  </label>

                  {user.role === "Teacher" ? (
                    <label className="grid gap-2 sm:col-span-2">
                      <span className="text-sm font-medium text-[#374151]">{t("user.teaching_subject")}</span>
                      <input
                        className="w-full rounded-xl border border-[#d9dee8] bg-[#fbfbfc] px-4 py-3 text-sm text-[#091225] outline-none transition-colors placeholder:text-[#647084] focus:border-[#e67700] focus:ring-2 focus:ring-[#e67700]/20"
                        value={form.teachingSubject}
                        onChange={(event) => setForm((current) => ({ ...current, teachingSubject: event.target.value }))}
                        placeholder={t("user.ph_subject")}
                      />
                    </label>
                  ) : null}
                </div>
              </section>
            </div>
          </>
        ) : (
          <section className="rounded-[1.8rem] border border-white/70 bg-white/90 p-6 text-stone-600 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
            {t("user.empty")}
          </section>
        )}
      </div>
    </main>
  );
}
