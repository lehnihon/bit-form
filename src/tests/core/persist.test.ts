import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBitStore as createBitStoreRuntime } from "../../core";

function createBitStore<T extends object = Record<string, unknown>>(
  config?: any,
) {
  return createBitStoreRuntime<T>(config) as any;
}

interface TestForm {
  name: string;
  email: string;
  age: number;
}

function createMockStorage() {
  const data: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => data[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      data[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete data[key];
    }),
    _data: data,
  };
}

describe("Persist Feature (BitPersistManager)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("disabled by default", () => {
    it("should not save when persist is not enabled", async () => {
      const storage = createMockStorage();
      const store = createBitStore<TestForm>({
        initialValues: { name: "Leo", email: "leo@test.com", age: 30 },
        persist: {
          enabled: false,
          key: "test-form",
          storage,
        },
      });

      store.write.setField("name", "Changed");
      vi.runAllTimers();
      await Promise.resolve();

      expect(storage.setItem).not.toHaveBeenCalled();
      store.feature.cleanup();
    });

    it("should return false on restorePersisted when disabled", async () => {
      const storage = createMockStorage();
      const store = createBitStore<TestForm>({
        initialValues: { name: "Leo", email: "leo@test.com", age: 30 },
        persist: {
          enabled: false,
          key: "test-form",
          storage,
        },
      });

      const restored = await store.feature.restorePersisted();
      expect(restored).toBe(false);
      store.feature.cleanup();
    });
  });

  describe("autosave", () => {
    it("should autosave after value changes (debounced)", async () => {
      const storage = createMockStorage();
      const store = createBitStore<TestForm>({
        initialValues: { name: "Leo", email: "leo@test.com", age: 30 },
        persist: {
          enabled: true,
          key: "test-form",
          storage,
          debounceMs: 300,
        },
      });

      store.write.setField("name", "Leandro");
      expect(storage.setItem).not.toHaveBeenCalled();

      vi.advanceTimersByTime(300);
      await Promise.resolve();

      expect(storage.setItem).toHaveBeenCalledWith(
        "test-form",
        expect.any(String),
      );

      const saved = JSON.parse(storage._data["test-form"]);
      expect(saved.name).toBe("Leandro");

      store.feature.cleanup();
    });

    it("should not autosave if autoSave is false", async () => {
      const storage = createMockStorage();
      const store = createBitStore<TestForm>({
        initialValues: { name: "Leo", email: "leo@test.com", age: 30 },
        persist: {
          enabled: true,
          key: "test-form",
          storage,
          autoSave: false,
        },
      });

      store.write.setField("name", "Leandro");
      vi.runAllTimers();
      await Promise.resolve();

      expect(storage.setItem).not.toHaveBeenCalled();
      store.feature.cleanup();
    });

    it("should debounce multiple rapid changes into one save", async () => {
      const storage = createMockStorage();
      const store = createBitStore<TestForm>({
        initialValues: { name: "Leo", email: "leo@test.com", age: 30 },
        persist: {
          enabled: true,
          key: "test-form",
          storage,
          debounceMs: 300,
        },
      });

      store.write.setField("name", "A");
      store.write.setField("name", "AB");
      store.write.setField("name", "ABC");
      vi.advanceTimersByTime(300);
      await Promise.resolve();

      expect(storage.setItem).toHaveBeenCalledTimes(1);
      store.feature.cleanup();
    });

    it("should expose persist.error when autosave fails", async () => {
      const onError = vi.fn();
      const store = createBitStore<TestForm>({
        initialValues: { name: "Leo", email: "leo@test.com", age: 30 },
        persist: {
          enabled: true,
          key: "test-form",
          debounceMs: 300,
          storage: {
            getItem: vi.fn(() => null),
            setItem: vi.fn(() => {
              throw new Error("autosave failed");
            }),
            removeItem: vi.fn(),
          },
          onError,
        },
      });

      store.write.setField("name", "Leandro");
      await vi.advanceTimersByTimeAsync(300);

      expect(onError).toHaveBeenCalledWith(expect.any(Error));
      expect(store.read.getState().persist.isSaving).toBe(false);
      expect(store.read.getState().persist.error).toBeInstanceOf(Error);
      expect(store.read.getState().persist.error?.message).toContain(
        "autosave failed",
      );

      store.feature.cleanup();
    });
  });

  describe("forceSave", () => {
    it("should save immediately when forceSave is called", async () => {
      const storage = createMockStorage();
      const store = createBitStore<TestForm>({
        initialValues: { name: "Leo", email: "leo@test.com", age: 30 },
        persist: {
          enabled: true,
          key: "test-form",
          storage,
          autoSave: false,
        },
      });

      store.write.setField("name", "Leandro");
      await store.feature.forceSave();

      expect(storage.setItem).toHaveBeenCalledWith(
        "test-form",
        expect.any(String),
      );
      const saved = JSON.parse(storage._data["test-form"]);
      expect(saved.name).toBe("Leandro");
      store.feature.cleanup();
    });

    it("should set persist.error and reset isSaving when save fails", async () => {
      const onError = vi.fn();
      const store = createBitStore<TestForm>({
        initialValues: { name: "Leo", email: "leo@test.com", age: 30 },
        persist: {
          enabled: true,
          key: "test-form",
          storage: {
            getItem: vi.fn(() => null),
            setItem: vi.fn(() => {
              throw new Error("quota exceeded");
            }),
            removeItem: vi.fn(),
          },
          autoSave: false,
          onError,
        },
      });

      await store.feature.forceSave();

      expect(onError).toHaveBeenCalledWith(expect.any(Error));
      expect(store.read.getState().persist.isSaving).toBe(false);
      expect(store.read.getState().persist.error).toBeInstanceOf(Error);
      expect(store.read.getState().persist.error?.message).toContain(
        "quota exceeded",
      );

      store.feature.cleanup();
    });

    it("should still expose persist.error when onError callback is not provided", async () => {
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => undefined);
      const store = createBitStore<TestForm>({
        initialValues: { name: "Leo", email: "leo@test.com", age: 30 },
        persist: {
          enabled: true,
          key: "test-form",
          storage: {
            getItem: vi.fn(() => null),
            setItem: vi.fn(() => {
              throw new Error("write failed");
            }),
            removeItem: vi.fn(),
          },
          autoSave: false,
        },
      });

      await store.feature.forceSave();

      expect(store.read.getState().persist.isSaving).toBe(false);
      expect(store.read.getState().persist.error).toBeInstanceOf(Error);
      expect(store.read.getState().persist.error?.message).toContain(
        "write failed",
      );

      consoleErrorSpy.mockRestore();
      store.feature.cleanup();
    });
  });

  describe("restorePersisted", () => {
    it("should restore saved values into the form", async () => {
      const storage = createMockStorage();
      storage._data["test-form"] = JSON.stringify({
        name: "Restored",
        email: "restored@test.com",
        age: 99,
      });

      const store = createBitStore<TestForm>({
        initialValues: { name: "Leo", email: "leo@test.com", age: 30 },
        persist: {
          enabled: true,
          key: "test-form",
          storage,
        },
      });

      const restored = await store.feature.restorePersisted();

      expect(restored).toBe(true);
      expect(store.read.getState().values.name).toBe("Restored");
      expect(store.read.getState().values.email).toBe("restored@test.com");
      store.feature.cleanup();
    });

    it("should return false when nothing is saved", async () => {
      const storage = createMockStorage();
      const store = createBitStore<TestForm>({
        initialValues: { name: "Leo", email: "leo@test.com", age: 30 },
        persist: {
          enabled: true,
          key: "test-form",
          storage,
        },
      });

      const restored = await store.feature.restorePersisted();
      expect(restored).toBe(false);
      store.feature.cleanup();
    });

    it("should partially restore (only saved fields override)", async () => {
      const storage = createMockStorage();
      storage._data["test-form"] = JSON.stringify({ name: "Partial" });

      const store = createBitStore<TestForm>({
        initialValues: { name: "Leo", email: "leo@test.com", age: 30 },
        persist: {
          enabled: true,
          key: "test-form",
          storage,
        },
      });

      await store.feature.restorePersisted();

      expect(store.read.getState().values.name).toBe("Partial");
      expect(store.read.getState().values.email).toBe("leo@test.com");
      expect(store.read.getState().values.age).toBe(30);
      store.feature.cleanup();
    });

    it("should deeply merge nested restored payloads with the baseline", async () => {
      const storage = createMockStorage();
      storage._data["nested-form"] = JSON.stringify({
        profile: { city: "Osaka" },
      });

      const store = createBitStore({
        initialValues: {
          profile: { city: "Tokyo", zip: "100-0001" },
          preferences: { theme: "dark" },
        },
        persist: {
          enabled: true,
          key: "nested-form",
          storage,
        },
      });

      const restored = await store.feature.restorePersisted();

      expect(restored).toBe(true);
      expect(store.read.getState().values).toEqual({
        profile: { city: "Osaka", zip: "100-0001" },
        preferences: { theme: "dark" },
      });

      store.feature.cleanup();
    });
  });

  describe("clearPersisted", () => {
    it("should remove the key from storage", async () => {
      const storage = createMockStorage();
      storage._data["test-form"] = JSON.stringify({ name: "Saved" });

      const store = createBitStore<TestForm>({
        initialValues: { name: "Leo", email: "leo@test.com", age: 30 },
        persist: {
          enabled: true,
          key: "test-form",
          storage,
        },
      });

      await store.feature.clearPersisted();

      expect(storage.removeItem).toHaveBeenCalledWith("test-form");
      expect(storage._data["test-form"]).toBeUndefined();
      store.feature.cleanup();
    });
  });

  describe("async storage adapter", () => {
    it("should work with an async storage adapter (e.g. AsyncStorage)", async () => {
      const asyncData: Record<string, string> = {};
      const asyncStorage = {
        getItem: vi.fn(async (key: string) => asyncData[key] ?? null),
        setItem: vi.fn(async (key: string, value: string) => {
          asyncData[key] = value;
        }),
        removeItem: vi.fn(async (key: string) => {
          delete asyncData[key];
        }),
      };

      const store = createBitStore<TestForm>({
        initialValues: { name: "Leo", email: "leo@test.com", age: 30 },
        persist: {
          enabled: true,
          key: "test-form",
          storage: asyncStorage,
          autoSave: false,
        },
      });

      store.write.setField("name", "Async");
      await store.feature.forceSave();
      expect(asyncStorage.setItem).toHaveBeenCalled();

      const restored = await store.feature.restorePersisted();
      expect(restored).toBe(true);
      expect(store.read.getState().values.name).toBe("Async");
      store.feature.cleanup();
    });
  });

  describe("onError callback", () => {
    it("should call onError when storage throws", async () => {
      const onError = vi.fn();
      const badStorage = {
        getItem: vi.fn(() => {
          throw new Error("Storage failure");
        }),
        setItem: vi.fn(),
        removeItem: vi.fn(),
      };

      const store = createBitStore<TestForm>({
        initialValues: { name: "Leo", email: "leo@test.com", age: 30 },
        persist: {
          enabled: true,
          key: "test-form",
          storage: badStorage,
          onError,
        },
      });

      const restored = await store.feature.restorePersisted();

      expect(restored).toBe(false);
      expect(onError).toHaveBeenCalledWith(expect.any(Error));
      store.feature.cleanup();
    });
  });

  describe("createBitStore facade", () => {
    it("should expose restorePersisted, forceSave, clearPersisted", () => {
      const store = createBitStore({
        initialValues: { name: "", email: "", age: 0 },
        persist: {
          enabled: true,
          key: "facade-test",
          storage: createMockStorage(),
        },
      });

      expect(typeof store.feature.restorePersisted).toBe("function");
      expect(typeof store.feature.forceSave).toBe("function");
      expect(typeof store.feature.clearPersisted).toBe("function");
    });
  });
});
