"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuthMe } from "@/lib/client-auth";
import { useI18n } from "@/lib/i18n/I18nProvider";

function FaqLoadingFallback() {
  const { t } = useI18n();
  return (
    <main className="min-h-screen bg-stone-50 px-4 py-10">
      <div className="mx-auto max-w-5xl rounded-2xl border border-stone-200 bg-white p-6 text-center text-sm text-stone-500">
        {t("faq.loading")}
      </div>
    </main>
  );
}

function FaqPageContent() {
  const { t } = useI18n();
  const { user } = useAuthMe();
  const searchParams = useSearchParams();
  const supportRef = useRef<HTMLElement | null>(null);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isAuthenticated = Boolean(user?.email);

  const faqSections = useMemo(() => {
    return [0, 1, 2, 3].map((section) => ({
      title: t(`faq.s${section}.title`),
      items: [0, 1, 2, 3].map((i) => ({
        q: t(`faq.s${section}.i${i}.q`),
        a: t(`faq.s${section}.i${i}.a`),
      })),
    }));
  }, [t]);

  useEffect(() => {
    if (searchParams.get("support") === "1") {
      supportRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [searchParams]);

  async function submitSupportMessage() {
    if (!subject.trim() || !message.trim()) {
      setError(t("faq.support_err_both"));
      return;
    }
    setSending(true);
    setStatus(null);
    setError(null);
    try {
      const response = await fetch("/api/support/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: subject.trim(),
          message: message.trim(),
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(payload?.error || t("faq.support_err_send"));
        return;
      }
      setSubject("");
      setMessage("");
      setStatus(t("faq.support_ok"));
    } catch {
      setError(t("faq.support_err_net"));
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="min-h-screen bg-stone-50 px-4 py-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <header>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-700">{t("faq.kicker")}</p>
          <h1 className="mt-2 text-3xl font-semibold text-stone-950">{t("faq.title")}</h1>
          <p className="mt-2 max-w-3xl text-sm text-stone-600">{t("faq.intro")}</p>
        </header>

        {faqSections.map((section) => (
          <section key={section.title} className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-stone-950">{section.title}</h2>
            <div className="mt-4 grid gap-3">
              {section.items.map((item) => (
                <article key={item.q} className="rounded-xl border border-stone-200 bg-stone-50 p-4">
                  <h3 className="text-sm font-semibold text-stone-950">{item.q}</h3>
                  <p className="mt-2 text-sm leading-6 text-stone-600">{item.a}</p>
                </article>
              ))}
            </div>
          </section>
        ))}

        <section ref={supportRef} className="rounded-2xl border border-teal-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-stone-950">{t("faq.support_title")}</h2>
          <p className="mt-1 text-sm text-stone-600">{t("faq.support_intro")}</p>
          {!isAuthenticated ? (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {t("faq.support_signin")}
            </div>
          ) : (
            <div className="mt-4 grid gap-3">
              <input
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                placeholder={t("faq.support_subject_ph")}
                className="w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm text-stone-900 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
              />
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder={t("faq.support_message_ph")}
                className="min-h-32 w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm text-stone-900 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
              />
              <button
                type="button"
                className="w-full rounded-xl bg-stone-900 px-4 py-3 text-sm font-semibold text-white hover:bg-stone-800 sm:w-auto"
                onClick={() => void submitSupportMessage()}
                disabled={sending}
              >
                {sending ? t("common.sending") : t("faq.support_send")}
              </button>
            </div>
          )}
          {status ? <p className="mt-3 text-sm font-medium text-emerald-700">{status}</p> : null}
          {error ? <p className="mt-3 text-sm font-medium text-rose-700">{error}</p> : null}
        </section>
      </div>
    </main>
  );
}

export default function FaqPage() {
  return (
    <Suspense fallback={<FaqLoadingFallback />}>
      <FaqPageContent />
    </Suspense>
  );
}
