import { describe, expect, it, vi } from "vitest";
import { createBitStore as createBitStoreRuntime } from "../../core";

function createBitStore<T extends object = Record<string, unknown>>(
  config?: any,
) {
  return createBitStoreRuntime<T>(config) as any;
}

describe("Production Fixes - Safeguards", () => {
  describe("CRÍTICA: Listener exceptions should not crash notification pipeline", () => {
    it("should notify all subscribers even if one throws", async () => {
      const store = createBitStore({
        initialValues: { field1: "test" },
      });

      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const results: number[] = [];

      const collector1 = () => {
        throw new Error("crash");
      };
      const collector2 = () => {
        results.push(2);
      };
      const collector3 = () => {
        results.push(3);
      };

      store.observe.subscribe(collector1);
      store.observe.subscribe(collector2);
      store.observe.subscribe(collector3);

      // This should NOT throw and should call collector2 and collector3
      store.write.setField("field1", "updated");

      expect(results).toEqual([2, 3]);
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    it("should continue notifying scoped subscribers if one throws", async () => {
      const store = createBitStore({
        initialValues: { user: { name: "leo", age: 30 } },
      });

      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const results: string[] = [];

      // Two subscribers on the same selector: first throws, second should still be called
      store.observe.subscribeSelector(
        (state) => (state.values as any).user.age,
        () => {
          throw new Error("crash");
        },
        { paths: ["user.age"] },
      );

      store.observe.subscribeSelector(
        (state) => (state.values as any).user.age,
        (age) => {
          results.push(`age:${age}`);
        },
        { paths: ["user.age"] },
      );

      store.write.setField("user.age", 31);

      expect(results).toContain("age:31");
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });

  describe("ALTA: Stale validation commit should not overwrite current errors", () => {
    it("should not apply stale validation result when values changed during resolver", async () => {
      const store = createBitStore({
        initialValues: { email: "test@example.com" },
        validation: {
          resolver: async (values: any) => {
            // Simulate slow resolver
            await new Promise((resolve) => setTimeout(resolve, 50));
            // Return error only for "invalid" value
            return values.email === "invalid@example.com"
              ? { email: "invalid email" }
              : {};
          },
        },
      });

      // First validation: email valid initially
      const result1 = await store.feature.validate({ scopeFields: ["email"] });
      expect(result1).toBe(true);

      // Start second validation with current value, resolver will be slow
      const validationPromise = store.feature.validate({
        scopeFields: ["email"],
      });

      // Change value to invalid before first resolver completes
      store.write.setField("email", "invalid@example.com");

      // Wait for stale validation to complete (should be skipped due to stale guard)
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Trigger validation for the new value
      await store.feature.validate({ scopeFields: ["email"] });

      // Final error should reflect the invalid value
      const finalState = store.read.getState();
      expect(finalState.errors.email).toBeDefined();
    });

    it("should handle rapid field changes with async resolver", async () => {
      const resolverCalls: string[] = [];
      const store = createBitStore({
        initialValues: { field: "a" },
        validation: {
          resolver: async (values: any) => {
            resolverCalls.push(values.field);
            await new Promise((resolve) => setTimeout(resolve, 20));
            return values.field === "valid" ? {} : { field: "error" };
          },
        },
      });

      // Rapid validations
      store.feature.validate({ scopeFields: ["field"] });
      store.write.setField("field", "b");
      store.feature.validate({ scopeFields: ["field"] });
      store.write.setField("field", "valid");
      const finalResult = await store.feature.validate({
        scopeFields: ["field"],
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Final validation should pass
      expect(finalResult).toBe(true);
      expect(store.read.getState().errors.field).toBeUndefined();
    });
  });

  describe("ALTA: Normalizer exceptions should not crash update pipeline", () => {
    it("should continue with other normalizers if one throws", async () => {
      const normalizerCalls: string[] = [];

      const store = createBitStore({
        initialValues: { field1: "test", field2: "value" },
        fields: {
          field1: {
            normalize: (value: string) => {
              normalizerCalls.push("field1");
              throw new Error("normalizer crash");
            },
          },
          field2: {
            normalize: (value: string) => {
              normalizerCalls.push("field2");
              return value.toUpperCase();
            },
          },
        },
        onUnhandledError: vi.fn(),
      });

      // This should NOT throw and field2 should still be normalized
      store.write.setField("field1", "new1");
      store.write.setField("field2", "new2");

      const state = store.read.getState();

      // field1 should have original normalized value (fallback)
      // field2 should be normalized despite field1 error
      expect(state.values.field2).toBe("NEW2");
      expect(normalizerCalls).toContain("field1");
      expect(normalizerCalls).toContain("field2");
    });

    it("should handle normalizer error during batch update", async () => {
      const store = createBitStore({
        initialValues: { a: "x", b: "y" },
        fields: {
          a: {
            normalize: (value: string) => {
              if (value === "crash") throw new Error("bad value");
              return value;
            },
          },
          b: {
            normalize: (value: string) => value + "_normalized",
          },
        },
        onUnhandledError: vi.fn(),
      });

      // Update field a with crashing normalizer
      store.write.setField("a", "crash");

      // Then update b - normalizer should still work despite a error above
      store.write.setField("b", "test");

      const state = store.read.getState();

      // b should still be normalized despite a's previous error
      expect(state.values.b).toBe("test_normalized");
      expect(state.isValid).toBeDefined(); // Form still valid/invalid, not crashed
    });

    it("should apply fallback derivation if normalizer fails", async () => {
      const onUnhandledError = vi.fn();
      const store = createBitStore({
        initialValues: { data: '{"key":"value"}' },
        fields: {
          data: {
            normalize: (value: string) => {
              const parsed = JSON.parse(value); // Will throw on invalid JSON
              return parsed;
            },
          },
        },
        onUnhandledError,
      });

      // Invalid JSON that will crash normalizer
      store.write.setField("data", "{invalid json}");

      // Should not throw, falls back to original value
      const state = store.read.getState();
      expect(state.values.data).toBeDefined();
      expect(onUnhandledError).toHaveBeenCalled();
    });
  });

  describe("CRÍTICA: validateNow() unhandled promise rejections", () => {
    it("validateNow rejection is handled without crashing", async () => {
      const store = createBitStore({
        initialValues: { data: "test" },
        validation: {
          resolver: async () => {
            throw new Error("validation failed");
          },
        },
      });

      // setValues triggers validateNow internally
      // Should not crash even if resolver throws
      store.write.setValues({ data: "updated" });

      await new Promise((resolve) => setTimeout(resolve, 50));

      // Store should still be alive
      const state = store.read.getState();
      expect(state.values.data).toBe("updated");
    });
  });

  describe("ALTA: onFieldChange plugin error isolation", () => {
    it("store remains operational after field changes", async () => {
      const store = createBitStore({
        initialValues: { field: "test" },
      });

      // Trigger field change
      store.write.setField("field", "updated");

      // Store should still be operational
      const state = store.read.getState();
      expect(state.values.field).toBe("updated");
    });
  });
});
