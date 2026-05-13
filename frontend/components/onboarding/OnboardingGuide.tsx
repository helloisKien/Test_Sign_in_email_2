"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { useAuthMe } from "@/lib/client-auth";
import { useI18n } from "@/lib/i18n/I18nProvider";
import {
  ONBOARDING_GUIDE_OPEN_EVENT,
  ONBOARDING_GUIDE_STORAGE_KEY,
  WIZARD_RESULT_READY_EVENT,
} from "@/lib/onboarding-guide";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

type GuideStep = {
  id: string;
  titleKey: string;
  bodyKey: string;
  selector?: string;
  mobileSelector?: string;
  route?: string;
  requireWorkspaceClick?: boolean;
};

type HighlightRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

type WorkspaceRoute = "/generator" | "/auditor";
type WorkspaceMode = "generate" | "audit";

const WORKSPACE_ROUTES: WorkspaceRoute[] = ["/generator", "/auditor"];

const SHARED_STEPS: GuideStep[] = [
  {
    id: "welcome",
    titleKey: "guide.welcome_title",
    bodyKey: "guide.welcome_body",
  },
  {
    id: "navbar",
    titleKey: "guide.nav_title",
    bodyKey: "guide.nav_body",
    selector: "[data-guide='main-navbar-links']",
    mobileSelector: "[data-guide='mobile-nav-menu']",
  },
  {
    id: "workspace-select",
    titleKey: "guide.workspace_title",
    bodyKey: "guide.workspace_body",
    selector: "[data-guide='workspace-link']",
    mobileSelector: "[data-guide='mobile-nav-menu']",
    requireWorkspaceClick: true,
  },
];

const SHARED_TAIL_STEPS: GuideStep[] = [
  {
    id: "result",
    titleKey: "guide.result_title",
    bodyKey: "guide.result_body",
    route: "/result",
    selector: "[data-guide='result-page']",
  },
  {
    id: "history",
    titleKey: "guide.history_title",
    bodyKey: "guide.history_body",
    route: "/history",
    selector: undefined,
  },
  {
    id: "account",
    titleKey: "guide.account_title",
    bodyKey: "guide.account_body",
    route: "/user",
    selector: "[data-guide='user-editable']",
  },
  {
    id: "finish",
    titleKey: "guide.finish_title",
    bodyKey: "guide.finish_body",
  },
];

const GENERATE_WORKSPACE_STEPS: GuideStep[] = [
  {
    id: "workspace-order",
    titleKey: "guide.order_title",
    bodyKey: "guide.order_body",
    route: "/generator",
    selector: "[data-guide='wizard-step-order']",
  },
  {
    id: "generate-queue",
    titleKey: "guide.generate_queue_title",
    bodyKey: "guide.generate_queue_body",
    route: "/generator",
    selector: "[data-guide='wizard-queue']",
  },
  {
    id: "generate-fields",
    titleKey: "guide.generate_fields_title",
    bodyKey: "guide.generate_fields_body",
    route: "/generator",
    selector: "[data-guide='wizard-fields']",
  },
  {
    id: "generate-submit",
    titleKey: "guide.generate_submit_title",
    bodyKey: "guide.generate_submit_body",
    route: "/generator",
    selector: "[data-guide='wizard-submit-main']",
  },
];

const AUDIT_WORKSPACE_STEPS: GuideStep[] = [
  {
    id: "workspace-order",
    titleKey: "guide.order_title",
    bodyKey: "guide.order_body",
    route: "/auditor",
    selector: "[data-guide='wizard-step-order']",
  },
  {
    id: "audit-queue",
    titleKey: "guide.audit_queue_title",
    bodyKey: "guide.audit_queue_body",
    route: "/auditor",
    selector: "[data-guide='wizard-queue']",
  },
  {
    id: "audit-fields",
    titleKey: "guide.audit_fields_title",
    bodyKey: "guide.audit_fields_body",
    route: "/auditor",
    selector: "[data-guide='wizard-fields']",
  },
  {
    id: "audit-submit",
    titleKey: "guide.audit_submit_title",
    bodyKey: "guide.audit_submit_body",
    route: "/auditor",
    selector: "[data-guide='wizard-submit-main']",
  },
];

function readGuideCompleteFlag(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return window.localStorage.getItem(ONBOARDING_GUIDE_STORAGE_KEY) === "1";
}

function roleDefaultWorkspaceMode(role: string | undefined): WorkspaceMode {
  return role === "QA" ? "audit" : "generate";
}

function workspaceModeFromPath(pathname: string): WorkspaceMode | null {
  if (pathname === "/auditor") {
    return "audit";
  }
  if (pathname === "/generator") {
    return "generate";
  }
  return null;
}

function isMobileViewport(): boolean {
  return window.matchMedia("(max-width: 1023px)").matches;
}

function resolveStepSelector(step: GuideStep): string | undefined {
  if (isMobileViewport()) {
    return step.mobileSelector || step.selector;
  }
  return step.selector;
}

