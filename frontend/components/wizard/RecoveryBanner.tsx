"use client";

import { useI18n } from "@/lib/i18n/I18nProvider";

type RecoveryBannerProps = {
  savedAt: string;
  onRestore: () => void;
  onDismiss: () => void;
};

export function RecoveryBanner({ savedAt, onRestore, onDismiss }: RecoveryBannerProps) {
  const { t } = useI18n();
  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>{t("recovery.found", { savedAt })}</div>
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
            onClick={onRestore}
          >
            {t("recovery.restore")}
          </button>
          <button
            type="button"
            className="rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
            onClick={onDismiss}
          >
            {t("recovery.dismiss")}
          </button>
        </div>
      </div>
    </div>
  );
}
