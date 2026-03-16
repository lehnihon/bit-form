import { describe, it, expect, vi } from "vitest";
import { BitSubscriptionEngine } from "../../core/store/engines/subscription-engine";
import type { BitState } from "../../core/store/contracts/types";

type Values = { user: { name: string; age: number } };

function createState(values: Values): BitState<Values> {
  return {
    values,
    errors: {},
    touched: {},
    isValidating: {},
    persist: {
      isSaving: false,
      isRestoring: false,
      error: null,
    },
    isValid: true,
    isSubmitting: false,
    isDirty: false,
  };
}

describe("BitSubscriptionEngine", () => {
  it("notifica selector scoped somente quando path muda", () => {
    let state = createState({ user: { name: "Leo", age: 30 } });
    const engine = new BitSubscriptionEngine<Values>(() => state);
    const listener = vi.fn();

    engine.subscribeSelector(
      (nextState) => nextState.values.user.name,
      listener,
      { paths: ["user.name"] },
      (a, b) => a === b,
    );

    state = createState({ user: { name: "Leo", age: 31 } });
    engine.notify(state, ["user.age"]);
    expect(listener).not.toHaveBeenCalled();

    state = createState({ user: { name: "Ana", age: 31 } });
    engine.notify(state, ["user.name"]);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith("Ana");
  });

  it("notifica subscribe global em qualquer update", () => {
    let state = createState({ user: { name: "Leo", age: 30 } });
    const engine = new BitSubscriptionEngine<Values>(() => state);
    const listener = vi.fn();

    engine.subscribe(listener);

    state = createState({ user: { name: "Leo", age: 31 } });
    engine.notify(state, ["user.age"]);

    expect(listener).toHaveBeenCalledTimes(1);
  });
});
