import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBitStore as createBitStoreRuntime } from "../../core";
import { createUploadHandler } from "../../core/adapters/upload-kernel";
import { createBitBus } from "../../core/store/shared/bus";

function createBitStore<T extends object = Record<string, unknown>>(
  config?: any,
) {
  return createBitStoreRuntime<T>(config) as any;
}

interface TestForm {
  name: string;
  email: string;
  items?: Array<{ id: string; value: string }>;
}

describe("Production Audit 4 - Regression Tests", () => {
  describe("Bus Listener Error Chain Resilience", () => {
    it("should continue notifying listeners even if one listener throws", () => {
      const bus = createBitBus();

      const listener1 = vi.fn(() => {
        throw new Error("Listener 1 intentional error");
      });
      const listener2 = vi.fn();
      const listener3 = vi.fn();

      bus.subscribe(listener1);
      bus.subscribe(listener2);
      bus.subscribe(listener3);

      const testState = {
        values: {},
        errors: {},
        touched: {},
        isValidating: {},
        isValid: false,
        isDirty: false,
        persist: { isSaving: false, isRestoring: false, error: null },
      } as any;
      bus.dispatch("store-1", testState);

      expect(listener1).toHaveBeenCalledWith("store-1", testState);
      expect(listener2).toHaveBeenCalledWith("store-1", testState);
      expect(listener3).toHaveBeenCalledWith("store-1", testState);
    });

    it("should continue notifying listeners if multiple listeners throw", () => {
      const bus = createBitBus();

      const listener1 = vi.fn(() => {
        throw new Error("Error 1");
      });
      const listener2 = vi.fn(() => {
        throw new Error("Error 2");
      });
      const listener3 = vi.fn();

      bus.subscribe(listener1);
      bus.subscribe(listener2);
      bus.subscribe(listener3);

      const testState = {
        values: {},
        errors: {},
        touched: {},
        isValidating: {},
        isValid: false,
        isDirty: false,
        persist: { isSaving: false, isRestoring: false, error: null },
      } as any;
      bus.dispatch("store-2", testState);

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
      expect(listener3).toHaveBeenCalledTimes(1);
      expect(listener3).toHaveBeenCalledWith("store-2", testState);
    });

    it("should handle errors in listeners without breaking subscriptions", () => {
      const bus = createBitBus();
      const successfulListener = vi.fn();

      bus.subscribe(() => {
        throw new Error("Intentional error");
      });

      bus.subscribe(successfulListener);

      const testState = {
        values: {},
        errors: {},
        touched: {},
        isValidating: {},
        isValid: false,
        isDirty: false,
        persist: { isSaving: false, isRestoring: false, error: null },
      } as any;

      bus.dispatch("store-3", testState);

      expect(successfulListener).toHaveBeenCalledTimes(1);
    });
  });

  describe("Upload Kernel Callback Error Resilience", () => {
    it("should complete upload despite callback errors and reset loading state", async () => {
      const failingCallback = vi.fn(() => {
        throw new Error("Callback error");
      });

      const setLoading = vi.fn().mockImplementation(failingCallback);
      const setError = vi.fn();
      const setValue = vi.fn();
      const setUploadKey = vi.fn();
      const getUploadKey = vi.fn(() => null);

      const uploadFn = vi.fn(async () => ({
        url: "https://example.com/file.jpg",
        key: "file-key-123",
      }));

      const handler = createUploadHandler("avatar", uploadFn, {
        setLoading,
        setError,
        setValue,
        setUploadKey,
        getUploadKey,
      });

      const file = new File(["content"], "test.jpg", { type: "image/jpeg" });

      await handler(file);

      expect(setLoading).toHaveBeenCalledWith(true);
      expect(setLoading).toHaveBeenCalledWith(false);
      expect(setValue).toHaveBeenCalledWith("https://example.com/file.jpg");
    });

    it("should not leave isLoading true when callbacks throw on success path", async () => {
      let callCount = 0;
      const setLoading = vi.fn((..._args) => {
        callCount++;
        if (callCount === 1) {
          throw new Error("setLoading error on start");
        }
      });
      const setError = vi.fn();
      const setValue = vi.fn(() => {
        throw new Error("setValue callback error");
      });
      const setUploadKey = vi.fn();
      const getUploadKey = vi.fn(() => null);

      const uploadFn = vi.fn(async () => ({
        url: "https://example.com/file.jpg",
        key: "file-key-123",
      }));

      const handler = createUploadHandler("photo", uploadFn, {
        setLoading,
        setError,
        setValue,
        setUploadKey,
        getUploadKey,
      });

      const file = new File(["content"], "photo.jpg");

      await handler(file);

      expect(setLoading).toHaveBeenCalledTimes(2);
      expect(setLoading).toHaveBeenLastCalledWith(false);
    });

    it("should handle concurrent upload callbacks without state leakage", async () => {
      const setLoading = vi.fn();
      const setError = vi.fn();
      const setValue = vi.fn();
      const setUploadKey = vi.fn();
      const getUploadKey = vi.fn(() => null);

      const uploadFn = vi.fn(async () => ({
        url: "https://example.com/file.jpg",
        key: "file-key-123",
      }));

      const handler = createUploadHandler("file", uploadFn, {
        setLoading,
        setError,
        setValue,
        setUploadKey,
        getUploadKey,
      });

      const file1 = new File(["1"], "file1.jpg");
      const file2 = new File(["2"], "file2.jpg");

      const [result1, result2] = await Promise.all([
        handler(file1),
        handler(file2),
      ]);

      expect(setLoading).toHaveBeenCalledWith(false);
      expect(result1).toBeUndefined();
      expect(result2).toBeUndefined();
    });

    it("should reset loading even when error callback throws", async () => {
      const setLoading = vi.fn();
      const setError = vi.fn(() => {
        throw new Error("setError failed");
      });
      const setValue = vi.fn();
      const setUploadKey = vi.fn();
      const getUploadKey = vi.fn(() => null);

      const uploadFn = vi.fn(async () => {
        throw new Error("Upload failed");
      });

      const handler = createUploadHandler("avatar", uploadFn, {
        setLoading,
        setError,
        setValue,
        setUploadKey,
        getUploadKey,
      });

      const file = new File(["content"], "avatar.jpg");

      await handler(file);

      expect(setLoading).toHaveBeenCalledWith(true);
      expect(setLoading).toHaveBeenLastCalledWith(false);
    });
  });

  describe("Array pathIds Memory Leak Prevention", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should clean pathIds from memory when all array items removed", async () => {
      const store = createBitStore<TestForm>({
        initialValues: {
          name: "Test",
          email: "test@test.com",
          items: [
            { id: "1", value: "a" },
            { id: "2", value: "b" },
          ],
        },
        fields: {
          items: {
            type: "array",
          },
          "items.*": {
            type: "object",
          },
          "items.*.id": { type: "text" },
          "items.*.value": { type: "text" },
        },
      });

      store.feature.removeItem("items", 0);
      store.feature.removeItem("items", 0);

      const state = store.read.getState();
      expect(state.values.items).toEqual([]);

      store.feature.cleanup();
    });

    it("should clean pathIds when array is cleared", async () => {
      const store = createBitStore<TestForm>({
        initialValues: {
          name: "Test",
          email: "test@test.com",
          items: [
            { id: "1", value: "a" },
            { id: "2", value: "b" },
          ],
        },
        fields: {
          items: {
            type: "array",
          },
          "items.*": {
            type: "object",
          },
          "items.*.id": { type: "text" },
          "items.*.value": { type: "text" },
        },
      });

      store.write.setField("items", []);

      const state = store.read.getState();
      expect(state.values.items).toEqual([]);

      store.feature.cleanup();
    });

    it("should maintain correct pathIds after multiple cycles of add/remove", async () => {
      const store = createBitStore<TestForm>({
        initialValues: {
          name: "Test",
          email: "test@test.com",
          items: [],
        },
        fields: {
          items: {
            type: "array",
          },
          "items.*": {
            type: "object",
          },
          "items.*.id": { type: "text" },
          "items.*.value": { type: "text" },
        },
      });

      for (let i = 0; i < 5; i++) {
        store.feature.pushItem("items", { id: `${i}`, value: `item-${i}` });
        expect(store.read.getState().values.items).toHaveLength(1);

        store.feature.removeItem("items", 0);
        expect(store.read.getState().values.items).toHaveLength(0);
      }

      store.feature.cleanup();
    });

    it("should not accumulate empty entries when replacing array with empty array", async () => {
      const store = createBitStore<TestForm>({
        initialValues: {
          name: "Test",
          email: "test@test.com",
          items: [{ id: "1", value: "a" }],
        },
        fields: {
          items: {
            type: "array",
          },
          "items.*": {
            type: "object",
          },
          "items.*.id": { type: "text" },
          "items.*.value": { type: "text" },
        },
      });

      for (let i = 0; i < 10; i++) {
        store.write.setField("items", []);
        expect(store.read.getState().values.items).toEqual([]);

        store.write.setField("items", [{ id: "temp", value: "temp-value" }]);
        expect(store.read.getState().values.items).toHaveLength(1);
      }

      store.feature.cleanup();
    });
  });
});
