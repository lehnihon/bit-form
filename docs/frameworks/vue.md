# Vue Integration

Bit-Form embraces Vue's Composition API. It utilizes `provide` and `inject` to pass the store through your component tree, and wraps the store state in Vue's `computed` and `ref` to ensure deep reactivity.

## 1. Provide the Store

In your parent component, instantiate the `BitStore` and provide it using `provideBitStore`.

```vue
<script setup lang="ts">
import { BitStore } from "@lehnihon/bit-form";
import { provideBitStore } from "@lehnihon/bit-form/vue";
import UserForm from "./UserForm.vue";

const store = new BitStore({
  initialValues: { email: "", age: 18 },
});

// Provide the store to all child components
provideBitStore(store);
</script>

<template>
  <UserForm />
</template>
```

## 2. Using `useBitField`

Inside your child components, use `useBitField` to connect your inputs. It now returns:

- Value helpers at root level: `value`, `displayValue`, `modelValue`, `setValue()`, `setBlur()`
- `meta`: UI/validation refs (`invalid`, `error`, `touched`, `isDirty`, `isValidating`, `isHidden`, `isRequired`)

For native inputs, bind `v-model` to `modelValue`.

```vue
<script setup lang="ts">
import { useBitField } from "@lehnihon/bit-form/vue";

const emailField = useBitField("email");
const ageField = useBitField("age");
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
const form = useBitForm();

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

// Secondary actions grouped by semantic meaning
form.mutations.pushItem(); // for array operations
form.mutations.removeItem();

// History is now separated
const history = useBitHistory();
history.undo();
history.redo();
history.canUndo.value; // boolean
history.canRedo.value; // boolean
history.historyIndex.value; // number
history.historySize.value; // number

// Custom mask registration is done on the store
store.registerMask("myMask", myMask);
```

### Usage Example

```vue
<script setup lang="ts">
import { useBitForm } from "@lehnihon/bit-form/vue";

const form = useBitForm();

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

For multi-step or wizard forms, define `scopes` in your store and use `useBitScope` to validate and track status per step.

```vue
<script setup lang="ts">
import { useBitScope } from "@lehnihon/bit-form/vue";

// Store config: scopes: { step1: ["name", "email"], step2: ["address"] }
const step1 = useBitScope("step1");

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
