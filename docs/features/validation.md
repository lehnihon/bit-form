# Validation & Resolvers

Bit-Form treats validation as a first-class citizen. It supports synchronous schema validation via popular libraries (Zod, Yup, Joi) and native debounced asynchronous validation for API checks.

## Synchronous Validation (Schemas)

Bit-Form uses the `resolver` pattern. You define your schema using your favorite library and wrap it with the corresponding Bit-Form resolver.

First, import the resolver for your library:

```tsx
import { zodResolver } from "bit-form/resolvers/zod";
// import { yupResolver } from "bit-form/resolvers/yup";
// import { joiResolver } from "bit-form/resolvers/joi";
import { z } from "zod";
import { BitStore } from "bit-form";

const schema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const store = new BitStore({
  initialValues: { email: "", password: "" },
  resolver: zodResolver(schema),
  validationDelay: 300, // Debounce delay in milliseconds before running validation while typing
});
```

Whenever the form changes or a field loses focus, Bit-Form will run the resolver and populate the `errors` object in the store.

## Asynchronous Validation

Sometimes you need to validate a field against a backend API (e.g., checking if a username is available). You can define `asyncValidate` on a field's configuration. Bit-Form automatically manages the loading state (`isValidating`) and debounces the requests to avoid spamming your API.

```tsx
store.registerConfig("username", {
  asyncValidate: async (value, allValues) => {
    if (!value) return null;

    // Simulating an API call
    const response = await checkUsernameAvailability(value);

    // Return a string if there is an error, or null if valid
    if (!response.available) {
      return "This username is already taken";
    }
    return null;
  },
  asyncValidateDelay: 500, // Wait 500ms after the user stops typing before calling the API
});
```

You can check if a field is currently validating to show a loading spinner in your UI:

```tsx
// Example using React
const { isValidating } = useBitField("username");

if (isValidating) return <Spinner />;
```

Bit-Form safely merges synchronous schema errors with asynchronous API errors, avoiding race conditions if the user types quickly.
