# Server Errors: Client vs API Validation

Bit-Form distinguishes between **client-side validation** and **server-side errors**. This guide shows how to use each tool and the recommended pattern with `onSubmit`.

## Overview

| Tool                | When to use                                    | Handles                                                            |
| ------------------- | ---------------------------------------------- | ------------------------------------------------------------------ |
| **resolver**        | Schema validation (Zod, Yup, Joi)              | Sync validation before submit                                      |
| **asyncValidate**   | Real-time API checks (e.g. "email taken")      | Debounced per-field validation while typing                        |
| **setServerErrors** | 422/400 from API on submit                     | Errors returned after the form is sent                             |
| **onSubmit**        | Wrapper that calls API + handles server errors | preventDefault, setServerErrors on 422, submitError on 500/network |

## Client-Side: resolver + asyncValidate

Use these for validation that runs **before** or **while** the user fills the form.

### resolver (sync schema)

Runs on blur and before submit. Ideal for format checks, required fields, min/max length.

```tsx
import { zodResolver } from "@lehnihon/bit-form/resolvers/zod";
import { z } from "zod";

const schema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(6, "Mínimo 6 caracteres"),
});

const store = createBitStore({
  initialValues: { email: "", password: "" },
  validation: { resolver: zodResolver(schema) },
});
```

### asyncValidate (API checks while typing)

Runs after the user stops typing (debounced). Ideal for "username/email taken" checks.

```tsx
store.registerField("email", {
  validation: {
    asyncValidate: async (value) => {
      if (!value) return null;
      const { available } = await api.checkEmail(value);
      return available ? null : "E-mail já está em uso";
    },
    asyncValidateDelay: 500,
  },
});
```

## Server-Side: setServerErrors

When your API returns **422 Unprocessable Entity** or **400 Bad Request** with validation errors, you need to map them to form fields. The API typically returns:

```json
{
  "errors": {
    "email": ["E-mail já cadastrado"],
    "address.zipCode": "CEP inválido"
  }
}
```

### Option 1: Manual `submit` + `setServerErrors`

```tsx
const { submit, setServerErrors } = useBitForm();

const onSubmit = submit(async (values) => {
  try {
    await api.createUser(values);
  } catch (err: any) {
    if (err.response?.status === 422 && err.response?.data?.errors) {
      setServerErrors(err.response.data.errors);
    } else {
      throw err; // Re-throw for other errors
    }
  }
});
```

### Option 2: `onSubmit` helper (recommended)

The `onSubmit` helper does all of this automatically:

1. `preventDefault`
2. Validates and submits
3. On **success**: stores `lastResponse`, clears `submitError`
4. On **422/validation shape**: calls `setServerErrors` with the thrown payload
5. On **other errors** (500, network): sets `submitError` for display

```tsx
const { onSubmit, submitError, lastResponse } = useBitForm();

// Your API function throws on 4xx/5xx
const handleSubmit = onSubmit(async (values) => {
  const res = await api.createUser(values);
  return res.data; // Saved to lastResponse
});

return (
  <form onSubmit={handleSubmit}>
    {submitError && <p className="error">{submitError.message}</p>}
    {/* ... fields ... */}
  </form>
);
```

If your API returns 422 with `{ errors: { email: ["Taken"] } }`, your fetch/axios wrapper should **throw** that object. `onSubmit` detects the shape and calls `setServerErrors` automatically.

Example API wrapper:

```ts
async function createUser(values: UserForm) {
  const res = await fetch("/api/users", {
    method: "POST",
    body: JSON.stringify(values),
  });
  const data = await res.json();
  if (!res.ok) {
    // Throw the error body so onSubmit can detect validation errors
    throw data;
  }
  return data;
}
```

## Complete Example

```tsx
import { useBitForm, useBitField } from "@lehnihon/bit-form/react";
import { createBitStore } from "@lehnihon/bit-form";
import { zodResolver } from "@lehnihon/bit-form/resolvers/zod";
import { z } from "zod";

const schema = z.object({
  email: z.string().email("E-mail inválido"),
  name: z.string().min(2),
});

const store = createBitStore({
  initialValues: { email: "", name: "" },
  validation: { resolver: zodResolver(schema), delay: 300 },
});

function UserForm() {
  const { onSubmit, submitError, lastResponse, isSubmitting } = useBitForm();
  const email = useBitField("email");
  const name = useBitField("name");

  const handleSubmit = onSubmit(async (values) => {
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const data = await res.json();
    if (!res.ok) throw data; // 422 body has { errors: { ... } }
    return data;
  });

  return (
    <form onSubmit={handleSubmit}>
      {submitError && <p role="alert">{submitError.message}</p>}
      {lastResponse && <p>Cadastro realizado!</p>}

      <input {...email.props} />
      {email.invalid && <span>{email.error}</span>}

      <input {...name.props} />
      {name.invalid && <span>{name.error}</span>}

      <button disabled={isSubmitting}>
        {isSubmitting ? "Enviando..." : "Cadastrar"}
      </button>
    </form>
  );
}
```

## Supported validation error shapes

`onSubmit` accepts these thrown shapes and maps them to `setServerErrors`:

- `{ email: "Taken" }`
- `{ email: ["Taken", "Invalid format"] }` (uses first message)
- `{ errors: { email: "Taken" } }`
- `{ errors: { email: ["Taken"] } }`
