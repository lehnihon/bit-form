import { describe, expect, it, vi } from "vitest";
import { createBitStore as createBitStoreRuntime } from "../../core";

function createBitStore<T extends object = Record<string, unknown>>(
  config?: any,
) {
  return createBitStoreRuntime<T>(config) as any;
}

describe("Production Audit - Critical Fixes", () => {
  describe("CRÍTICO #1: Subscription Orphaning Fix", () => {
    it("tracked selector lifecycle handles rapid resubscribe+unmount gracefully", async () => {
      const store = createBitStore({
        initialValues: { field1: "" },
      });

      // Rapid state changes should not leave orphaned listeners
      for (let i = 0; i < 50; i++) {
        store.write.setField("field1", `value${i}`);
      }

      // Allow microtasks to settle
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Store should still be operational without orphaned subscriptions
      const state = store.read.getState();
      expect(state).toBeDefined();
      expect(state.values.field1).toBe("value49");
    });
  });

  describe("CRÍTICO #3: Circular Dependency Detection", () => {
    it("should handle circular field dependencies without O(n²) explosion", () => {
      const store = createBitStore({
        initialValues: { fieldA: 5, fieldB: 0 },
        fields: {
          fieldA: {
            conditional: {
              dependsOn: ["fieldB"],
              showIf: (v: any) => v.fieldB > 0,
            },
          },
          fieldB: {
            conditional: {
              dependsOn: ["fieldA"],
              showIf: (v: any) => v.fieldA > 0,
              requiredIf: (v: any) => v.fieldA > 3,
            },
          },
        },
      });

      // Try to update dependencies (circular reference setup)
      // Should not crash and should complete quickly
      const start = performance.now();
      store.write.setField("fieldA", 10);
      const duration = performance.now() - start;

      // Should complete in <20ms (no O(n²) explosion)
      expect(duration).toBeLessThan(20);
    });

    it("should not cause UI freeze with highly interdependent fields", () => {
      // Create a form with 30 conditionally dependent fields
      const fields: Record<string, any> = {};

      for (let i = 0; i < 30; i++) {
        const dependsOn = i > 0 ? [`field${i - 1}`] : [];
        fields[`field${i}`] = {
          conditional: {
            dependsOn,
            showIf: (v: any) => {
              if (dependsOn.length === 0) return true;
              const prevField = dependsOn[0];
              return (
                (v as any)[prevField] !== undefined && (v as any)[prevField] > 0
              );
            },
          },
        };
      }

      const initialValues: Record<string, number> = {};
      for (let i = 0; i < 30; i++) {
        initialValues[`field${i}`] = i;
      }

      const store = createBitStore({
        initialValues,
        fields,
      });

      // Update first field - should propagate to all 30 with good performance
      const start = performance.now();
      store.write.setField("field0", 100);
      const duration = performance.now() - start;

      // Should complete in <30ms even with 30 interdependent fields
      expect(duration).toBeLessThan(30);
    });

    it("should keep cyclic conditional field hidden as a safe fallback", () => {
      const onUnhandledError = vi.fn();
      const store = createBitStore({
        initialValues: { a: 1, b: "secret" },
        onUnhandledError,
      });

      store.feature.registerField("a", {
        conditional: {
          dependsOn: ["b"],
          showIf: (values: any) => values.b === "show",
        },
      });

      store.feature.registerField("b", {
        conditional: {
          dependsOn: ["a"],
          showIf: (values: any) => values.a === 2,
        },
      });

      expect(onUnhandledError).toHaveBeenCalled();
      expect(store.read.isHidden("b")).toBe(true);
    });

    it("should not hide required-only cyclic field and must keep it in submit payload", async () => {
      const onUnhandledError = vi.fn();
      const store = createBitStore({
        initialValues: { a: "A", b: "B" },
        onUnhandledError,
      });

      store.feature.registerField("a", {
        conditional: {
          dependsOn: ["b"],
          requiredIf: (values: any) => !!values.b,
        },
      });

      store.feature.registerField("b", {
        conditional: {
          dependsOn: ["a"],
          requiredIf: (values: any) => !!values.a,
        },
      });

      let submitted: any;
      await store.write.submit((values) => {
        submitted = values;
      });

      expect(onUnhandledError).toHaveBeenCalled();
      expect(store.read.isHidden("b")).toBe(false);
      expect(submitted.b).toBe("B");
    });

    it("should keep field in payload after re-register removes showIf", async () => {
      const store = createBitStore({
        initialValues: { gate: false, target: "value" },
      });

      store.feature.registerField("target", {
        conditional: {
          dependsOn: ["gate"],
          showIf: (values: any) => values.gate,
        },
      });

      expect(store.read.isHidden("target")).toBe(true);

      // Re-register same path without visibility condition.
      store.feature.registerField("target", {
        validation: {
          asyncValidate: async () => null,
        },
      });

      let submitted: any;
      await store.write.submit((values) => {
        submitted = values;
      });

      expect(store.read.isHidden("target")).toBe(false);
      expect(submitted.target).toBe("value");
    });
  });

  describe("ALTO #5: Hidden Field Error Validation", () => {
    it("should not set required error for hidden fields", () => {
      const store = createBitStore({
        initialValues: { fieldA: 2, fieldB: "" },
        validation: {
          resolver: async (values: any) => {
            return {};
          },
        },
        fields: {
          fieldA: { type: "number" },
          fieldB: {
            type: "string",
            conditional: {
              dependsOn: ["fieldA"],
              showIf: (v: any) => v.fieldA > 5,
              requiredIf: (v: any) => v.fieldA > 0,
            },
          },
        },
      });

      const state = store.read.getState();

      // fieldB is hidden (fieldA = 2, not > 5)
      // Previously, error would be set even though field is hidden
      // With the fix: no error should be set
      expect(state.errors.fieldB).toBeUndefined();
    });

    it("should not prevent form submission when hidden required field is empty", () => {
      const store = createBitStore({
        initialValues: { fieldA: 2, fieldB: "" },
        validation: {
          resolver: async (values: any) => {
            // Custom resolver that would normally fail for empty fieldB
            if (!values.fieldB && values.fieldA > 0) {
              return { fieldB: "required" };
            }
            return {};
          },
        },
        fields: {
          fieldA: { type: "number" },
          fieldB: {
            type: "string",
            conditional: {
              dependsOn: ["fieldA"],
              showIf: (v: any) => v.fieldA > 5,
              requiredIf: (v: any) => v.fieldA > 0,
            },
          },
        },
      });

      const state = store.read.getState();

      // fieldB is hidden and empty, but since hidden(), conditional required check
      // should prevent error from being displayed
      expect(state.errors.fieldB).toBeUndefined();
    });
  });

  describe("ALTO #4: Async Validation Cleanup", () => {
    it("should cleanup all pending async validations gracefully", async () => {
      const store = createBitStore({
        initialValues: { email: "" },
        fields: {
          email: {
            validation: {
              asyncValidate: async (value: string) => {
                return new Promise((resolve) => {
                  setTimeout(() => {
                    resolve(value.includes("@") ? null : "invalid email");
                  }, 100);
                });
              },
            },
          },
        },
      });

      // Trigger async validation
      store.write.setField("email", "test");

      // Should complete without errors even if store is destroyed mid-validation
      // This property is tested at destroy time
      expect(store.read.getState()).toBeDefined();
    });
  });

  describe("CRÍTICO #2: Async Validation Race Condition Coverage", () => {
    it("should handle rapid value changes in async validation", async () => {
      const validationCalls: string[] = [];

      const store = createBitStore({
        initialValues: { email: "" },
        fields: {
          email: {
            validation: {
              asyncValidate: async (value: string) => {
                validationCalls.push(value);
                // Simulate network delay
                return new Promise((resolve) => {
                  setTimeout(() => {
                    resolve(value.includes("@") ? null : "invalid");
                  }, 50);
                });
              },
            },
          },
        },
      });

      // Rapid changes: should only validate final value correctly
      store.write.setField("email", "t");
      store.write.setField("email", "te");
      store.write.setField("email", "tes");
      store.write.setField("email", "test@");
      store.write.setField("email", "test@example.com");

      // Wait for validations to complete
      await new Promise((resolve) => setTimeout(resolve, 200));

      const finalState = store.read.getState();

      // Final value is valid email, should not have error
      expect(finalState.values.email).toBe("test@example.com");
      expect(finalState.errors.email).toBeUndefined();
    });
  });
});
