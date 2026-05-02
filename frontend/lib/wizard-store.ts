import { create } from "zustand";

import type {
  WizardFieldAudit,
  WizardFieldDefinition,
  WizardFieldState,
  WizardMode,
  WizardSnapshot,
  WizardStepSummary,
} from "./wizard-types";

type WizardStoreState = {
  wizardId: string;
  mode: WizardMode;
  currentStep: number;
  fields: Record<string, WizardFieldState>;
  fieldOrder: string[];
  auditByField: Record<string, WizardFieldAudit>;
  overrides: Record<string, string>;
  pendingByField: Record<string, boolean>;
  snapshots: WizardSnapshot[];
  lastAutosaveAt: string | null;
  lastAuditCheckedAt: string | null;
  stepSummaryByStep: Record<string, WizardStepSummary>;
  initialize: (wizardId: string, mode: WizardMode, defs: WizardFieldDefinition[]) => void;
  setCurrentStep: (index: number) => void;
  setFieldValue: (fieldId: string, value: string) => void;
  pushUndoBaseline: (fieldId: string) => void;
  undoField: (fieldId: string) => void;
  setAudits: (stepId: string, audits: WizardFieldAudit[], summary: WizardStepSummary) => void;
  setOverride: (fieldId: string, reason: string | null) => void;
  setPending: (fieldId: string, pending: boolean) => void;
  pushSnapshot: (stepId: string) => void;
  restoreSnapshot: (snapshotId: string) => boolean;
  restoreLatestSnapshotForStep: (stepId: string) => boolean;
  markAutosaved: (timestamp: string) => void;
  hydrateDraft: (
    payload: {
      currentStep: number;
      fields: Record<string, string>;
      overrides: Record<string, string>;
      snapshots: WizardSnapshot[];
    },
  ) => void;
  reset: () => void;
};

const initialState = {
  wizardId: "",
  mode: "generate" as WizardMode,
  currentStep: 0,
  fields: {} as Record<string, WizardFieldState>,
  fieldOrder: [] as string[],
  auditByField: {} as Record<string, WizardFieldAudit>,
  overrides: {} as Record<string, string>,
  pendingByField: {} as Record<string, boolean>,
  snapshots: [] as WizardSnapshot[],
  lastAutosaveAt: null as string | null,
  lastAuditCheckedAt: null as string | null,
  stepSummaryByStep: {} as Record<string, WizardStepSummary>,
};

function cloneFieldState(field: WizardFieldState): WizardFieldState {
  return {
    ...field,
    undoStack: [...field.undoStack],
  };
}

