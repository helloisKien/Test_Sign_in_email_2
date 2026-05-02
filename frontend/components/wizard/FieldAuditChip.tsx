"use client";

import type { WizardFieldAudit } from "@/lib/wizard-types";

function severityClass(severity: WizardFieldAudit["severity"]): string {
  if (severity === "critical") {
    return "border-red-300 bg-red-50 text-red-800";
  }
  if (severity === "warn") {
    return "border-amber-300 bg-amber-50 text-amber-800";
  }
  return "border-emerald-300 bg-emerald-50 text-emerald-800";
}

function severityLabel(severity: WizardFieldAudit["severity"]): string {
  if (severity === "critical") {
    return "Hard fail";
  }
  if (severity === "warn") {
    return "Needs evidence";
  }
  return "Pass";
}

export function FieldAuditChip({ audit }: { audit: WizardFieldAudit | undefined }) {
  if (!audit) {
    return (
      <span className="inline-flex items-center rounded-full border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600">
        Pending audit
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${severityClass(
        audit.severity,
      )}`}
      title={`${audit.rule_code} confidence ${Math.round(audit.confidence * 100)}%`}
    >
      <span>{audit.rule_code}</span>
      <span className="opacity-80">{severityLabel(audit.severity)}</span>
      <span className="opacity-80">{Math.round(audit.confidence * 100)}%</span>
    </span>
  );
}
