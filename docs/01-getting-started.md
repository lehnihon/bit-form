# Getting Started

Welcome to **Bit-Form**! This guide will help you install the library and set up your very first form.

Bit-Form is an agnostic and performant form state management library. It was built to handle complex requirements—like asynchronous validations, dynamic masking, and conditional logic—while keeping your UI components clean and strictly decoupled from the business logic.

## Installation

Bit-Form is available as a single package that includes the core logic and bindings for React, React Native, Vue, and Angular.

Install it using your preferred package manager:

```bash
npm install @lehnihon/bit-form
# or
yarn add @lehnihon/bit-form
# or
pnpm add @lehnihon/bit-form
```

## Quick Start (React Example)

Since Bit-Form separates state management (Core) from framework integrations, setup is straightforward: create bindings and connect your fields.

Here is a quick example using React:

### 1. Create the Form Bindings

Use `createBitReactForm` with your initial values. This creates the store internally and returns React bindings.

```tsx
import { createBitReactForm } from "@lehnihon/bit-form/react";

const bit = createBitReactForm({
  initialValues: {
    name: "",
    email: "",
  },
});
```

### 2. Use Bindings in Components

```tsx
import MyFormContent from "./MyFormContent";

export default function App() {
  return <MyFormContent bit={bit} />;
}
```

### 3. Connect your Fields

Inside your components, use the `useBitField` hook to bind inputs to the store state seamlessly. The hook provides a `props` helper for native inputs and a `meta` object for validation/UI state.

```tsx
import type { BitReactBindings } from "@lehnihon/bit-form/react";

export default function MyFormContent({ bit }: { bit: BitReactBindings<any> }) {
  // Connect the fields using their paths
  const nameField = bit.useBitField("name");
  const emailField = bit.useBitField("email");

  // Access form-level actions and metadata
  const form = bit.useBitForm();

  // The submit wrapper automatically calls preventDefault()
  const onSubmit = form.submit((values) => {
    console.log("Form submitted with:", values);
  });

  return (
    <form onSubmit={onSubmit}>
      <div>
        <label>Name</label>
        {/* Spread the props (value, onChange, onBlur) directly */}
        <input {...nameField.props} placeholder="Enter your name" />
        {nameField.meta.invalid && (
          <span style={{ color: "red" }}>{nameField.meta.error}</span>
        )}
      </div>

      <div>
        <label>Email</label>
        <input {...emailField.props} placeholder="Enter your email" />
        {emailField.meta.invalid && (
          <span style={{ color: "red" }}>{emailField.meta.error}</span>
        )}
      </div>

      <button
        type="submit"
        disabled={!form.meta.isValid || form.meta.isSubmitting}
      >
        Submit
      </button>
    </form>
  );
}
```

## Next Steps

Now that you have your first form running, dive deeper into Bit-Form's powerful features:

- **[Documentation Hub](./README.md)**: Navigate docs by goal (onboarding, problem-solving, API).
- **[Core Concepts](./02-core-concepts.md)**: Learn how the `BitStore` handles state and lifecycle under the hood.
- **[Framework Guides](./frameworks/react.md)**: Check out specific guides for React, React Native, Vue, or Angular.
- **[Validation & Resolvers](./features/validation.md)**: Learn how to connect schemas like Zod, Yup, or Joi to your forms.
- **[Scopes](./features/scopes.md)**: Per-step validation for wizard forms with `useBitScope` / `injectBitScope`.
- **[When to Use What](./guides/when-to-use-what.md)**: Quick reference for choosing the right feature (resolver, asyncValidate, setServerErrors, etc.).
- **[Troubleshooting](./guides/troubleshooting.md)**: Diagnose common setup, validation, and devtools issues.
- **[Testing Guide](./guides/testing.md)**: Test store behavior, framework bindings, and e2e flows.
- **[Masks Example](./examples/masks-example.md)**: Define masks per field in `fields.path.mask`, with built-in presets.
- **[Complete Example](./examples/complete-form-example.md)**: See masks, asyncValidate, conditional logic, scopes, history, and DevTools working together.
