# Conditional Fields + Server Validation Example

## Scenario

The form collects user type (`PF` or `PJ`). If `PJ` is selected, `cnpj` becomes visible and required. Server-side uniqueness errors should map to fields after submit.

## Goal

Combine conditional logic (`dependsOn`, `showIf`, `requiredIf`) with backend validation mapping.

## Store Setup

```tsx
import { createBitStore } from "@lehnihon/bit-form";

type Registration = {
  userType: "PF" | "PJ";
  cnpj: string;
  email: string;
};

export const store = createBitStore<Registration>({
  initialValues: { userType: "PF", cnpj: "", email: "" },
  fields: {
    userType: {},
    cnpj: {
      mask: "cnpj",
      conditional: {
        dependsOn: ["userType"],
        showIf: (v) => v.userType === "PJ",
        requiredIf: (v) => v.userType === "PJ",
      },
      transform: (v) => String(v || "").replace(/\D/g, ""),
    },
    email: {
      validation: {
        asyncValidate: async (value) => {
          if (!value) return null;
          const exists = await api.emailExists(String(value));
          return exists ? "Email already registered" : null;
        },
        asyncValidateOn: "change",
        asyncValidateDelay: 300,
      },
    },
  },
});
```

## Submit Handler with 422 Mapping

```tsx
const onSubmit = form.onSubmit(async (values) => {
  const response = await api.createAccount(values);
  return response;
});
```

If backend responds with known validation-error shape, `onSubmit` maps field errors automatically.

## Expected Behavior

- `cnpj` is excluded from payload when hidden.
- `cnpj` errors are cleared when switching from `PJ` to `PF`.
- Backend 422 field errors appear in corresponding inputs.

## Related

- [Conditional Logic](../features/conditional-logic.md)
- [Server Errors](./server-errors.md)
