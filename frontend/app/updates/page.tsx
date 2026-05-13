"use client";

import { useEffect, useMemo, useState } from "react";

import { useAuthMe } from "@/lib/client-auth";
import { useI18n } from "@/lib/i18n/I18nProvider";
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

type TagCopy = {
  label: string;
  description: string;
  accent: string;
};

type PageCopy = {
  pageKicker: string;
  pageTitle: string;
  pageIntro: string;
  sectionPublish: string;
  sectionAdminTitle: string;
  sectionQaTitle: string;
  fieldTitle: string;
  fieldTitlePlaceholder: string;
  fieldTag: string;
  fieldMessage: string;
  fieldMessagePlaceholder: string;
  publish: string;
  publishing: string;
  loading: string;
  emptyCategory: string;
  authorLabel: string;
  unknownAuthor: string;
  messagePublished: string;
  errorNeedTitleBody: string;
  errorPublishFailed: string;
  errorPublishNetwork: string;
  roleBadgeAdmin: string;
  roleBadgeQa: string;
  tags: Record<UpdateItem["tag"], TagCopy>;
};

const COPY_EN: PageCopy = {
  pageKicker: "Updates",
  pageTitle: "Product and policy updates",
  pageIntro: "Keep faculty informed about platform releases and academic review rules in one shared bulletin space.",
  sectionPublish: "Publish",
  sectionAdminTitle: "Share a system update",
  sectionQaTitle: "Share a school rule update",
  fieldTitle: "Update title",
  fieldTitlePlaceholder: "New QA workflow lock is now enabled",
  fieldTag: "Tag",
  fieldMessage: "Message",
  fieldMessagePlaceholder: "Explain the change, who it affects, and any action teachers or QA should take.",
  publish: "Publish update",
  publishing: "Publishing...",
  loading: "Loading updates...",
  emptyCategory: "No updates published yet in this category.",
  authorLabel: "Author",
  unknownAuthor: "Unknown",
  messagePublished: "Update published.",
  errorNeedTitleBody: "Add both a title and the update content before publishing.",
  errorPublishFailed: "Could not publish the update.",
  errorPublishNetwork: "Network error while publishing the update.",
  roleBadgeAdmin: "Admin",
  roleBadgeQa: "QA",
  tags: {
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
  },
};

const COPY_VI: PageCopy = {
  pageKicker: "Cập nhật",
  pageTitle: "Cập nhật sản phẩm và quy định",
  pageIntro: "Theo dõi thay đổi nền tảng và quy định học thuật trong một bảng tin dùng chung cho giảng viên và QA.",
  sectionPublish: "Đăng tin",
  sectionAdminTitle: "Đăng cập nhật hệ thống",
  sectionQaTitle: "Đăng cập nhật quy định học thuật",
  fieldTitle: "Tiêu đề",
  fieldTitlePlaceholder: "Đã bật khóa phiên QA theo quy trình mới",
  fieldTag: "Phân loại",
  fieldMessage: "Nội dung",
  fieldMessagePlaceholder: "Mô tả thay đổi, đối tượng ảnh hưởng và hành động mà giảng viên hoặc QA cần thực hiện.",
  publish: "Đăng cập nhật",
  publishing: "Đang đăng...",
  loading: "Đang tải cập nhật...",
  emptyCategory: "Chưa có cập nhật nào trong mục này.",
  authorLabel: "Tác giả",
  unknownAuthor: "Không rõ",
  messagePublished: "Đã đăng cập nhật.",
  errorNeedTitleBody: "Vui lòng nhập cả tiêu đề và nội dung trước khi đăng.",
  errorPublishFailed: "Không thể đăng cập nhật.",
  errorPublishNetwork: "Lỗi mạng khi đăng cập nhật.",
  roleBadgeAdmin: "Quản trị",
  roleBadgeQa: "QA",
  tags: {
    system_update: {
      label: "Cập nhật hệ thống",
      description: "Thay đổi nền tảng, phát hành tính năng và thông báo từ quản trị viên.",
      accent: "border-teal-200 bg-teal-50 text-teal-800",
    },
    school_rule_update: {
      label: "Cập nhật quy định học thuật",
      description: "Nhắc nhở chính sách, hướng dẫn QA và ghi chú rà soát từ nhà trường.",
      accent: "border-amber-200 bg-amber-50 text-amber-800",
    },
  },
};

