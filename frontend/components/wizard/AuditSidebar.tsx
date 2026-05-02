"use client";

import { Fragment, type ReactNode } from "react";

import type { WizardFieldAudit, WizardFieldState } from "@/lib/wizard-types";

import { FieldActions } from "./FieldActions";
import { FieldAuditChip } from "./FieldAuditChip";
import { RuleQuotePanel } from "./RuleQuotePanel";

type AuditSidebarProps = {
  fields: WizardFieldState[];
  auditsByField: Record<string, WizardFieldAudit>;
  pendingByField: Record<string, boolean>;
  overrides: Record<string, string>;
  fieldErrors: Record<string, string | undefined>;
  onJumpToField: (fieldId: string) => void;
  onRegenerateField: (fieldId: string) => void;
  onUndoField: (fieldId: string) => void;
  onSetOverride: (fieldId: string, reason: string | null) => void;
};

function rowClass(severity: WizardFieldAudit["severity"]): string {
  if (severity === "critical") {
    return "border-red-200 bg-red-50";
  }
  if (severity === "warn") {
    return "border-amber-200 bg-amber-50";
  }
  return "border-emerald-200 bg-emerald-50";
}

function renderHighlightPreview(text: string, spans: WizardFieldAudit["highlight_spans"]) {
  if (!spans || spans.length === 0 || !text) {
    return text;
  }
  const sorted = [...spans].sort((a, b) => a.start - b.start);
  const nodes: ReactNode[] = [];
  let cursor = 0;

  for (const span of sorted) {
    const start = Math.max(0, Math.min(text.length, span.start));
    const end = Math.max(start, Math.min(text.length, span.end));
    if (start > cursor) {
      nodes.push(<Fragment key={`plain-${cursor}`}>{text.slice(cursor, start)}</Fragment>);
    }
    nodes.push(
      <mark key={`hl-${start}-${end}`} className="rounded bg-amber-200 px-1 text-slate-900">
        {text.slice(start, end)}
      </mark>,
    );
    cursor = end;
  }

  if (cursor < text.length) {
    nodes.push(<Fragment key={`tail-${cursor}`}>{text.slice(cursor)}</Fragment>);
  }

  return nodes;
}

export function AuditSidebar({
  fields,
  auditsByField,
  pendingByField,
  overrides,
  fieldErrors,
  onJumpToField,
  onRegenerateField,
  onUndoField,
  onSetOverride,
}: AuditSidebarProps) {
  const visible = fields
    .map((field) => auditsByField[field.fieldId])
    .filter((item): item is WizardFieldAudit => Boolean(item) && item.severity !== "pass");
  const critical = visible.filter((item) => item.severity === "critical").length;
  const warn = visible.filter((item) => item.severity === "warn").length;

  return (
    <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 text-sm font-semibold text-slate-900">Inline Audit Sidebar</div>
      <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
        <div className="font-semibold text-slate-900">Quick legend</div>
        <div className="mt-1">Critical: {critical} field(s) need fix before submit.</div>
        <div>Warn: {warn} field(s) need confirmation or override reason.</div>
      </div>
      <div className="space-y-3">
        {fields.length === 0 ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
            No fields available for this step.
          </div>
        ) : (
          fields.map((field) => {
            const audit = auditsByField[field.fieldId];
            const pending = Boolean(pendingByField[field.fieldId]);
            const overrideReason = overrides[field.fieldId] ?? null;
            const preview = renderHighlightPreview(field.value, audit?.highlight_spans ?? []);
            const severityClass = audit ? rowClass(audit.severity) : "border-slate-200 bg-slate-50";

            return (
              <div key={field.fieldId} className={`rounded-xl border px-3 py-2 text-xs text-slate-700 ${severityClass}`}>
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    className="text-left"
                    onClick={() => onJumpToField(field.fieldId)}
                    title="Jump to field"
                  >
                    <span className="font-semibold text-slate-900">{field.fieldId}</span>
                  </button>
                  <FieldAuditChip audit={audit} />
                </div>

                <div className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs leading-5 text-slate-700">
                  <div className="mb-1 font-semibold text-slate-600">Span-level highlights</div>
                  <div>{preview || "No highlighted phrase yet."}</div>
                </div>

                <p className="mt-2 text-xs text-slate-500">
                  Tip: Use Ctrl/Cmd+Enter to regenerate this field, and Tab or Shift+Tab to move between fields.
                </p>

                {audit ? (
                  <div className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
                    <div className="font-semibold text-slate-800">Why flagged</div>
                    <div className="mt-1">{audit.message}</div>
                    <div className="mt-1 text-slate-600">Suggestion: {audit.suggestion}</div>
                  </div>
                ) : null}

                <div className="mt-2">
                  <RuleQuotePanel audit={audit} />
                </div>

                <div className="mt-2">
                  <FieldActions
                    pending={pending}
                    onRegenerate={() => onRegenerateField(field.fieldId)}
                    onUndo={() => onUndoField(field.fieldId)}
                    onSetOverride={(reason) => onSetOverride(field.fieldId, reason)}
                    overrideReason={overrideReason}
                  />
                </div>
                {fieldErrors[field.fieldId] ? (
                  <p className="mt-2 text-xs text-red-700">{fieldErrors[field.fieldId]}</p>
                ) : null}
                {overrideReason ? (
                  <p className="mt-2 text-xs text-emerald-700">Override saved: {overrideReason}</p>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
