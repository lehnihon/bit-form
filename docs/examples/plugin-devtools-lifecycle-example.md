# Plugin Lifecycle + DevTools Example

## Scenario

You need audit-style logs for validation/submit stages and also want to inspect transitions with DevTools.

## Goal

Show how plugin hooks and devtools complement each other during debugging.

## Store Setup

```tsx
import { createBitStore, type BitPlugin } from "@lehnihon/bit-form";
import { createDevToolsPlugin } from "@lehnihon/bit-form/devtools";

type FormData = { email: string; acceptedTerms: boolean };

const auditPlugin: BitPlugin<FormData> = {
  name: "audit-plugin",
  hooks: {
    beforeValidate: ({ values }) => {
      console.info("beforeValidate", values);
    },
    afterValidate: ({ errors }) => {
      console.info("afterValidate", errors);
    },
    beforeSubmit: ({ payload }) => {
      console.info("beforeSubmit", payload);
    },
    afterSubmit: ({ result }) => {
      console.info("afterSubmit", result);
    },
    onError: ({ error, source }) => {
      console.error("plugin error", source, error);
    },
  },
};

export const store = createBitStore<FormData>({
  initialValues: { email: "", acceptedTerms: false },
  devTools: { enabled: true, mode: "local" },
  plugins: [createDevToolsPlugin(), auditPlugin],
});
```

## What to Observe

- Plugin logs for each lifecycle stage.
- Form timeline in devtools panel.
- Validation and submit metadata transitions.

## Related

- [Lifecycle Plugins](../features/plugins.md)
- [DevTools Overview](../devtools/index.md)
