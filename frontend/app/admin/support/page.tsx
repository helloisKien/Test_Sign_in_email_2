"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type SupportMessage = {
  id: number;
  user_email: string;
  user_name?: string | null;
  user_role?: string | null;
  subject: string;
  message: string;
  status: "new" | "in_review" | "resolved";
  created_at?: string | null;
  updated_at?: string | null;
};

function badgeTone(status: SupportMessage["status"]): string {
  if (status === "resolved") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "in_review") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-sky-200 bg-sky-50 text-sky-700";
}

function AdminSupportPageContent() {
  const searchParams = useSearchParams();
  const highlight = searchParams.get("highlight");
  const [items, setItems] = useState<SupportMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  async function loadMessages() {
    setLoading(true);
    try {
      const response = await fetch("/api/support/messages");
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(payload?.error || "Could not load support messages.");
        setItems([]);
        return;
      }
      setItems(Array.isArray(payload?.items) ? payload.items : []);
    } catch {
      setError("Network error while loading support messages.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadMessages();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  async function updateStatus(id: number, status: SupportMessage["status"]) {
    setMessage(null);
    setError(null);
    setUpdatingId(id);
    try {
      const response = await fetch(`/api/support/messages/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(payload?.error || "Could not update support message.");
        return;
      }
      setItems((current) =>
        current.map((item) => (item.id === id ? { ...item, status, updated_at: payload?.item?.updated_at || item.updated_at } : item)),
      );
      setMessage("Support status updated.");
    } catch {
      setError("Network error while updating support status.");
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(20,184,166,0.12),_transparent_24%),radial-gradient(circle_at_top_right,_rgba(251,146,60,0.1),_transparent_18%),linear-gradient(180deg,_#faf7f2_0%,_#f2ede4_100%)] px-4 py-8">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="rounded-[1.8rem] border border-white/70 bg-white/90 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-700">Admin Inbox</p>
          <h1 className="mt-2 text-3xl font-semibold text-stone-950">Support messages</h1>
          <p className="mt-2 text-sm text-stone-600">
            Review user feedback reports, update resolution status, and close resolved cases.
          </p>
        </header>

        {message ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</div>
        ) : null}
        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>
        ) : null}

        {loading ? (
          <section className="rounded-[1.8rem] border border-white/70 bg-white/90 p-6 text-center text-stone-500 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
            Loading support inbox...
          </section>
        ) : items.length === 0 ? (
          <section className="rounded-[1.8rem] border border-white/70 bg-white/90 p-6 text-center text-stone-500 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
            No support reports yet.
          </section>
        ) : (
          <section className="grid gap-3">
            {items.map((item) => {
              const isHighlighted = highlight === String(item.id);
              return (
                <article
                  key={item.id}
                  className={`rounded-[1.5rem] border bg-white/92 p-4 shadow-[0_18px_60px_rgba(15,23,42,0.08)] ${
                    isHighlighted ? "border-teal-400 ring-2 ring-teal-200" : "border-white/70"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold text-stone-950">{item.subject}</h2>
                      <p className="mt-1 text-xs text-stone-500">
                        From {item.user_name || item.user_email} ({item.user_role || "User"})
                      </p>
                    </div>
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${badgeTone(item.status)}`}>
                      {item.status.replace("_", " ")}
                    </span>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-stone-700">{item.message}</p>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-stone-500">
                    <span>{item.created_at ? new Date(item.created_at).toLocaleString() : "Unknown time"}</span>
                    <span>{item.user_email}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded-xl border border-sky-300 bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-700 hover:bg-sky-100 disabled:opacity-50"
                      onClick={() => void updateStatus(item.id, "new")}
                      disabled={updatingId === item.id || item.status === "new"}
                    >
                      Mark new
                    </button>
                    <button
                      type="button"
                      className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-50"
                      onClick={() => void updateStatus(item.id, "in_review")}
                      disabled={updatingId === item.id || item.status === "in_review"}
                    >
                      In review
                    </button>
                    <button
                      type="button"
                      className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                      onClick={() => void updateStatus(item.id, "resolved")}
                      disabled={updatingId === item.id || item.status === "resolved"}
                    >
                      Resolve
                    </button>
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
}

export default function AdminSupportPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-stone-50 px-4 py-8">
          <div className="mx-auto max-w-5xl rounded-2xl border border-stone-200 bg-white p-6 text-center text-sm text-stone-500">
            Loading support inbox...
          </div>
        </main>
      }
    >
      <AdminSupportPageContent />
    </Suspense>
  );
}
