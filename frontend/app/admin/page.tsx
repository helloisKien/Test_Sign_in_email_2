"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { getPublicApiBase } from "@/lib/backend-api";

type UserItem = {
  id: string;
  email: string;
  full_name: string;
  role: "generator" | "auditor" | "admin";
  created_at: string;
};

type SessionItem = {
  request_id: string;
  status: string;
  course_title?: string | null;
  submitted_at?: string | null;
  reviewed_at?: string | null;
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
  return "border-sky-200 bg-sky-50 text-sky-700";
}

export default function AdminPage() {
  const apiBase = getPublicApiBase();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  async function loadAdminData() {
    const [userResponse, sessionResponse] = await Promise.all([
      fetch("/api/admin/users"),
      fetch(`${apiBase}/api/review/submissions?status=submitted,in_progress,needs_revision,reject,approve`),
    ]);
    const userPayload = await userResponse.json().catch(() => null);
    const sessionPayload = await sessionResponse.json().catch(() => null);
    setUsers(Array.isArray(userPayload?.items) ? userPayload.items : []);
    setSessions(Array.isArray(sessionPayload?.items) ? sessionPayload.items : []);
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadAdminData();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function updateRole(userId: string, role: UserItem["role"]) {
    setMessage(null);
    const response = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/role`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      setMessage(payload?.error || "Could not update role.");
      return;
    }
    setMessage("Role updated.");
    await loadAdminData();
  }

  async function deleteUser(userId: string, fullName: string) {
    const confirmed = window.confirm(`Delete account "${fullName}"? This action cannot be undone.`);
    if (!confirmed) {
      return;
    }
    setMessage(null);
    const response = await fetch(`/api/admin/users/${encodeURIComponent(userId)}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      setMessage(payload?.error || "Could not delete user.");
      return;
    }
    setMessage("User deleted.");
    await loadAdminData();
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(20,184,166,0.12),_transparent_24%),radial-gradient(circle_at_top_right,_rgba(251,146,60,0.1),_transparent_18%),linear-gradient(180deg,_#faf7f2_0%,_#f2ede4_100%)] px-4 py-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="rounded-[1.8rem] border border-white/70 bg-white/90 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-700">Admin / Dev</p>
              <h1 className="mt-2 text-3xl font-semibold text-stone-950">Management console</h1>
            </div>
            <Link
              href="/admin/support"
              className="rounded-xl border border-teal-300 bg-teal-50 px-4 py-2 text-sm font-semibold text-teal-800 hover:bg-teal-100"
            >
              Open support inbox
            </Link>
          </div>
        </header>

        {message ? (
          <div className="rounded-2xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-900">
            {message}
          </div>
        ) : null}

        <section className="rounded-[1.8rem] border border-white/70 bg-white/92 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="text-lg font-semibold text-stone-950">Users and roles</div>
              <p className="text-sm text-stone-500">Assign Teacher, QA, or Admin roles and remove invalid accounts.</p>
            </div>
          </div>

          <div className="grid gap-3 md:hidden">
            {users.map((user) => (
              <article key={user.id} className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-stone-950">{user.full_name}</div>
                    <div className="mt-1 break-all text-sm text-stone-600">{user.email}</div>
                  </div>
                  <div className="rounded-full border border-stone-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-stone-700">
                    {roleLabel(user.role)}
                  </div>
                </div>
                <div className="mt-3 text-xs text-stone-500">
                  Created {user.created_at ? new Date(user.created_at).toLocaleDateString() : "N/A"}
                </div>
                <div className="mt-3 grid gap-2">
                  <select
                    className="rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm"
                    value={user.role}
                    onChange={(event) => void updateRole(user.id, event.target.value as UserItem["role"])}
                  >
                    <option value="generator">Teacher</option>
                    <option value="auditor">QA</option>
                    <option value="admin">Admin</option>
                  </select>
                  {user.role === "admin" ? (
                    <div className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-center text-xs font-semibold text-stone-400">
                      Protected admin
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100"
                      onClick={() => void deleteUser(user.id, user.full_name)}
                    >
                      Delete user
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-stone-200 text-xs uppercase text-stone-500">
                <tr>
                  <th className="py-2 pr-3">Name</th>
                  <th className="py-2 pr-3">Email</th>
                  <th className="py-2 pr-3">Role</th>
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
                      >
                        <option value="generator">Teacher</option>
                        <option value="auditor">QA</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td className="py-3 pr-3 text-stone-500">{user.created_at ? new Date(user.created_at).toLocaleDateString() : "N/A"}</td>
                    <td className="py-3 pr-3 text-right">
                      {user.role === "admin" ? (
                        <span className="text-xs font-semibold text-stone-400">Protected</span>
                      ) : (
                        <button
                          type="button"
                          className="rounded-lg border border-rose-300 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                          onClick={() => void deleteUser(user.id, user.full_name)}
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-[1.8rem] border border-white/70 bg-white/92 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
          <div className="mb-4">
            <div className="text-lg font-semibold text-stone-950">Sessions</div>
            <p className="text-sm text-stone-500">Cross-role visibility into active and completed syllabus reviews.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {sessions.length === 0 ? (
              <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4 text-sm text-stone-500">No sessions yet.</div>
            ) : (
              sessions.map((session) => (
                <article key={session.request_id} className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="font-semibold text-stone-950">{session.course_title || "Untitled syllabus"}</div>
                    <div className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusTone(session.status)}`}>
                      {session.status.replaceAll("_", " ")}
                    </div>
                  </div>
                  <div className="mt-3 text-xs leading-5 text-stone-500">
                    {session.reviewed_at
                      ? `Reviewed ${new Date(session.reviewed_at).toLocaleString()}`
                      : session.submitted_at
                        ? `Submitted ${new Date(session.submitted_at).toLocaleString()}`
                        : "No timestamp"}
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
