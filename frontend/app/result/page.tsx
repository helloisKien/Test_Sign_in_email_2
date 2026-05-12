"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { getPublicApiBase } from "@/lib/backend-api";
import { useAuthMe } from "@/lib/client-auth";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { renderPreviewHtml, stripAuditorLeakage } from "@/lib/markdown-preview";
import { readResultPayloadForUser } from "@/lib/result-session";
import type { FeedbackType } from "@/lib/wizard-types";
import { showToast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { SkeletonCard } from "@/components/ui/Skeleton";

type ResultPayload = {
  mode: "generate" | "audit";
  role?: string;
  requestId: string;
  content: string;
  outputFormat?: "markdown" | "text";
  sourceMarkdown?: string;
  courseTitle?: string;
  reviewingRequestId?: string | null;
  ownerEmail?: string | null;
};

export default function ResultPage() {
  const router = useRouter();
  const apiBase = getPublicApiBase();
  const { user } = useAuthMe();
  const { t } = useI18n();
  const [payload, setPayload] = useState<ResultPayload | null>(null);
  const [editorText, setEditorText] = useState("");
  const [verdict, setVerdict] = useState<FeedbackType>("needs_revision");
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(true);
  const [copyLabel, setCopyLabel] = useState<string | null>(null);
  const [confirmQaOpen, setConfirmQaOpen] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const stored = readResultPayloadForUser<ResultPayload>(user?.email || null);
      setPayload(stored);
      setEditorText(stripAuditorLeakage((stored?.content || "").replace(/\r/g, "")));
      setLoading(false);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [user?.email]);

  const auditLockRequestId =
    payload?.mode === "audit" ? (payload.reviewingRequestId || payload.requestId) : null;

  useEffect(() => {
    if (!auditLockRequestId) {
      return;
    }
    const heartbeat = async () => {
      await fetch(`/api/review/submissions/${encodeURIComponent(auditLockRequestId)}/heartbeat`, {
        method: "POST",
      }).catch(() => null);
    };
    const initial = window.setTimeout(() => {
      void heartbeat();
    }, 1_000);
    const interval = window.setInterval(() => {
      void heartbeat();
    }, 30_000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
    };
  }, [auditLockRequestId]);

  useEffect(() => {
    if (!auditLockRequestId) {
      return;
    }
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "Are you sure you want to leave this review?";
      return event.returnValue;
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [auditLockRequestId]);

  function readEditorContent(): string {
    return editorText.replace(/\r/g, "");
  }

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(readEditorContent());
      setCopyLabel(t("result.copied"));
      showToast(t("result.copied"), "success");
      setTimeout(() => setCopyLabel(null), 2000);
    } catch {
      showToast(t("result.err_copy"), "error");
    }
  }

  function downloadMarkdown() {
    const blob = new Blob([readEditorContent()], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(payload?.courseTitle || "syllabus").replace(/[^a-zA-Z0-9_-]/g, "_")}.md`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(t("result.download_md"), "success");
  }

  async function downloadPdf() {
    const previewHtml = renderPreviewHtml(readEditorContent(), payload?.outputFormat === "text" ? "text" : "markdown");
    const title = payload?.courseTitle || t("result.default_title");

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      showToast(t("result.err_popup"), "error");
      return;
    }

    printWindow.document.write(`<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700&display=swap');
    body { font-family: 'Manrope', sans-serif; max-width: 800px; margin: 40px auto; padding: 0 24px; color: #1c1917; line-height: 1.75; }
    h1 { font-size: 1.75rem; font-weight: 700; margin: 0 0 1rem; }
    h2 { font-size: 1.3rem; font-weight: 700; margin: 1.5rem 0 0.75rem; }
    h3 { font-size: 1.05rem; font-weight: 700; margin: 1.25rem 0 0.5rem; }
    ul, ol { margin: 0 0 1rem 1.4rem; padding: 0; }
    li { margin-bottom: 0.35rem; }
    p { margin: 0 0 0.85rem; }
    code { background: #f1f5f9; padding: 0.1rem 0.35rem; border-radius: 0.375rem; font-size: 0.92em; }
    hr { margin: 1.25rem 0; border: 0; border-top: 1px solid #e5e7eb; }
    @media print { body { margin: 0; max-width: 100%; } }
  </style>
</head>
<body>${previewHtml}</body>
</html>`);
    printWindow.document.close();

    // Wait for fonts to load before printing
    setTimeout(() => {
      printWindow.print();
    }, 600);
  }

  async function sendToQa() {
    if (!payload) return;
    const content = readEditorContent();
    if (!content.trim()) {
      showToast(t("result.err_empty_qa"), "error");
      return;
    }
    const response = await fetch(`${apiBase}/api/review/submissions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        request_id: payload.requestId,
        content,
        output_format: payload.outputFormat || "markdown",
        source_markdown: payload.sourceMarkdown || "",
        note: feedback || null,
        course_title: payload.courseTitle || t("untitled_syllabus"),
        teacher_email: user?.email || null,
        teacher_name: user?.fullName || null,
      }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      showToast(body?.error || t("result.err_send_qa"), "error");
      return;
    }
    showToast(t("result.ok_sent_qa"), "success");
  }

  async function sendDecision() {
    if (!payload) return;
    const content = readEditorContent();
    const requestId = payload.reviewingRequestId || payload.requestId;
    if (!feedback.trim()) {
      showToast(t("result.err_feedback"), "error");
      return;
    }
    const response = await fetch(`${apiBase}/api/review/submissions/${encodeURIComponent(requestId)}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        verdict,
        target_request_id: payload.reviewingRequestId || null,
        feedback_text: feedback.trim(),
        reviewed_content: content,
        output_format: payload.outputFormat || "markdown",
        reviewer_email: user?.email || null,
      }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      showToast(body?.error || t("result.err_send_decision"), "error");
      return;
    }
    showToast(t("result.ok_decision"), "success");
  }

  function continueInWizard() {
    if (!payload) return;
    const resumeId = payload.mode === "audit"
      ? (payload.reviewingRequestId || payload.requestId)
      : payload.requestId;
    const targetPath = payload.mode === "audit" ? "/auditor" : "/generator";
    router.push(`${targetPath}?resume=${encodeURIComponent(resumeId)}`);
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

  if (!payload) {
    return (
      <main className="min-h-screen bg-stone-50 px-4 py-10">
        <div className="mx-auto max-w-4xl rounded-xl border border-stone-200 bg-white p-6 text-stone-700">
          {t("result.no_payload")}
        </div>
      </main>
    );
  }

  const isAudit = payload.mode === "audit";
  const previewHtml = renderPreviewHtml(editorText || "", payload.outputFormat === "text" ? "text" : "markdown");

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(20,184,166,0.12),_transparent_25%),radial-gradient(circle_at_top_right,_rgba(251,146,60,0.1),_transparent_20%),linear-gradient(180deg,_#faf7f2_0%,_#f2ede4_100%)] px-4 py-6 sm:py-8">
      <div className="mx-auto max-w-6xl space-y-4">
        <header className="flex flex-col gap-3 rounded-[1.75rem] border border-white/70 bg-white/90 p-4 shadow-[0_18px_60px_rgba(15,23,42,0.08)] sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-700">
              {isAudit ? t("result.kicker_audit") : t("result.kicker_gen")}
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-stone-950">{payload.courseTitle || t("result.default_title")}</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm font-semibold text-stone-700 transition-transform hover:bg-stone-50 active:scale-[0.98]"
              onClick={() => router.push("/history")}
            >
              {t("result.back_history")}
            </button>
            <button
              type="button"
              className="rounded-xl bg-stone-900 px-3 py-2 text-sm font-semibold text-white transition-transform hover:bg-stone-800 active:scale-[0.98]"
              onClick={continueInWizard}
            >
              {t("result.continue")}
            </button>
          </div>
        </header>

        {/* Toolbar — copy, download, PDF */}
        <section className="flex flex-wrap gap-2 rounded-2xl border border-white/70 bg-white/90 px-4 py-3 shadow-[0_14px_40px_rgba(15,23,42,0.06)]">
          <button
            type="button"
            className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-50"
            onClick={() => void copyToClipboard()}
          >
            {copyLabel || t("result.copy_md")}
          </button>
          <button
            type="button"
            className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-50"
            onClick={downloadMarkdown}
          >
            {t("result.download_md")}
          </button>
          <button
            type="button"
            className="rounded-lg border border-teal-300 bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-800 hover:bg-teal-100"
            onClick={() => void downloadPdf()}
          >
            {t("result.download_pdf")}
          </button>
        </section>

        <section className="grid items-stretch gap-4 lg:grid-cols-2">
          <div className="flex min-h-[22rem] flex-col rounded-[1.75rem] border border-white/70 bg-white/92 p-4 shadow-[0_18px_60px_rgba(15,23,42,0.08)] lg:h-[min(72vh,56rem)]">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">{t("result.editable")}</p>
            <textarea
              value={editorText}
              onChange={(event) => setEditorText(event.target.value)}
              className="h-full w-full flex-1 rounded-2xl border border-stone-300 bg-white px-4 py-4 text-sm leading-6 text-stone-900 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
            />
          </div>
          <div className="flex min-h-[22rem] flex-col rounded-[1.75rem] border border-teal-200 bg-teal-50/90 p-4 shadow-[0_18px_60px_rgba(15,23,42,0.08)] lg:h-[min(72vh,56rem)]">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-teal-800">{t("result.preview")}</p>
            <div
              className="markdown-preview h-full flex-1 overflow-y-auto rounded-2xl border border-teal-300 bg-white px-4 py-4 text-[15px]"
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          </div>
        </section>

        <section className="rounded-[1.75rem] border border-white/70 bg-white/92 p-4 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
          <div className="grid gap-3 md:grid-cols-[14rem_1fr]">
            {isAudit ? (
              <select
                className="rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm"
                value={verdict}
                onChange={(event) => setVerdict(event.target.value as FeedbackType)}
              >
                <option value="approve">{t("result.verdict_pass")}</option>
                <option value="needs_revision">{t("result.verdict_needs")}</option>
                <option value="reject">{t("result.verdict_fail")}</option>
              </select>
            ) : (
              <div className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm font-medium text-stone-600">
                {t("result.extra_notes")}
              </div>
            )}
            <textarea
              className="min-h-24 rounded-xl border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10"
              placeholder={isAudit ? t("result.feedback_ph_audit") : t("result.feedback_ph_gen")}
              value={feedback}
              onChange={(event) => setFeedback(event.target.value)}
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-xl bg-teal-700 px-5 py-3 text-sm font-semibold text-white transition-transform hover:bg-teal-800 active:scale-[0.98]"
              onClick={() => {
                if (isAudit) {
                  void sendDecision();
                } else {
                  setConfirmQaOpen(true);
                }
              }}
            >
              {isAudit ? t("result.send_decision") : t("result.send_qa")}
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
