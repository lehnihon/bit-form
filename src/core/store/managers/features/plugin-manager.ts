import type {
  BitAfterSubmitEvent,
  BitAfterValidateEvent,
  BitBeforeSubmitEvent,
  BitBeforeValidateEvent,
  BitFieldChangeEvent,
  BitPlugin,
  BitPluginContext,
  BitPluginErrorEvent,
} from "../../contracts/types";

interface PendingPluginError<T extends object> {
  source: BitPluginErrorEvent<T>["source"];
  pluginName?: string;
  error: unknown;
  event?: unknown;
}

export class BitPluginManager<T extends object = Record<string, unknown>> {
  private teardownFns: Array<() => void> = [];
  private notifyingError = false;
  private pendingErrorQueue: PendingPluginError<T>[] = [];
  private cachedContext: BitPluginContext<T> | null = null;

  constructor(
    private plugins: BitPlugin<T>[],
    private contextFactory: () => BitPluginContext<T>,
  ) {}

  setupAll() {
    const context = this.getContext();
    this.plugins.forEach((plugin) => {
      if (!plugin.setup) return;

      try {
        const maybeTeardown = plugin.setup(context);
        if (typeof maybeTeardown === "function") {
          this.teardownFns.push(maybeTeardown);
        }
      } catch (error) {
        void this.reportError("setup", error, undefined, plugin.name);
      }
    });
  }

  async beforeValidate(event: BitBeforeValidateEvent<T>) {
    await this.emitHook("beforeValidate", event);
  }

  async afterValidate(event: BitAfterValidateEvent<T>) {
    await this.emitHook("afterValidate", event);
  }

  async beforeSubmit(event: BitBeforeSubmitEvent<T>) {
    await this.emitHook("beforeSubmit", event);
  }

  async afterSubmit(event: BitAfterSubmitEvent<T>) {
    await this.emitHook("afterSubmit", event);
  }

  onFieldChange(event: BitFieldChangeEvent<T>) {
    const context = this.getContext();
    this.plugins.forEach((plugin) => {
      const hook = plugin.hooks?.onFieldChange;
      if (!hook) return;

      try {
        const result = hook(event, context);
        void Promise.resolve(result).catch((error) => {
          void this.reportError("onFieldChange", error, event, plugin.name);
        });
      } catch (error) {
        void this.reportError("onFieldChange", error, event, plugin.name);
      }
    });
  }

  async reportError(
    source: BitPluginErrorEvent<T>["source"],
    error: unknown,
    event?: unknown,
    pluginName?: string,
  ) {
    // Enqueue with minimal data — state snapshot is captured at processing time
    // to ensure plugins receive the freshest state, not a stale copy from the
    // moment the error was enqueued (which may be several ticks earlier).
    this.pendingErrorQueue.push({ source, pluginName, error, event });

    if (this.notifyingError) {
      // The active drain loop will pick up this entry in its next iteration.
      // Do NOT return without re-checking: the while-loop below handles the
      // re-entrancy case automatically.
      return;
    }

    this.notifyingError = true;

    try {
      while (this.pendingErrorQueue.length > 0) {
        const entry = this.pendingErrorQueue.shift();
        if (!entry) {
          break;
        }

        // Build the full payload with a fresh state snapshot at dispatch time.
        const stateSnapshot = this.contextFactory().getState();
        const payload: BitPluginErrorEvent<T> = {
          source: entry.source,
          pluginName: entry.pluginName,
          error: entry.error,
          event: entry.event,
          values: stateSnapshot.values,
          state: stateSnapshot,
        };

        for (const plugin of this.plugins) {
          const onError = plugin.hooks?.onError;
          if (!onError) continue;

          try {
            await onError(payload, this.contextFactory());
          } catch {
            // fail-open: ignore secondary errors from onError handlers
          }
        }
      }
    } finally {
      this.notifyingError = false;
    }

    if (this.pendingErrorQueue.length > 0) {
      this.notifyingError = true;
      try {
        while (this.pendingErrorQueue.length > 0) {
          const entry = this.pendingErrorQueue.shift();
          if (!entry) break;

          const stateSnapshot = this.contextFactory().getState();
          const payload: BitPluginErrorEvent<T> = {
            source: entry.source,
            pluginName: entry.pluginName,
            error: entry.error,
            event: entry.event,
            values: stateSnapshot.values,
            state: stateSnapshot,
          };

          for (const plugin of this.plugins) {
            const onError = plugin.hooks?.onError;
            if (!onError) continue;

            try {
              await onError(payload, this.contextFactory());
            } catch {}
          }
        }
      } finally {
        this.notifyingError = false;
      }
    }
  }

  destroy() {
    for (let index = this.teardownFns.length - 1; index >= 0; index -= 1) {
      const teardown = this.teardownFns[index];
      try {
        teardown();
      } catch (error) {
        void this.reportError("teardown", error);
      }
    }

    this.teardownFns = [];
    this.cachedContext = null;
  }

  private async emitHook(
    hookName:
      | "beforeValidate"
      | "afterValidate"
      | "beforeSubmit"
      | "afterSubmit",
    event:
      | BitBeforeValidateEvent<T>
      | BitAfterValidateEvent<T>
      | BitBeforeSubmitEvent<T>
      | BitAfterSubmitEvent<T>,
  ) {
    const context = this.getContext();

    for (const plugin of this.plugins) {
      const hook = plugin.hooks?.[hookName];
      if (!hook) continue;

      try {
        await hook(event as never, context);
      } catch (error) {
        await this.reportError(hookName, error, event, plugin.name);
      }
    }
  }

  private getContext(): BitPluginContext<T> {
    if (!this.cachedContext) {
      this.cachedContext = this.contextFactory();
    }

    return this.cachedContext;
  }
}
