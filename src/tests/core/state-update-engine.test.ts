import { describe, it, expect } from "vitest";
import { applyStateUpdate } from "../../core/store/engines/state-update-engine";
import type { BitState } from "../../core/store/contracts/types";

describe("applyStateUpdate", () => {
  const baseState: BitState<{ name: string; total: number }> = {
    values: { name: "Leo", total: 10 },
    errors: {},
    touched: {},
    isValidating: {},
    isValid: true,
    isSubmitting: false,
    isDirty: false,
  };

  it("aplica computed values e marca changedPaths padrão", () => {
    const result = applyStateUpdate({
      currentState: baseState,
      partialState: { values: { name: "Ana", total: 15 } },
      applyComputedValues: (values) => ({ ...values, total: values.total * 2 }),
    });

    expect(result.valuesChanged).toBe(true);
    expect(result.changedPaths).toEqual(["*"]);
    expect(result.nextState.values).toEqual({ name: "Ana", total: 30 });
  });

  it("preserva changedPaths informado explicitamente", () => {
    const result = applyStateUpdate({
      currentState: baseState,
      partialState: { touched: { name: true } },
      changedPaths: ["name"],
      applyComputedValues: (values) => values,
    });

    expect(result.valuesChanged).toBe(false);
    expect(result.changedPaths).toEqual(["name"]);
    expect(result.nextState.touched).toEqual({ name: true });
  });

  it("recalcula isValid quando errors muda", () => {
    const result = applyStateUpdate({
      currentState: baseState,
      partialState: { errors: { name: "required" } },
      applyComputedValues: (values) => values,
    });

    expect(result.nextState.isValid).toBe(false);
    expect(result.nextState.errors).toEqual({ name: "required" });
  });
});
