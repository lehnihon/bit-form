import { describe, expect, it, vi } from "vitest";
import { createBitStore } from "../../src";

describe("release-gate observability", () => {
  it("captures persist errors through onError hook", async () => {
    const onError = vi.fn();

    const store = createBitStore({
      initialValues: { name: "" },
      persist: {
        enabled: true,
        storage: {
          getItem: () => null,
          setItem: () => {
            throw new Error("storage down");
          },
          removeItem: () => undefined,
        },
        onError,
      },
    });

    await expect(store.feature.forceSave()).rejects.toThrow("storage down");
    expect(onError).toHaveBeenCalledTimes(1);
    expect(store.read.getPersistMetadata().isSaving).toBe(false);
    expect(store.read.getPersistMetadata().isRestoring).toBe(false);
  });
});
