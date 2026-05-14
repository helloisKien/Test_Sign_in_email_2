"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { getPublicApiBase } from "@/lib/backend-api";
import { useAuthMe } from "@/lib/client-auth";
import { extractRemediationSection } from "@/lib/extract-qa-remediation";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { getPreferredLanguage } from "@/lib/language-preference";
import { renderPreviewHtml, stripAuditorLeakage } from "@/lib/markdown-preview";
import { showToast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { SkeletonCard } from "@/components/ui/Skeleton";

type SubmissionPayload = {
  request_id: string;
  mode?: string;
  syllabus_markdown?: string | null;
  qa_report_markdown?: string | null;
  content?: string;
  source_markdown?: string | null;
  course_title?: string | null;
  qa_feedback?: string | null;
  output_format?: string | null;
};

function RegeneratePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestId = (searchParams.get("request_id") || "").trim();
  const apiBase = getPublicApiBase();
  const { user } = useAuthMe();
  const { t } = useI18n();
  const preferredLanguage = getPreferredLanguage();

  const [loading, setLoading] = useState(true);
  const [submission, setSubmission] = useState<SubmissionPayload | null>(null);
  const [syllabusText, setSyllabusText] = useState("");
  const [qaReportText, setQaReportText] = useState("");
  const [feedback, setFeedback] = useState("");
  const [hitlBusy, setHitlBusy] = useState(false);
  const [copyLabel, setCopyLabel] = useState<string | null>(null);
  const [confirmQaOpen, setConfirmQaOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const remediationSnippet = useMemo(() => extractRemediationSection(qaReportText), [qaReportText]);

  const loadSubmission = useCallback(async () => {
    if (!requestId) {
      setSubmission(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`${apiBase}/api/review/submissions/${encodeURIComponent(requestId)}`);
      const data = (await response.json().catch(() => null)) as SubmissionPayload & { error?: string };
      if (!response.ok) {
        showToast(data?.error || t("regenerate.err_submission"), "error");
        setSubmission(null);
        return;
      }
      setSubmission(data);
      const syllabus = (data.syllabus_markdown || data.content || "").replace(/\r/g, "");
      const qa = (data.qa_report_markdown || "").replace(/\r/g, "");
      setSyllabusText(stripAuditorLeakage(syllabus));
      setQaReportText(qa);
      setFeedback((data.qa_feedback || "").trim());
    } finally {
      setLoading(false);
    }
  }, [apiBase, requestId, t]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void loadSubmission();
    }, 0);
    return () => window.clearTimeout(handle);
  }, [loadSubmission]);

  const qaPreviewHtml = useMemo(
    () => renderPreviewHtml(qaReportText || "", submission?.output_format === "text" ? "text" : "markdown"),
    [qaReportText, submission?.output_format],
  );

  async function copySyllabusMd() {
    try {
      await navigator.clipboard.writeText(syllabusText.replace(/\r/g, ""));
      setCopyLabel(t("result.copied"));
      showToast(t("result.copied"), "success");
      setTimeout(() => setCopyLabel(null), 2000);
    } catch {
      showToast(t("result.err_copy"), "error");
    }
  }

  async function runHitlRevise() {
    if (!submission?.request_id) {
      return;
    }
    const trimmedSyllabus = syllabusText.replace(/\r/g, "").trim();
    if (!trimmedSyllabus) {
      showToast(t("result.err_empty_qa"), "error");
      return;
    }
    setHitlBusy(true);
    try {
      const response = await fetch(`${apiBase}/api/hitl/revise`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          request_id: submission.request_id,
          mode: "generate",
          language: preferredLanguage,
          output_format: submission.output_format === "text" ? "text" : "markdown",
          feedback_type: "needs_revision",
          feedback_text: t("regenerate.hitl_pointer_feedback"),
          original_content: trimmedSyllabus,
          edited_content: null,
          source_markdown: submission.source_markdown || "",
          request_payload: {},
          metadata: { ui: "regenerate-page" },
        }),
      });
      const body = (await response.json().catch(() => null)) as { content?: string; error?: { message?: string }; message?: string } | null;
      if (!response.ok) {
        const msg = body?.error?.message || body?.message || t("regenerate.err_hitl");
        showToast(msg, "error");
        return;
      }
      const next = typeof body?.content === "string" ? body.content : "";
      if (next) {
        setSyllabusText(stripAuditorLeakage(next.replace(/\r/g, "")));
      }
      showToast(t("regenerate.ok_hitl"), "success");
    } finally {
      setHitlBusy(false);
    }
  }

  async function sendToQa() {
    if (submitting) return;
    if (!submission?.request_id) {
      return;
    }
    const content = syllabusText.replace(/\r/g, "").trim();
    if (!content) {
      showToast(t("result.err_empty_qa"), "error");
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch(`${apiBase}/api/review/submissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          request_id: submission.request_id,
          content,
          output_format: submission.output_format === "text" ? "text" : "markdown",
          source_markdown: submission.source_markdown || "",
          note: feedback.trim() || null,
          course_title: submission.course_title || t("untitled_syllabus"),
          teacher_email: user?.email || null,
          teacher_name: user?.fullName || null,
          flow_mode: "generate",
        }),
      });
      if (!response.ok) {
        const errBody = await response.json().catch(() => null);
        showToast(errBody?.error || t("result.err_send_qa"), "error");
        return;
      }
      showToast(t("result.ok_sent_qa"), "success");
    } finally {
      setSubmitting(false);
    }
  }

  if (!requestId) {
    return (
      <main className="min-h-screen bg-stone-50 px-4 py-10">
        <div className="mx-auto max-w-4xl rounded-xl border border-stone-200 bg-white p-6 text-stone-700">
          <p>{t("regenerate.err_submission")}</p>
          <button
            type="button"
            className="mt-4 rounded-lg border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-800 hover:bg-stone-50"
            onClick={() => router.push("/history")}
          >
            {t("result.back_history")}
          </button>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen px-4 py-10">
        <div className="mx-auto max-w-6xl space-y-4">
          <SkeletonCard lines={2} />
          <div className="grid gap-4 lg:grid-cols-2">
            <SkeletonCard lines={6} />
            <SkeletonCard lines={6} />
          </div>
        </div>
      </main>
    );
  }

  if (!submission) {
    return (
      <main className="min-h-screen bg-stone-50 px-4 py-10">
        <div className="mx-auto max-w-4xl rounded-xl border border-stone-200 bg-white p-6 text-stone-700">
          <p>{t("regenerate.err_submission")}</p>
          <button
            type="button"
            className="mt-4 rounded-lg border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-800 hover:bg-stone-50"
            onClick={() => router.push("/history")}
          >
            {t("result.back_history")}
          </button>
        </div>
      </main>
    );
  }

  return (
    <main
      data-guide="regenerate-page"
      className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(20,184,166,0.12),_transparent_25%),radial-gradient(circle_at_top_right,_rgba(251,146,60,0.1),_transparent_20%),linear-gradient(180deg,_#faf7f2_0%,_#f2ede4_100%)] px-4 py-6 sm:py-8"
    >
      <div className="mx-auto max-w-6xl space-y-4">
        <header className="flex flex-col gap-3 rounded-[1.75rem] border border-white/70 bg-white/90 p-4 shadow-[0_18px_60px_rgba(15,23,42,0.08)] sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-700">{t("regenerate.kicker")}</p>
            <h1 className="mt-2 text-3xl font-semibold text-stone-950">
              {submission.course_title || t("regenerate.title")}
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-full border border-[#d9dee8] bg-[#ffffff] px-4 py-2.5 text-sm font-bold text-[#111827] shadow-[0_4px_12px_rgba(15,23,42,0.08)] transition-transform hover:border-[#c6cdd9] active:scale-[0.98]"
              onClick={() => router.push("/history")}
            >
              {t("result.back_history")}
            </button>
          </div>
        </header>

        <section className="flex flex-wrap gap-2 rounded-[1.05rem] border border-[#e8ebef] bg-[#fbfbfc] px-4 py-3 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
          <button
            type="button"
            className="rounded-lg border border-[#d9dee8] bg-white px-3 py-1.5 text-xs font-bold text-[#374151] hover:bg-[#f3f4f6]"
            onClick={() => void copySyllabusMd()}
          >
            {copyLabel || t("result.copy_md")}
          </button>
        </section>

        <section className="grid items-stretch gap-4 lg:grid-cols-2">
          <div className="flex min-h-[22rem] flex-col rounded-[1.45rem] border border-[#ece9df] bg-white p-4 shadow-[0_18px_60px_rgba(15,23,42,0.08)] lg:h-[min(72vh,56rem)]">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-[#647084]">{t("regenerate.col_syllabus")}</p>
            <textarea
              value={syllabusText}
              onChange={(event) => setSyllabusText(event.target.value)}
              className="h-full w-full min-h-[16rem] flex-1 rounded-2xl border border-[#d9dee8] bg-[#fbfbfc] px-4 py-4 font-mono text-sm leading-6 text-[#091225] outline-none focus:border-[#e67700] focus:ring-2 focus:ring-[#e67700]/20"
            />
          </div>
          <div className="flex min-h-[22rem] flex-col rounded-[1.75rem] border border-teal-200 bg-teal-50/90 p-4 shadow-[0_18px_60px_rgba(15,23,42,0.08)] lg:h-[min(72vh,56rem)]">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-teal-800">{t("regenerate.col_qa")}</p>
            {qaReportText.trim() ? (
              <div
                className="markdown-preview h-full flex-1 overflow-y-auto rounded-2xl border border-teal-300 bg-white px-4 py-4 text-[15px]"
                dangerouslySetInnerHTML={{ __html: qaPreviewHtml }}
              />
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-teal-300 bg-white/80 px-4 py-8 text-center text-sm text-teal-900">
                <p>{t("wizard.qa_report_panel_empty")}</p>
                {submission.qa_feedback ? (
                  <div
                    className="markdown-preview mt-4 max-h-[50vh] w-full overflow-y-auto rounded-xl border border-teal-200 bg-white px-3 py-3 text-left text-sm"
                    dangerouslySetInnerHTML={{
                      __html: renderPreviewHtml(submission.qa_feedback, "markdown"),
                    }}
                  />
                ) : null}
              </div>
            )}
          </div>
        </section>

        {remediationSnippet ? (
          <section className="rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-950">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-amber-900">{t("regenerate.remediation_snippet")}</p>
            <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs leading-relaxed">
              {remediationSnippet}
            </pre>
          </section>
        ) : null}

        <p className="text-xs leading-relaxed text-stone-600">{t("regenerate.hitl_hint")}</p>

        <section
          data-guide="regenerate-send"
          className="rounded-[1.75rem] border border-white/70 bg-white/92 p-4 shadow-[0_18px_60px_rgba(15,23,42,0.08)]"
        >
          <button
            type="button"
            className="mb-3 w-full rounded-full border border-teal-700 bg-white px-5 py-3 text-sm font-bold text-teal-800 shadow-sm transition-transform hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            disabled={hitlBusy}
            onClick={() => void runHitlRevise()}
          >
            {hitlBusy ? t("common.working") : t("regenerate.hitl_btn")}
          </button>

          <div className="grid gap-3 md:grid-cols-[14rem_1fr]">
            <div className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm font-medium text-stone-600">
              {t("result.extra_notes")}
            </div>
            <textarea
              className="min-h-24 rounded-xl border border-[#d9dee8] bg-[#fbfbfc] px-3 py-2 text-sm outline-none focus:border-[#e67700] focus:ring-2 focus:ring-[#e67700]/20"
              placeholder={t("result.feedback_ph_gen")}
              value={feedback}
              onChange={(event) => setFeedback(event.target.value)}
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-full bg-[#e67700] px-5 py-3 text-sm font-bold text-white shadow-[0_8px_16px_rgba(230,119,0,0.2)] transition-transform hover:bg-[#c75f00] active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-slate-400 disabled:shadow-none"
              disabled={submitting}
              onClick={() => {
                if (submitting) return;
                setConfirmQaOpen(true);
              }}
            >
              {submitting ? t("common.working") : t("result.send_qa")}
            </button>
          </div>
        </section>
      </div>

      <ConfirmDialog
        open={confirmQaOpen}
        title={t("admin.confirm_send_qa")}
        description={t("admin.confirm_send_qa_body")}
        confirmLabel={t("result.send_qa")}
        cancelLabel={t("common.back")}
        onConfirm={() => {
          setConfirmQaOpen(false);
          void sendToQa();
        }}
        onCancel={() => setConfirmQaOpen(false)}
      />
    </main>
  );
}

export default function RegeneratePage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen px-4 py-10">
          <div className="mx-auto max-w-6xl space-y-4">
            <SkeletonCard lines={2} />
            <div className="grid gap-4 lg:grid-cols-2">
              <SkeletonCard lines={6} />
              <SkeletonCard lines={6} />
            </div>
          </div>
        </main>
      }
    >
      <RegeneratePageInner />
    </Suspense>
  );
}
