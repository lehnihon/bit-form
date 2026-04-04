export type BitValidationOptions =
  | {
      scope: string;
      scopeFields?: never;
    }
  | {
      scope?: never;
      scopeFields: string[];
    }
  | {
      scope?: undefined;
      scopeFields?: undefined;
    };

export interface BitServerErrorOptions {
  arrayStrategy?: "first" | "join";
  joinSeparator?: string;
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
