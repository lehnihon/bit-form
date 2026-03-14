export interface BitPipelineContext {
  halted?: boolean;
}

export interface BitPipelineStep<TContext extends BitPipelineContext> {
  name: string;
  run: (context: TContext) => void | Promise<void>;
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
