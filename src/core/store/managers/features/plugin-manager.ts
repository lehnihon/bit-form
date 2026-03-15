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

export class BitPluginManager<T extends object = any> {
  private teardownFns: Array<() => void> = [];
  private notifyingError = false;

  constructor(
    private plugins: BitPlugin<T>[],
    private contextFactory: () => BitPluginContext<T>,
  ) {}

  setupAll() {
    this.plugins.forEach((plugin) => {
      if (!plugin.setup) return;

      try {
        const maybeTeardown = plugin.setup(this.contextFactory());
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
    this.plugins.forEach((plugin) => {
      const hook = plugin.hooks?.onFieldChange;
      if (!hook) return;

      try {
        const result = hook(event, this.contextFactory());
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
    if (this.notifyingError) {
      return;
    }

    this.notifyingError = true;

    const context = this.contextFactory();
    const payload: BitPluginErrorEvent<T> = {
      source,
      pluginName,
      error,
      event,
      values: context.getState().values,
      state: context.getState(),
    };

    for (const plugin of this.plugins) {
      const onError = plugin.hooks?.onError;
      if (!onError) continue;

      try {
        await onError(payload, context);
      } catch {
        // fail-open: ignore secondary errors from onError handlers
      }
    }

    this.notifyingError = false;
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
    const context = this.contextFactory();

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
}
