# React Integration

Bit-Form provides first-class support for React through custom hooks and a Context Provider. It ensures your components only re-render when absolutely necessary by subscribing directly to the agnostic `BitStore`.

## 1. Setup the Provider

Wrap your application or form component with `BitFormProvider`. This allows any nested components to access the store via hooks.

```tsx
import { BitStore } from "bit-form";
import { BitFormProvider } from "bit-form/react";
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

The `useBitForm` hook gives you access to the form's metadata, such as `isValid`, `isSubmitting`, and the `submit` wrapper function.

```tsx
import { useBitForm } from "bit-form/react";

export function SubmitButton() {
  const { isValid, isSubmitting, submit } = useBitForm();

  const onSubmit = submit((values) => {
    console.log("Payload:", values);
  });

  return (
    <button onClick={onSubmit} disabled={!isValid || isSubmitting}>
      {isSubmitting ? "Loading..." : "Submit"}
    </button>
  );
}
```

## 3. Connecting Fields with `useBitField`

The `useBitField` hook binds an input to a specific path in your store. It returns a `props` object containing `value`, `onChange`, and `onBlur`, which you can spread directly onto your native HTML inputs.

```tsx
import { useBitField } from "bit-form/react";

export function UsernameInput() {
  const field = useBitField("username");

  return (
    <div>
      <label>Username</label>
      <input {...field.props} placeholder="Enter username" />
      {field.invalid && <span className="error">{field.error}</span>}
    </div>
  );
}
```

## 4. Array Fields with `useBitFieldArray`

For dynamic lists, use `useBitFieldArray`. It provides array manipulation methods (`append`, `remove`, `move`, `swap`) and a stable `fields` array with unique keys.

```tsx
import { useBitFieldArray } from "bit-form/react";

export function TagsList() {
  const { fields, append, remove } = useBitFieldArray("tags");

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
