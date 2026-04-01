import { describe, expect, it, vi } from "vitest";
import { BitStoreEffectEngine } from "../../core/store/engines/effect-engine";
import { BitEffectRegistry } from "../../core/store/engines/effects/effect-registry";

describe("effect engine registry", () => {
  it("deve executar hooks de efeitos registrados sem conhecer implementacoes concretas", async () => {
    const registry = new BitEffectRegistry<Record<string, unknown>>();
    const onStateUpdated = vi.fn();
    const beforeValidate = vi.fn(async () => {});
    const afterSubmit = vi.fn(async () => {});

    registry.register({
      name: "custom-metrics",
      onStateUpdated,
      beforeValidate,
      afterSubmit,
    });

    const engine = new BitStoreEffectEngine(registry);

    engine.onStateUpdated({} as any, true);
    await engine.beforeValidate({} as any);
    await engine.afterSubmit({} as any);

    expect(onStateUpdated).toHaveBeenCalledTimes(1);
    expect(beforeValidate).toHaveBeenCalledTimes(1);
    expect(afterSubmit).toHaveBeenCalledTimes(1);
  });

  it("deve agregar restorePersisted retornando true quando ao menos um efeito restaura", async () => {
    const registry = new BitEffectRegistry<Record<string, unknown>>();

    registry.register({
      name: "persist-a",
      restorePersisted: async () => false,
    });
    registry.register({
      name: "persist-b",
      restorePersisted: async () => true,
    });

    const engine = new BitStoreEffectEngine(registry);
    const restored = await engine.restorePersisted();

    expect(restored).toBe(true);
  });
});
