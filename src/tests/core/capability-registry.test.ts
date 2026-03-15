import { describe, it, expect } from "vitest";
import { BitCapabilityRegistry } from "../../core/store/capability-registry";

describe("BitCapabilityRegistry", () => {
  it("registra e recupera capabilities", () => {
    const registry = new BitCapabilityRegistry<{ foo: { value: number } }>();

    registry.register("foo", { value: 42 });

    expect(registry.has("foo")).toBe(true);
    expect(registry.get("foo").value).toBe(42);
  });

  it("lança erro quando capability não existe", () => {
    const registry = new BitCapabilityRegistry<{ foo: { value: number } }>();

    expect(() => registry.get("foo")).toThrow(
      'Capability "foo" is not registered',
    );
  });

  it("limpa todas as capabilities", () => {
    const registry = new BitCapabilityRegistry<{ foo: { value: number } }>();
    registry.register("foo", { value: 1 });

    registry.clear();

    expect(registry.has("foo")).toBe(false);
  });
});
