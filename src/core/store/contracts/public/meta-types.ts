export interface BitValidationOptions {
  scope?: string;
  scopeFields?: string[];
}

export interface BitHistoryMetadata {
  enabled: boolean;
  canUndo: boolean;
  canRedo: boolean;
  historyIndex: number;
  historySize: number;
}

export interface BitFormMeta {
  isValid: boolean;
  isDirty: boolean;
  isSubmitting: boolean;
}
