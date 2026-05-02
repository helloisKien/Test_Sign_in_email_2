"use client";

import { useEffect, useState } from "react";
import { getPublicApiBase } from "@/lib/backend-api";
import { invalidateAuthMeCache, useAuthMe } from "@/lib/client-auth";

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

const emptyForm: ProfileForm = {
  employeeId: "",
  phoneNumber: "",
  department: "",
  teachingSubject: "",
};

export default function UserPage() {
  const apiBase = getPublicApiBase();
  const { user: authUser, refresh } = useAuthMe();
  const [user, setUser] = useState<UserPayload | null>(null);
  const [form, setForm] = useState<ProfileForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

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

  async function saveProfile() {
    setSaving(true);
    setMessage(null);
    setError(null);
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
        setError(payload?.error || "Could not update your profile.");
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
      setMessage("Profile updated.");
    } catch {
      setError("Network error while saving your profile.");
    } finally {
      setSaving(false);
    }
  }

  async function uploadAvatar(file: File) {
    const formData = new FormData();
    formData.append("avatar", file);
    setUploadingAvatar(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/users/me/avatar", {
        method: "POST",
        body: formData,
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(payload?.error || "Could not upload avatar.");
        return;
      }
      setUser(payload);
      invalidateAuthMeCache();
      await refresh();
      setMessage("Avatar updated.");
    } catch {
      setError("Network error while uploading avatar.");
    } finally {
      setUploadingAvatar(false);
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(20,184,166,0.12),_transparent_24%),radial-gradient(circle_at_top_right,_rgba(251,146,60,0.12),_transparent_18%),linear-gradient(180deg,_#faf7f2_0%,_#f2ede4_100%)] px-4 py-8">
      <div className="mx-auto max-w-5xl space-y-5">
        <header className="rounded-[1.8rem] border border-white/70 bg-white/90 px-5 py-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-700">User</p>
          <h1 className="mt-2 text-3xl font-semibold text-stone-950">Profile and contact details</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">
            Keep your academic profile current so QA reviewers and admins can identify the right department, subject area, and contact channel.
          </p>
        </header>

        {message ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {message}
          </div>
        ) : null}
        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {error}
          </div>
        ) : null}

        {loading ? (
          <section className="rounded-[1.8rem] border border-white/70 bg-white/90 p-6 text-center text-stone-500 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
            Loading profile...
          </section>
        ) : user ? (
          <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
            <section className="rounded-[1.8rem] border border-white/70 bg-white/90 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">Account Summary</p>
              <div className="mt-4 grid gap-3">
                <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">Avatar</div>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-stone-200 bg-white text-lg font-semibold text-stone-700">
                      {user.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={user.avatarUrl.startsWith("http") ? user.avatarUrl : `${apiBase}${user.avatarUrl}`} alt="Avatar" className="h-full w-full object-cover" />
                      ) : (
                        user.fullName?.trim().charAt(0).toUpperCase() || "U"
                      )}
                    </div>
                    <label className="cursor-pointer rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-100">
                      {uploadingAvatar ? "Uploading..." : "Choose avatar"}
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
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">Full name</div>
                  <div className="mt-1 text-lg font-semibold text-stone-950">{user.fullName}</div>
                </div>
                <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">Email</div>
                  <div className="mt-1 break-all text-stone-800">{user.email}</div>
                </div>
                <div className="rounded-2xl border border-teal-200 bg-teal-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-700">Role</div>
                  <div className="mt-1 text-stone-950">{user.role}</div>
                </div>
              </div>
            </section>

            <section className="rounded-[1.8rem] border border-white/70 bg-white/90 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">Editable details</p>
                  <h2 className="mt-1 text-xl font-semibold text-stone-950">Institutional profile</h2>
                </div>
                <button
                  type="button"
                  className="rounded-xl bg-stone-900 px-4 py-2 text-sm font-semibold text-white hover:bg-stone-800 disabled:opacity-50"
                  onClick={() => void saveProfile()}
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Save changes"}
                </button>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-sm font-medium text-stone-700">Employee ID</span>
                  <input
                    className="rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-stone-900 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
                    value={form.employeeId}
                    onChange={(event) => setForm((current) => ({ ...current, employeeId: event.target.value }))}
                    placeholder="EMP-1024"
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-medium text-stone-700">Phone number</span>
                  <input
                    className="rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-stone-900 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
                    value={form.phoneNumber}
                    onChange={(event) => setForm((current) => ({ ...current, phoneNumber: event.target.value }))}
                    placeholder="+84 912 345 678"
                  />
                </label>

                <label className="grid gap-2 sm:col-span-2">
                  <span className="text-sm font-medium text-stone-700">Department</span>
                  <input
                    className="rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-stone-900 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
                    value={form.department}
                    onChange={(event) => setForm((current) => ({ ...current, department: event.target.value }))}
                    placeholder="Faculty of Computer Science"
                  />
                </label>

                {user.role === "Teacher" ? (
                  <label className="grid gap-2 sm:col-span-2">
                    <span className="text-sm font-medium text-stone-700">Teaching subject</span>
                    <input
                      className="rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-stone-900 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
                      value={form.teachingSubject}
                      onChange={(event) => setForm((current) => ({ ...current, teachingSubject: event.target.value }))}
                      placeholder="Data Structures, Ethics, Calculus..."
                    />
                  </label>
                ) : null}
              </div>
            </section>
          </div>
        ) : (
          <section className="rounded-[1.8rem] border border-white/70 bg-white/90 p-6 text-stone-600 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
            No account details loaded.
          </section>
        )}
      </div>
    </main>
  );
}
