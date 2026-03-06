# React Integration

Bit-Form provides first-class support for React through custom hooks and a Context Provider. It ensures your components only re-render when absolutely necessary by subscribing directly to the agnostic `BitStore`.

## 1. Setup the Provider

Wrap your application or form component with `BitFormProvider`. This allows any nested components to access the store via hooks.

```tsx
import { BitStore } from "@lehnihon/bit-form";
import { BitFormProvider } from "@lehnihon/bit-form/react";
import MyForm from "./MyForm";

const store = new BitStore({
  initialValues: { username: "", password: "" },
});

export default function App() {
  return (
    <BitFormProvider store={store}>
      <MyForm />
    </BitFormProvider>
  );
}
```

## 2. Using `useBitForm`

The `useBitForm` hook gives you access to the form's metadata and actions. All readonly state is grouped under `meta`, main actions are flat, and secondary actions are grouped.

### Form Structure

```tsx
const form = useBitForm();

// Readonly state under meta
form.meta.isValid; // boolean
form.meta.isDirty; // boolean
form.meta.isSubmitting; // boolean
form.meta.canUndo; // boolean
form.meta.canRedo; // boolean
form.meta.submitError; // Error | null
form.meta.lastResponse; // unknown

// Getters
form.getValues(); // T
form.getErrors(); // BitErrors<T>
form.getTouched(); // BitTouched<T>
form.getDirtyValues(); // Partial<T> - only changed fields

// Main actions remain flat
form.submit();
form.onSubmit();
form.reset();
form.setField();
// ... etc

// Secondary actions grouped by semantic meaning
form.mutations.pushItem(); // for array operations
form.mutations.removeItem();
form.history.undo(); // for history/time-travel
form.history.redo();

// Custom mask registration is done on the store
store.registerMask("myMask", myMask);
```

### Basic `submit`

```tsx
import { useBitForm } from "@lehnihon/bit-form/react";

export function SubmitButton() {
  const form = useBitForm();

  const onSubmit = form.submit((values, dirtyValues) => {
    console.log("Full payload:", values);
    console.log("Only changed:", dirtyValues);
  });

  return (
    <button
      onClick={onSubmit}
      disabled={!form.meta.isValid || form.meta.isSubmitting}
    >
      {form.meta.isSubmitting ? "Loading..." : "Submit"}
    </button>
  );
}
```

### Recommended `onSubmit` (API + server errors)

Use `onSubmit` when your form calls an API. It handles `preventDefault`, calls the API, maps 422 validation errors to fields via `setServerErrors`, and exposes `submitError` and `lastResponse` for UI feedback.

```tsx
const form = useBitForm();

const handleSubmit = form.onSubmit(async (values, dirtyValues) => {
  // Use dirtyValues for PATCH requests
  const res = await api.patchUser(userId, dirtyValues);
  return res.data;
});

<form onSubmit={handleSubmit}>
  {form.meta.submitError && <p>{form.meta.submitError.message}</p>}
  <button disabled={form.meta.isSubmitting}>Submit</button>
</form>;
```

See [Server Errors Example](../examples/server-errors.md) for the full pattern.

## 3. Connecting Fields with `useBitField`

The `useBitField` hook binds an input to a specific path in your store. It now returns:

- Value + handlers at root level: `value`, `displayValue`, `setValue()`, `setBlur()`, `onChange()`, `onBlur()`
- `meta`: UI state (`invalid`, `error`, `touched`, `isDirty`, `isValidating`, `isHidden`, `isRequired`)
- `props`: HTML helper (`value`, `onChange`, `onBlur`) for native inputs

You can also register field config directly in React with the second argument (`BitFieldDefinition`) and keep mask options as the third argument.

```tsx
import { useBitField } from "@lehnihon/bit-form/react";

export function UsernameInput() {
  const username = useBitField("username");
  const age = useBitField(
    "age",
    {
      validation: {
        asyncValidate: async (value) =>
          Number(value) < 18 ? "Must be 18+" : undefined,
      },
    },
    { mask: "integer" },
  );

  return (
    <div>
      <label>Username</label>
      <input {...username.props} placeholder="Enter username" />
      {username.meta.invalid && (
        <span className="error">{username.meta.error}</span>
      )}

      <label>Age</label>
      <input {...age.props} />
    </div>
  );
}
```

## 4. Array Fields with `useBitArray`

For dynamic lists, use `useBitArray`. It provides array manipulation methods (`append`, `remove`, `move`, `swap`, `insert`, `replace`, `clear`) and a stable `fields` array with unique keys.

```tsx
import { useBitArray } from "@lehnihon/bit-form/react";

export function TagsList() {
  const { fields, append, remove } = useBitArray("tags");

  return (
    <div>
      {fields.map((field, index) => (
        <div key={field.key}>
          <span>{field.value}</span>
          <button type="button" onClick={() => remove(index)}>
            Remove
          </button>
        </div>
      ))}
      <button type="button" onClick={() => append("New Tag")}>
        Add Tag
      </button>
    </div>
  );
}
```

## 5. Scoped Validation with `useBitScope`

For multi-step or wizard forms, define `scopes` in your store config and use `useBitScope` to validate and track status per step.

```tsx
import { useBitScope } from "@lehnihon/bit-form/react";

// Store config: scopes: { step1: ["name", "email"], step2: ["address"] }
const step1 = useBitScope("step1");

const handleNext = async () => {
  const { valid } = await step1.validate();
  if (valid) goToStep(2);
};

// step1.status, step1.isValid, step1.isDirty, step1.errors
```

See [Scopes](../features/scopes.md) for full documentation and store configuration.