export default function UpdatesPage() {
  const { locale } = useI18n();
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

  const copy = locale === "vi" ? COPY_VI : COPY_EN;
  const tagCopy = copy.tags;
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
      setError(copy.errorNeedTitleBody);
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
        setError(payload?.error || copy.errorPublishFailed);
        return;
      }
      const createdItem = payload?.item as UpdateItem | undefined;
      if (createdItem) {
        setItems((current) => [createdItem, ...current]);
      }
      setTitle("");
      setBody("");
      setMessage(copy.messagePublished);
    } catch {
      setError(copy.errorPublishNetwork);
    } finally {
      setPublishing(false);
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(255,239,189,0.4),_transparent_20%),radial-gradient(circle_at_top_right,_rgba(200,247,238,0.46),_transparent_22%),linear-gradient(180deg,_#fbfaf7_0%,_#f5f3ec_100%)] px-4 py-5 sm:py-6">
      <div className="mx-auto max-w-6xl space-y-4">
        <header className="rounded-[1.45rem] border border-[#ece9df] bg-white/90 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#647084]">{copy.pageKicker}</p>
          <h1 className="mt-2 font-sans text-[2rem] font-black text-stone-950 sm:text-[2.35rem]">{copy.pageTitle}</h1>
          <p className="mt-2 max-w-3xl text-[1rem] leading-7 text-stone-600">{copy.pageIntro}</p>
        </header>

        {message ? (
          <div className="rounded-[1.1rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {message}
          </div>
        ) : null}
        {error ? (
          <div className="rounded-[1.1rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {error}
          </div>
        ) : null}

        {canPublish ? (
          <section className="rounded-[1.45rem] border border-[#ece9df] bg-white/90 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-stone-500">{copy.sectionPublish}</p>
                <h2 className="mt-1 font-sans text-[1.5rem] font-black text-stone-950">
                  {user?.role === "Admin" ? copy.sectionAdminTitle : copy.sectionQaTitle}
                </h2>
              </div>
              <div className={`rounded-full border px-3 py-1 text-xs font-bold ${tagCopy[tag].accent}`}>
                {tagCopy[tag].label}
              </div>
            </div>

            <div className="mt-4 grid gap-4">
              <label className="grid gap-2">
                <span className="text-sm font-medium text-stone-700">{copy.fieldTitle}</span>
                <input
                  className="rounded-[1.1rem] border border-[#d9dee8] bg-[#fbfbfc] px-4 py-3 text-sm text-[#091225] outline-none transition-colors placeholder:text-[#647084] focus:border-[#e67700] focus:ring-2 focus:ring-[#e67700]/20"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder={copy.fieldTitlePlaceholder}
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-medium text-stone-700">{copy.fieldTag}</span>
                <select
                  className="rounded-[1.1rem] border border-[#d9dee8] bg-[#fbfbfc] px-4 py-3 text-sm text-[#091225] outline-none focus:border-[#e67700] focus:ring-2 focus:ring-[#e67700]/20"
                  value={tag}
                  onChange={(event) => setTag(event.target.value as "system_update" | "school_rule_update")}
                  disabled={user?.role !== "Admin"}
                >
                  {user?.role === "Admin" ? <option value="system_update">{tagCopy.system_update.label}</option> : null}
                  {user?.role === "QA" ? <option value="school_rule_update">{tagCopy.school_rule_update.label}</option> : null}
                </select>
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-medium text-stone-700">{copy.fieldMessage}</span>
                <textarea
                  className="min-h-36 rounded-[1.1rem] border border-[#d9dee8] bg-[#fbfbfc] px-4 py-3 text-sm text-[#091225] outline-none transition-colors placeholder:text-[#647084] focus:border-[#e67700] focus:ring-2 focus:ring-[#e67700]/20"
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  placeholder={copy.fieldMessagePlaceholder}
                />
              </label>

              <button
                type="button"
                className="w-full rounded-full bg-[#e67700] px-5 py-3 text-sm font-bold text-white shadow-[0_12px_24px_rgba(230,119,0,0.22)] hover:bg-[#c75f00] sm:w-auto"
                onClick={() => void publishUpdate()}
                disabled={publishing}
              >
                {publishing ? copy.publishing : copy.publish}
              </button>
            </div>
          </section>
        ) : null}

        {loading ? (
          <section className="rounded-[1.45rem] border border-[#ece9df] bg-white/90 p-6 text-center text-stone-500 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
            {copy.loading}
          </section>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {(["system_update", "school_rule_update"] as const).map((tagKey) => (
              <section key={tagKey} className="rounded-[1.45rem] border border-[#ece9df] bg-white/92 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="font-sans text-[1.45rem] font-black text-stone-950">{tagCopy[tagKey].label}</h2>
                    <p className="mt-1 text-[1rem] leading-7 text-stone-600">{tagCopy[tagKey].description}</p>
                  </div>
                  <div className={`rounded-full border px-3 py-1 text-xs font-bold ${tagCopy[tagKey].accent}`}>
                    {groupedUpdates[tagKey].length}
                  </div>
                </div>

                <div className="mt-4 grid gap-3">
                  {groupedUpdates[tagKey].length === 0 ? (
                    <div className="rounded-[1.1rem] border border-stone-200 bg-stone-50 px-4 py-4 text-sm text-stone-500">
                      {copy.emptyCategory}
                    </div>
                  ) : (
                    groupedUpdates[tagKey].map((item) => (
                      <article key={item.id} className="rounded-[1.1rem] border border-stone-200 bg-stone-50 px-4 py-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <h3 className="font-sans text-[1.18rem] font-black text-stone-950">{item.title}</h3>
                          <div className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${tagCopy[tagKey].accent}`}>
                            {tagKey === "system_update" ? copy.roleBadgeAdmin : copy.roleBadgeQa}
                          </div>
                        </div>
                        <p className="mt-2 whitespace-pre-wrap text-[1rem] leading-7 text-stone-700">{item.body}</p>
                        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-500">
                          <span>
                            {copy.authorLabel}: {item.author_name || item.author_email || copy.unknownAuthor}
                          </span>
                          {item.created_at ? (
                            <span>{new Date(item.created_at).toLocaleString(locale === "vi" ? "vi-VN" : "en-US")}</span>
                          ) : null}
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
