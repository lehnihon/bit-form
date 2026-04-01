import {
  BitLifecyclePhase,
  type BitLifecyclePhaseContext,
  type BitLifecyclePhaseExecutor,
} from "./lifecycle-phases";

export class BitLifecycleOrchestrator<
  TContext extends BitLifecyclePhaseContext,
> {
  private readonly executors = new Map<
    TContext["kind"],
    BitLifecyclePhaseExecutor<TContext>[]
  >();

  register(
    kind: TContext["kind"],
    executor: BitLifecyclePhaseExecutor<TContext>,
  ) {
    const current = this.executors.get(kind) ?? [];
    current.push(executor);
    this.executors.set(kind, current);
  }

  async execute(context: TContext): Promise<void> {
    const ordered = this.getOrderedExecutors(context.kind);

    for (const executor of ordered) {
      await executor.execute(context);
    }
  }

  executeSync(context: TContext): void {
    const ordered = this.getOrderedExecutors(context.kind);

    for (const executor of ordered) {
      const result = executor.execute(context);
      if (result && typeof (result as Promise<unknown>).then === "function") {
        throw new Error(
          `BitLifecycleOrchestrator: executor async em modo sync para kind "${context.kind}".`,
        );
      }
    }
  }

  private getOrderedExecutors(kind: TContext["kind"]) {
    const executors = this.executors.get(kind) ?? [];
    return [...executors].sort((left, right) => left.phase - right.phase);
  }
}

export { BitLifecyclePhase };
