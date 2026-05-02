"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuthMe } from "@/lib/client-auth";
import { fetchWithStaleCache } from "@/lib/stale-cache";

type UserPayload = {
  role: string;
  fullName?: string;
};

type UpdateItem = {
  id: number;
  title: string;
  body: string;
  tag: "system_update" | "school_rule_update";
  author_email?: string | null;
  author_name?: string | null;
  author_role?: string | null;
  created_at?: string | null;
};

const tagCopy = {
  system_update: {
    label: "System Updates",
    description: "Platform changes, feature releases, and admin announcements.",
    accent: "border-teal-200 bg-teal-50 text-teal-800",
  },
  school_rule_update: {
    label: "School Rule Updates",
    description: "Policy reminders, QA guidance, and institutional review notes.",
    accent: "border-amber-200 bg-amber-50 text-amber-800",
  },
} as const;

export default function UpdatesPage() {
  const { user: authUser, refresh } = useAuthMe();
  const [user, setUser] = useState<UserPayload | null>(null);
  const [items, setItems] = useState<UpdateItem[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tag, setTag] = useState<"system_update" | "school_rule_update">("school_rule_update");
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canPublish = user?.role === "Admin" || user?.role === "QA";

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void (async () => {
        try {
          const userPayload = authUser || (await refresh()) || null;
          const updatesPayload = await fetchWithStaleCache<{ items?: UpdateItem[] }>(
            "updates:feed",
            async () => {
              const updatesResponse = await fetch("/api/updates");
              return (updatesResponse.ok
                ? await updatesResponse.json().catch(() => ({ items: [] }))
                : { items: [] }) as { items?: UpdateItem[] };
            },
            20_000,
          );
          setUser(userPayload);
          setItems(Array.isArray(updatesPayload?.items) ? updatesPayload.items : []);
          if (userPayload?.role === "Admin") {
            setTag("system_update");
          }
        } catch {
          setUser(null);
          setItems([]);
        } finally {
          setLoading(false);
        }
      })();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [authUser, refresh]);

  const groupedUpdates = useMemo(
    () => ({
      system_update: items.filter((item) => item.tag === "system_update"),
      school_rule_update: items.filter((item) => item.tag === "school_rule_update"),
    }),
    [items],
  );

  async function publishUpdate() {
    if (!title.trim() || !body.trim()) {
      setError("Add both a title and the update content before publishing.");
      return;
    }
    setPublishing(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch("/api/updates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          tag,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(payload?.error || "Could not publish the update.");
        return;
      }
      const createdItem = payload?.item as UpdateItem | undefined;
      if (createdItem) {
        setItems((current) => [createdItem, ...current]);
      }
      setTitle("");
      setBody("");
      setMessage("Update published.");
    } catch {
      setError("Network error while publishing the update.");
    } finally {
      setPublishing(false);
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(20,184,166,0.12),_transparent_26%),radial-gradient(circle_at_top_right,_rgba(251,146,60,0.12),_transparent_20%),linear-gradient(180deg,_#faf7f2_0%,_#f2ede4_100%)] px-4 py-10">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="rounded-[1.8rem] border border-white/70 bg-white/90 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-700">Updates</p>
          <h1 className="mt-2 text-3xl font-semibold text-stone-950">Product and policy updates</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-600">
            Keep faculty informed about platform releases and academic review rules in one shared bulletin space.
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

        {canPublish ? (
          <section className="rounded-[1.8rem] border border-white/70 bg-white/90 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">Publish</p>
                <h2 className="mt-1 text-xl font-semibold text-stone-950">
                  {user?.role === "Admin" ? "Share a system update" : "Share a school rule update"}
                </h2>
              </div>
              <div className={`rounded-full border px-3 py-1 text-xs font-semibold ${tagCopy[tag].accent}`}>
                {tagCopy[tag].label}
              </div>
            </div>

            <div className="mt-4 grid gap-4">
              <label className="grid gap-2">
                <span className="text-sm font-medium text-stone-700">Update title</span>
                <input
                  className="rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-stone-900 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="New QA workflow lock is now enabled"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-medium text-stone-700">Tag</span>
                <select
                  className="rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-stone-900 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
                  value={tag}
                  onChange={(event) => setTag(event.target.value as "system_update" | "school_rule_update")}
                  disabled={user?.role !== "Admin"}
                >
                  {user?.role === "Admin" ? <option value="system_update">System update</option> : null}
                  {user?.role === "QA" ? <option value="school_rule_update">School rule update</option> : null}
                </select>
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-medium text-stone-700">Message</span>
                <textarea
                  className="min-h-36 rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-stone-900 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  placeholder="Explain the change, who it affects, and any action teachers or QA should take."
                />
              </label>

              <button
                type="button"
                className="w-full rounded-2xl bg-stone-900 px-4 py-3 text-sm font-semibold text-white hover:bg-stone-800 sm:w-auto"
                onClick={() => void publishUpdate()}
                disabled={publishing}
              >
                {publishing ? "Publishing..." : "Publish update"}
              </button>
            </div>
          </section>
        ) : null}

        {loading ? (
          <section className="rounded-[1.8rem] border border-white/70 bg-white/90 p-6 text-center text-stone-500 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
            Loading updates...
          </section>
        ) : (
          <div className="grid gap-5 xl:grid-cols-2">
            {(["system_update", "school_rule_update"] as const).map((tagKey) => (
              <section key={tagKey} className="rounded-[1.8rem] border border-white/70 bg-white/92 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold text-stone-950">{tagCopy[tagKey].label}</h2>
                    <p className="mt-1 text-sm text-stone-600">{tagCopy[tagKey].description}</p>
                  </div>
                  <div className={`rounded-full border px-3 py-1 text-xs font-semibold ${tagCopy[tagKey].accent}`}>
                    {groupedUpdates[tagKey].length}
                  </div>
                </div>

                <div className="mt-4 grid gap-3">
                  {groupedUpdates[tagKey].length === 0 ? (
                    <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4 text-sm text-stone-500">
                      No updates published yet in this category.
                    </div>
                  ) : (
                    groupedUpdates[tagKey].map((item) => (
                      <article key={item.id} className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <h3 className="text-base font-semibold text-stone-950">{item.title}</h3>
                          <div className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${tagCopy[tagKey].accent}`}>
                            {tagKey === "system_update" ? "Admin" : "QA"}
                          </div>
                        </div>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-stone-700">{item.body}</p>
                        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-500">
                          <span>Author: {item.author_name || item.author_email || "Unknown"}</span>
                          {item.created_at ? <span>{new Date(item.created_at).toLocaleString()}</span> : null}
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
