import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createBitStore } from "../../core";
import { BitStore } from "../../core/store";

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
      const store = new BitStore<TestForm>({
        initialValues: { name: "Leo", email: "leo@test.com", age: 30 },
        persist: {
          enabled: false,
          key: "test-form",
          storage,
        },
      });

      store.setField("name", "Changed");
      vi.runAllTimers();
      await Promise.resolve();

      expect(storage.setItem).not.toHaveBeenCalled();
      store.cleanup();
    });

    it("should return false on restorePersisted when disabled", async () => {
      const storage = createMockStorage();
      const store = new BitStore<TestForm>({
        initialValues: { name: "Leo", email: "leo@test.com", age: 30 },
        persist: {
          enabled: false,
          key: "test-form",
          storage,
        },
      });

      const restored = await store.restorePersisted();
      expect(restored).toBe(false);
      store.cleanup();
    });
  });

  describe("autosave", () => {
    it("should autosave after value changes (debounced)", async () => {
      const storage = createMockStorage();
      const store = new BitStore<TestForm>({
        initialValues: { name: "Leo", email: "leo@test.com", age: 30 },
        persist: {
          enabled: true,
          key: "test-form",
          storage,
          debounceMs: 300,
        },
      });

      store.setField("name", "Leandro");
      expect(storage.setItem).not.toHaveBeenCalled();

      vi.advanceTimersByTime(300);
      await Promise.resolve();

      expect(storage.setItem).toHaveBeenCalledWith(
        "test-form",
        expect.any(String),
      );

      const saved = JSON.parse(storage._data["test-form"]);
      expect(saved.name).toBe("Leandro");

      store.cleanup();
    });

    it("should not autosave if autoSave is false", async () => {
      const storage = createMockStorage();
      const store = new BitStore<TestForm>({
        initialValues: { name: "Leo", email: "leo@test.com", age: 30 },
        persist: {
          enabled: true,
          key: "test-form",
          storage,
          autoSave: false,
        },
      });

      store.setField("name", "Leandro");
      vi.runAllTimers();
      await Promise.resolve();

      expect(storage.setItem).not.toHaveBeenCalled();
      store.cleanup();
    });

    it("should debounce multiple rapid changes into one save", async () => {
      const storage = createMockStorage();
      const store = new BitStore<TestForm>({
        initialValues: { name: "Leo", email: "leo@test.com", age: 30 },
        persist: {
          enabled: true,
          key: "test-form",
          storage,
          debounceMs: 300,
        },
      });

      store.setField("name", "A");
      store.setField("name", "AB");
      store.setField("name", "ABC");
      vi.advanceTimersByTime(300);
      await Promise.resolve();

      expect(storage.setItem).toHaveBeenCalledTimes(1);
      store.cleanup();
    });
  });

  describe("forceSave", () => {
    it("should save immediately when forceSave is called", async () => {
      const storage = createMockStorage();
      const store = new BitStore<TestForm>({
        initialValues: { name: "Leo", email: "leo@test.com", age: 30 },
        persist: {
          enabled: true,
          key: "test-form",
          storage,
          autoSave: false,
        },
      });

      store.setField("name", "Leandro");
      await store.forceSave();

      expect(storage.setItem).toHaveBeenCalledWith(
        "test-form",
        expect.any(String),
      );
      const saved = JSON.parse(storage._data["test-form"]);
      expect(saved.name).toBe("Leandro");
      store.cleanup();
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

      const store = new BitStore<TestForm>({
        initialValues: { name: "Leo", email: "leo@test.com", age: 30 },
        persist: {
          enabled: true,
          key: "test-form",
          storage,
        },
      });

      const restored = await store.restorePersisted();

      expect(restored).toBe(true);
      expect(store.getState().values.name).toBe("Restored");
      expect(store.getState().values.email).toBe("restored@test.com");
      store.cleanup();
    });

    it("should return false when nothing is saved", async () => {
      const storage = createMockStorage();
      const store = new BitStore<TestForm>({
        initialValues: { name: "Leo", email: "leo@test.com", age: 30 },
        persist: {
          enabled: true,
          key: "test-form",
          storage,
        },
      });

      const restored = await store.restorePersisted();
      expect(restored).toBe(false);
      store.cleanup();
    });

    it("should partially restore (only saved fields override)", async () => {
      const storage = createMockStorage();
      storage._data["test-form"] = JSON.stringify({ name: "Partial" });

      const store = new BitStore<TestForm>({
        initialValues: { name: "Leo", email: "leo@test.com", age: 30 },
        persist: {
          enabled: true,
          key: "test-form",
          storage,
        },
      });

      await store.restorePersisted();

      expect(store.getState().values.name).toBe("Partial");
      expect(store.getState().values.email).toBe("leo@test.com");
      expect(store.getState().values.age).toBe(30);
      store.cleanup();
    });
  });

  describe("clearPersisted", () => {
    it("should remove the key from storage", async () => {
      const storage = createMockStorage();
      storage._data["test-form"] = JSON.stringify({ name: "Saved" });

      const store = new BitStore<TestForm>({
        initialValues: { name: "Leo", email: "leo@test.com", age: 30 },
        persist: {
          enabled: true,
          key: "test-form",
          storage,
        },
      });

      await store.clearPersisted();

      expect(storage.removeItem).toHaveBeenCalledWith("test-form");
      expect(storage._data["test-form"]).toBeUndefined();
      store.cleanup();
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

      const store = new BitStore<TestForm>({
        initialValues: { name: "Leo", email: "leo@test.com", age: 30 },
        persist: {
          enabled: true,
          key: "test-form",
          storage: asyncStorage,
          autoSave: false,
        },
      });

      store.setField("name", "Async");
      await store.forceSave();
      expect(asyncStorage.setItem).toHaveBeenCalled();

      const restored = await store.restorePersisted();
      expect(restored).toBe(true);
      expect(store.getState().values.name).toBe("Async");
      store.cleanup();
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

      const store = new BitStore<TestForm>({
        initialValues: { name: "Leo", email: "leo@test.com", age: 30 },
        persist: {
          enabled: true,
          key: "test-form",
          storage: badStorage,
          onError,
        },
      });

      const restored = await store.restorePersisted();

      expect(restored).toBe(false);
      expect(onError).toHaveBeenCalledWith(expect.any(Error));
      store.cleanup();
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

      expect(typeof store.restorePersisted).toBe("function");
      expect(typeof store.forceSave).toBe("function");
      expect(typeof store.clearPersisted).toBe("function");
    });
  });
});
