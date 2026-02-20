# Getting Started

Welcome to **Bit-Form**! This guide will help you install the library and set up your very first form.

Bit-Form is an agnostic and performant form state management library. It was built to handle complex requirements—like asynchronous validations, dynamic masking, and conditional logic—while keeping your UI components clean and strictly decoupled from the business logic.

## Installation

Bit-Form is available as a single package that includes the core logic and bindings for React, React Native, Vue, and Angular.

Install it using your preferred package manager:

```bash
npm install bit-form
# or
yarn add bit-form
# or
pnpm add bit-form
```

## Quick Start (React Example)

Since Bit-Form separates the state management (Core) from the UI layer (Framework integrations), setting up a form generally involves three simple steps: creating the store, providing it to your app, and connecting your fields.

Here is a quick example using React:

### 1. Create the Store

First, instantiate a `BitStore` with your initial values. You can define this outside of your component lifecycle or inside a stable reference to prevent unnecessary re-renders.

```tsx
import { BitStore } from "bit-form";

// Define your initial state
const myStore = new BitStore({
  initialValues: {
    name: "",
    email: "",
  },
});
```

### 2. Provide the Store

Wrap your form component with the `BitFormProvider` to make the store context available to all nested hooks.

```tsx
import { BitFormProvider } from "bit-form/react";
import MyFormContent from "./MyFormContent";

export default function App() {
  return (
    <BitFormProvider store={myStore}>
      <MyFormContent />
    </BitFormProvider>
  );
}
```

### 3. Connect your Fields

Inside your components, use the `useBitField` hook to bind inputs to the store state seamlessly. The hook provides a `props` object that you can spread directly into your input elements.

```tsx
import { useBitField, useBitForm } from "bit-form/react";

export default function MyFormContent() {
  // Connect the fields using their paths
  const nameField = useBitField("name");
  const emailField = useBitField("email");

  // Access form-level actions and metadata
  const { submit, isValid, isSubmitting } = useBitForm();

  // The submit wrapper automatically calls preventDefault()
  const onSubmit = submit((values) => {
    console.log("Form submitted with:", values);
  });

  return (
    <form onSubmit={onSubmit}>
      <div>
        <label>Name</label>
        {/* Spread the props (value, onChange, onBlur) directly */}
        <input {...nameField.props} placeholder="Enter your name" />
        {nameField.invalid && (
          <span style={{ color: "red" }}>{nameField.error}</span>
        )}
      </div>

      <div>
        <label>Email</label>
        <input {...emailField.props} placeholder="Enter your email" />
        {emailField.invalid && (
          <span style={{ color: "red" }}>{emailField.error}</span>
        )}
      </div>

      <button type="submit" disabled={!isValid || isSubmitting}>
        Submit
      </button>
    </form>
  );
}
```

## Next Steps

Now that you have your first form running, dive deeper into Bit-Form's powerful features:

- **[Core Concepts](./02-core-concepts.md)**: Learn how the `BitStore` handles state and lifecycle under the hood.
- **[Framework Guides](./frameworks/react.md)**: Check out specific guides for React, React Native, Vue, or Angular.
- **[Validation & Resolvers](../features/validation.md)**: Learn how to connect schemas like Zod, Yup, or Joi to your forms.
