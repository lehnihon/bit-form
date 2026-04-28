import { getDeepValue, valueEqual } from "../../../../utils";
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

const BIT_ASYNC_VALIDATION_TIMEOUT = Symbol("bit.async.validation.timeout");

export interface BitAsyncValidationSchedulerPort<T extends object> {
  schedule(fn: () => void, delayMs: number): () => void;
  getValues(): T;
  setFieldValidating(path: string, isValidating: boolean): void;
  setAsyncError(path: string, message: string): void;
  clearAsyncError(path: string): void;
  onValidationPassed(path: string): Promise<void>;
  onError(error: unknown): void;
}

export class BitAsyncValidationScheduler<T extends object> {
  private _cancellingAll = false;
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
    this.port.clearAsyncError(path);
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

    const paths = new Set<string>([
      ...this.pendingJobs.keys(),
      ...this.abortControllers.keys(),
    ]);

    for (const path of paths) {
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

  remapPaths(remapPath: (path: string) => string | null): void {
    let hasPendingChange = false;

    const nextPendingJobs = new Map<string, PendingAsyncValidationJob<T>>();

    for (const [path, job] of this.pendingJobs.entries()) {
      const nextPath = remapPath(path);

      if (!nextPath) {
        job.controller.abort();
        hasPendingChange = true;
        continue;
      }

      if (nextPath !== path) {
        hasPendingChange = true;
      }

      nextPendingJobs.set(nextPath, job);
    }

    const nextAbortControllers = new Map<string, AbortController>();

    for (const [path, controller] of this.abortControllers.entries()) {
      const nextPath = remapPath(path);

      if (!nextPath) {
        controller.abort();
        continue;
      }

      nextAbortControllers.set(nextPath, controller);
    }

    this.pendingJobs.clear();
    nextPendingJobs.forEach((job, path) => {
      this.pendingJobs.set(path, job);
    });

    this.abortControllers.clear();
    nextAbortControllers.forEach((controller, path) => {
      this.abortControllers.set(path, controller);
    });

    if (hasPendingChange) {
      this.schedulePendingJobs();
    }
  }

  cancelAll(): void {
    this._cancellingAll = true;
    try {
      if (this.cancelSchedulerTimeout) {
        try {
          this.cancelSchedulerTimeout();
        } catch {
          // Ignore: may fail if cancellation already happened
        } finally {
          this.cancelSchedulerTimeout = undefined;
        }
      }

      this.abortControllers.forEach((controller, path) => {
        try {
          controller.abort();
        } catch {
          // Already aborted or invalid
        }
        // Reset isValidating so the UI spinner never stays stuck.
        // The runJob finally block guards its own call with !signal.aborted,
        // so once aborted mid-flight it would never clear this flag otherwise.
        if (!this._cancellingAll) {
          this.port.setFieldValidating(path, false);
        }
      });

      this.pendingJobs.forEach((_job, path) => {
        // Jobs still in the pending queue also had setFieldValidating(true) called
        // in handle(). Clear them so pending-but-not-yet-executed jobs don't leak.
        if (!this._cancellingAll) {
          this.port.setFieldValidating(path, false);
        }
      });

      this.pendingJobs.clear();
      this.abortControllers.clear();
    } finally {
      this._cancellingAll = false;
    }
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
        void this.flushPendingJobs().catch((error) => {
          this.port.onError(error);
        });
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

    const results = await Promise.allSettled(
      dueJobs.map(([path, job]) => this.runJob(path, job)),
    );

    for (const result of results) {
      if (result.status === "rejected") {
        this.port.onError(result.reason);
      }
    }

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
      let validationPromise: Promise<
        string | null | undefined | typeof BIT_ASYNC_VALIDATION_TIMEOUT
      > = job.validate(job.value, this.port.getValues());

      if (typeof job.timeoutMs === "number" && job.timeoutMs > 0) {
        let timeoutId: ReturnType<typeof setTimeout> | undefined;
        validationPromise = Promise.race([
          validationPromise,
          new Promise<typeof BIT_ASYNC_VALIDATION_TIMEOUT>((resolve) => {
            timeoutId = setTimeout(
              () => resolve(BIT_ASYNC_VALIDATION_TIMEOUT),
              job.timeoutMs,
            );
          }),
        ]).finally(() => {
          if (timeoutId) {
            clearTimeout(timeoutId);
          }
        });
      }

      const errorMessage = await validationPromise;

      if (job.controller.signal.aborted) {
        return;
      }

      const currentValue = getDeepValue(this.port.getValues(), path);
      if (!valueEqual(currentValue, job.value)) {
        return;
      }

      if (errorMessage === BIT_ASYNC_VALIDATION_TIMEOUT) {
        // Timeout is inconclusive: do not clear/set error and do not report validation success.
        return;
      }

      if (errorMessage !== null && errorMessage !== undefined) {
        this.port.setAsyncError(path, errorMessage);
      } else {
        this.port.clearAsyncError(path);
        await this.port.onValidationPassed(path);
      }
    } finally {
      const currentPath = this.findControllerPath(job.controller) ?? path;

      if (!job.controller.signal.aborted && !this._cancellingAll) {
        this.port.setFieldValidating(currentPath, false);
      }

      if (this.abortControllers.get(currentPath) === job.controller) {
        this.abortControllers.delete(currentPath);
      }
    }
  }

  private findControllerPath(controller: AbortController): string | undefined {
    for (const [path, storedController] of this.abortControllers.entries()) {
      if (storedController === controller) {
        return path;
      }
    }

    return undefined;
  }
}
