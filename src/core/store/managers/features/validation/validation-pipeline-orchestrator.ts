import { BitPipelineRunner } from "../../../shared/pipeline";
import type { ValidationPipelineContext } from "./validation-pipeline-context";
import {
  abortIfOutdatedStage,
  commitValidationStage,
  mergeAsyncTrackStage,
  resolveTargetFieldsStage,
  runAsyncTrackStage,
  runBeforeValidateHooksStage,
  runSynchronousTrackStage,
  type BitValidationPipelineStageDeps,
} from "./validation-pipeline-stages";

export type BitValidationPipelineOrchestratorDeps<T extends object> =
  BitValidationPipelineStageDeps<T>;

export class BitValidationPipelineOrchestrator<T extends object> {
  private readonly runner: BitPipelineRunner<ValidationPipelineContext<T>>;

  constructor(private readonly deps: BitValidationPipelineOrchestratorDeps<T>) {
    this.runner = new BitPipelineRunner<ValidationPipelineContext<T>>([
      {
        name: "validate:resolve-target-fields",
        run: (ctx) => resolveTargetFieldsStage({ ctx, deps: this.deps }),
      },
      {
        name: "validate:before-hooks",
        run: async (ctx) =>
          runBeforeValidateHooksStage({ ctx, deps: this.deps }),
      },
      {
        name: "validate:sync-track",
        run: async (ctx) => runSynchronousTrackStage({ ctx, deps: this.deps }),
      },
      {
        name: "validate:abort-check-pre-async",
        run: async (ctx) => abortIfOutdatedStage({ ctx, deps: this.deps }),
      },
      {
        name: "validate:async-track",
        run: async (ctx) => runAsyncTrackStage({ ctx, deps: this.deps }),
      },
      {
        name: "validate:abort-check",
        run: async (ctx) => abortIfOutdatedStage({ ctx, deps: this.deps }),
      },
      {
        name: "validate:async-track-merge",
        run: (ctx) => mergeAsyncTrackStage({ ctx, deps: this.deps }),
      },
      {
        name: "validate:commit",
        run: async (ctx) => commitValidationStage({ ctx, deps: this.deps }),
      },
    ]);
  }

  async run(context: ValidationPipelineContext<T>): Promise<void> {
    await this.runner.run(context);
  }
}
