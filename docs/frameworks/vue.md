# Vue Integration

Bit-Form embraces Vue's Composition API with store-bound bindings, without requiring provide/inject wiring in application code.

There are two usage layers:

- Recommended (basic DX): `createBitVueForm(config)`
- Advanced (explicit store control): `createBitStore(config)` + `createBitVueBindings(store)`

## 1. Quick Setup (Recommended)

Create bindings once and consume them inside setup functions.

```vue
<script setup lang="ts">
import { createBitVueForm } from "@lehnihon/bit-form/vue";
import UserForm from "./UserForm.vue";

const bit = createBitVueForm({
  initialValues: { email: "", age: 18 },
});
</script>

<template>
  <UserForm :bit="bit" />
</template>
```

## 2. Advanced Setup (Explicit Store)

```ts
import { createBitStore } from "@lehnihon/bit-form";
import { createBitVueBindings } from "@lehnihon/bit-form/vue";

const store = createBitStore({ initialValues: { email: "", age: 18 } });
const bit = createBitVueBindings(store);
```

## 2. Using `useBitField`

Inside your child components, use `useBitField` to connect your inputs. It now returns:

- Value helpers at root level: `value`, `displayValue`, `modelValue`, `setValue()`, `setBlur()`
- `meta`: UI/validation refs (`invalid`, `error`, `touched`, `isDirty`, `isValidating`, `isHidden`, `isRequired`)

For native inputs, bind `v-model` to `modelValue`.

```vue
<script setup lang="ts">
import type { BitVueBindings } from "@lehnihon/bit-form/vue";

const props = defineProps<{ bit: BitVueBindings<any> }>();
const emailField = props.bit.useBitField("email");
const ageField = props.bit.useBitField("age");
</script>

<template>
  <div>
    <label>Email</label>
    <input
      v-model="emailField.modelValue.value"
      @blur="emailField.setBlur()"
      type="email"
    />
    <span v-if="emailField.meta.invalid.value">{{
      emailField.meta.error.value
    }}</span>

    <label>Age</label>
    <input
      v-model="ageField.modelValue.value"
      @blur="ageField.setBlur()"
      type="number"
    />
  </div>
</template>
```

## 3. Submitting the Form

Use `useBitForm` to access form metadata and actions. All readonly state is grouped under `meta` (as computed refs).

### Form Structure

```ts
const form = bit.useBitForm();

// Readonly state under meta (all ComputedRef or Ref)
form.meta.isValid; // ComputedRef<boolean>
form.meta.isDirty; // ComputedRef<boolean>
form.meta.isSubmitting; // ComputedRef<boolean>
form.meta.submitError; // Ref<Error | null>
form.meta.lastResponse; // Ref<unknown>

// Getters
form.getValues(); // T
form.getErrors(); // BitErrors<T>
form.getTouched(); // BitTouched<T>
form.getDirtyValues(); // Partial<T> - only changed fields

// Main actions remain flat
form.submit();
form.onSubmit();
form.reset();
// ... etc

// Array operations are handled by useBitArray
const skills = bit.useBitArray("skills");
// Keys come from store idFactory (deterministic when customized)
skills.append("React");
skills.remove(0);

// History is now separated
const history = bit.useBitHistory();
history.undo();
history.redo();
history.canUndo.value; // boolean
history.canRedo.value; // boolean
history.historyIndex.value; // number
history.historySize.value; // number
```

### Usage Example

```vue
<script setup lang="ts">
import type { BitVueBindings } from "@lehnihon/bit-form/vue";

const props = defineProps<{ bit: BitVueBindings<any> }>();
const form = props.bit.useBitForm();

// Simple submit
const handleSubmit = form.submit((values, dirtyValues) => {
  console.log("Vue Form Submitted:", values);
  console.log("Only changed:", dirtyValues);
});

// Or use onSubmit for API + server errors
const handleApiSubmit = form.onSubmit(async (values, dirtyValues) => {
  // Use dirtyValues for PATCH
  const res = await api.patchUser(userId, dirtyValues);
  return res.data;
});
</script>

<template>
  <form @submit="handleSubmit">
    <p v-if="form.meta.submitError.value">
      {{ form.meta.submitError.value.message }}
    </p>
    <button
      type="submit"
      :disabled="!form.meta.isValid.value || form.meta.isSubmitting.value"
    >
      Submit
    </button>
  </form>
</template>
```

## 4. Scoped Validation with `useBitScope`

For multi-step or wizard forms, define `scope` per field in `fields` and use `useBitScope` to validate and track status per step.

```vue
<script setup lang="ts">
import type { BitVueBindings } from "@lehnihon/bit-form/vue";

// Store config:
// fields: {
//   name: { scope: "step1" },
//   email: { scope: "step1" },
//   address: { scope: "step2" },
// }
const props = defineProps<{ bit: BitVueBindings<any> }>();
const step1 = props.bit.useBitScope("step1");

const handleNext = async () => {
  const { valid } = await step1.validate();
  if (valid) goToStep(2);
};
</script>

<template>
  <button @click="handleNext" :disabled="!step1.isValid.value">Próximo</button>
</template>
```

See [Scopes](../features/scopes.md) for full documentation.

## 5. Draft Persistence with `useBitPersist`

`useBitPersist` gives explicit draft actions and reactive meta refs.

Its `meta` refs are sourced from the core persistence metadata (`state.persist`).

```vue
<script setup lang="ts">
import type { BitVueBindings } from "@lehnihon/bit-form/vue";

const props = defineProps<{ bit: BitVueBindings<any> }>();
const persist = props.bit.useBitPersist();

async function saveDraft() {
  await persist.save();
}

async function restoreDraft() {
  await persist.restore();
}

async function clearDraft() {
  await persist.clear();
}
</script>

<template>
  <button type="button" @click="saveDraft">Save Draft</button>
  <button type="button" @click="restoreDraft">Restore Draft</button>
  <button type="button" @click="clearDraft">Clear Draft</button>
  <p v-if="persist.meta.error.value">{{ persist.meta.error.value.message }}</p>
</template>
```

See [Draft Persistence](../features/persistence.md) for full config options.