function ensureMobileMenuOpenForGuide(step: GuideStep): void {
  if (!isMobileViewport()) {
    return;
  }
  if (step.id !== "navbar" && step.id !== "workspace-select") {
    return;
  }
  const menu = document.querySelector("[data-guide='mobile-nav-menu']");
  if (menu) {
    return;
  }
  const toggle = document.querySelector("[data-guide='mobile-menu-toggle']") as HTMLButtonElement | null;
  if (toggle?.getAttribute("aria-expanded") !== "true") {
    toggle?.click();
  }
}

export function OnboardingGuide() {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading } = useAuthMe();

  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [highlightRect, setHighlightRect] = useState<HighlightRect | null>(null);
  const [confirmSkipOpen, setConfirmSkipOpen] = useState(false);
  const [wizardResultReady, setWizardResultReady] = useState(false);

  const selectedWorkspaceMode = useMemo(
    () => workspaceModeFromPath(pathname) || roleDefaultWorkspaceMode(user?.role),
    [pathname, user?.role],
  );

  const guideSteps = useMemo(() => {
    const workspaceSteps = selectedWorkspaceMode === "audit" ? AUDIT_WORKSPACE_STEPS : GENERATE_WORKSPACE_STEPS;
    return [...SHARED_STEPS, ...workspaceSteps, ...SHARED_TAIL_STEPS];
  }, [selectedWorkspaceMode]);

  const clampedStepIndex = Math.min(stepIndex, guideSteps.length - 1);
  const activeStep = guideSteps[clampedStepIndex];

  const workspacePicked = useMemo(
    () => WORKSPACE_ROUTES.some((route) => pathname === route),
    [pathname],
  );

  const waitingForWorkspaceClick = Boolean(activeStep?.requireWorkspaceClick && !workspacePicked);

  // Auto-advance once the user navigates to a workspace (step 3 "workspace-select")
  useEffect(() => {
    if (!open || !activeStep?.requireWorkspaceClick) {
      return;
    }
    if (workspacePicked) {
      // User has clicked the workspace link — advance automatically
      const timer = window.setTimeout(() => {
        setStepIndex((value) =>
          Math.min(guideSteps.length - 1, Math.min(value, guideSteps.length - 1) + 1),
        );
      }, 350);
      return () => window.clearTimeout(timer);
    }
  }, [open, activeStep, workspacePicked, guideSteps.length]);

  // Listen for wizard result ready event (for blocking step 7 submit)
  useEffect(() => {
    if (!open) {
      return;
    }
    const handleResultReady = () => setWizardResultReady(true);
    window.addEventListener(WIZARD_RESULT_READY_EVENT, handleResultReady);
    return () => window.removeEventListener(WIZARD_RESULT_READY_EVENT, handleResultReady);
  }, [open]);

  // Reset wizardResultReady flag when moving to a different step
  useEffect(() => {
    const handle = window.setTimeout(() => {
      setWizardResultReady(false);
    }, 0);
    return () => window.clearTimeout(handle);
  }, [clampedStepIndex]);

  // Determine whether this is a submit step that should be blocked until the wizard finishes
  const isSubmitStep = activeStep?.id === "generate-submit" || activeStep?.id === "audit-submit";
  const waitingForResult = isSubmitStep && !wizardResultReady;

  const waitingForRoute =
    Boolean(activeStep?.route) &&
    !activeStep?.requireWorkspaceClick &&
    pathname !== activeStep.route;

  const closeAndPersist = useCallback(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(ONBOARDING_GUIDE_STORAGE_KEY, "1");
    }
    setOpen(false);
    setStepIndex(0);
    setHighlightRect(null);
    setConfirmSkipOpen(false);
  }, []);

  useEffect(() => {
    if (loading || !user) {
      return;
    }
    if (readGuideCompleteFlag()) {
      return;
    }
    const timer = window.setTimeout(() => setOpen(true), 700);
    return () => window.clearTimeout(timer);
  }, [loading, user]);

  useEffect(() => {
    const handleOpen = () => {
      if (!user) {
        return;
      }
      setOpen(true);
      setStepIndex(0);
      setHighlightRect(null);
      setConfirmSkipOpen(false);
    };
    window.addEventListener(ONBOARDING_GUIDE_OPEN_EVENT, handleOpen as EventListener);
    return () => window.removeEventListener(ONBOARDING_GUIDE_OPEN_EVENT, handleOpen as EventListener);
  }, [user]);

  useEffect(() => {
    if (!open || !activeStep?.route || activeStep.requireWorkspaceClick) {
      return;
    }
    if (pathname === activeStep.route) {
      return;
    }
    const timer = window.setTimeout(() => {
      router.push(activeStep.route as string);
    }, 150);
    return () => window.clearTimeout(timer);
  }, [activeStep, open, pathname, router]);

  useEffect(() => {
    let cancelled = false;

    const updateHighlight = () => {
      if (cancelled) {
        return;
      }
      if (!activeStep) {
        setHighlightRect(null);
        return;
      }

      ensureMobileMenuOpenForGuide(activeStep);
      const selector = resolveStepSelector(activeStep);
      if (!selector) {
        setHighlightRect(null);
        return;
      }

      const element = document.querySelector(selector) as HTMLElement | null;
      if (!element) {
        setHighlightRect(null);
        return;
      }

      const rect = element.getBoundingClientRect();
      if (rect.width < 8 || rect.height < 8) {
        setHighlightRect(null);
        return;
      }

      const margin = 8;
      const top = Math.max(8, rect.top - margin);
      const left = Math.max(8, rect.left - margin);
      const maxWidth = Math.max(8, window.innerWidth - left - 8);
      const maxHeight = Math.max(8, window.innerHeight - top - 8);
      const width = Math.min(rect.width + margin * 2, maxWidth);
      const height = Math.min(rect.height + margin * 2, maxHeight);

      if (width < 8 || height < 8) {
        setHighlightRect(null);
        return;
      }

      setHighlightRect({ top, left, width, height });
    };

    const initial = window.setTimeout(() => {
      if (!open || !activeStep) {
        setHighlightRect(null);
        return;
      }
      if (activeStep.route && !activeStep.requireWorkspaceClick && pathname !== activeStep.route) {
        setHighlightRect(null);
        return;
      }

      ensureMobileMenuOpenForGuide(activeStep);
      const selector = resolveStepSelector(activeStep);
      const element = selector ? (document.querySelector(selector) as HTMLElement | null) : null;
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
      }
      updateHighlight();
      window.setTimeout(updateHighlight, 140);
    }, 240);

    window.addEventListener("resize", updateHighlight);
    window.addEventListener("scroll", updateHighlight, true);

    return () => {
      cancelled = true;
      window.clearTimeout(initial);
      window.removeEventListener("resize", updateHighlight);
      window.removeEventListener("scroll", updateHighlight, true);
    };
  }, [activeStep, open, pathname]);

  if (!open || !user || !activeStep) {
    return null;
  }

  const nextBlocked = waitingForWorkspaceClick || waitingForRoute || waitingForResult;
  const isLastStep = clampedStepIndex >= guideSteps.length - 1;

  return (
    <>
      {highlightRect ? (
        <div
          className="pointer-events-none fixed z-[72] rounded-2xl border-2 border-teal-300 shadow-[0_0_0_9999px_rgba(15,23,42,0.45),0_0_0_6px_rgba(45,212,191,0.2)]"
          style={{
            top: `${highlightRect.top}px`,
            left: `${highlightRect.left}px`,
            width: `${highlightRect.width}px`,
            height: `${highlightRect.height}px`,
          }}
        />
      ) : (
        <div className="pointer-events-none fixed inset-0 z-[72] bg-slate-950/45" />
      )}

      <aside className="fixed bottom-5 right-4 z-[73] w-[min(95vw,26rem)] rounded-2xl border border-teal-100 bg-white px-4 py-4 shadow-[0_20px_55px_rgba(15,23,42,0.38)]">
        <p className="text-xs font-semibold uppercase tracking-[0.17em] text-teal-700">
          {t("guide.progress", { current: clampedStepIndex + 1, total: guideSteps.length })}
        </p>
        <h3 className="mt-1 text-lg font-semibold text-stone-950">{t(activeStep.titleKey)}</h3>
        <p className="mt-2 text-sm leading-6 text-stone-600">{t(activeStep.bodyKey)}</p>

        {waitingForWorkspaceClick ? (
          <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
            {t("guide.workspace_hint")}
          </p>
        ) : null}
        {waitingForRoute ? (
          <p className="mt-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-medium text-sky-800">
            {t("guide.route_loading")}
          </p>
        ) : null}
        {waitingForResult ? (
          <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
            {t("guide.submit_hint")}
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-50"
            onClick={() => setConfirmSkipOpen(true)}
          >
            {t("guide.skip")}
          </button>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-40"
              onClick={() =>
                setStepIndex((value) => Math.max(0, Math.min(value, guideSteps.length - 1) - 1))
              }
              disabled={clampedStepIndex === 0}
            >
              {t("common.back")}
            </button>
            {isLastStep ? (
              <button
                type="button"
                className="rounded-lg bg-stone-900 px-3 py-2 text-xs font-semibold text-white hover:bg-stone-800"
                onClick={closeAndPersist}
              >
                {t("guide.finish")}
              </button>
            ) : (
              <button
                type="button"
                className="rounded-lg bg-stone-900 px-3 py-2 text-xs font-semibold text-white hover:bg-stone-800 disabled:opacity-50"
                onClick={() =>
                  setStepIndex((value) =>
                    Math.min(guideSteps.length - 1, Math.min(value, guideSteps.length - 1) + 1),
                  )
                }
                disabled={nextBlocked}
              >
                {t("common.next")}
              </button>
            )}
          </div>
        </div>
      </aside>

      <ConfirmDialog
        open={confirmSkipOpen}
        title={t("guide.skip_confirm_title")}
        description={t("guide.skip_confirm_body")}
        confirmLabel={t("guide.skip_confirm_ok")}
        cancelLabel={t("guide.skip_confirm_cancel")}
        onConfirm={closeAndPersist}
        onCancel={() => setConfirmSkipOpen(false)}
      />
    </>
  );
}
