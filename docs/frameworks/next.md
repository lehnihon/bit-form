# Next.js Integration

Bit-Form works with Next.js through the React adapter.

Use `@lehnihon/bit-form/react` and keep any component that uses Bit-Form hooks as a **Client Component** (`"use client"`).

## 1. Install

```bash
npm install @lehnihon/bit-form
```

## 2. App Router Setup (recommended)

Create bindings in a Client Component and pass them to your form components.

```tsx
"use client";

import { createBitReactForm } from "@lehnihon/bit-form/react";

export const bit = createBitReactForm({
  name: "signup",
  initialValues: {
    name: "",
    email: "",
  },
});
```

Use it in a page/layout client boundary:

```tsx
import { bit } from "./signup-form-bindings";
import { SignupForm } from "./signup-form";

export default function Page() {
  return <SignupForm bit={bit} />;
}
```

## 3. Form Component (Client)

```tsx
"use client";

import type { BitReactBindings } from "@lehnihon/bit-form/react";

export function SignupForm({ bit }: { bit: BitReactBindings<any> }) {
  const form = bit.useBitForm();
  const name = bit.useBitField("name");
  const email = bit.useBitField("email");

  const onSubmit = form.onSubmit(async (_values, dirtyValues) => {
    await fetch("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dirtyValues),
    });
  });

  return (
    <form onSubmit={onSubmit}>
      <input {...name.props} placeholder="Name" />
      <input {...email.props} placeholder="Email" type="email" />

      {form.meta.submitError && <p>{form.meta.submitError.message}</p>}

      <button type="submit" disabled={form.meta.isSubmitting}>
        {form.meta.isSubmitting ? "Sending..." : "Submit"}
      </button>
    </form>
  );
}
```

## 4. Route Handlers and Uploads

For uploads in Next.js, use Route Handlers (`app/api/.../route.ts`) and keep upload logic in `useBitUpload` on the client.

See:

- [File Uploads](../features/file-uploads.md)
- [Upload Integration Example](../examples/upload-integration-example.md)

## 5. Important Notes

- Hooks like `useBitForm`, `useBitField`, `useBitArray`, `useBitScope`, and `useBitPersist` must run in Client Components.
- `persist` with default storage uses browser `localStorage`, so restoration/saving happens on the client side.
- Pages Router is also supported; the same rule applies: components using hooks must be client-rendered.
