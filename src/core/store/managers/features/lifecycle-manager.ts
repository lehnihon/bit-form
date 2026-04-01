import type { BitLifecyclePorts } from "../../contracts/port-types";
import type { BitSubmitResult } from "../../contracts/types";
import { BitFieldChangeMeta, DeepPartial } from "../../contracts/types";
import { BitFieldUpdateManager } from "./lifecycle/field-update-manager";
import {
  BitLifecycleOrchestrator,
  BitLifecyclePhase,
} from "./lifecycle/lifecycle-orchestrator";
import { BitSubmitLifecycleManager } from "./lifecycle/submit-lifecycle-manager";
import { BitValuesLifecycleManager } from "./lifecycle/values-lifecycle-manager";

interface BitLifecycleManagerContext<T extends object> {
  kind:
    | "updateField"
    | "setValues"
    | "hydrateValues"
    | "rebaseValues"
    | "applyHistoryState"
    | "submit"
    | "reset";
  path?: string;
  value?: unknown;
  meta?: BitFieldChangeMeta;
  newValues?: T | DeepPartial<T>;
  options?: { partial?: boolean; rebase?: boolean };
  snapshot?: T;
  onSuccess?: (
    values: T,
    dirtyValues?: Partial<T>,
  ) => unknown | Promise<unknown>;
  submitResult?: BitSubmitResult;
}

export class BitLifecycleManager<T extends object> {
  private readonly fieldUpdate: BitFieldUpdateManager<T>;
  private readonly values: BitValuesLifecycleManager<T>;
  private readonly submitFlow: BitSubmitLifecycleManager<T>;
  private readonly orchestrator = new BitLifecycleOrchestrator<
    BitLifecycleManagerContext<T>
  >();

  constructor(private readonly ports: BitLifecyclePorts<T>) {
    this.fieldUpdate = new BitFieldUpdateManager<T>(ports.fieldUpdate);
    this.values = new BitValuesLifecycleManager<T>(ports.values);
    this.submitFlow = new BitSubmitLifecycleManager<T>(ports.submit);

    this.orchestrator.register("updateField", {
      phase: BitLifecyclePhase.UPDATE_FIELD,
      execute: (ctx) =>
        this.fieldUpdate.updateField(
          ctx.path!,
          ctx.value,
          ctx.meta ?? { origin: "setField" },
        ),
    });

    this.orchestrator.register("setValues", {
      phase: BitLifecyclePhase.UPDATE_VALUES,
      execute: (ctx) => this.values.setValues(ctx.newValues!, ctx.options),
    });

    this.orchestrator.register("hydrateValues", {
      phase: BitLifecyclePhase.UPDATE_VALUES,
      execute: (ctx) =>
        this.values.hydrateValues(ctx.newValues as DeepPartial<T>),
    });

    this.orchestrator.register("rebaseValues", {
      phase: BitLifecyclePhase.UPDATE_VALUES,
      execute: (ctx) => this.values.rebaseValues(ctx.newValues as T),
    });

    this.orchestrator.register("applyHistoryState", {
      phase: BitLifecyclePhase.UPDATE_VALUES,
      execute: (ctx) => this.values.applyHistoryState(ctx.snapshot as T),
    });

    this.orchestrator.register("submit", {
      phase: BitLifecyclePhase.SUBMIT,
      execute: async (ctx) => {
        ctx.submitResult = await this.submitFlow.submit(ctx.onSuccess!);
      },
    });

    this.orchestrator.register("reset", {
      phase: BitLifecyclePhase.RESET,
      execute: () => this.values.reset(),
    });
  }

  updateField(
    path: string,
    value: unknown,
    meta: BitFieldChangeMeta = { origin: "setField" },
  ) {
    this.orchestrator.executeSync({
      kind: "updateField",
      path,
      value,
      meta,
    });
  }

  setValues(
    newValues: T | DeepPartial<T>,
    options?: { partial?: boolean; rebase?: boolean },
  ) {
    this.orchestrator.executeSync({
      kind: "setValues",
      newValues,
      options,
    });
  }

  hydrateValues(values: DeepPartial<T>) {
    this.orchestrator.executeSync({
      kind: "hydrateValues",
      newValues: values,
    });
  }

  rebaseValues(newValues: T) {
    this.orchestrator.executeSync({
      kind: "rebaseValues",
      newValues,
    });
  }

  applyHistoryState(snapshot: T) {
    this.orchestrator.executeSync({
      kind: "applyHistoryState",
      snapshot,
    });
  }

  async submit(
    onSuccess: (
      values: T,
      dirtyValues?: Partial<T>,
    ) => unknown | Promise<unknown>,
  ): Promise<BitSubmitResult> {
    const context: BitLifecycleManagerContext<T> = {
      kind: "submit",
      onSuccess,
    };

    await this.orchestrator.execute(context);
    return context.submitResult as BitSubmitResult;
  }

  reset() {
    this.orchestrator.executeSync({
      kind: "reset",
    });
  }
}
