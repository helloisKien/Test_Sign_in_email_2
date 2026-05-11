"use client";

import type { WizardFieldAudit } from "@/lib/wizard-types";

export function RuleQuotePanel({ audit }: { audit: WizardFieldAudit | undefined }) {
  if (!audit) {
    return null;
  }

  return (
    <details className="rounded-xl border border-slate-200 bg-white px-3 py-2">
      <summary className="cursor-pointer text-xs font-semibold text-slate-700">
        Xem luat - {audit.source_ref.section}
      </summary>
      <div className="mt-2 space-y-2 text-xs leading-5 text-slate-600">
        <p className="font-quote rounded-lg bg-slate-50 px-3 py-2 text-sm">{audit.quote}</p>
        <p>
          <span className="font-semibold text-slate-700">Reference:</span> {audit.source_ref.doc} -{" "}
          {audit.source_ref.version}
        </p>
      </div>
    </details>
  );
}
