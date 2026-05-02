import type { PreferredLanguage } from "@/lib/language-preference";
import { translate } from "@/lib/i18n/t";
import type { WizardFlowConfig } from "@/lib/wizard-config";

function t(locale: PreferredLanguage, key: string): string {
  return translate(locale, key);
}

/** UI labels only — field IDs and default values stay from base config. */
export function localizeWizardConfig(base: WizardFlowConfig, locale: PreferredLanguage): WizardFlowConfig {
  if (locale === "en") {
    return base;
  }

  const isGenerate = base.mode === "generate";

  const title = isGenerate ? t(locale, "wizloc.gen.title") : t(locale, "wizloc.audit.title");
  const subtitle = isGenerate ? t(locale, "wizloc.gen.subtitle") : t(locale, "wizloc.audit.subtitle");
  const submitLabel = isGenerate ? t(locale, "wizloc.gen.submit") : t(locale, "wizloc.audit.submit");

  const stepTitle = (id: string): string => t(locale, `wizloc.step.${id}.title`);
  const stepDesc = (id: string): string => t(locale, `wizloc.step.${id}.desc`);

  const fieldLabel = (fieldId: string): string => t(locale, `wizloc.field.${fieldId}.label`);

  return {
    ...base,
    title,
    subtitle,
    submitLabel,
    steps: base.steps.map((step) => ({
      ...step,
      title: stepTitle(step.id),
      description: stepDesc(step.id),
    })),
    fields: base.fields.map((field) => ({
      ...field,
      label: fieldLabel(field.fieldId),
    })),
  };
}
