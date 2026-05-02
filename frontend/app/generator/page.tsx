"use client";

import { WizardShell } from "@/components/wizard/WizardShell";
import { useAuthMe } from "@/lib/client-auth";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { GENERATOR_FLOW_CONFIG } from "@/lib/wizard-config";

export default function GeneratorPage() {
  const { t } = useI18n();
  const { user } = useAuthMe();
  const userInfo = user?.fullName
    ? { fullName: user.fullName, email: user.email, role: user.role }
    : null;

  if (!userInfo) {
    return (
      <main className="min-h-screen bg-stone-50 px-4 py-8">
        <div className="mx-auto max-w-4xl rounded-xl border border-stone-200 bg-white p-5 text-sm text-stone-600">
          {t("workspace.loading")}
        </div>
      </main>
    );
  }

  return <WizardShell config={GENERATOR_FLOW_CONFIG} roleLabel={t("workspace.teacher")} userInfo={userInfo} />;
}
