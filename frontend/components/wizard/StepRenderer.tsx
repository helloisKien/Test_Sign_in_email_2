"use client";

import type { KeyboardEvent } from "react";

import type { WizardFieldState } from "@/lib/wizard-types";

type StepRendererProps = {
  fields: WizardFieldState[];
  minimalFieldUi?: boolean;
  onChangeField: (fieldId: string, value: string) => void;
  onRegenerateField: (fieldId: string) => void;
  onMoveFieldFocus: (fieldId: string, direction: -1 | 1) => void;
};

function fieldCardClassForMode(minimalFieldUi: boolean): string {
  if (minimalFieldUi) {
    return "border-slate-200";
  }
  return "border-slate-200";
}

export function StepRenderer({
  fields,
  minimalFieldUi = false,
  onChangeField,
  onRegenerateField,
  onMoveFieldFocus,
}: StepRendererProps) {
  function handleFieldKeyDown(
    event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
    fieldId: string,
  ) {
    if (event.key === "Tab") {
      event.preventDefault();
      onMoveFieldFocus(fieldId, event.shiftKey ? -1 : 1);
      return;
    }
    if (minimalFieldUi) {
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      onRegenerateField(fieldId);
    }
  }

  return (
    <div className="space-y-4">
      {fields.map((field) => {
        return (
          <section
            key={field.fieldId}
            id={`field-${field.fieldId}`}
            className={`rounded-2xl border bg-white p-4 shadow-sm ${fieldCardClassForMode(minimalFieldUi)}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-semibold text-slate-900">
                {field.label}
                {field.required ? <span className="ml-1 text-rose-600">*</span> : null}
              </div>
            </div>

            {field.multiline ? (
              <textarea
                className="mt-3 min-h-[8rem] w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none ring-slate-900/10 focus:border-slate-900 focus:ring-2"
                value={field.value}
                data-wizard-input={field.fieldId}
                placeholder={field.placeholder}
                onChange={(event) => onChangeField(field.fieldId, event.target.value)}
                onKeyDown={(event) => handleFieldKeyDown(event, field.fieldId)}
              />
            ) : (
              <input
                className="mt-3 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none ring-slate-900/10 focus:border-slate-900 focus:ring-2"
                value={field.value}
                data-wizard-input={field.fieldId}
                placeholder={field.placeholder}
                onChange={(event) => onChangeField(field.fieldId, event.target.value)}
                onKeyDown={(event) => handleFieldKeyDown(event, field.fieldId)}
              />
            )}
          </section>
        );
      })}
    </div>
  );
}
