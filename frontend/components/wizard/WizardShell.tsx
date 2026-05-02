"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { getPublicApiBase } from "@/lib/backend-api";
import {
  getPreferredLanguage,
  languageChangedEventName,
  type PreferredLanguage,
} from "@/lib/language-preference";
import { translate } from "@/lib/i18n/t";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { renderPreviewHtml } from "@/lib/markdown-preview";
import { saveResultPayload } from "@/lib/result-session";
import type { WizardFlowConfig } from "@/lib/wizard-config";
import { localizeWizardConfig } from "@/lib/wizard-localization";
import { useWizardStore } from "@/lib/wizard-store";
import type {
  FeedbackType,
  WizardDraftEnvelope,
  WizardFieldState,
} from "@/lib/wizard-types";

import { RecoveryBanner } from "./RecoveryBanner";
import { StepRenderer } from "./StepRenderer";

type UserInfo = {
  fullName: string;
  email: string;
  role?: string;
};

type WizardShellProps = {
  config: WizardFlowConfig;
  roleLabel: string;
  userInfo?: UserInfo;
};

type BackendResult = {
  request_id: string;
  status: string;
  mode: string;
  content: string;
  output_format: string;
  metadata?: {
    model?: string;
    model_provider?: string;
    generated_at?: string;
    latency_ms?: number;
    fallback_route?: string;
  };
  fallback_reason?: string | null;
};

type ReviewSubmission = {
  request_id: string;
  content: string;
  status: string;
  output_format?: string | null;
  source_markdown?: string | null;
  course_code?: string | null;
  course_title?: string | null;
  teacher_note?: string | null;
  qa_feedback?: string | null;
  teacher_email?: string | null;
  teacher_name?: string | null;
  reviewer_email?: string | null;
  reviewer_name?: string | null;
  verdict?: string | null;
  submitted_at?: string | null;
  review_started_at?: string | null;
  review_lock_expires_at?: string | null;
  reviewed_at?: string | null;
};

function splitLines(value: string): string[] {
  return value
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function parseJsonResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return {};
  }
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function extractMessage(payload: unknown, status: number): string {
  let message: string | null = null;
  if (typeof payload === "string") {
    message = payload;
  }
  if (!message && isRecord(payload)) {
    if (typeof payload.message === "string") {
      message = payload.message;
    }
    if (!message && isRecord(payload.error) && typeof payload.error.message === "string") {
      message = payload.error.message;
    }
    if (!message && typeof payload.detail === "string") {
      message = payload.detail;
    }
    const actionsRemaining = typeof payload.actions_remaining === "number" ? payload.actions_remaining : null;
    const tokensRemaining = typeof payload.tokens_remaining === "number" ? payload.tokens_remaining : null;
    if (message && (actionsRemaining !== null || tokensRemaining !== null)) {
      const chunks: string[] = [];
      if (actionsRemaining !== null) {
        chunks.push(`${actionsRemaining} actions left`);
      }
      if (tokensRemaining !== null) {
        chunks.push(`${tokensRemaining} tokens left`);
      }
      if (chunks.length > 0) {
        message = `${message} (${chunks.join(" | ")})`;
      }
    }
  }
  return message || `HTTP ${status}`;
}

function parseSourceContext(sourceMarkdown: string): Record<string, string> {
  const lines = sourceMarkdown.replace(/\r/g, "").split("\n");
  const sections: Record<string, string[]> = {};
  let currentHeading: string | null = null;

  for (const line of lines) {
    const headingMatch = line.match(/^##\s+(.+)$/);
    if (headingMatch) {
      currentHeading = headingMatch[1]?.trim() || null;
      if (currentHeading && !sections[currentHeading]) {
        sections[currentHeading] = [];
      }
      continue;
    }

    if (!currentHeading) {
      continue;
    }

    sections[currentHeading].push(line);
  }

  return Object.fromEntries(
    Object.entries(sections).map(([heading, value]) => [heading, value.join("\n").trim()]),
  );
}

function formatSubmissionStatus(status: string, t: (key: string) => string): string {
  if (status === "in_progress") {
    return t("status.in_progress");
  }
  if (status === "needs_revision") {
    return t("status.needs_revision");
  }
  if (status === "approve") {
    return t("status.approve");
  }
  if (status === "reject") {
    return t("status.reject");
  }
  if (status === "draft") {
    return t("status.draft");
  }
  return t("status.submitted");
}

function submissionStatusClass(status: string): string {
  if (status === "in_progress") {
    return "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700";
  }
  if (status === "needs_revision") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  if (status === "approve") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (status === "reject") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }
  return "border-sky-200 bg-sky-50 text-sky-700";
}

