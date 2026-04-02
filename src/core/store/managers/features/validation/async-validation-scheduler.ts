import type { BitFieldDefinition } from "../../../contracts/types";
import { isPathWithinPrefix } from "../../../shared/path-prefix";

export type BitAsyncValidateFn<T extends object> = NonNullable<
  NonNullable<BitFieldDefinition<T>["validation"]>["asyncValidate"]
>;

interface PendingAsyncValidationJob<T extends object> {
  value: unknown;
  dueAt: number;
  validate: BitAsyncValidateFn<T>;
  controller: AbortController;
  timeoutMs?: number;
}

export interface BitAsyncValidationSchedulerPort<T extends object> {
  schedule(fn: () => void, delayMs: number): () => void;
  getValues(): T;
  setFieldValidating(path: string, isValidating: boolean): void;
  setAsyncError(path: string, message: string): void;
  clearAsyncError(path: string): void;
  onValidationPassed(path: string): Promise<void>;
}

export class BitAsyncValidationScheduler<T extends object> {
  private cancelSchedulerTimeout?: () => void;
  private readonly abortControllers = new Map<string, AbortController>();
  private readonly pendingJobs = new Map<
    string,
    PendingAsyncValidationJob<T>
  >();

  constructor(private readonly port: BitAsyncValidationSchedulerPort<T>) {}

  handle(
    path: string,
    value: unknown,
    validate: BitAsyncValidateFn<T> | undefined,
    delay: number,
    timeoutMs?: number,
  ): void {
    if (!validate) {
      this.cancel(path);
      this.port.setFieldValidating(path, false);
      return;
    }

    this.cancel(path);
    this.port.setFieldValidating(path, true);

    const controller = new AbortController();
    this.abortControllers.set(path, controller);
    this.pendingJobs.set(path, {
      value,
      dueAt: Date.now() + delay,
      validate,
      controller,
      timeoutMs,
    });
    this.schedulePendingJobs();
  }

  cancel(path: string): void {
    this.cancelInternal(path, true);
  }

  private cancelInternal(path: string, shouldReschedule: boolean): void {
    if (this.pendingJobs.has(path)) {
      this.pendingJobs.delete(path);
      if (shouldReschedule) {
        this.schedulePendingJobs();
      }
    }

    const controller = this.abortControllers.get(path);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(path);
    }
  }

  cleanupPrefix(prefix: string): void {
    let hasPendingChange = false;

    for (const path of this.pendingJobs.keys()) {
      if (isPathWithinPrefix(path, prefix)) {
        this.cancelInternal(path, false);
        hasPendingChange = true;
        this.port.clearAsyncError(path);
        this.port.setFieldValidating(path, false);
      }
    }

    if (hasPendingChange) {
      this.schedulePendingJobs();
    }
  }

  cancelAll(): void {
    if (this.cancelSchedulerTimeout) {
      this.cancelSchedulerTimeout();
      this.cancelSchedulerTimeout = undefined;
    }

    this.pendingJobs.clear();
    this.abortControllers.forEach((controller) => controller.abort());
    this.abortControllers.clear();
  }

  private schedulePendingJobs(): void {
    if (this.cancelSchedulerTimeout) {
      this.cancelSchedulerTimeout();
      this.cancelSchedulerTimeout = undefined;
    }

    let nextDueAt = Number.POSITIVE_INFINITY;

    for (const job of this.pendingJobs.values()) {
      if (job.dueAt < nextDueAt) {
        nextDueAt = job.dueAt;
      }
    }

    if (!Number.isFinite(nextDueAt)) {
      return;
    }

    this.cancelSchedulerTimeout = this.port.schedule(
      () => {
        this.cancelSchedulerTimeout = undefined;
        void this.flushPendingJobs();
      },
      Math.max(0, nextDueAt - Date.now()),
    );
  }

  private async flushPendingJobs(): Promise<void> {
    this.cancelSchedulerTimeout = undefined;

    const now = Date.now();
    const dueJobs: Array<[string, PendingAsyncValidationJob<T>]> = [];

    for (const [path, job] of this.pendingJobs.entries()) {
      if (job.dueAt <= now) {
        dueJobs.push([path, job]);
      }
    }

    if (dueJobs.length === 0) {
      this.schedulePendingJobs();
      return;
    }

    dueJobs.forEach(([path]) => {
      this.pendingJobs.delete(path);
    });

    await Promise.all(dueJobs.map(([path, job]) => this.runJob(path, job)));

    this.schedulePendingJobs();
  }

  private async runJob(
    path: string,
    job: PendingAsyncValidationJob<T>,
  ): Promise<void> {
    if (job.controller.signal.aborted) {
      return;
    }

    try {
      let validationPromise: Promise<string | null | undefined> = job.validate(
        job.value,
        this.port.getValues(),
      );

      if (typeof job.timeoutMs === "number" && job.timeoutMs > 0) {
        validationPromise = Promise.race([
          validationPromise,
          new Promise<undefined>((resolve) =>
            setTimeout(() => resolve(undefined), job.timeoutMs),
          ),
        ]);
      }

      const errorMessage = await validationPromise;

      if (job.controller.signal.aborted) {
        return;
      }

      if (errorMessage) {
        this.port.setAsyncError(path, errorMessage);
      } else {
        this.port.clearAsyncError(path);
        await this.port.onValidationPassed(path);
      }
    } finally {
      if (!job.controller.signal.aborted) {
        this.port.setFieldValidating(path, false);
      }
      this.abortControllers.delete(path);
    }
  }
}
