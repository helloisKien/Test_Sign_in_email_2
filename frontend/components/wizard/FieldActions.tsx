"use client";

import { useState } from "react";

type FieldActionsProps = {
  pending: boolean;
  onRegenerate: () => void;
  onUndo: () => void;
  onSetOverride: (reason: string | null) => void;
  overrideReason: string | null;
};

export function FieldActions({
  pending,
  onRegenerate,
  onUndo,
  onSetOverride,
  overrideReason,
}: FieldActionsProps) {
  const [draftReason, setDraftReason] = useState(overrideReason ?? "");

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-slate-400 hover:bg-slate-50"
          disabled={pending}
          onClick={onRegenerate}
        >
          {pending ? "Regenerating..." : "Regenerate this field"}
        </button>
        <button
          type="button"
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-slate-400 hover:bg-slate-50"
          disabled={pending}
          onClick={onUndo}
        >
          Undo field
        </button>
      </div>
      <div className="space-y-2">
        <div className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] text-amber-900">
          <span className="mr-1" aria-hidden="true">
            !
          </span>
          <span className="font-semibold">Guide:</span> Enter a reason when you want to keep current text despite the audit warning.
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            className="min-w-[16rem] flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 outline-none ring-slate-900/10 focus:border-slate-900 focus:ring-2"
            placeholder="Enter a reason to keep current text"
            value={draftReason}
            onChange={(event) => setDraftReason(event.target.value)}
          />
          <button
            type="button"
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-slate-400 hover:bg-slate-50"
            onClick={() => onSetOverride(draftReason.trim() ? draftReason.trim() : null)}
          >
            Save reason
          </button>
        </div>
      </div>
    </div>
  );
}
