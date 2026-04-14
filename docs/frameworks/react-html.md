# Bit-Form + native HTML (React)

You can use Bit-Form with plain HTML form controls by generating ready-to-edit React wrappers with the Bit-Form CLI. Each wrapper uses `useBitField` and maps validation and accessibility metadata directly to native elements such as `<input>`, `<textarea>`, `<select>`, and radio/checkbox controls.

## 1. Prerequisites

- A React project.
- Bit-Form installed: `npm install @lehnihon/bit-form`.

## 2. Generate wrappers with the CLI

From your project root:

```bash
# Add all native HTML wrappers (input, textarea, select, checkbox, radio-group)
npx bit-form add html

# Add specific components
npx bit-form add html input textarea select

# Custom output directory (default: current directory)
npx bit-form add html input --path ./components/forms

# Overwrite existing files
npx bit-form add html input --overwrite
```

### Flags

| Flag           | Description                                              |
| -------------- | -------------------------------------------------------- |
| `--path`       | Directory where wrapper files are written (default: `.`) |
| `--overwrite`  | Replace existing wrapper files                           |
| `--yes` / `-y` | Non-interactive (no prompts)                             |

`--ui-path` is accepted by the shared CLI parser but has no effect for the `html` adapter because no external UI component imports are generated.

## 3. Use the wrappers in your form

Example with `BitFormInput`, `BitFormTextarea`, and `BitFormSelect`:

```tsx
import { createBitStore } from "@lehnihon/bit-form";
import { BitFormProvider } from "@lehnihon/bit-form/react";
import { BitFormInput } from "./bit-form-input";
import { BitFormTextarea } from "./bit-form-textarea";
import { BitFormSelect } from "./bit-form-select";

const store = createBitStore({
  initialValues: {
    name: "",
    bio: "",
    role: "",
  },
});

export function MyForm() {
  return (
    <BitFormProvider store={store}>
      <form className="space-y-4">
        <BitFormInput path="name" label="Name" placeholder="Your name" />
        <BitFormTextarea path="bio" label="Bio" rows={4} />
        <BitFormSelect
          path="role"
          label="Role"
          placeholder="Select a role"
          options={[
            { value: "admin", label: "Admin" },
            { value: "user", label: "User" },
          ]}
        />
      </form>
    </BitFormProvider>
  );
}
```

Each wrapper:

- Uses `useBitField(path)` with native bindings.
- Supports optional `label` and `description`.
- Sets `aria-invalid`, `aria-required`, and `data-invalid` when relevant.
- Renders the validation error message when present.
- Returns `null` when `meta.isHidden` is true.

## 4. Available wrappers

| Component  | File                       | Notes                                       |
| ---------- | -------------------------- | ------------------------------------------- |
| Input      | `bit-form-input.tsx`       | Accepts `type` for text-like input variants |
| Textarea   | `bit-form-textarea.tsx`    | Native `<textarea>` binding                 |
| Select     | `bit-form-select.tsx`      | Native `<select>` with `options`            |
| Checkbox   | `bit-form-checkbox.tsx`    | Native boolean binding                      |
| RadioGroup | `bit-form-radio-group.tsx` | Native radio inputs rendered from `options` |

You can edit the generated files freely to add project-specific styles, layout wrappers, or richer HTML attributes.
