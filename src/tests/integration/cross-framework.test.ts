import { describe, it, expect, vi } from "vitest";
import { BitStore, createPatternMask } from "../../core";

describe("Cross-Framework Consistency", () => {
  it("should maintain data integrity and case sensitivity across adapters", async () => {
    const store = new BitStore({ initialValues: { apiKey: "" } });
    const mask = createPatternMask("XXXX-####");
    const formatted = mask.format("test1234");

    store.setField("apiKey", formatted);
    expect(store.getState().values.apiKey).toBe("test-1234");

    await store.submit((values: any) => {
      expect(values.apiKey).toBe("test-1234");
    });
  });

  it("should exhibit identical behavior for currency between frameworks", () => {
    const store = new BitStore({ initialValues: { balance: 10 } });
    const brl = store.masks.brl;

    const display = brl.format(store.getState().values.balance);
    expect(display).toBe("R$ 10,00");

    const parsed = brl.parse("R$ 50,00");
    expect(parsed).toBe(50);
  });

  it("should handle array error shifting and value integrity consistently", () => {
    const store = new BitStore({ initialValues: { list: ["A", "B", "C"] } });
    (store as any).validate = vi.fn();
    (store as any).triggerValidation = vi.fn();

    store.setError("list.2", "Error C");
    store.removeItem("list", 1);

    expect(store.getState().values.list).toEqual(["A", "C"]);
    expect(store.getState().errors["list.1"]).toBe("Error C");

    store.moveItem("list", 1, 0);
    expect(store.getState().values.list).toEqual(["C", "A"]);
    expect(store.getState().errors["list.0"]).toBe("Error C");
  });

  it("should evaluate conditional visibility and requirement consistently", () => {
    const store = new BitStore({ initialValues: { type: "A", detail: "" } });

    store.registerConfig("detail", {
      dependsOn: ["type"],
      showIf: (v: any) => v.type === "B",
      requiredIf: (v: any) => v.type === "B",
    });

    expect(store.isHidden("detail")).toBe(true);
    store.setField("type", "B");
    expect(store.isHidden("detail")).toBe(false);
  });

  it("should apply transforms consistently before submission", async () => {
    const store = new BitStore({
      initialValues: { count: 10 },
      transform: { count: (v) => v * 2 },
    });

    let result: any;
    await store.submit((values: any) => {
      result = values;
    });
    expect(result.count).toBe(20);
  });
});
