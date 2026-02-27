# Vue Integration

Bit-Form embraces Vue's Composition API. It utilizes `provide` and `inject` to pass the store through your component tree, and wraps the store state in Vue's `computed` and `ref` to ensure deep reactivity.

## 1. Provide the Store

In your parent component, instantiate the `BitStore` and provide it using `provideBitStore`.

```vue
<script setup lang="ts">
import { BitStore } from "bit-form";
import { provideBitStore } from "bit-form/vue";
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

Inside your child components, use `useBitField` to connect your inputs. You can bind the field value directly using `v-model`.

```vue
<script setup lang="ts">
import { useBitField } from "bit-form/vue";

const emailField = useBitField("email");
const ageField = useBitField("age");
</script>

<template>
  <div>
    <label>Email</label>
    <input
      v-model="emailField.value.value"
      @blur="emailField.setBlur()"
      type="email"
    />
    <span v-if="emailField.invalid.value">{{ emailField.error.value }}</span>

    <label>Age</label>
    <input
      v-model="ageField.value.value"
      @blur="ageField.setBlur()"
      type="number"
    />
  </div>
</template>
```

## 3. Submitting the Form

Use `useBitForm` to access form metadata, the `submit` wrapper, and the recommended `onSubmit` helper (which handles API calls and 422 server errors automatically).

```vue
<script setup lang="ts">
import { useBitForm } from "bit-form/vue";

const { submit, onSubmit, submitError, isSubmitting, isValid } = useBitForm();

// Simple submit
const handleSubmit = submit((values) => {
  console.log("Vue Form Submitted:", values);
});

// Or use onSubmit for API + server errors
const handleApiSubmit = onSubmit(async (values) => {
  const res = await api.createUser(values);
  return res.data;
});
</script>

<template>
  <form @submit="handleSubmit">
    <p v-if="submitError">{{ submitError.message }}</p>
    <button type="submit" :disabled="!isValid.value || isSubmitting.value">
      Submit
    </button>
  </form>
</template>
```

## 4. Scoped Validation with `useBitScope`

For multi-step or wizard forms, define `scopes` in your store and use `useBitScope` to validate and track status per step.

```vue
<script setup lang="ts">
import { useBitScope } from "bit-form/vue";

// Store config: scopes: { step1: ["name", "email"], step2: ["address"] }
const step1 = useBitScope("step1");

const handleNext = async () => {
  const { valid } = await step1.validate();
  if (valid) goToStep(2);
};
</script>

<template>
  <button @click="handleNext" :disabled="!step1.isValid.value">
    Próximo
  </button>
</template>
```

See [Scopes](../features/scopes.md) for full documentation.