export const useWizardStore = create<WizardStoreState>((set, get) => ({
  ...initialState,
  initialize: (wizardId, mode, defs) => {
    set((state) => {
      if (state.wizardId === wizardId && state.mode === mode && state.fieldOrder.length > 0) {
        return state;
      }
      const fields: Record<string, WizardFieldState> = {};
      const fieldOrder: string[] = [];
      for (const def of defs) {
        fields[def.fieldId] = {
          ...def,
          value: def.defaultValue ?? "",
          undoStack: [],
        };
        fieldOrder.push(def.fieldId);
      }
      return {
        ...initialState,
        wizardId,
        mode,
        fields,
        fieldOrder,
      };
    });
  },
  setCurrentStep: (index) => set({ currentStep: Math.max(0, index) }),
  setFieldValue: (fieldId, value) =>
    set((state) => {
      const existing = state.fields[fieldId];
      if (!existing) {
        return state;
      }
      return {
        fields: {
          ...state.fields,
          [fieldId]: {
            ...existing,
            value,
          },
        },
      };
    }),
  pushUndoBaseline: (fieldId) =>
    set((state) => {
      const existing = state.fields[fieldId];
      if (!existing) {
        return state;
      }
      const next = cloneFieldState(existing);
      const baseline = existing.value;
      if (next.undoStack.length === 0 || next.undoStack[next.undoStack.length - 1] !== baseline) {
        next.undoStack.push(baseline);
      }
      return {
        fields: {
          ...state.fields,
          [fieldId]: next,
        },
      };
    }),
  undoField: (fieldId) =>
    set((state) => {
      const existing = state.fields[fieldId];
      if (!existing || existing.undoStack.length === 0) {
        return state;
      }
      const next = cloneFieldState(existing);
      const previous = next.undoStack.pop();
      if (previous == null) {
        return state;
      }
      next.value = previous;
      return {
        fields: {
          ...state.fields,
          [fieldId]: next,
        },
      };
    }),
  setAudits: (stepId, audits, summary) =>
    set((state) => {
      const auditByField = { ...state.auditByField };
      for (const audit of audits) {
        auditByField[audit.field_id] = audit;
      }
      const nextStepSummaryByStep = {
        ...state.stepSummaryByStep,
        [stepId]: summary,
      };
      return {
        auditByField,
        stepSummaryByStep: nextStepSummaryByStep,
        lastAuditCheckedAt: summary.checked_at,
      };
    }),
  setOverride: (fieldId, reason) =>
    set((state) => {
      const next = { ...state.overrides };
      if (reason && reason.trim()) {
        next[fieldId] = reason.trim();
      } else {
        delete next[fieldId];
      }
      return { overrides: next };
    }),
  setPending: (fieldId, pending) =>
    set((state) => ({
      pendingByField: {
        ...state.pendingByField,
        [fieldId]: pending,
      },
    })),
  pushSnapshot: (stepId) =>
    set((state) => {
      const fields: Record<string, string> = {};
      for (const fieldId of state.fieldOrder) {
        fields[fieldId] = state.fields[fieldId]?.value ?? "";
      }
      const snapshot: WizardSnapshot = {
        snapshotId: crypto.randomUUID(),
        stepId,
        createdAt: new Date().toISOString(),
        fields,
      };
      const snapshots = [snapshot, ...state.snapshots].slice(0, 20);
      return { snapshots };
    }),
  restoreSnapshot: (snapshotId) => {
    const state = get();
    const snapshot = state.snapshots.find((item) => item.snapshotId === snapshotId);
    if (!snapshot) {
      return false;
    }
    set((current) => {
      const nextFields: Record<string, WizardFieldState> = { ...current.fields };
      for (const fieldId of Object.keys(snapshot.fields)) {
        const existing = current.fields[fieldId];
        if (!existing) {
          continue;
        }
        nextFields[fieldId] = {
          ...existing,
          value: snapshot.fields[fieldId],
        };
      }
      return { fields: nextFields };
    });
    return true;
  },
  restoreLatestSnapshotForStep: (stepId) => {
    const state = get();
    const snapshot = state.snapshots.find((item) => item.stepId === stepId);
    if (!snapshot) {
      return false;
    }
    return get().restoreSnapshot(snapshot.snapshotId);
  },
  markAutosaved: (timestamp) => set({ lastAutosaveAt: timestamp }),
  hydrateDraft: (payload) =>
    set((state) => {
      const nextFields: Record<string, WizardFieldState> = { ...state.fields };
      for (const [fieldId, value] of Object.entries(payload.fields)) {
        const existing = state.fields[fieldId];
        if (!existing) {
          continue;
        }
        nextFields[fieldId] = {
          ...existing,
          value,
        };
      }
      return {
        currentStep: payload.currentStep,
        fields: nextFields,
        overrides: payload.overrides,
        snapshots: payload.snapshots,
      };
    }),
  reset: () => {
    const state = get();
    const resetFields: Record<string, WizardFieldState> = {};
    for (const fieldId of state.fieldOrder) {
      const existing = state.fields[fieldId];
      if (!existing) {
        continue;
      }
      resetFields[fieldId] = {
        ...existing,
        value: existing.defaultValue ?? "",
        undoStack: [],
      };
    }
    set({
      currentStep: 0,
      fields: resetFields,
      auditByField: {},
      overrides: {},
      pendingByField: {},
      snapshots: [],
      lastAutosaveAt: null,
      lastAuditCheckedAt: null,
      stepSummaryByStep: {},
    });
  },
}));
