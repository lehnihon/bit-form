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
import { BitStore, unmaskCurrency } from "@lehnihon/bit-form";
import { zodResolver } from "@lehnihon/bit-form/resolvers/zod";
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

  devTools: process.env.NODE_ENV !== "production",

  fields: {
    cnpj: {
      mask: "cnpj",
      conditional: {
        dependsOn: ["companyType"],
        showIf: (v) => v.companyType === "PJ",
        requiredIf: (v) => v.companyType === "PJ",
      },
      transform: (v) => (typeof v === "string" ? v.replace(/\D/g, "") : v),
      scope: "step1",
      validation: {
        asyncValidate: async (value) => {
          if (!value || value.replace(/\D/g, "").length < 14) return null;
          const ok = await api.checkCnpjAvailable(value);
          return ok ? null : "CNPJ já cadastrado";
        },
        asyncValidateDelay: 500,
      },
    },
    companyType: { scope: "step1" },
    email: {
      scope: "step1",
      validation: {
        asyncValidate: async (value) => {
          if (!value) return null;
          const ok = await api.checkEmailAvailable(value);
          return ok ? null : "E-mail já está em uso";
        },
        asyncValidateDelay: 400,
      },
    },
    salary: {
      mask: "brl",
      transform: (v) => unmaskCurrency(v),
      scope: "step2",
    },
    hasBonus: { scope: "step2" },
    bonusValue: {
      mask: "brl",
      conditional: {
        dependsOn: ["hasBonus"],
        showIf: (v) => v.hasBonus === true,
        requiredIf: (v) => v.hasBonus === true,
      },
      scope: "step2",
    },
  },
});
```

## React Form Component

```tsx
import { useState } from "react";
import { useBitForm, useBitField, useBitSteps } from "@lehnihon/bit-form/react";
import { useBitHistory } from "@lehnihon/bit-form/react";

// Assumes store is created and provided via BitFormProvider
export function RegistrationWizard() {
  const form = useBitForm();
  const history = useBitHistory();
  const steps = useBitSteps(["step1", "step2"]);
  const [isValidatingNext, setIsValidatingNext] = useState(false);

  const handleNext = async () => {
    setIsValidatingNext(true);
    await steps.next(); // valida o step atual antes de avançar; só avança se válido
    setIsValidatingNext(false);
  };

  const companyType = useBitField("companyType");
  const cnpj = useBitField("cnpj");
  const email = useBitField("email");
  const salary = useBitField("salary");
  const hasBonus = useBitField("hasBonus");
  const bonusValue = useBitField("bonusValue");

  const handleSubmit = form.onSubmit(async (values) => {
    await api.register(values);
    return { success: true };
  });

  return (
    <form onSubmit={handleSubmit}>
      {form.meta.submitError && (
        <p className="error">{form.meta.submitError.message}</p>
      )}

      {/* Toolbar: Undo / Redo */}
      <div className="toolbar">
        <button
          type="button"
          onClick={history.undo}
          disabled={!history.canUndo}
        >
          ↺ Undo
        </button>
        <button
          type="button"
          onClick={history.redo}
          disabled={!history.canRedo}
        >
          ↻ Redo
        </button>
      </div>

      {steps.step === 1 && (
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

          <button
            type="button"
            onClick={handleNext}
            disabled={isValidatingNext}
          >
            {isValidatingNext ? "Validando..." : "Next"}
          </button>
        </div>
      )}

      {steps.step === 2 && (
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

          <button type="button" onClick={steps.prev}>
            Back
          </button>
          <button
            type="submit"
            disabled={!form.meta.isValid || form.meta.isSubmitting}
          >
            {form.meta.isSubmitting ? "Enviando..." : "Cadastrar"}
          </button>
        </div>
      )}
    </form>
  );
}
```

## What This Example Demonstrates

| Feature               | Usage                                                                                                                                                                                                                                        |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Masks**             | `brl`, `cnpj` on salary and CNPJ fields                                                                                                                                                                                                      |
| **asyncValidate**     | Email and CNPJ availability check with debounce                                                                                                                                                                                              |
| **Conditional logic** | CNPJ shown only when companyType is PJ; bonusValue shown when hasBonus is true                                                                                                                                                               |
| **Scopes**            | `useBitSteps(["step1", "step2"])` for wizard navigation. `steps.next()` runs validation before advancing (only advances if valid). Do not use `steps.isValid` to disable the Next button — it is `true` initially; validation runs on click. |
| **History**           | Undo/Redo in toolbar via `history: { enabled: true }`                                                                                                                                                                                        |
| **DevTools**          | Local inspector enabled in development                                                                                                                                                                                                       |
| **Transform**         | `salary` and `cnpj` normalized before submit                                                                                                                                                                                                 |
| **onSubmit**          | Handles API call, `submitError`, and `lastResponse` automatically                                                                                                                                                                            |
