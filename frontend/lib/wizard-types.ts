export type WizardMode = "generate" | "audit";
export type WizardSeverity = "pass" | "warn" | "critical";
export type FeedbackType = "approve" | "needs_revision" | "reject";

export type HighlightSpan = {
  start: number;
  end: number;
  text: string;
};

export type WizardFieldDefinition = {
  fieldId: string;
  stepId: string;
  label: string;
  required?: boolean;
  placeholder?: string;
  multiline?: boolean;
  defaultValue?: string;
};

export type WizardStepDefinition = {
  id: string;
  title: string;
  description: string;
  fieldIds: string[];
};

export type WizardFieldState = WizardFieldDefinition & {
  value: string;
  undoStack: string[];
};

export type WizardFieldInput = {
  field_id: string;
  step_id: string;
  label?: string;
  value: string;
};

export type WizardFieldAudit = {
  field_id: string;
  step_id: string;
  severity: WizardSeverity;
  rule_code: string;
  confidence: number;
  quote: string;
  source_ref: {
    doc: string;
    section: string;
    version: string;
  };
  highlight_spans: HighlightSpan[];
  message: string;
  suggestion: string;
  override_reason?: string | null;
};

export type WizardStepSummary = {
  pass: number;
  warn: number;
  critical: number;
  total_fields: number;
  pass_ratio: number;
  model: string;
  checked_at: string;
};

export type InlineAuditResponse = {
  wizard_id: string;
  mode: WizardMode;
  step_id: string;
  field_audits: WizardFieldAudit[];
  step_summary: WizardStepSummary;
};

export type WizardSnapshot = {
  snapshotId: string;
  stepId: string;
  createdAt: string;
  fields: Record<string, string>;
};

export type WizardDraftEnvelope = {
  wizardId: string;
  mode: WizardMode;
  currentStep: number;
  fields: Record<string, string>;
  overrides: Record<string, string>;
  snapshots: WizardSnapshot[];
  savedAt: string;
};
