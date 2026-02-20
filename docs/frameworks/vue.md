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

Use `useBitForm` to access form metadata and the `submit` wrapper.

```vue
<script setup lang="ts">
import { useBitForm } from "bit-form/vue";

const { submit, isSubmitting, isValid } = useBitForm();

const onSubmit = submit((values) => {
  console.log("Vue Form Submitted:", values);
});
</script>

<template>
  <form @submit="onSubmit">
    <button type="submit" :disabled="!isValid.value || isSubmitting.value">
      Submit
    </button>
  </form>
</template>
```
