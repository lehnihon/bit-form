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

  it("deve continuar executando efeitos mesmo quando um hook falha", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const registry = new BitEffectRegistry<Record<string, unknown>>();
    const afterSubmitA = vi.fn(async () => {
      throw new Error("effect-a-failed");
    });
    const afterSubmitB = vi.fn(async () => {});

    registry.register({
      name: "effect-a",
      afterSubmit: afterSubmitA,
    });

    registry.register({
      name: "effect-b",
      afterSubmit: afterSubmitB,
    });

    const engine = new BitStoreEffectEngine(registry);

    await engine.afterSubmit({} as any);

    expect(afterSubmitA).toHaveBeenCalledTimes(1);
    expect(afterSubmitB).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('effect "effect-a" failed in hook "afterSubmit"'),
      expect.any(Error),
    );

    consoleErrorSpy.mockRestore();
  });

  it("deve isolar falhas em reportOperationalError e continuar para o proximo efeito", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const registry = new BitEffectRegistry<Record<string, unknown>>();
    const reportA = vi.fn(async () => {
      throw new Error("effect-report-failed");
    });
    const reportB = vi.fn(async () => {});

    registry.register({
      name: "effect-a",
      reportOperationalError: reportA,
    });

    registry.register({
      name: "effect-b",
      reportOperationalError: reportB,
    });

    const engine = new BitStoreEffectEngine(registry);

    await expect(
      engine.reportOperationalError({
        source: "submit",
        error: new Error("submit-failed"),
      }),
    ).resolves.toBeUndefined();

    expect(reportA).toHaveBeenCalledTimes(1);
    expect(reportB).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        'effect "effect-a" failed in hook "reportOperationalError"',
      ),
      expect.any(Error),
    );

    consoleErrorSpy.mockRestore();
  });

  it("BUG-6: deve isolar falhas em onStateUpdated e continuar chamando outros efeitos", () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const registry = new BitEffectRegistry<Record<string, unknown>>();
    const onStateUpdatedA = vi.fn(() => {
      throw new Error("effect-a-failed");
    });
    const onStateUpdatedB = vi.fn();

    registry.register({
      name: "effect-a",
      onStateUpdated: onStateUpdatedA,
    });

    registry.register({
      name: "effect-b",
      onStateUpdated: onStateUpdatedB,
    });

    const engine = new BitStoreEffectEngine(registry);

    expect(() => {
      engine.onStateUpdated({} as any, true);
    }).not.toThrow();

    expect(onStateUpdatedA).toHaveBeenCalledTimes(1);
    expect(onStateUpdatedB).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        'effect "effect-a" failed in hook "onStateUpdated"',
      ),
      expect.any(Error),
    );

    consoleErrorSpy.mockRestore();
  });
});
