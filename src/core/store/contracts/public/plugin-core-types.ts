import type { BitConfig } from "./config-types";
import type { BitMaybePromise } from "./persist-types";
import type {
  BitAfterSubmitEvent,
  BitAfterValidateEvent,
  BitBeforeSubmitEvent,
  BitBeforeValidateEvent,
  BitFieldChangeEvent,
  BitPluginErrorEvent,
} from "./plugin-event-types";
import type { BitState } from "./state-types";

export interface BitPluginContext<T extends object = Record<string, unknown>> {
  storeId: string;
  getState: () => Readonly<BitState<T>>;
  getConfig: () => Readonly<BitConfig<T>>;
}

export interface BitPluginHooks<T extends object = Record<string, unknown>> {
  beforeValidate?: (
    event: BitBeforeValidateEvent<T>,
    context: BitPluginContext<T>,
  ) => BitMaybePromise<void>;
  afterValidate?: (
    event: BitAfterValidateEvent<T>,
    context: BitPluginContext<T>,
  ) => BitMaybePromise<void>;
  beforeSubmit?: (
    event: BitBeforeSubmitEvent<T>,
    context: BitPluginContext<T>,
  ) => BitMaybePromise<void>;
  afterSubmit?: (
    event: BitAfterSubmitEvent<T>,
    context: BitPluginContext<T>,
  ) => BitMaybePromise<void>;
  onFieldChange?: (
    event: BitFieldChangeEvent<T>,
    context: BitPluginContext<T>,
  ) => BitMaybePromise<void>;
  onError?: (
    event: BitPluginErrorEvent<T>,
    context: BitPluginContext<T>,
  ) => BitMaybePromise<void>;
}

export interface BitPlugin<T extends object = Record<string, unknown>> {
  name: string;
  setup?: (context: BitPluginContext<T>) => void | (() => void);
  hooks?: BitPluginHooks<T>;
}
