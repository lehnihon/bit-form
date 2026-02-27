# Complete End-to-End Example

This example showcases **all major Bit-Form features** working together: masks, async validation, conditional logic, scopes, history, DevTools, and the `onSubmit` helper. It simulates a multi-step registration form for a Brazilian company.

## Scenario

A wizard-style form with:
- **Step 1**: Company type (PF/PJ), CNPJ (only if PJ) with mask, email with async availability check
- **Step 2**: Salary (currency mask BRL), optional bonus (conditional field)
- **History**: Undo/Redo enabled for step navigation
- **DevTools**: Local inspector for debugging

## Store Configuration

```tsx
import { BitStore, unmaskCurrency } from "bit-form";
import { zodResolver } from "bit-form/resolvers/zod";
import { z } from "zod";

const schema = z.object({
  companyType: z.enum(["PF", "PJ"]),
  cnpj: z.string().optional(),
  email: z.string().email("E-mail inválido"),
  salary: z.number().min(0),
  hasBonus: z.boolean(),
  bonusValue: z.number().optional(),
});

const store = new BitStore({
  name: "registration-form",
  initialValues: {
    companyType: "PF" as "PF" | "PJ",
    cnpj: "",
    email: "",
    salary: 0,
    hasBonus: false,
    bonusValue: 0,
  },

  validation: {
    resolver: zodResolver(schema),
    delay: 300,
  },

  history: {
    enabled: true,
    limit: 20,
  },

  features: {
    transform: {
      salary: (v) => unmaskCurrency(v),
      cnpj: (v) => (typeof v === "string" ? v.replace(/\D/g, "") : v),
    },
    scopes: {
      step1: ["companyType", "cnpj", "email"],
      step2: ["salary", "hasBonus", "bonusValue"],
    },
  },

  devTools: process.env.NODE_ENV !== "production",

  fields: {
    cnpj: {
      dependsOn: ["companyType"],
      showIf: (v) => v.companyType === "PJ",
      requiredIf: (v) => v.companyType === "PJ",
      asyncValidate: async (value) => {
        if (!value || value.replace(/\D/g, "").length < 14) return null;
        const ok = await api.checkCnpjAvailable(value);
        return ok ? null : "CNPJ já cadastrado";
      },
      asyncValidateDelay: 500,
    },
    email: {
      asyncValidate: async (value) => {
        if (!value) return null;
        const ok = await api.checkEmailAvailable(value);
        return ok ? null : "E-mail já está em uso";
      },
      asyncValidateDelay: 400,
    },
    bonusValue: {
      dependsOn: ["hasBonus"],
      showIf: (v) => v.hasBonus === true,
      requiredIf: (v) => v.hasBonus === true,
    },
  },
});
```

## React Form Component

```tsx
import { useState } from "react";
import { useBitForm, useBitField, useBitScope } from "bit-form/react";

// Assumes store is created and provided via BitFormProvider
export function RegistrationWizard() {
  const form = useBitForm();
  const step1 = useBitScope("step1");
  const step2 = useBitScope("step2");

  const companyType = useBitField("companyType");
  const cnpj = useBitField("cnpj", { mask: "cnpj" });
  const email = useBitField("email");
  const salary = useBitField("salary", { mask: "brl" });
  const hasBonus = useBitField("hasBonus");
  const bonusValue = useBitField("bonusValue", { mask: "brl" });

  const [currentStep, setCurrentStep] = useState(1);

  const handleNext = async () => {
    const scope = currentStep === 1 ? step1 : step2;
    const { valid } = await scope.validate();
    if (valid) setCurrentStep((s) => Math.min(s + 1, 2));
  };

  const handleSubmit = form.onSubmit(async (values) => {
    await api.register(values);
    return { success: true };
  });

  return (
    <form onSubmit={handleSubmit}>
      {form.submitError && (
        <p className="error">{form.submitError.message}</p>
      )}

      {/* Toolbar: Undo / Redo */}
      <div className="toolbar">
        <button type="button" onClick={form.undo} disabled={!form.canUndo}>
          ↺ Undo
        </button>
        <button type="button" onClick={form.redo} disabled={!form.canRedo}>
          ↻ Redo
        </button>
      </div>

      {currentStep === 1 && (
        <div className="step">
          <h2>Step 1: Company</h2>
          <select {...companyType.props}>
            <option value="PF">Pessoa Física</option>
            <option value="PJ">Pessoa Jurídica</option>
          </select>

          {!cnpj.isHidden && (
            <div>
              <label>CNPJ</label>
              <input {...cnpj.props} />
              {cnpj.isValidating && <span>Checking...</span>}
              {cnpj.invalid && <span>{cnpj.error}</span>}
            </div>
          )}

          <div>
            <label>E-mail</label>
            <input type="email" {...email.props} />
            {email.isValidating && <span>Checking...</span>}
            {email.invalid && <span>{email.error}</span>}
          </div>

          <button type="button" onClick={handleNext} disabled={!step1.isValid}>
            Next
          </button>
        </div>
      )}

      {currentStep === 2 && (
        <div className="step">
          <h2>Step 2: Salary</h2>
          <div>
            <label>Salário</label>
            <input {...salary.props} placeholder="R$ 0,00" />
          </div>

          <label>
            <input type="checkbox" {...hasBonus.props} /> Tem bônus?
          </label>

          {!bonusValue.isHidden && (
            <div>
              <label>Valor do bônus</label>
              <input {...bonusValue.props} />
            </div>
          )}

          <button type="button" onClick={() => setCurrentStep(1)}>
            Back
          </button>
          <button type="submit" disabled={!form.isValid || form.isSubmitting}>
            {form.isSubmitting ? "Enviando..." : "Cadastrar"}
          </button>
        </div>
      )}
    </form>
  );
}
```

## What This Example Demonstrates

| Feature | Usage |
|--------|--------|
| **Masks** | `brl`, `cnpj` on salary and CNPJ fields |
| **asyncValidate** | Email and CNPJ availability check with debounce |
| **Conditional logic** | CNPJ shown only when companyType is PJ; bonusValue shown when hasBonus is true |
| **Scopes** | `useBitScope("step1")` and `step2` for per-step validation |
| **History** | Undo/Redo in toolbar via `history: { enabled: true }` |
| **DevTools** | Local inspector enabled in development |
| **Transform** | `salary` and `cnpj` normalized before submit |
| **onSubmit** | Handles API call, `submitError`, and `lastResponse` automatically |
