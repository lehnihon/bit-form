# When to Use What

A quick reference for choosing the right Bit-Form feature for each scenario.

---

## Validation: resolver vs asyncValidate vs setServerErrors

| Feature | When to use | Runs | Example |
|--------|-------------|------|---------|
| **resolver** | Schema validation (format, required, min/max) | On blur, before submit | Zod/Yup/Joi schema |
| **asyncValidate** | Check value against API while user types | Debounced, per field | "Email already taken" |
| **setServerErrors** | Map 422/400 API response to fields | After submit fails | Server returns `{ errors: { field: "msg" } }` |

### Decision flow

- **"Is the field required / valid format?"** → `resolver`
- **"Does this value exist in our DB?"** → `asyncValidate`
- **"API returned validation errors after submit"** → `setServerErrors` (or use `onSubmit` which does it automatically)

---

## Values: computed vs transform

| Feature | When to use | Purpose |
|---------|-------------|---------|
| **computed** | Derive a value from other fields in real time | `total = price * quantity` |
| **transform** | Convert value **only on submit** | `"R$ 1.500,00"` → `1500` |

### When to use each

- **User sees the derived value?** (e.g. total, discount) → `computed`
- **User types masked, API needs raw?** (e.g. currency, CPF) → `transform`

`computed` runs on every change. `transform` runs only when the form is submitted.

---

## Conditional fields: dependsOn + showIf vs UI hide

| Approach | When to use | Data behavior |
|----------|-------------|---------------|
| **dependsOn + showIf** | Field is conditionally part of the form | Hidden = excluded from submit, errors cleared |
| **UI-only hide** (e.g. `v-if`, `{condition && <Field />}`) | Same as above, but manual | You must handle cleanup yourself |

### Recommendation

Prefer **dependsOn + showIf**. Bit-Form will:
- Exclude hidden field values from the submit payload
- Clear validation errors when the field becomes hidden
- Keep `isRequired` / `requiredIf` in sync

Use UI-only hide only if you have very custom rendering logic and are comfortable managing state yourself.

---

## Quick reference table

| Scenario | Use |
|----------|-----|
| Validate email format | `resolver` (Zod/Yup) |
| Check if email exists in DB | `asyncValidate` |
| Show "Email taken" from API 422 | `setServerErrors` or `onSubmit` |
| Total = price × quantity | `computed` |
| Submit "R$ 1.500" as 1500 | `transform` |
| Show CNPJ only when type=PJ | `showIf` + `dependsOn` |
| Validate step before "Next" | `scopes` + `useBitScope` / `injectBitScope` |
| Undo/Redo | `enableHistory`, `undo()`, `redo()` |
| Debug form state | `devTools: true` |
