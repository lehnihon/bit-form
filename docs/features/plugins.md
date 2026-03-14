# Lifecycle Plugins

Bit-Form supports lifecycle plugins through `config.plugins`.

Plugins are **observability-first** and **fail-open**:

- They can observe validate/submit/field-change lifecycle.
- They do not change core flow by contract.
- If a plugin throws, core flow continues and `onError` is called.

Bit-Form also wires DevTools internally through a lazy plugin (`bit-devtools`) when `devTools` is enabled.
This keeps DevTools opt-in while preserving the same plugin lifecycle and teardown behavior.

---

## Supported hooks

- `beforeValidate`
- `afterValidate`
- `beforeSubmit`
- `afterSubmit`
- `onFieldChange`
- `onError`

---

## Basic usage

```ts
import { createBitStore, BitPlugin } from "@lehnihon/bit-form";

type FormValues = { name: string; items: string[] };

const analyticsPlugin: BitPlugin<FormValues> = {
  name: "analytics",
  hooks: {
    beforeValidate: (event) => {
      console.log("validate:start", {
        scope: event.scope,
        scopeFields: event.scopeFields,
      });
    },
    afterValidate: (event) => {
      console.log("validate:end", {
        valid: event.result,
        errors: event.errors,
      });
    },
    beforeSubmit: (event) => {
      console.log("submit:start", {
        values: event.values,
        dirtyValues: event.dirtyValues,
      });
    },
    afterSubmit: (event) => {
      console.log("submit:end", {
        success: event.success,
        invalid: event.invalid,
        error: event.error,
      });
    },
    onFieldChange: (event) => {
      console.log("field:change", {
        path: event.path,
        origin: event.meta.origin,
        operation: event.meta.operation,
      });
    },
    onError: (event) => {
      console.warn("plugin:error", {
        source: event.source,
        pluginName: event.pluginName,
        error: event.error,
      });
    },
  },
};

const store = createBitStore<FormValues>({
  initialValues: { name: "", items: [] },
  plugins: [analyticsPlugin],
});
```

---

## Setup and teardown

A plugin can run setup on store initialization and return a teardown callback.

```ts
const plugin: BitPlugin = {
  name: "lifecycle",
  setup: (ctx) => {
    console.log("plugin setup", ctx.storeId);

    return () => {
      console.log("plugin teardown", ctx.storeId);
    };
  },
};
```

Teardown runs when `store.cleanup()` is called.

---

## Event notes

- `onFieldChange` fires for:
  - `setField` (`meta.origin = "setField"`)
  - `rebase` (`meta.origin = "rebase"`)
  - `replaceValues` (`meta.origin = "replaceValues"`)
  - `hydrate` (`meta.origin = "hydrate"`)
  - array operations (`meta.origin = "array"`, `meta.operation = push|prepend|insert|remove|move|swap`)
- Validate hooks receive scope/scopeFields context when provided.
- Submit hooks receive `values` and `dirtyValues` snapshot.
- Submit lifecycle is stage-based (`submit:start`, `submit:prepare`, hooks, handler, finalize),
  so plugin hooks run in deterministic order around the same pipeline.

---

## Types

Main exported types:

- `BitPlugin<T>`
- `BitPluginContext<T>`
- `BitPluginHooks<T>`
- `BitPluginErrorEvent<T>`
- `BitFieldChangeEvent<T>`
- `BitBeforeValidateEvent<T>`
- `BitAfterValidateEvent<T>`
- `BitBeforeSubmitEvent<T>`
- `BitAfterSubmitEvent<T>`
