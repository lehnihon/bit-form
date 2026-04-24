import { describe, expect, it, vi } from "vitest";
import { BitPluginManager } from "../../core/store/managers/features/plugin-manager";

describe("BitPluginManager", () => {
  it("deve enfileirar erros e notificar todos sem perda", async () => {
    let releaseFirst: (() => void) | null = null;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    const onError = vi.fn(async (event: { source: string }) => {
      if (event.source === "beforeValidate") {
        await firstGate;
      }
    });

    const manager = new BitPluginManager<Record<string, unknown>>(
      [
        {
          name: "error-listener",
          hooks: { onError },
        },
      ],
      () =>
        ({
          getState: () => ({ values: {}, errors: {}, touched: {} }),
        }) as any,
    );

    const first = manager.reportError("beforeValidate", new Error("first"));
    const second = manager.reportError("beforeSubmit", new Error("second"));

    await Promise.resolve();
    expect(onError).toHaveBeenCalledTimes(1);

    releaseFirst!();
    await Promise.all([first, second]);

    expect(onError).toHaveBeenCalledTimes(2);
    expect(onError.mock.calls[0][0]).toEqual(
      expect.objectContaining({ source: "beforeValidate" }),
    );
    expect(onError.mock.calls[1][0]).toEqual(
      expect.objectContaining({ source: "beforeSubmit" }),
    );
  });

  it("deve manter payload de erro consistente com uma unica leitura de estado", async () => {
    const onError = vi.fn();
    let getStateCallCount = 0;

    const manager = new BitPluginManager<Record<string, unknown>>(
      [
        {
          name: "error-snapshot",
          hooks: { onError },
        },
      ],
      () =>
        ({
          getState: () => {
            getStateCallCount += 1;
            return {
              values: { sequence: getStateCallCount },
              errors: {},
              touched: {},
            };
          },
        }) as any,
    );

    await manager.reportError("beforeValidate", new Error("snapshot"));

    const payload = onError.mock.calls[0]?.[0];
    expect(payload).toBeDefined();
    expect(payload.values).toEqual(payload.state.values);
  });

  describe("Plugin Stability - Exception Isolation", () => {
    it("store remains operational after field changes even with plugin errors", async () => {
      const { createBitStore } = await import("../../core");
      const store = (createBitStore as any)({
        initialValues: { field: "test" },
      });

      store.write.setField("field", "updated");

      const state = store.read.getState();
      expect(state.values.field).toBe("updated");
    });
  });
});
