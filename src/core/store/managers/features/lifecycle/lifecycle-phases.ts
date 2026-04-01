export enum BitLifecyclePhase {
  PREPARE = 0,
  UPDATE_FIELD = 1,
  UPDATE_VALUES = 2,
  SUBMIT = 3,
  RESET = 4,
}

export interface BitLifecyclePhaseContext {
  kind:
    | "updateField"
    | "setValues"
    | "hydrateValues"
    | "rebaseValues"
    | "applyHistoryState"
    | "submit"
    | "reset";
}

export interface BitLifecyclePhaseExecutor<
  TContext extends BitLifecyclePhaseContext,
> {
  phase: BitLifecyclePhase;
  execute(context: TContext): void | Promise<void>;
}
