# Bit-Form + shadcn/ui (React)

You can use Bit-Form with [shadcn/ui](https://ui.shadcn.com/) by generating ready-to-use form field wrappers with the Bit-Form CLI. Each wrapper uses `useBitField` (`field` + `meta`) and forwards accessibility/validation state for styling.

## 1. Prerequisites

- A React project with [shadcn/ui installed](https://ui.shadcn.com/docs/installation) (run `npx shadcn@latest init` if needed).
- Bit-Form installed: `npm install @lehnihon/bit-form`.

## 2. Generate wrappers with the CLI

From your project root:

```bash
# Add all shadcn form wrappers (input, textarea, select, checkbox, switch, radio-group)
npx bit-form add shadcn

# Add specific components
npx bit-form add shadcn input textarea select

# Custom output directory (default: current directory)
npx bit-form add shadcn input --path ./components/forms

# Custom UI import path (default: @/components/ui)
npx bit-form add shadcn input --ui-path @/components/ui

# Overwrite existing files
npx bit-form add shadcn input --overwrite
```

### Flags

| Flag           | Description                                                    |
| -------------- | -------------------------------------------------------------- |
| `--path`       | Directory where wrapper files are written (default: `.`)       |
| `--ui-path`    | Import path for shadcn components (default: `@/components/ui`) |
| `--overwrite`  | Replace existing wrapper files                                 |
| `--yes` / `-y` | Non-interactive (no prompts)                                   |

If `components.json` is not found in the project root, the CLI warns you to run `npx shadcn@latest init` or to pass `--ui-path` to match your setup.

## 3. Ensure shadcn components exist

Each wrapper imports a shadcn component from `@/components/ui`. Add any missing components with the shadcn CLI, for example:

```bash
npx shadcn@latest add input textarea select checkbox switch radio-group
```

## 4. Use the wrappers in your form

Example with `BitFormInput`, `BitFormTextarea`, and `BitFormSelect`:

```tsx
import { BitStore } from "@lehnihon/bit-form";
import { BitFormProvider } from "@lehnihon/bit-form/react";
import { BitFormInput } from "./bit-form-input";
import { BitFormTextarea } from "./bit-form-textarea";
import { BitFormSelect } from "./bit-form-select";

const store = new BitStore({
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

- Uses `useBitField(path)` with `field` handlers and `meta` state.
- Supports optional `label` and `description`.
- Sets `aria-invalid` and `data-invalid` when the field is invalid.
- Renders the validation error message when present.

## 5. Available wrappers

| Component  | File                       | shadcn dependency |
| ---------- | -------------------------- | ----------------- |
| Input      | `bit-form-input.tsx`       | `input`           |
| Textarea   | `bit-form-textarea.tsx`    | `textarea`        |
| Select     | `bit-form-select.tsx`      | `select`          |
| Checkbox   | `bit-form-checkbox.tsx`    | `checkbox`        |
| Switch     | `bit-form-switch.tsx`      | `switch`          |
| RadioGroup | `bit-form-radio-group.tsx` | `radio-group`     |

You can extend or edit the generated files to match your design system or add custom props.
