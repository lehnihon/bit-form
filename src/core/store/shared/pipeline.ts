export interface BitPipelineContext {
  halted?: boolean;
}

export interface BitPipelineStep<TContext extends BitPipelineContext> {
  name: string;
  run: (context: TContext) => void | Promise<void>;
}

export interface BitSyncPipelineStep<TContext extends BitPipelineContext> {
  name: string;
  run: (context: TContext) => void;
}

export class BitPipelineRunner<TContext extends BitPipelineContext> {
  constructor(private readonly steps: BitPipelineStep<TContext>[]) {}

  async run(context: TContext): Promise<void> {
    for (const step of this.steps) {
      if (context.halted) {
        break;
      }

      await step.run(context);
    }
  }
}

export class BitSyncPipelineRunner<TContext extends BitPipelineContext> {
  constructor(private readonly steps: BitSyncPipelineStep<TContext>[]) {}

  run(context: TContext): void {
    for (const step of this.steps) {
      if (context.halted) {
        break;
      }

      step.run(context);
    }
  }
}
