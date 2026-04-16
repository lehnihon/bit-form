# When to Use What

A quick reference for choosing the right Bit-Form feature for each scenario.

---

## Validation: resolver vs asyncValidate vs setServerErrors

| Feature             | When to use                                   | Runs                   | Example                                       |
| ------------------- | --------------------------------------------- | ---------------------- | --------------------------------------------- |
| **resolver**        | Schema validation (format, required, min/max) | On blur, before submit | Zod/Yup/Joi schema                            |
| **asyncValidate**   | Check value against API while user types      | Debounced, per field   | "Email already taken"                         |
| **setServerErrors** | Map 422/400 API response to fields            | After submit fails     | Server returns `{ errors: { field: "msg" } }` |

### Decision flow

- **"Is the field required / valid format?"** → `resolver`
- **"Does this value exist in our DB?"** → `asyncValidate`
- **"API returned validation errors after submit"** → `setServerErrors` (or use `onSubmit` which does it automatically)

---

## Values: normalize vs computed vs transform

| Feature       | When to use                                      | Purpose                    |
| ------------- | ------------------------------------------------ | -------------------------- |
| **normalize** | Clean the runtime state immediately after writes | `"  Ana  "` → `"Ana"`      |
| **computed**  | Derive a value from other fields in real time    | `total = price * quantity` |
| **transform** | Convert value **only on submit**                 | `"R$ 1.500,00"` → `1500`   |

### When to use each

- **State should store the cleaned value right away?** (e.g. trim, lowercase, uppercase, collapse spaces) → `normalize`
- **User sees the derived value?** (e.g. total, discount) → `computed`
- **User types masked, API needs raw?** (e.g. currency, CPF) → `transform`

`normalize` runs after writes and batches. `computed` runs after dependencies change. `transform` runs only when the form is submitted.

If input formatting is the main goal, use `mask` instead of `normalize`.

---

## Conditional fields: dependsOn + showIf vs UI hide

| Approach                                                   | When to use                             | Data behavior                                 |
| ---------------------------------------------------------- | --------------------------------------- | --------------------------------------------- |
| **dependsOn + showIf**                                     | Field is conditionally part of the form | Hidden = excluded from submit, errors cleared |
| **UI-only hide** (e.g. `v-if`, `{condition && <Field />}`) | Same as above, but manual               | You must handle cleanup yourself              |

### Recommendation

Prefer **dependsOn + showIf**. Bit-Form will:

- Exclude hidden field values from the submit payload
- Clear validation errors when the field becomes hidden
- Keep `isRequired` / `requiredIf` in sync

Use UI-only hide only if you have very custom rendering logic and are comfortable managing state yourself.

---

## Quick reference table

| Scenario                                   | Use                                                                 |
| ------------------------------------------ | ------------------------------------------------------------------- |
| Validate email format                      | `resolver` (Zod/Yup)                                                |
| Check if email exists in DB                | `asyncValidate`                                                     |
| Show "Email taken" from API 422            | `setServerErrors` or `onSubmit`                                     |
| Store trimmed/lowercased value immediately | `normalize`                                                         |
| Total = price × quantity                   | `computed`                                                          |
| Submit "R$ 1.500" as 1500                  | `transform`                                                         |
| Show CNPJ only when type=PJ                | `showIf` + `dependsOn`                                              |
| Validate step before "Next"                | `fields[path].scope` + `useBitScope` / `injectBitScope`             |
| Undo/Redo                                  | `history: { enabled: true }`, `undo()`, `redo()`                    |
| Debug form state                           | `devTools: true` + `createDevToolsPlugin()`                         |
| Release confidence                         | `quality` gates (`test:bench`, `test:compat`, `test:release-gates`) |

---

## Architecture and release references

- Compatibility targets: `./compatibility-matrix.md`
- Migration guide: `./migration.md`
- Release gate policy: `./release-gates.md`
- Troubleshooting: `./troubleshooting.md`
