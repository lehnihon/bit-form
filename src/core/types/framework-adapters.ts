/**
 * Shared framework adapter contracts.
 *
 * These contracts define shape only; each framework provides its own reactive wrappers.
 */

export interface BitStepsAdapterResult<
  TStep,
  TStepIndex,
  TScope,
  TBoolean,
  TStatus,
  TErrors,
  TValidateResult,
> {
  step: TStep;
  stepIndex: TStepIndex;
  scope: TScope;
  next: () => Promise<boolean>;
  prev: () => void;
  goTo: (step: number) => void;
  isFirst: TBoolean;
  isLast: TBoolean;
  status: TStatus;
  errors: TErrors;
  isValid: TBoolean;
  isDirty: TBoolean;
  validate: () => Promise<TValidateResult>;
  getErrors: () => Record<string, string>;
}

export interface BitHistoryAdapterResult<
  TCanUndo,
  TCanRedo,
  THistoryIndex,
  THistorySize,
> {
  canUndo: TCanUndo;
  canRedo: TCanRedo;
  historyIndex: THistoryIndex;
  historySize: THistorySize;
  undo: () => void;
  redo: () => void;
}

export interface BitPersistAdapterResult<TMeta> {
  restore: () => Promise<boolean>;
  save: () => Promise<void>;
  clear: () => Promise<void>;
  meta: TMeta;
}