export function WizardShell({ config, roleLabel, userInfo }: WizardShellProps) {
  const { t } = useI18n();
  const pathname = usePathname();
  const router = useRouter();
  const apiBase = useMemo(() => getPublicApiBase(), []);
  const store = useWizardStore();
  const {
    wizardId,
    mode,
    currentStep,
    fields,
    fieldOrder,
    overrides,
    snapshots,
  } = store;

  const [busySubmit, setBusySubmit] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BackendResult | null>(null);
  const [resultContent, setResultContent] = useState("");
  const [feedbackType, setFeedbackType] = useState<FeedbackType>("needs_revision");
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackStatus, setFeedbackStatus] = useState<string | null>(null);
  const [reviewSubmissions, setReviewSubmissions] = useState<ReviewSubmission[]>([]);
  const [activeAuditSubmission, setActiveAuditSubmission] = useState<ReviewSubmission | null>(null);
  const [reviewingRequestId, setReviewingRequestId] = useState<string | null>(null);
  const [queueBusy, setQueueBusy] = useState(false);
  const [autosaveCandidate, setAutosaveCandidate] = useState<WizardDraftEnvelope | null>(null);
  const [lastSubmitPayload, setLastSubmitPayload] = useState<Record<string, unknown> | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadFileName, setUploadFileName] = useState<string>("");
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [preferredLanguage, setPreferredLanguageState] = useState<PreferredLanguage>(() => getPreferredLanguage());
  const [activeReviewLockId, setActiveReviewLockId] = useState<string | null>(null);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [leaveConfirmText, setLeaveConfirmText] = useState("");

  const autosaveKeyRef = useRef<string>("");
  const uploadFileRef = useRef<File | null>(null);
  const reviewingRequestIdRef = useRef<string | null>(null);
  const activeReviewLockIdRef = useRef<string | null>(null);
  const pendingLeaveActionRef = useRef<(() => Promise<void>) | null>(null);

  const searchParams = useSearchParams();
  const [resumeBanner, setResumeBanner] = useState<{ feedback: string; verdict: string; courseTitle: string } | null>(null);
  const [resumeLoading, setResumeLoading] = useState(false);

  useEffect(() => {
    activeReviewLockIdRef.current = activeReviewLockId;
  }, [activeReviewLockId]);

  const displayConfig = useMemo(
    () => localizeWizardConfig(config, preferredLanguage),
    [config, preferredLanguage],
  );
  const stepDefs = displayConfig.steps;
  const currentStepDef = stepDefs[currentStep] ?? stepDefs[0];

  const labelByFieldId = useMemo(
    () =>
      Object.fromEntries(
        displayConfig.fields.map((field) => [field.fieldId, { label: field.label, placeholder: field.placeholder ?? "" }]),
      ),
    [displayConfig.fields],
  );

  const currentFields = useMemo(() => {
    const fieldIds = new Set(currentStepDef.fieldIds);
    return fieldOrder
      .map((fieldId) => fields[fieldId])
      .filter((field): field is WizardFieldState => Boolean(field && fieldIds.has(field.fieldId)))
      .map((field) => {
        const loc = labelByFieldId[field.fieldId];
        if (!loc) {
          return field;
        }
        return { ...field, label: loc.label, placeholder: loc.placeholder };
      });
  }, [currentStepDef.fieldIds, fieldOrder, fields, labelByFieldId]);

  useEffect(() => {
    const routeWizardId = `${config.mode}-wizard-main`;
    autosaveKeyRef.current = `wizard-draft:${routeWizardId}:${config.mode}`;
    store.initialize(routeWizardId, config.mode, config.fields);
  }, [config.fields, config.mode, store]);

  useEffect(() => {
    if (!wizardId) {
      return;
    }
    const raw = localStorage.getItem(autosaveKeyRef.current);
    if (!raw) {
      return;
    }
    try {
      const payload = JSON.parse(raw) as WizardDraftEnvelope;
      if (payload.wizardId !== wizardId || payload.mode !== mode) {
        return;
      }
      setAutosaveCandidate(payload);
    } catch {
      // ignore malformed autosave payload
    }
  }, [mode, wizardId]);

  useEffect(() => {
    const syncLanguage = () => setPreferredLanguageState(getPreferredLanguage());
    window.addEventListener(languageChangedEventName(), syncLanguage as EventListener);
    return () => {
      window.removeEventListener(languageChangedEventName(), syncLanguage as EventListener);
    };
  }, []);

  useEffect(() => {
    if (!wizardId) {
      return;
    }
    const interval = window.setInterval(() => {
      const snapshot: WizardDraftEnvelope = {
        wizardId,
        mode,
        currentStep: useWizardStore.getState().currentStep,
        fields: Object.fromEntries(
          Object.entries(useWizardStore.getState().fields).map(([fieldId, field]) => [fieldId, field.value]),
        ),
        overrides: useWizardStore.getState().overrides,
        snapshots: useWizardStore.getState().snapshots,
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem(autosaveKeyRef.current, JSON.stringify(snapshot));
      store.markAutosaved(snapshot.savedAt);
    }, 3000);
    return () => window.clearInterval(interval);
  }, [mode, store, wizardId]);

  // Resume from history: load a previous submission into the wizard
  useEffect(() => {
    const resumeId = searchParams.get("resume");
    if (!resumeId || !wizardId) return;

    let cancelled = false;
    const resumeTimeout = window.setTimeout(() => {
      setResumeLoading(true);

      void (async () => {
        try {
          if (mode === "audit") {
            const claimResponse = await fetch(`/api/review/submissions/${encodeURIComponent(resumeId)}/claim`, {
              method: "POST",
            });
            const claimPayload = await claimResponse.json().catch(() => null);
            if (!claimResponse.ok || cancelled) {
              setError(claimPayload?.error || t("wizard.err_claimed"));
              return;
            }
            setActiveReviewLockId(resumeId);
          }

          const response = await fetch(`${apiBase}/api/review/submissions/${encodeURIComponent(resumeId)}`);
          if (!response.ok || cancelled) {
            if (mode === "audit") {
              setActiveReviewLockId(null);
            }
            return;
          }
          const data = await response.json();
          if (cancelled || !data) return;

          if (mode === "generate") {
            restoreGenerateSubmission(data as ReviewSubmission);
          } else if (mode === "audit") {
            restoreAuditSubmission(data as ReviewSubmission);
          }

          // Show QA feedback banner if resuming a needs_revision item
          if (data.qa_feedback && data.status === "needs_revision") {
            setResumeBanner({
              feedback: data.qa_feedback,
              verdict: data.verdict || "needs_revision",
              courseTitle: data.course_title || t("untitled_syllabus"),
            });
            setFeedbackText(data.qa_feedback);
          }

          store.setCurrentStep(0);
        } catch {
          // Silently ignore resume errors
          if (mode === "audit") {
            setActiveReviewLockId(null);
          }
        } finally {
          if (!cancelled) setResumeLoading(false);
        }
      })();
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(resumeTimeout);
    };
  }, [mode, searchParams, wizardId]); // eslint-disable-line react-hooks/exhaustive-deps

  const releaseReviewLock = useCallback(async (requestId: string | null): Promise<void> => {
    if (mode !== "audit" || !requestId) {
      return;
    }
    try {
      await fetch(`/api/review/submissions/${encodeURIComponent(requestId)}/release`, {
        method: "POST",
        keepalive: true,
      });
    } catch {
      // lock lease timeout is the source of truth, so release failures are tolerated
    }
  }, [mode]);

  const releaseActiveLockAndReset = useCallback(async (): Promise<void> => {
    const activeLockId = activeReviewLockIdRef.current;
    setActiveReviewLockId(null);
    await releaseReviewLock(activeLockId);
  }, [releaseReviewLock]);

  function requestLeaveConfirmation(action: () => Promise<void>, message?: string) {
    pendingLeaveActionRef.current = action;
    setLeaveConfirmText(message || t("wizard.leave_default"));
    setLeaveConfirmOpen(true);
  }

  async function confirmLeave() {
    const pending = pendingLeaveActionRef.current;
    pendingLeaveActionRef.current = null;
    setLeaveConfirmOpen(false);
    if (!pending) {
      return;
    }
    await pending();
  }

  function cancelLeave() {
    pendingLeaveActionRef.current = null;
    setLeaveConfirmOpen(false);
  }

  useEffect(() => {
    if (mode !== "audit" || !activeReviewLockId) {
      return;
    }

    let cancelled = false;
    const heartbeat = async () => {
      const response = await fetch(`/api/review/submissions/${encodeURIComponent(activeReviewLockId)}/heartbeat`, {
        method: "POST",
      }).catch(() => null);
      if (!response || cancelled) {
        return;
      }
      if (response.ok) {
        return;
      }
      if (response.status === 409) {
        setActiveReviewLockId(null);
        await loadReviewSubmissions();
        return;
      }
      const payload = await response.json().catch(() => null);
      setError(payload?.error || t("wizard.err_renew_lock"));
    };

    const initial = window.setTimeout(() => {
      void heartbeat();
    }, 1_000);
    const interval = window.setInterval(() => {
      void heartbeat();
    }, 30_000);

    return () => {
      cancelled = true;
      window.clearTimeout(initial);
      window.clearInterval(interval);
    };
  }, [activeReviewLockId, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (mode !== "audit" || !activeReviewLockId) {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = translate(getPreferredLanguage(), "wizard.beforeunload");
      return event.returnValue;
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [activeReviewLockId, mode]);

  useEffect(() => {
    if (mode !== "audit" || !activeReviewLockId) {
      return;
    }

    const onDocumentClick = (event: MouseEvent) => {
      if (event.defaultPrevented) {
        return;
      }
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor) {
        return;
      }
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) {
        return;
      }
      const destination = new URL(anchor.href, window.location.href);
      const current = new URL(window.location.href);
      const sameLocation =
        destination.origin === current.origin &&
        destination.pathname === current.pathname &&
        destination.search === current.search &&
        destination.hash === current.hash;
      if (sameLocation) {
        return;
      }

      event.preventDefault();
      requestLeaveConfirmation(
        async () => {
          await releaseActiveLockAndReset();
          router.push(`${destination.pathname}${destination.search}${destination.hash}`);
        },
        t("wizard.leave_nav"),
      );
    };

    document.addEventListener("click", onDocumentClick, true);
    return () => {
      document.removeEventListener("click", onDocumentClick, true);
    };
  }, [activeReviewLockId, mode, releaseActiveLockAndReset, router]);

  async function loadReviewSubmissions() {
    const status = mode === "audit" ? "submitted,in_progress" : "needs_revision,reject,approve";
    const queryParams = new URLSearchParams({ status });
    if (mode === "audit" && userInfo?.email) {
      queryParams.set("reviewer_email", userInfo.email);
      queryParams.set("include_unreviewed", "true");
    } else if (mode === "generate" && userInfo?.role !== "Admin" && userInfo?.email) {
      queryParams.set("teacher_email", userInfo.email);
    }
    setQueueBusy(true);
    try {
      const response = await fetch(`${apiBase}/api/review/submissions?${queryParams.toString()}`);
      const payload = (await response.json().catch(() => null)) as { items?: ReviewSubmission[] } | null;
      const nextItems = Array.isArray(payload?.items) ? payload.items : [];
      if (mode === "audit") {
        nextItems.sort((left, right) => {
          if (left.status === "in_progress" && right.status !== "in_progress") return -1;
          if (left.status !== "in_progress" && right.status === "in_progress") return 1;
          return 0;
        });
      }
      setReviewSubmissions(nextItems);
    } catch {
      setReviewSubmissions([]);
    } finally {
      setQueueBusy(false);
    }
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadReviewSubmissions();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [apiBase, mode, userInfo?.email, userInfo?.role]); // eslint-disable-line react-hooks/exhaustive-deps

  function getFieldValue(fieldId: string): string {
    return fields[fieldId]?.value ?? "";
  }

  function setFieldIfExists(fieldId: string, value: string) {
    if (!fields[fieldId]) {
      return;
    }
    store.setFieldValue(fieldId, value);
  }

  function hydrateFieldsFromSourceMarkdown(sourceMarkdown: string | null | undefined) {
    if (!sourceMarkdown) {
      return;
    }

    const sections = parseSourceContext(sourceMarkdown);
    if (Object.keys(sections).length === 0) {
      return;
    }

    const fieldLookup = new Map<string, string>();
    for (const fieldId of fieldOrder) {
      const field = fields[fieldId];
      if (!field) {
        continue;
      }
      fieldLookup.set(field.label.trim().toLowerCase(), fieldId);
      fieldLookup.set(field.fieldId.trim().toLowerCase(), fieldId);
    }

    for (const [heading, value] of Object.entries(sections)) {
      const targetFieldId = fieldLookup.get(heading.trim().toLowerCase());
      if (!targetFieldId || !value) {
        continue;
      }
      setFieldIfExists(targetFieldId, value);
    }
  }

  function applyAuditSourceSections(sourceMarkdown: string | null | undefined) {
    const sections = parseSourceContext(sourceMarkdown || "");
    setFieldIfExists("clo_text", sections["course learning outcomes"] || sections["draft clos"] || sections["clos"] || "");
    setFieldIfExists("weekly_plan_text", sections["weekly plan"] || "");
    setFieldIfExists("assessment_text", sections["assessment rubric"] || "");
  }

  function restoreGenerateSubmission(submission: ReviewSubmission) {
    setActiveAuditSubmission(null);
    setActiveReviewLockId(null);
    reviewingRequestIdRef.current = submission.request_id;
    setReviewingRequestId(submission.request_id);
    setResumeBanner(null);
    setFeedbackStatus(null);
    setError(null);
    setFeedbackText(submission.qa_feedback || submission.teacher_note || "");
    hydrateFieldsFromSourceMarkdown(submission.source_markdown);
    if (submission.course_title) {
      setFieldIfExists("course_name", submission.course_title);
    }

    if (submission.content) {
      const restoredResult: BackendResult = {
        request_id: submission.request_id,
        status: submission.status || "draft",
        mode: "generate",
        content: submission.content,
        output_format: submission.output_format || "markdown",
      };
      setResult(restoredResult);
      setResultContent(submission.content);
    }
  }

  function restoreAuditSubmission(submission: ReviewSubmission) {
    setActiveAuditSubmission(submission);
    setActiveReviewLockId(submission.request_id);
    reviewingRequestIdRef.current = submission.request_id;
    setReviewingRequestId(submission.request_id);
    setResumeBanner(null);
    setResult(null);
    setResultContent("");
    setFeedbackStatus(null);
    setError(null);
    setFeedbackText(submission.qa_feedback || "");
    const sourceText = (submission.source_markdown || submission.content || "").trim();
    setFieldIfExists("source_text", sourceText);
    applyAuditSourceSections(sourceText);
    setFieldIfExists("review_notes", submission.teacher_note || submission.qa_feedback || "");
  }

  function clearWizardSession(clearResumeQuery: boolean) {
    setActiveAuditSubmission(null);
    setActiveReviewLockId(null);
    reviewingRequestIdRef.current = null;
    setReviewingRequestId(null);
    setResumeBanner(null);
    setResumeLoading(false);
    setResult(null);
    setResultContent("");
    setFeedbackText("");
    setFeedbackStatus(null);
    setError(null);
    setLastSubmitPayload(null);
    setUploadStatus(null);
    setUploadFileName("");
    setLeaveConfirmOpen(false);
    uploadFileRef.current = null;
    store.reset();

    if (clearResumeQuery && searchParams.get("resume")) {
      router.replace(pathname);
    }
  }

  async function claimAndOpenAuditSubmission(submission: ReviewSubmission) {
    const claimResponse = await fetch(`/api/review/submissions/${encodeURIComponent(submission.request_id)}/claim`, {
      method: "POST",
    });
    const claimPayload = await claimResponse.json().catch(() => null);
    if (!claimResponse.ok) {
      setError(claimPayload?.error || t("wizard.err_claimed"));
      await loadReviewSubmissions();
      return;
    }

    setActiveReviewLockId(submission.request_id);
    restoreAuditSubmission(submission);
    store.setCurrentStep(0);
    await loadReviewSubmissions();
  }

  async function openSubmission(submission: ReviewSubmission) {
    if (mode === "audit") {
      const previousLockId = activeReviewLockIdRef.current;
      if (previousLockId && previousLockId !== submission.request_id) {
        requestLeaveConfirmation(
          async () => {
            await releaseActiveLockAndReset();
            await claimAndOpenAuditSubmission(submission);
          },
          t("wizard.leave_switch"),
        );
        return;
      }

      await claimAndOpenAuditSubmission(submission);
      return;
    }

    restoreGenerateSubmission(submission);
    store.setCurrentStep(0);
  }

  function allSourceContext(): string {
    return fieldOrder.map((fieldId) => `## ${fields[fieldId]?.label ?? fieldId}\n${fields[fieldId]?.value ?? ""}`).join("\n\n");
  }

  function validateGenerateRequiredFields(): string[] {
    const missing: string[] = [];
    const courseCode = getFieldValue("course_code").trim();
    const courseName = getFieldValue("course_name").trim();
    const creditsRaw = getFieldValue("credits").trim();
    const weeksRaw = getFieldValue("weeks").trim();
    const credits = Number(creditsRaw);
    const weeks = Number(weeksRaw);

    if (!courseCode) missing.push("course_code");
    if (!courseName) missing.push("course_name");
    if (!creditsRaw || Number.isNaN(credits) || credits <= 0) missing.push("credits");
    if (!weeksRaw || Number.isNaN(weeks) || weeks <= 0) missing.push("weeks");

    return missing;
  }

  async function persistDraftToHistory(requestId: string, content: string, outputFormat: string) {
    if (mode !== "generate") {
      return;
    }
    await fetch(`${apiBase}/api/review/submissions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        request_id: requestId,
        content,
        output_format: outputFormat === "text" ? "text" : "markdown",
        source_markdown: allSourceContext(),
        course_title: getFieldValue("course_name") || null,
        teacher_email: userInfo?.email || null,
        teacher_name: userInfo?.fullName || null,
        status: "draft",
      }),
    }).catch(() => null);
  }

  function openResultPage(nextResult: BackendResult, contentOverride?: string) {
    const nextContent = contentOverride ?? nextResult.content;
    saveResultPayload(
      {
        mode,
        role: userInfo?.role,
        ownerEmail: userInfo?.email || null,
        requestId: nextResult.request_id,
        status: nextResult.status,
        content: nextContent,
        outputFormat: nextResult.output_format,
        sourceMarkdown: mode === "audit" ? (activeAuditSubmission?.source_markdown || getFieldValue("source_text")) : allSourceContext(),
        courseTitle:
          mode === "audit"
            ? (activeAuditSubmission?.course_title || t("untitled_syllabus"))
            : (getFieldValue("course_name") || t("untitled_syllabus")),
        reviewingRequestId: mode === "audit" ? reviewingRequestIdRef.current : null,
      },
      userInfo?.email || null,
    );
    void persistDraftToHistory(nextResult.request_id, nextContent, nextResult.output_format);
    router.push("/result");
  }

  function asLineList(value: unknown): string {
    if (!Array.isArray(value)) {
      return "";
    }
    const lines = value
      .map((item) => {
        if (typeof item === "string") {
          return item.trim();
        }
        if (isRecord(item)) {
          const topic = typeof item.topic === "string" ? item.topic : "";
          const component = typeof item.component === "string" ? item.component : "";
          const weight = typeof item.weight === "number" ? `${item.weight}%` : "";
          const combined = [topic, component, weight].filter(Boolean).join(" - ").trim();
          if (combined) {
            return combined;
          }
        }
        return "";
      })
      .filter(Boolean);
    return lines.length > 0 ? lines.map((line) => `- ${line}`).join("\n") : "";
  }

  async function prefillFieldsFromUpload(file: File) {
    const lowerName = file.name.toLowerCase();
    if (!(lowerName.endsWith(".json") || lowerName.endsWith(".txt") || lowerName.endsWith(".md"))) {
      return;
    }
    const text = await file.text();
    if (!text.trim()) {
      return;
    }

    if (mode === "audit") {
      setFieldIfExists("source_text", text.slice(0, 120000));
      return;
    }

    if (!lowerName.endsWith(".json")) {
      setFieldIfExists("constraints_text", text.slice(0, 3000));
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return;
    }
    if (!isRecord(parsed)) {
      return;
    }

    const course = isRecord(parsed.course)
      ? parsed.course
      : isRecord(parsed.course_metadata)
        ? parsed.course_metadata
        : null;

    if (course) {
      if (typeof course.course_code === "string") {
        setFieldIfExists("course_code", course.course_code);
      }
      if (typeof course.course_name === "string") {
        setFieldIfExists("course_name", course.course_name);
      }
      if (typeof course.credits === "number" || typeof course.credits === "string") {
        setFieldIfExists("credits", String(course.credits));
      }
      if (typeof course.weeks === "number" || typeof course.weeks === "string") {
        setFieldIfExists("weeks", String(course.weeks));
      }
    }

    const cloText = asLineList((parsed as Record<string, unknown>).clo ?? (parsed as Record<string, unknown>).course_learning_outcomes);
    if (cloText) {
      setFieldIfExists("clo_text", cloText);
    }

    const weeklyText = asLineList((parsed as Record<string, unknown>).weekly_plan ?? (parsed as Record<string, unknown>).weekly_schedule);
    if (weeklyText) {
      setFieldIfExists("weekly_plan_text", weeklyText);
    }

    const assessmentText = asLineList(
      (parsed as Record<string, unknown>).assessment_rubric ?? (parsed as Record<string, unknown>).assessment_methods,
    );
    if (assessmentText) {
      setFieldIfExists("assessment_text", assessmentText);
    }

    if (Array.isArray((parsed as Record<string, unknown>).constraints)) {
      const constraints = ((parsed as Record<string, unknown>).constraints as unknown[])
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 30)
        .map((item) => `- ${item}`)
        .join("\n");
      if (constraints) {
        setFieldIfExists("constraints_text", constraints);
      }
    }
  }

  function toBackendResult(parsed: Record<string, unknown>): BackendResult {
    return {
      request_id: String(parsed.request_id || ""),
      status: String(parsed.status || "success"),
      mode: String(parsed.mode || mode),
      content: String(parsed.content || ""),
      output_format: String(parsed.output_format || "markdown"),
      metadata: isRecord(parsed.metadata)
        ? {
          model: typeof parsed.metadata.model === "string" ? parsed.metadata.model : undefined,
          model_provider: typeof parsed.metadata.model_provider === "string" ? parsed.metadata.model_provider : undefined,
          generated_at: typeof parsed.metadata.generated_at === "string" ? parsed.metadata.generated_at : undefined,
          latency_ms: typeof parsed.metadata.latency_ms === "number" ? parsed.metadata.latency_ms : undefined,
          fallback_route: typeof parsed.metadata.fallback_route === "string" ? parsed.metadata.fallback_route : undefined,
        }
        : undefined,
      fallback_reason: typeof parsed.fallback_reason === "string" ? parsed.fallback_reason : null,
    };
  }

  async function uploadAndRunSource() {
    const file = uploadFileRef.current;
    if (!file) {
      setError(t("wizard.err_no_file"));
      return;
    }
    setUploadBusy(true);
    setError(null);
    setUploadStatus(null);
    try {
      await prefillFieldsFromUpload(file);

      const requestId = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
      const formData = new FormData();
      formData.append("file", file);
      formData.append("language", preferredLanguage);
      formData.append("request_id", requestId);
      formData.append("output_format", "markdown");
      formData.append("model_provider", "auto");
      formData.append("model_name", "");
      if (mode === "generate") {
        formData.append("mode", "full");
        formData.append("constraints", getFieldValue("constraints_text"));
      } else {
        formData.append("focus", getFieldValue("focus_text"));
      }

      const endpoint = mode === "generate" ? "/api/generate/upload" : "/api/audit/upload";
      const response = await fetch(`${apiBase}${endpoint}`, {
        method: "POST",
        body: formData,
      });
      const parsed = await parseJsonResponse(response);
      if (!response.ok) {
        throw new Error(extractMessage(parsed, response.status));
      }
      if (!isRecord(parsed)) {
        throw new Error(t("wizard.err_invalid_shape"));
      }

      const nextResult = toBackendResult(parsed);
      setLastSubmitPayload(null);
      setResult(nextResult);
      setResultContent(nextResult.content);
      openResultPage(nextResult);
      setUploadStatus(
        t("wizard.upload_ok", {
          file: file.name,
          mode: t(mode === "generate" ? "wizard.upload_mode_gen" : "wizard.upload_mode_audit"),
        }),
      );
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : String(uploadError));
    } finally {
      setUploadBusy(false);
    }
  }

  async function regenerateField(fieldId: string) {
    const field = fields[fieldId];
    if (!field) {
      return;
    }
    store.pushUndoBaseline(fieldId);
    store.pushSnapshot(currentStepDef.id);
    store.setPending(fieldId, true);
    setError(null);

    const neighborFields = currentFields
      .filter((item) => item.fieldId !== fieldId)
      .map((item) => ({
        field_id: item.fieldId,
        step_id: item.stepId,
        label: item.label,
        value: item.value,
      }));

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(`${apiBase}/api/wizard/regenerate-field`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          wizard_id: wizardId,
          mode,
          step_id: currentStepDef.id,
          field_id: fieldId,
          current_text: field.value,
          field_context: allSourceContext(),
          neighbor_fields: neighborFields,
          constraints: splitLines(getFieldValue("constraints_text") || getFieldValue("focus_text")),
          language: preferredLanguage,
        }),
      });
      const payload = await parseJsonResponse(response);
      if (!response.ok) {
        throw new Error(extractMessage(payload, response.status));
      }
      if (!isRecord(payload)) {
        throw new Error(t("wizard.err_invalid_shape"));
      }
      const newText = typeof payload.new_text === "string" ? payload.new_text : field.value;
      store.setFieldValue(fieldId, newText);

    } catch (regenError) {
      if (regenError instanceof DOMException && regenError.name === "AbortError") {
        setError(t("wizard.err_regen_timeout", { field: fieldId }));
      } else {
        setError(regenError instanceof Error ? regenError.message : String(regenError));
      }
    } finally {
      window.clearTimeout(timeout);
      store.setPending(fieldId, false);
    }
  }

  function buildGeneratePayload(): Record<string, unknown> {
    const cloLines = splitLines(getFieldValue("clo_text"));
    const constraints = splitLines(getFieldValue("constraints_text"));
    const courseCode = getFieldValue("course_code").trim();
    const courseName = getFieldValue("course_name").trim();
    const credits = Number(getFieldValue("credits").trim());
    const weeks = Number(getFieldValue("weeks").trim());
    return {
      request_id: reviewingRequestIdRef.current || crypto.randomUUID().replace(/-/g, "").slice(0, 16),
      mode: "full",
      language: preferredLanguage,
      source_format: "manual",
      source_markdown: allSourceContext(),
      output_format: "markdown",
      model_provider: "auto",
      model_name: "",
      course: {
        course_code: courseCode,
        course_name: courseName,
        credits,
        class_hours_per_week: 3,
        weeks,
        prerequisites: [],
        program_outcomes: cloLines.length > 0 ? cloLines : ["Apply computing fundamentals to solve course problems."],
        brief: getFieldValue("constraints_text") || "Generated with wizard shell.",
      },
      constraints,
      metadata: {
        wizard: {
          id: wizardId,
          mode,
          overrides,
        },
      },
    };
  }

  function buildAuditPayload(): Record<string, unknown> {
    const sourceText = getFieldValue("source_text") || allSourceContext();
    return {
      request_id: reviewingRequestIdRef.current || crypto.randomUUID().replace(/-/g, "").slice(0, 16),
      language: preferredLanguage,
      source_format: "md",
      source_text: sourceText,
      source_markdown: sourceText,
      output_format: "markdown",
      model_provider: "auto",
      model_name: "",
      source_payload: {
        course: {
          course_code: getFieldValue("course_code") || "CS0000",
          course_name: getFieldValue("course_name") || "Untitled Course",
          credits: Number(getFieldValue("credits") || "3"),
          weeks: Number(getFieldValue("weeks") || "15"),
        },
        clo: splitLines(getFieldValue("clo_text")),
        weekly_plan: splitLines(getFieldValue("weekly_plan_text")),
        assessment_rubric: splitLines(getFieldValue("assessment_text")),
      },
      focus: splitLines(getFieldValue("focus_text")),
      metadata: {
        wizard: {
          id: wizardId,
          mode,
          overrides,
        },
      },
    };
  }

  async function submitMainFlow() {
    setBusySubmit(true);
    setError(null);
    setFeedbackStatus(null);
    try {
      if (mode === "generate") {
        const missingFields = validateGenerateRequiredFields();
        if (missingFields.length > 0) {
          const labels = missingFields.map((id) => t(`wizard.validation.${id}`)).join(", ");
          throw new Error(t("wizard.err_missing_fields", { fields: labels }));
        }
      }
      if (mode === "audit" && !reviewingRequestIdRef.current && !reviewingRequestId) {
        throw new Error(t("wizard.err_open_audit_first"));
      }
      const endpoint = mode === "generate" ? "/api/generate" : "/api/audit";
      const payload = mode === "generate" ? buildGeneratePayload() : buildAuditPayload();
      setLastSubmitPayload(payload);
      const response = await fetch(`${apiBase}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const parsed = await parseJsonResponse(response);
      if (!response.ok) {
        throw new Error(extractMessage(parsed, response.status));
      }
      if (!isRecord(parsed)) {
        throw new Error(t("wizard.err_invalid_shape"));
      }
      const nextResult: BackendResult = {
        request_id: String(parsed.request_id || ""),
        status: String(parsed.status || "success"),
        mode: String(parsed.mode || mode),
        content: String(parsed.content || ""),
        output_format: String(parsed.output_format || "markdown"),
        metadata: isRecord(parsed.metadata)
          ? {
            model: typeof parsed.metadata.model === "string" ? parsed.metadata.model : undefined,
            model_provider:
              typeof parsed.metadata.model_provider === "string" ? parsed.metadata.model_provider : undefined,
            generated_at: typeof parsed.metadata.generated_at === "string" ? parsed.metadata.generated_at : undefined,
            latency_ms: typeof parsed.metadata.latency_ms === "number" ? parsed.metadata.latency_ms : undefined,
            fallback_route:
              typeof parsed.metadata.fallback_route === "string" ? parsed.metadata.fallback_route : undefined,
          }
          : undefined,
        fallback_reason: typeof parsed.fallback_reason === "string" ? parsed.fallback_reason : null,
      };
      setResult(nextResult);
      setResultContent(nextResult.content);
      openResultPage(nextResult);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : String(submitError));
    } finally {
      setBusySubmit(false);
    }
  }

  async function submitFeedback(recordOnly: boolean, feedbackOverride?: string) {
    const effectiveFeedback = (feedbackOverride ?? feedbackText).trim();
    if (!result || !effectiveFeedback) {
      setError(t("wizard.err_feedback_after"));
      return;
    }
    setError(null);
    setFeedbackStatus(null);
    try {
      const requestBody = {
        request_id: result.request_id,
        mode,
        feedback_type: feedbackType,
        output_format: "markdown",
        feedback_text: effectiveFeedback,
        original_content: result.content,
        edited_content: resultContent !== result.content ? resultContent : null,
        source_markdown: mode === "audit" ? getFieldValue("source_text") : allSourceContext(),
        metadata: {
          ui: "wizard-shell",
          overrides,
          submit_payload: lastSubmitPayload,
        },
      };
      const endpoint = recordOnly ? "/api/feedback" : "/api/hitl/revise";
      const body = recordOnly
        ? requestBody
        : {
          ...requestBody,
          language: preferredLanguage,
          request_payload: lastSubmitPayload,
        };

      const response = await fetch(`${apiBase}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await parseJsonResponse(response);
      if (!response.ok) {
        throw new Error(extractMessage(payload, response.status));
      }

      if (recordOnly) {
        if (!isRecord(payload)) {
          throw new Error(t("wizard.err_invalid_shape"));
        }
        setFeedbackStatus(t("wizard.feedback_saved", { id: String(payload.feedback_id || "ok") }));
      } else {
        if (!isRecord(payload)) {
          throw new Error(t("wizard.err_invalid_shape"));
        }
        setFeedbackStatus(t("wizard.hitl_done", { id: String(payload.request_id || "ok") }));
        const revisedResult = {
          request_id: String(payload.request_id || result.request_id),
          status: String(payload.status || "success"),
          mode: String(payload.mode || mode),
          content: String(payload.content || result.content),
          output_format: String(payload.output_format || result.output_format),
          metadata: isRecord(payload.metadata)
            ? {
              model: typeof payload.metadata.model === "string" ? payload.metadata.model : undefined,
              model_provider:
                typeof payload.metadata.model_provider === "string" ? payload.metadata.model_provider : undefined,
              generated_at: typeof payload.metadata.generated_at === "string" ? payload.metadata.generated_at : undefined,
              latency_ms: typeof payload.metadata.latency_ms === "number" ? payload.metadata.latency_ms : undefined,
              fallback_route:
                typeof payload.metadata.fallback_route === "string" ? payload.metadata.fallback_route : undefined,
            }
            : undefined,
          fallback_reason: typeof payload.fallback_reason === "string" ? payload.fallback_reason : null,
        };
        setResult(revisedResult);
        setResultContent(revisedResult.content);
      }
    } catch (feedbackError) {
      setError(feedbackError instanceof Error ? feedbackError.message : String(feedbackError));
    }
  }

  async function submitDraftToQa() {
    if (!result || !resultContent.trim()) {
      setError(t("wizard.err_no_syllabus_qa"));
      return;
    }
    setFeedbackStatus(null);
    setError(null);
    try {
      const response = await fetch(`${apiBase}/api/review/submissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          request_id: result.request_id,
          content: resultContent,
          output_format: result.output_format === "text" ? "text" : "markdown",
          source_markdown: allSourceContext(),
          note: feedbackText.trim() || null,
          course_title: getFieldValue("course_name") || null,
          teacher_email: userInfo?.email || null,
          teacher_name: userInfo?.fullName || null,
        }),
      });
      const payload = await parseJsonResponse(response);
      if (!response.ok) {
        throw new Error(extractMessage(payload, response.status));
      }
      setFeedbackStatus(t("wizard.status_sent_qa"));
      await loadReviewSubmissions();
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : String(submissionError));
    }
  }

  async function sendReviewDecision() {
    const requestId = reviewingRequestIdRef.current || reviewingRequestId || result?.request_id;
    if (!requestId || !resultContent.trim()) {
      setError(t("wizard.err_open_audit"));
      return;
    }
    if (!feedbackText.trim()) {
      setError(t("wizard.err_write_feedback"));
      return;
    }
    setFeedbackStatus(null);
    setError(null);
    try {
      const response = await fetch(`${apiBase}/api/review/submissions/${encodeURIComponent(requestId)}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          verdict: feedbackType,
          target_request_id: reviewingRequestIdRef.current || reviewingRequestId || null,
          feedback_text: feedbackText.trim(),
          reviewed_content: resultContent,
          output_format: result?.output_format === "text" ? "text" : "markdown",
          reviewer_email: userInfo?.email || null,
        }),
      });
      const payload = await parseJsonResponse(response);
      if (!response.ok) {
        throw new Error(extractMessage(payload, response.status));
      }
      setFeedbackStatus(t("wizard.status_decision_sent"));
      setActiveReviewLockId(null);
      await loadReviewSubmissions();
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : String(reviewError));
    }
  }

  const hasCurrentStepSnapshot = snapshots.some((snapshot) => snapshot.stepId === currentStepDef.id);
  return (
    <div className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="rounded-[1.7rem] border border-teal-200 bg-teal-50/90 px-4 py-3 text-sm text-teal-950 shadow-[0_14px_40px_rgba(15,23,42,0.06)]">
          <div className="font-semibold">
            {mode === "generate" ? t("wizard.banner.create_title") : t("wizard.banner.review_title")}
          </div>
          <p className="mt-1 text-xs text-teal-900">
            {mode === "generate" ? t("wizard.banner.create_body") : t("wizard.banner.review_body")}
          </p>
        </section>

        {mode === "audit" && activeReviewLockId ? (
          <section className="rounded-2xl border border-fuchsia-200 bg-fuchsia-50 px-4 py-3 text-sm text-fuchsia-900">
            <div className="font-semibold">{t("wizard.lock_title")}</div>
            <p className="mt-1 text-xs text-fuchsia-800">{t("wizard.lock_body")}</p>
          </section>
        ) : null}

        {resumeLoading && (
          <section className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
            <div className="flex items-center gap-2">
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-blue-300 border-t-blue-700" />
              {t("wizard.resume_loading")}
            </div>
          </section>
        )}

        {resumeBanner && (
          <section className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-sm font-semibold text-amber-900">
                  {t("wizard.resume_title", { title: resumeBanner.courseTitle })}
                </div>
                <p className="mt-1 text-xs text-amber-800">{t("wizard.resume_hint")}</p>
              </div>
              <button
                type="button"
                className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100"
                onClick={() => setResumeBanner(null)}
              >
                {t("common.dismiss")}
              </button>
            </div>
            <div className="mt-2 rounded-lg border border-amber-200 bg-white px-3 py-2">
              <p className="text-xs font-semibold text-amber-800">{t("wizard.qa_feedback_label")}</p>
              <p className="mt-0.5 text-sm text-amber-900">{resumeBanner.feedback}</p>
            </div>
          </section>
        )}

        {autosaveCandidate ? (
          <RecoveryBanner
            savedAt={new Date(autosaveCandidate.savedAt).toLocaleString(preferredLanguage === "vi" ? "vi-VN" : "en-US")}
            onRestore={() => {
              store.hydrateDraft({
                currentStep: autosaveCandidate.currentStep,
                fields: autosaveCandidate.fields,
                overrides: autosaveCandidate.overrides,
                snapshots: autosaveCandidate.snapshots,
              });
              setAutosaveCandidate(null);
            }}
            onDismiss={() => setAutosaveCandidate(null)}
          />
        ) : null}

        <section className="rounded-[1.7rem] border border-white/70 bg-white/92 px-4 py-4 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-sm font-semibold text-slate-900">
                {mode === "audit" ? t("wizard.queue_audit_title") : t("wizard.queue_gen_title")}
              </div>
              <p className="text-xs text-slate-500">
                {mode === "audit" ? t("wizard.queue_audit_hint") : t("wizard.queue_gen_hint")}
              </p>
            </div>
            <button
              type="button"
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              onClick={() => void loadReviewSubmissions()}
              disabled={queueBusy}
            >
              {queueBusy ? t("wizard.queue_refreshing") : t("common.refresh")}
            </button>
          </div>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {reviewSubmissions.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-500">
                {mode === "audit" ? t("wizard.queue_empty_audit") : t("wizard.queue_empty_gen")}
              </div>
            ) : (
              reviewSubmissions.slice(0, 6).map((submission) => (
                <button
                  key={submission.request_id}
                  type="button"
                  className={`rounded-[1.35rem] border px-4 py-4 text-left text-sm transition-colors ${
                    activeAuditSubmission?.request_id === submission.request_id || reviewingRequestId === submission.request_id
                      ? "border-teal-300 bg-teal-50"
                      : "border-slate-200 bg-slate-50 hover:border-teal-400 hover:bg-teal-50"
                  }`}
                  onClick={() => void openSubmission(submission)}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <span className="block font-semibold text-slate-900">
                        {submission.course_title || t("untitled_syllabus")}
                      </span>
                      {mode === "audit" ? (
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                          {submission.course_code ? (
                            <span>
                              {t("wizard.course_code_lbl")} {submission.course_code}
                            </span>
                          ) : null}
                          {submission.teacher_email ? (
                            <span>
                              {t("wizard.author_lbl")} {submission.teacher_name || submission.teacher_email}
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${submissionStatusClass(submission.status)}`}>
                      {formatSubmissionStatus(submission.status, t)}
                    </span>
                  </div>
                  {submission.qa_feedback || submission.teacher_note ? (
                    <div className="mt-2 max-h-16 overflow-hidden text-xs leading-5 text-slate-600">
                      {submission.qa_feedback || submission.teacher_note}
                    </div>
                  ) : null}
                  {mode === "audit" && submission.review_started_at ? (
                    <div className="mt-2 text-[11px] text-slate-400">
                      {t("wizard.started", {
                        time: new Date(submission.review_started_at).toLocaleString(
                          preferredLanguage === "vi" ? "vi-VN" : "en-US",
                        ),
                      })}
                    </div>
                  ) : null}
                </button>
              ))
            )}
          </div>
        </section>

        <header className="rounded-[1.85rem] border border-white/70 bg-white/92 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{roleLabel}</div>
              <h1 className="mt-1 text-2xl font-semibold text-slate-950">{displayConfig.title}</h1>
              <p className="mt-1 text-sm text-slate-600">{displayConfig.subtitle}</p>
            </div>
            <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between xl:w-auto">
              {userInfo?.role === "Admin" ? (
                <div className="flex rounded-xl border border-slate-300 bg-white p-1">
                  <a
                    href="/generator"
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                      mode === "generate" ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {t("wizard.admin_generate")}
                  </a>
                  <a
                    href="/auditor"
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                      mode === "audit" ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {t("wizard.admin_auditor")}
                  </a>
                </div>
              ) : null}
              {userInfo ? (
                <div className="min-w-0 text-left sm:text-right">
                  <div className="text-sm font-semibold text-slate-900">{userInfo.fullName}</div>
                  <div className="text-xs text-slate-500">{userInfo.email}</div>
                </div>
              ) : null}
              <button
                type="button"
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-transform hover:bg-slate-50 active:scale-[0.98]"
                onClick={() => {
                  if (mode === "audit" && activeReviewLockIdRef.current) {
                    requestLeaveConfirmation(
                      async () => {
                        await releaseActiveLockAndReset();
                        clearWizardSession(true);
                      },
                      t("wizard.leave_reset"),
                    );
                    return;
                  }
                  clearWizardSession(true);
                }}
              >
                {t("wizard.reset")}
              </button>
            </div>
          </div>
          <div className="mt-4 overflow-x-auto pb-1">
            <div className="flex min-w-max items-center gap-2">
              {stepDefs.map((step, index) => (
                <button
                  type="button"
                  key={step.id}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${currentStep === index ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-600"
                    }`}
                  onClick={() => store.setCurrentStep(index)}
                >
                  {index + 1}. {step.title}
                </button>
              ))}
            </div>
          </div>
        </header>

        <div className="grid items-start gap-5">
          <section
            className="min-w-0 space-y-4 rounded-[1.85rem] border border-white/70 bg-white/92 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)]"
          >
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{currentStepDef.title}</h2>
                <p className="text-sm text-slate-600">{currentStepDef.description}</p>
              </div>
            </div>

            {mode === "generate" ? (
              <div className="rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3">
                <div className="text-sm font-semibold text-indigo-950">{t("wizard.source_upload_title")}</div>
                <p className="mt-1 text-xs text-indigo-900">{t("wizard.source_upload_body")}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <input
                    type="file"
                    accept=".pdf,.json,.txt,.md"
                    className="max-w-full rounded-lg border border-indigo-300 bg-white px-2 py-1 text-xs text-indigo-900"
                    onChange={(event) => {
                      const file = event.target.files?.[0] ?? null;
                      uploadFileRef.current = file;
                      setUploadFileName(file?.name ?? "");
                      setUploadStatus(null);
                    }}
                  />
                  <button
                    type="button"
                    className="rounded-lg border border-indigo-300 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-900 hover:bg-indigo-100 disabled:opacity-50"
                    onClick={() => void uploadAndRunSource()}
                    disabled={uploadBusy || !uploadFileName}
                  >
                    {uploadBusy ? t("wizard.uploading") : t("wizard.upload_btn")}
                  </button>
                </div>
                {uploadFileName ? (
                  <p className="mt-2 text-xs text-indigo-900">{t("wizard.selected_file", { name: uploadFileName })}</p>
                ) : null}
                {uploadStatus ? <p className="mt-2 text-xs text-emerald-700">{uploadStatus}</p> : null}
              </div>
            ) : null}

            {mode === "audit" && currentStepDef.id === "source" ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3">
                  <div className="text-sm font-semibold text-indigo-950">{t("wizard.audit_source_title")}</div>
                  <p className="mt-1 text-xs text-indigo-900">{t("wizard.audit_source_body")}</p>
                </div>

                {activeAuditSubmission ? (
                  <>
                    <div className="grid gap-3 md:grid-cols-3">
                      <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">
                          {t("wizard.author_card")}
                        </div>
                        <div className="mt-1 text-sm font-semibold text-stone-950">
                          {activeAuditSubmission.teacher_name || activeAuditSubmission.teacher_email || t("common.unknown")}
                        </div>
                        {activeAuditSubmission.teacher_email ? (
                          <div className="mt-1 break-all text-xs text-stone-500">{activeAuditSubmission.teacher_email}</div>
                        ) : null}
                      </div>
                      <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">
                          {t("wizard.course_code_card")}
                        </div>
                        <div className="mt-1 text-sm font-semibold text-stone-950">
                          {activeAuditSubmission.course_code || t("common.na")}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">
                          {t("wizard.course_name_card")}
                        </div>
                        <div className="mt-1 text-sm font-semibold text-stone-950">
                          {activeAuditSubmission.course_title || t("untitled_syllabus")}
                        </div>
                      </div>
                    </div>

                    {activeAuditSubmission.teacher_note ? (
                      <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3">
                        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-800">
                          {t("wizard.extra_notes_qa")}
                        </div>
                        <div className="mt-1 text-sm leading-6 text-sky-950">{activeAuditSubmission.teacher_note}</div>
                      </div>
                    ) : null}

                    <div className="rounded-[1.5rem] border border-stone-200 bg-white p-4">
                      <div
                        className="markdown-preview min-h-[30rem] rounded-[1.2rem] border border-stone-200 bg-stone-50 px-4 py-4 text-[15px] shadow-inner"
                        dangerouslySetInnerHTML={{
                          __html: renderPreviewHtml(getFieldValue("source_text") || t("wizard.no_source_md"), "markdown"),
                        }}
                      />
                    </div>
                  </>
                ) : (
                  <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 px-4 py-10 text-center text-sm text-stone-500">
                    {t("wizard.select_submission")}
                  </div>
                )}
              </div>
            ) : (
              <StepRenderer
                fields={currentFields}
                minimalFieldUi={currentStepDef.id === "course"}
                onChangeField={(fieldId, value) => store.setFieldValue(fieldId, value)}
                onRegenerateField={(fieldId) => void regenerateField(fieldId)}
                onMoveFieldFocus={(fieldId, direction) => {
                  const activeFieldIds = currentFields.map((item) => item.fieldId);
                  const index = activeFieldIds.indexOf(fieldId);
                  if (index < 0) {
                    return;
                  }
                  const nextIndex = index + direction;
                  if (nextIndex < 0 || nextIndex >= activeFieldIds.length) {
                    return;
                  }
                  const nextFieldId = activeFieldIds[nextIndex];
                  const nextElement = document.querySelector(
                    `[data-wizard-input="${nextFieldId}"]`,
                  ) as HTMLInputElement | HTMLTextAreaElement | null;
                  nextElement?.focus();
                  nextElement?.select();
                }}
              />
            )}

            <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 pt-3">
              <button
                type="button"
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-transform hover:bg-slate-50 active:scale-[0.98] disabled:opacity-40"
                disabled={currentStep === 0}
                onClick={() => store.setCurrentStep(Math.max(0, currentStep - 1))}
              >
                {t("common.back")}
              </button>
              <button
                type="button"
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-transform hover:bg-slate-50 active:scale-[0.98] disabled:opacity-40"
                disabled={currentStep >= stepDefs.length - 1}
                onClick={() => store.setCurrentStep(Math.min(stepDefs.length - 1, currentStep + 1))}
              >
                {t("common.next")}
              </button>
              <button
                type="button"
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-transform hover:bg-slate-50 active:scale-[0.98] disabled:opacity-40"
                disabled={!hasCurrentStepSnapshot}
                onClick={() => {
                  store.restoreLatestSnapshotForStep(currentStepDef.id);
                }}
                title={t("wizard.restore_title")}
              >
                {t("wizard.restore_snapshot")}
              </button>
              <button
                type="button"
                className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow transition-transform hover:bg-slate-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-slate-400"
                disabled={busySubmit}
                onClick={() => void submitMainFlow()}
              >
                {busySubmit ? t("common.working") : displayConfig.submitLabel}
              </button>
            </div>

            {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div> : null}
          </section>

          {result ? (
            <section className="min-w-0 space-y-4 rounded-[1.85rem] border border-teal-200 bg-teal-50 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold text-teal-950">
                    {mode === "generate" ? t("wizard.result_generated") : t("wizard.result_qa")}
                  </div>
                  <div className="text-xs text-teal-800">
                    {result.metadata?.model_provider ?? "auto"} / {result.metadata?.model ?? "n/a"}
                  </div>
                </div>
                {result.fallback_reason ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-800">
                    {t("wizard.fallback")} {result.fallback_reason}
                  </div>
                ) : null}
              </div>

              <textarea
                className="min-h-[28rem] w-full rounded-2xl border border-teal-300 bg-white px-4 py-3 font-mono text-sm leading-6 text-slate-900 outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-700/20"
                value={resultContent}
                onChange={(event) => setResultContent(event.target.value)}
              />

              <div className="rounded-2xl border border-teal-300 bg-white/80 p-4">
                <div className="text-sm font-semibold text-slate-900">
                  {mode === "generate" ? t("wizard.submit_qa_section") : t("wizard.send_decision_section")}
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-[14rem_1fr]">
                  {mode === "audit" ? (
                    <select
                      className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm text-slate-800"
                      value={feedbackType}
                      onChange={(event) => setFeedbackType(event.target.value as FeedbackType)}
                    >
                      <option value="approve">{t("wizard.verdict_pass")}</option>
                      <option value="needs_revision">{t("wizard.verdict_needs")}</option>
                      <option value="reject">{t("wizard.verdict_fail")}</option>
                    </select>
                  ) : (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-600">
                      {t("wizard.extra_notes_static")}
                    </div>
                  )}
                  <textarea
                    className="min-h-[7rem] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
                    placeholder={mode === "generate" ? t("wizard.ph_notes_gen") : t("wizard.ph_notes_audit")}
                    value={feedbackText}
                    onChange={(event) => setFeedbackText(event.target.value)}
                  />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
                    onClick={() => void (mode === "generate" ? submitDraftToQa() : sendReviewDecision())}
                    disabled={!result}
                  >
                    {mode === "generate" ? t("wizard.send_qa") : t("wizard.send_decision")}
                  </button>
                  {mode === "audit" ? (
                    <button
                      type="button"
                      className="rounded-lg border border-teal-700 bg-white px-4 py-2 text-sm font-semibold text-teal-800 hover:bg-teal-100"
                      onClick={() => void submitFeedback(false, feedbackText || t("wizard.improve_default"))}
                      disabled={!result}
                    >
                      {t("wizard.improve_direct")}
                    </button>
                  ) : null}
                </div>
                {feedbackStatus ? <div className="mt-2 text-sm text-emerald-700">{feedbackStatus}</div> : null}
              </div>
            </section>
          ) : null}
        </div>
      </div>

      {leaveConfirmOpen ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/45 px-4">
          <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-5 shadow-2xl">
            <h3 className="text-base font-semibold text-stone-950">{t("wizard.leave_title")}</h3>
            <p className="mt-2 text-sm leading-6 text-stone-600">{leaveConfirmText || t("wizard.leave_default")}</p>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="rounded-xl border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50"
                onClick={cancelLeave}
              >
                {t("wizard.stay")}
              </button>
              <button
                type="button"
                className="rounded-xl bg-stone-900 px-4 py-2 text-sm font-semibold text-white hover:bg-stone-800"
                onClick={() => void confirmLeave()}
              >
                {t("wizard.leave_review")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
