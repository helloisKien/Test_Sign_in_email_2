"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { getPublicApiBase } from "@/lib/backend-api";
import { useAuthMe } from "@/lib/client-auth";
import { renderPreviewHtml } from "@/lib/markdown-preview";
import { readResultPayloadForUser } from "@/lib/result-session";
import type { FeedbackType } from "@/lib/wizard-types";

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
  const [payload, setPayload] = useState<ResultPayload | null>(null);
  const [editorText, setEditorText] = useState("");
  const [verdict, setVerdict] = useState<FeedbackType>("needs_revision");
  const [feedback, setFeedback] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const stored = readResultPayloadForUser<ResultPayload>(user?.email || null);
      setPayload(stored);
      setEditorText((stored?.content || "").replace(/\r/g, ""));
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

  async function sendToQa() {
    if (!payload) return;
    const content = readEditorContent();
    if (!content.trim()) {
      setError("Add syllabus content before sending to QA.");
      return;
    }
    setError(null);
    setStatus(null);
    const response = await fetch(`${apiBase}/api/review/submissions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        request_id: payload.requestId,
        content,
        output_format: payload.outputFormat || "markdown",
        source_markdown: payload.sourceMarkdown || "",
        note: feedback || null,
        course_title: payload.courseTitle || "Untitled syllabus",
        teacher_email: user?.email || null,
        teacher_name: user?.fullName || null,
      }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error || "Could not send to QA.");
      return;
    }
    setStatus("Sent to QA.");
  }

  async function sendDecision() {
    if (!payload) return;
    const content = readEditorContent();
    const requestId = payload.reviewingRequestId || payload.requestId;
    if (!feedback.trim()) {
      setError("Write feedback before sending the decision.");
      return;
    }
    setError(null);
    setStatus(null);
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
      setError(body?.error || "Could not send the decision.");
      return;
    }
    setStatus("Decision sent to the teacher.");
  }

  function continueInWizard() {
    if (!payload) return;
    const resumeId = payload.mode === "audit"
      ? (payload.reviewingRequestId || payload.requestId)
      : payload.requestId;
    const targetPath = payload.mode === "audit" ? "/auditor" : "/generator";
    router.push(`${targetPath}?resume=${encodeURIComponent(resumeId)}`);
  }

  if (!payload) {
    return (
      <main className="min-h-screen bg-stone-50 px-4 py-10">
        <div className="mx-auto max-w-4xl rounded-xl border border-stone-200 bg-white p-6 text-stone-700">
          No current result is open. Generate or audit a syllabus first.
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
              {isAudit ? "QA result" : "Generated syllabus"}
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-stone-950">{payload.courseTitle || "Syllabus result"}</h1>
          </div>
          <button
            type="button"
            className="rounded-xl bg-stone-900 px-3 py-2 text-sm font-semibold text-white transition-transform hover:bg-stone-800 active:scale-[0.98]"
            onClick={continueInWizard}
          >
            Continue in Wizard
          </button>
        </header>

        <section className="grid items-stretch gap-4 lg:grid-cols-2">
          <div className="flex min-h-[22rem] flex-col rounded-[1.75rem] border border-white/70 bg-white/92 p-4 shadow-[0_18px_60px_rgba(15,23,42,0.08)] lg:h-[min(72vh,56rem)]">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">Editable content</p>
            <textarea
              value={editorText}
              onChange={(event) => setEditorText(event.target.value)}
              className="h-full w-full flex-1 rounded-2xl border border-stone-300 bg-white px-4 py-4 text-sm leading-6 text-stone-900 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
            />
          </div>
          <div className="flex min-h-[22rem] flex-col rounded-[1.75rem] border border-teal-200 bg-teal-50/90 p-4 shadow-[0_18px_60px_rgba(15,23,42,0.08)] lg:h-[min(72vh,56rem)]">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-teal-800">Markdown preview</p>
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
                <option value="approve">Pass</option>
                <option value="needs_revision">Needs revision</option>
                <option value="reject">Fail</option>
              </select>
            ) : (
              <div className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm font-medium text-stone-600">
                Extra Notes for QA
              </div>
            )}
            <textarea
              className="min-h-24 rounded-xl border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10"
              placeholder={isAudit ? "Feedback for the teacher" : "Optional extra notes for QA review"}
              value={feedback}
              onChange={(event) => setFeedback(event.target.value)}
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-xl bg-teal-700 px-5 py-3 text-sm font-semibold text-white transition-transform hover:bg-teal-800 active:scale-[0.98]"
              onClick={() => void (isAudit ? sendDecision() : sendToQa())}
            >
              {isAudit ? "Send decision" : "Send to QA"}
            </button>
          </div>
          {status ? <p className="mt-2 text-sm font-medium text-emerald-700">{status}</p> : null}
          {error ? <p className="mt-2 text-sm font-medium text-red-700">{error}</p> : null}
        </section>
      </div>
    </main>
  );
}
