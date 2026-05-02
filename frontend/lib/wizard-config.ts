import type { WizardFieldDefinition, WizardMode, WizardStepDefinition } from "./wizard-types";

export type WizardFlowConfig = {
  mode: WizardMode;
  title: string;
  subtitle: string;
  submitLabel: string;
  steps: WizardStepDefinition[];
  fields: WizardFieldDefinition[];
};

export const GENERATOR_FLOW_CONFIG: WizardFlowConfig = {
  mode: "generate",
  title: "Syllabus Generator",
  subtitle: "Create a draft, edit it, then send it to QA when ready.",
  submitLabel: "Generate syllabus",
  steps: [
    {
      id: "course",
      title: "Course",
      description: "Upload source or set core course metadata.",
      fieldIds: ["course_code", "course_name", "credits", "weeks"],
    },
    {
      id: "outcomes",
      title: "CLO",
      description: "Draft measurable course outcomes.",
      fieldIds: ["clo_text"],
    },
    {
      id: "weekly",
      title: "Weekly Plan",
      description: "Set week-by-week progression.",
      fieldIds: ["weekly_plan_text"],
    },
    {
      id: "assessment",
      title: "Assessment",
      description: "Define assessment and weights.",
      fieldIds: ["assessment_text"],
    },
    {
      id: "constraints",
      title: "Preference",
      description: "Optional preferences for the generated syllabus and LLM tone.",
      fieldIds: ["constraints_text"],
    },
  ],
  fields: [
    { fieldId: "course_code", stepId: "course", label: "Course Code", required: true, defaultValue: "CS2436" },
    { fieldId: "course_name", stepId: "course", label: "Course Name", required: true, defaultValue: "Applied Data Structures" },
    { fieldId: "credits", stepId: "course", label: "Credits", required: true, defaultValue: "3" },
    { fieldId: "weeks", stepId: "course", label: "Weeks", required: true, defaultValue: "15" },
    {
      fieldId: "clo_text",
      stepId: "outcomes",
      label: "Course Learning Outcomes",
      multiline: true,
      defaultValue:
        "- Understand linear and nonlinear data structures.\n- Learn how to compare implementation choices.",
    },
    {
      fieldId: "weekly_plan_text",
      stepId: "weekly",
      label: "Weekly Plan",
      multiline: true,
      defaultValue:
        "- Week 1: Course overview and complexity review\n- Week 2: Arrays and linked lists\n- Week 3: Stacks and queues",
    },
    {
      fieldId: "assessment_text",
      stepId: "assessment",
      label: "Assessment Rubric",
      multiline: true,
      defaultValue: "- Quiz set: 20%\n- Lab exercises: 30%\n- Final project: 50%",
    },
    {
      fieldId: "constraints_text",
      stepId: "constraints",
      label: "Preference",
      multiline: true,
      defaultValue:
        "- Keep the language easy for students to understand.\n- Keep the structure suitable for faculty editing.",
    },
  ],
};

export const AUDITOR_FLOW_CONFIG: WizardFlowConfig = {
  mode: "audit",
  title: "QA Review",
  subtitle: "Review submitted syllabuses and send a clear decision back to teachers.",
  submitLabel: "Run QA review",
  steps: [
    {
      id: "source",
      title: "Source",
      description: "Preview the submitted syllabus source and teacher context.",
      fieldIds: ["source_text"],
    },
    {
      id: "focus",
      title: "Focus",
      description: "Set audit focus criteria.",
      fieldIds: ["focus_text"],
    },
    {
      id: "mapped",
      title: "Mapped Fields",
      description: "Map core sections for deterministic checks.",
      fieldIds: ["clo_text", "weekly_plan_text", "assessment_text"],
    },
    {
      id: "review",
      title: "Review",
      description: "Add notes before running the QA review.",
      fieldIds: ["review_notes"],
    },
  ],
  fields: [
    {
      fieldId: "source_text",
      stepId: "source",
      label: "Syllabus Source",
      multiline: true,
      defaultValue:
        "## Draft CLOs\n- Understand cloud concepts.\n- Know security basics.\n\n## Weekly Plan\n- Week 1: Intro\n- Week 2: Cloud overview\n\n## Assessment Rubric\n- Project: 100%",
    },
    {
      fieldId: "focus_text",
      stepId: "focus",
      label: "Audit Focus",
      multiline: true,
      defaultValue: "- Criterion 3\n- Criterion 5\n- Remediation specificity",
    },
    {
      fieldId: "clo_text",
      stepId: "mapped",
      label: "CLO Section",
      multiline: true,
      defaultValue: "- Understand cloud concepts.\n- Know security basics.",
    },
    {
      fieldId: "weekly_plan_text",
      stepId: "mapped",
      label: "Weekly Plan Section",
      multiline: true,
      defaultValue: "- Week 1: Intro\n- Week 2: Cloud overview",
    },
    {
      fieldId: "assessment_text",
      stepId: "mapped",
      label: "Assessment Section",
      multiline: true,
      defaultValue: "- Project: 100%",
    },
    {
      fieldId: "review_notes",
      stepId: "review",
      label: "Review Notes",
      multiline: true,
      defaultValue: "Capture QA notes before sending the decision back to the teacher.",
    },
  ],
};
