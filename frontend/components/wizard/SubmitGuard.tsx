"use client";

type SubmitGuardProps = {
  blocked: boolean;
  warningCount: number;
  criticalCount: number;
  disabled: boolean;
  busy: boolean;
  reason: string;
  onSubmit: () => void;
  label: string;
};

export function SubmitGuard({
  blocked,
  warningCount,
  criticalCount,
  disabled,
  busy,
  reason,
  onSubmit,
  label,
}: SubmitGuardProps) {
  const buttonDisabled = disabled || blocked || busy;
  const helper = blocked
    ? `Blocked: ${criticalCount} critical fields unresolved.`
    : warningCount > 0
      ? `Warnings unresolved: ${warningCount}. Confirmation will be required.`
      : "All required fields currently pass deterministic checks.";

  return (
    <div className="space-y-2">
      <button
        type="button"
        className="inline-flex items-center justify-center rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
        disabled={buttonDisabled}
        title={reason}
        onClick={onSubmit}
      >
        {busy ? "Submitting..." : label}
      </button>
      <p className="text-xs text-slate-600">{helper}</p>
    </div>
  );
}

