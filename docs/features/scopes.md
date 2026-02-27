# Scopes

Scopes let you group form fields (e.g. by wizard step) for **per-step validation** and status. You can validate a single step before allowing "Next", check if a step has errors or is dirty, and display step-specific error messages.

## Store Configuration

Define scopes by setting `scope` on each field in `fields`:

```tsx
import { BitStore } from "bit-form";

const store = new BitStore({
  initialValues: {
    name: "",
    email: "",
    address: "",
    city: "",
  },
  fields: {
    name: { scope: "step1" },
    email: { scope: "step1" },
    address: { scope: "step2" },
    city: { scope: "step2" },
  },
});
```

- **`step1`** groups `name` and `email`
- **`step2`** groups `address` and `city`

You can use these scope names with the framework integrations (`useBitScope`, `injectBitScope`) and with `store.validate({ scope })`, `store.getStepStatus()`, and `store.getStepErrors()`.

## React: `useBitScope`

```tsx
import { useBitScope } from "bit-form/react";

export function WizardStep1() {
  const step1 = useBitScope("step1");

  const handleNext = async () => {
    const { valid } = await step1.validate();
    if (valid) goToStep(2);
  };

  return (
    <div>
      {step1.status.hasErrors && <p>Corrija os erros antes de continuar.</p>}
      {Object.entries(step1.errors).map(([field, msg]) => (
        <p key={field}>{msg}</p>
      ))}
      <button onClick={handleNext} disabled={!step1.isValid}>
        Próximo
      </button>
    </div>
  );
}
```

### Return values

| Property     | Type                              | Description                                      |
|-------------|-----------------------------------|--------------------------------------------------|
| `scopeName` | `string`                          | Name of the scope                                |
| `status`    | `{ hasErrors, isDirty, errors }`  | Current status of the scope                      |
| `errors`    | `Record<string, string>`          | Errors for fields in this scope                  |
| `validate`  | `() => Promise<{ valid, errors }>`| Validates only the scope's fields                |
| `getErrors` | `() => Record<string, string>`    | Returns errors for the scope                     |
| `isValid`   | `boolean`                         | `!status.hasErrors`                              |
| `isDirty`   | `boolean`                         | `status.isDirty`                                 |

## Vue: `useBitScope`

```vue
<script setup lang="ts">
import { useBitScope } from "bit-form/vue";

const step1 = useBitScope("step1");

const handleNext = async () => {
  const { valid } = await step1.validate();
  if (valid) goToStep(2);
};
</script>

<template>
  <div>
    <p v-if="step1.status.value.hasErrors">Corrija os erros antes de continuar.</p>
    <button @click="handleNext" :disabled="!step1.isValid.value">
      Próximo
    </button>
  </div>
</template>
```

Vue returns the same shape as React, but `status` and `errors` are refs, and `isValid` / `isDirty` are computed refs.

## Angular: `injectBitScope`

```ts
import { injectBitScope } from "bit-form/angular";

@Component({...})
export class WizardStep1Component {
  step1 = injectBitScope("step1");

  async handleNext() {
    const { valid } = await this.step1.validate();
    if (valid) this.goToStep(2);
  }
}
```

```html
<p *ngIf="step1.status().hasErrors">Corrija os erros antes de continuar.</p>
<button (click)="handleNext()" [disabled]="!step1.isValid()">
  Próximo
</button>
```

Angular exposes `status`, `errors`, `isValid`, and `isDirty` as signals (call them as `status()`, `isValid()`, etc.).

## Store API (Core)

If you use the store directly (without framework hooks):

- **`store.validate({ scope: "step1" })`** — Validates only the fields in `step1`
- **`store.getStepStatus(scopeName)`** — Returns `{ hasErrors, isDirty, errors }`
- **`store.getStepErrors(scopeName)`** — Returns `Record<string, string>`

## Typical use: Wizard / multi-step forms

1. Define `scopes` in the store for each step.
2. Use `useBitScope` / `injectBitScope` in each step component.
3. Before moving to the next step, call `validate()` on the current scope.
4. Use `status`, `errors`, `isValid`, `isDirty` to control UI and "Next" button state.

See the [Complete Form Example](../examples/complete-form-example.md) for a full implementation with scopes.
