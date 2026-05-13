"use client";

import { WizardShell } from "@/components/wizard/WizardShell";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { useAuthMe } from "@/lib/client-auth";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { AUDITOR_FLOW_CONFIG } from "@/lib/wizard-config";

export default function AuditorPage() {
  const { t } = useI18n();
  const { user } = useAuthMe();
  const userInfo = user?.fullName
    ? { fullName: user.fullName, email: user.email, role: user.role }
    : null;

  if (!userInfo) {
    return (
      <main className="min-h-screen bg-[linear-gradient(180deg,_#fbfaf7_0%,_#f5f3ec_100%)] px-4 py-6">
        <div className="mx-auto max-w-4xl">
          <SkeletonCard lines={5} />
        </div>
      </main>
    );
  }

  return <WizardShell config={AUDITOR_FLOW_CONFIG} roleLabel={t("workspace.qa")} userInfo={userInfo} />;
}
