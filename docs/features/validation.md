# Validation & Resolvers

Bit-Form treats validation as a first-class citizen. It supports synchronous schema validation via popular libraries (Zod, Yup, Joi) and native asynchronous validation for API checks with configurable trigger semantics.

## Synchronous Validation (Schemas)

Bit-Form uses the `resolver` pattern. You define your schema using your favorite library and wrap it with the corresponding Bit-Form resolver.

First, import the resolver for your library:

```tsx
import { zodResolver } from "@lehnihon/bit-form/resolvers/zod";
// import { yupResolver } from "@lehnihon/bit-form/resolvers/yup";
// import { joiResolver } from "@lehnihon/bit-form/resolvers/joi";
import { z } from "zod";
import { createBitStore } from "@lehnihon/bit-form";

const schema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const store = createBitStore({
  initialValues: { email: "", password: "" },
  validation: {
    resolver: zodResolver(schema),
    delay: 300, // Debounce delay in milliseconds before running validation while typing
  },
});
```

Whenever the form changes or a field loses focus, Bit-Form will run the resolver and populate the `errors` object in the store.

## Asynchronous Validation

Sometimes you need to validate a field against a backend API (e.g., checking if a username is available). You can define `asyncValidate` on a field's configuration. Bit-Form automatically manages the loading state (`isValidating`) and supports two trigger modes:

- `blur` (**default**): runs async validation when the field loses focus, and also during `validate()`/submit flows.
- `change`: opt-in live validation while typing. Pair it with `asyncValidateDelay` to debounce requests.

```tsx
store.registerField("username", {
  validation: {
    asyncValidate: async (value, allValues) => {
      if (!value) return null;
      const response = await checkUsernameAvailability(value);
      if (!response.available) return "This username is already taken";
      return null;
    },
    asyncValidateOn: "change",
    asyncValidateDelay: 500,
  },
});
```

If you do not set `asyncValidateOn`, the field keeps the cheaper default behavior and validates asynchronously on `blur`.

You can check if a field is currently validating to show a loading spinner in your UI:

```tsx
// Example using React
const { isValidating } = useBitField("username");

if (isValidating) return <Spinner />;
```

Bit-Form safely merges synchronous schema errors with asynchronous API errors, avoiding race conditions if the user types quickly.

### Migration note

If you used `asyncValidate` in older dev-branch builds expecting automatic validation on every change, add `asyncValidateOn: "change"` to preserve that behavior.

## Server Errors (422 / 400)

When your API returns validation errors after submit (e.g. 422 Unprocessable Entity), use `setServerErrors` to map them to fields. The `onSubmit` helper in `useBitForm` / `injectBitForm` does this automatically: if your handler throws an object like `{ errors: { email: ["Taken"] } }`, it calls `setServerErrors` for you.

See the [Server Errors Example](../examples/server-errors.md) for the full pattern.
