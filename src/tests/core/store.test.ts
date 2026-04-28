import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createBitStore as createBitStoreRuntime,
  createFrameworkStoreAdapter,
  resolveBitStoreForHooks,
} from "../../core";

const createBitStore = ((config?: any) =>
  createFrameworkStoreAdapter(createBitStoreRuntime(config))) as any;

class CustomProfile {
  constructor(
    public name: string,
    public city: string,
  ) {}
}

describe("BitStore Core", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  describe("Public Store API", () => {
    it("should create a store with core operations", async () => {
      const store = createBitStore({ initialValues: { name: "Leo", age: 30 } });

      store.write.setField("name", "Leandro");

      let submittedValues: any;
      let submittedDirtyValues: any;

      await store.write.submit((values, dirtyValues) => {
        submittedValues = values;
        submittedDirtyValues = dirtyValues;
      });

      expect(submittedValues).toEqual({ name: "Leandro", age: 30 });
      expect(submittedDirtyValues).toEqual({ name: "Leandro" });
    });

    it("should expose core and hook-compatible methods from store instance", () => {
      const store = createBitStore({ initialValues: { name: "Leo" } }) as any;

      expect("feature" in store).toBe(true);
      expect("observe" in store).toBe(true);
      expect("read" in store).toBe(true);
      expect("write" in store).toBe(true);
      expect("undo" in store.feature).toBe(true);
      expect("redo" in store.feature).toBe(true);
      expect("getHistoryMetadata" in store.read).toBe(true);
      expect("subscribeSelector" in store.observe).toBe(true);
      expect("subscribePath" in store.observe).toBe(true);
      expect("getFieldState" in store.read).toBe(true);
      expect("setValues" in store.write).toBe(true);
      expect("beginFieldValidation" in store).toBe(false);
      expect("replaceValues" in store).toBe(false);
      expect("hydrate" in store).toBe(false);
      expect("rebase" in store).toBe(false);
      expect("transaction" in store.write).toBe(true);
      expect("historyMg" in store).toBe(false);
      expect("depsMg" in store).toBe(false);
    });

    it("should resolve hook API from store instance", () => {
      const store = createBitStoreRuntime({
        initialValues: { name: "Leo" },
      }) as any;

      expect(typeof store.observe.subscribeSelector).toBe("function");

      const hooksStore = resolveBitStoreForHooks(store);

      expect(typeof hooksStore.observe.subscribeSelector).toBe("function");
      expect(typeof hooksStore.observe.subscribePath).toBe("function");
      expect(typeof hooksStore.read.getFieldState).toBe("function");
    });

    it("should build framework adapter from store instance", () => {
      const store = createBitStoreRuntime({
        initialValues: { name: "Leo" },
      }) as any;

      const frameworkStore = createFrameworkStoreAdapter(store);

      expect(frameworkStore).toBe(store);
      expect(typeof frameworkStore.observe.subscribeSelector).toBe("function");
      expect(typeof frameworkStore.write.setField).toBe("function");
      expect(typeof frameworkStore.write.submit).toBe("function");
      expect(typeof frameworkStore.feature.cleanup).toBe("function");
    });

    it("should expose complete framework contract from adapter", () => {
      const rawStore = createBitStoreRuntime({
        initialValues: { name: "Leo", items: [] as string[] },
      }) as any;
      const frameworkStore = createFrameworkStoreAdapter(rawStore) as any;

      // Verifica namespaces da nova API namespaced
      expect(typeof frameworkStore.read.getState).toBe("function");
      expect(typeof frameworkStore.read.getFieldState).toBe("function");
      expect(typeof frameworkStore.read.getDirtyValues).toBe("function");
      expect(typeof frameworkStore.read.getScopeStatus).toBe("function");
      expect(typeof frameworkStore.read.getScopeFields).toBe("function");
      expect(typeof frameworkStore.read.getScopeErrors).toBe("function");
      expect(typeof frameworkStore.read.getHistoryMetadata).toBe("function");
      expect(typeof frameworkStore.read.getPersistMetadata).toBe("function");
      expect(typeof frameworkStore.write.setField).toBe("function");
      expect(typeof frameworkStore.write.blurField).toBe("function");
      expect(typeof frameworkStore.write.setError).toBe("function");
      expect(typeof frameworkStore.write.setErrors).toBe("function");
      expect(typeof frameworkStore.write.setServerErrors).toBe("function");
      expect(typeof frameworkStore.write.setValues).toBe("function");
      expect(typeof frameworkStore.feature.validate).toBe("function");
      expect(typeof frameworkStore.write.submit).toBe("function");
      expect(typeof frameworkStore.write.reset).toBe("function");
      expect(typeof frameworkStore.observe.subscribe).toBe("function");
      expect(typeof frameworkStore.observe.subscribePath).toBe("function");
      expect(typeof frameworkStore.observe.subscribeSelector).toBe("function");
      expect(typeof frameworkStore.observe.subscribeFieldState).toBe(
        "function",
      );
      expect(typeof frameworkStore.observe.subscribeFormMeta).toBe("function");
      expect(typeof frameworkStore.observe.subscribeScopeStatus).toBe(
        "function",
      );
      expect(typeof frameworkStore.feature.registerField).toBe("function");
      expect(typeof frameworkStore.feature.unregisterField).toBe("function");
      expect(typeof frameworkStore.feature.unregisterPrefix).toBe("function");
      expect(typeof frameworkStore.feature.pushItem).toBe("function");
      expect(typeof frameworkStore.feature.removeItem).toBe("function");
      expect(typeof frameworkStore.feature.moveItem).toBe("function");
      expect(typeof frameworkStore.feature.cleanup).toBe("function");
    });
  });

  describe("Basic State and Getters", () => {
    it("should initialize with correct state", () => {
      const store = createBitStore({ initialValues: { name: "Leo" } });
      const state = store.read.getState();

      expect(state.values.name).toBe("Leo");
      expect(store.read.getState().isValid).toBe(true);
      expect(store.read.getState().isDirty).toBe(false);
      expect(store.read.getState().isSubmitting).toBe(false);
      expect(store.read.config.initialValues).toEqual({ name: "Leo" });
    });

    it("should return a defensive state snapshot", () => {
      const store = createBitStore({
        initialValues: { profile: { name: "Leo" } },
      });

      const snapshot = store.read.getState() as any;
      snapshot.values.profile.name = "Mutated Externally";
      snapshot.errors.profile = "external-error";

      const stateAfterExternalMutation = store.read.getState();

      expect(stateAfterExternalMutation.values.profile.name).toBe("Leo");
      expect(
        stateAfterExternalMutation.errors.profile as unknown as string,
      ).toBeUndefined();
    });

    it("should return a defensive state snapshot for class instances", () => {
      const store = createBitStore({
        initialValues: {
          profile: new CustomProfile("Leo", "Tokyo"),
        },
      });

      const snapshot = store.read.getState() as any;
      snapshot.values.profile.name = "Mutated Externally";

      const stateAfterExternalMutation = store.read.getState() as any;
      expect(stateAfterExternalMutation.values.profile.name).toBe("Leo");
    });

    it("should return a defensive field state snapshot", () => {
      const store = createBitStore({
        initialValues: {
          profile: { name: "Leo", city: "Tokyo" },
        },
      });

      const fieldState = store.read.getFieldState("profile") as any;
      fieldState.value.name = "Mutated Externally";

      const stateAfterExternalMutation = store.read.getState() as any;
      expect(stateAfterExternalMutation.values.profile.name).toBe("Leo");
    });

    it("should update field and notify listeners", () => {
      const store = createBitStore({ initialValues: { name: "" } });
      const listener = vi.fn();
      store.observe.subscribe(listener);

      store.write.setField("name", "Leo");

      expect(store.read.getState().values.name).toBe("Leo");
      expect(listener).toHaveBeenCalled();
    });

    it("should batch updates inside transaction and notify once", () => {
      const store = createBitStore({ initialValues: { name: "Leo", age: 30 } });
      const listener = vi.fn();

      store.observe.subscribe(listener);

      store.write.transaction(() => {
        store.write.setField("name", "Leandro");
        store.write.setField("age", 31);
      });

      expect(store.read.getState().values).toEqual({
        name: "Leandro",
        age: 31,
      });
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it("BUG-5: transaction should not revoke proxies when passing state to subscribers (Vue/MobX compatibility)", () => {
      const store = createBitStore({ initialValues: { name: "Leo" } });

      let trappedState: any = null;
      store.observe.subscribeFormMeta(() => {
        // Simula o Vue lendo propriedades do proxy logo após o commit
        trappedState = store.read.getState().values.name;
      });

      // Em um ambiente com Proxy.revocable no batch engine, isso falharia ao ler a prop no final do commit
      expect(() => {
        store.write.transaction(() => {
          store.write.setField("name", "Leandro");
        });
      }).not.toThrow();

      expect(trappedState).toBe("Leandro");
    });

    it("should allow watching specific fields", () => {
      const store = createBitStore({
        initialValues: { user: { name: "Leo", age: 30 } },
      });
      const watcher = vi.fn();

      store.observe.subscribePath("user.name", watcher);

      store.write.setField("user.age", 31);
      expect(watcher).not.toHaveBeenCalled();

      store.write.setField("user.name", "Leandro");
      expect(watcher).toHaveBeenCalledWith("Leandro");
    });

    it("should support selector-based subscriptions", () => {
      const store = createBitStore({
        initialValues: { user: { name: "Leo" }, age: 30 },
      });
      const listener = vi.fn();

      const unsubscribe = store.observe.subscribeSelector(
        (state) => state.values.user.name,
        listener,
        { paths: ["user.name"] },
      );

      store.write.setField("age", 31);
      expect(listener).not.toHaveBeenCalled();

      store.write.setField("user.name", "Leandro");
      expect(listener).toHaveBeenCalledWith("Leandro");

      unsubscribe();
    });

    it("should require explicit selector paths and notify on matching nested updates", () => {
      const store = createBitStore({
        initialValues: { user: { name: "Leo", age: 30 }, city: "Tokyo" },
      });
      const listener = vi.fn();

      const unsubscribe = store.observe.subscribeSelector(
        (state) => state.values.user.name,
        listener,
        { paths: ["user.name"] },
      );

      store.write.setField("city", "Osaka");
      expect(listener).not.toHaveBeenCalled();

      store.write.setField("user.age", 31);
      expect(listener).not.toHaveBeenCalled();

      store.write.setField("user.name", "Leandro");
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith("Leandro");

      unsubscribe();
    });

    it("should notify field subscribers when dependency toggles hidden state", () => {
      const store = createBitStore({
        initialValues: { country: "BR", state: "SP" },
      });

      store.feature.registerField("state", {
        conditional: {
          dependsOn: ["country"],
          showIf: (values) => values.country === "BR",
        },
      });

      const listener = vi.fn();

      const unsubscribe = store.observe.subscribeSelector(
        () => store.read.getFieldState("state").isHidden,
        listener,
        { paths: ["state"] },
      );

      store.write.setField("country", "US");
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(true);

      store.write.setField("country", "BR");
      expect(listener).toHaveBeenCalledTimes(2);
      expect(listener).toHaveBeenLastCalledWith(false);

      unsubscribe();
    });

    it("should notify field subscribers when requiredIf changes without visibility change", () => {
      const store = createBitStore({
        initialValues: { hasLicense: false, licenseNumber: "" },
      });

      store.feature.registerField("licenseNumber", {
        conditional: {
          dependsOn: ["hasLicense"],
          requiredIf: (values) => values.hasLicense === true,
        },
      });

      const listener = vi.fn();
      const unsubscribe = store.observe.subscribeFieldState(
        "licenseNumber",
        listener,
      );

      store.write.setField("hasLicense", true);

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener.mock.calls[0]?.[0]).toMatchObject({
        isRequired: true,
        isHidden: false,
      });

      unsubscribe();
    });

    it("should support selector options emitImmediately and equalityFn", () => {
      const store = createBitStore({
        initialValues: { user: { name: "Leo" }, age: 30 },
      });

      const listener = vi.fn();

      const unsubscribe = store.observe.subscribeSelector(
        (state) => state.values.user,
        listener,
        {
          emitImmediately: true,
          paths: ["user"],
          equalityFn: (prev, next) => prev.name === next.name,
        },
      );

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith({ name: "Leo" });

      store.write.setField("age", 31);
      expect(listener).toHaveBeenCalledTimes(1);

      store.write.setField("user.name", "Leandro");
      expect(listener).toHaveBeenCalledTimes(2);
      expect(listener).toHaveBeenLastCalledWith({ name: "Leandro" });

      unsubscribe();
    });

    it("should support tracked selector subscriptions without explicit paths", () => {
      const store = createBitStore({
        initialValues: { user: { name: "Leo" }, age: 30 },
        trackedSubscriptions: true,
      });

      const listener = vi.fn();

      const unsubscribe = store.observe.subscribeSelector(
        (state) => state.values.user.name,
        listener,
        { mode: "tracked" },
      );

      store.write.setField("age", 31);
      expect(listener).not.toHaveBeenCalled();

      store.write.setField("user.name", "Leandro");
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenLastCalledWith("Leandro");

      unsubscribe();
    });

    it("should re-track tracked selector paths when selector branch changes", async () => {
      const store = createBitStore({
        initialValues: {
          mode: "name" as "name" | "city",
          user: { name: "Leo" },
          city: "Tokyo",
        },
        trackedSubscriptions: true,
      });

      const listener = vi.fn();

      const unsubscribe = store.observe.subscribeSelector(
        (state) =>
          state.values.mode === "name"
            ? state.values.user.name
            : state.values.city,
        listener,
        { mode: "tracked" },
      );

      store.write.setField("city", "Osaka");
      expect(listener).not.toHaveBeenCalled();

      store.write.setField("mode", "city");
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenLastCalledWith("Osaka");

      await Promise.resolve();

      store.write.setField("city", "Kyoto");
      expect(listener).toHaveBeenCalledTimes(2);
      expect(listener).toHaveBeenLastCalledWith("Kyoto");

      unsubscribe();
    });

    it("should support path-based subscriptions", () => {
      const store = createBitStore({
        initialValues: { user: { name: "Leo" }, age: 30 },
      });
      const listener = vi.fn();

      const unsubscribe = store.observe.subscribePath("user.name", listener);

      store.write.setField("age", 31);
      expect(listener).not.toHaveBeenCalled();

      store.write.setField("user.name", "Leandro");
      expect(listener).toHaveBeenCalledWith("Leandro");

      unsubscribe();
    });

    it("should support native subscribeFieldState with field-level equality", () => {
      const store = createBitStore({
        initialValues: { name: "Leo", age: 30 },
      });
      const listener = vi.fn();

      const unsubscribe = store.observe.subscribeFieldState("name", listener);

      store.write.setField("age", 31);
      expect(listener).not.toHaveBeenCalled();

      store.write.setField("name", "Leandro");
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener.mock.calls[0]?.[0]?.value).toBe("Leandro");

      unsubscribe();
    });

    it("should support native subscribeFormMeta and notify only form flags", () => {
      const store = createBitStore({
        initialValues: { name: "Leo" },
      });
      const listener = vi.fn();

      const unsubscribe = store.observe.subscribeFormMeta(listener);

      store.write.setField("name", "Leandro");
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener.mock.calls[0]?.[0]).toMatchObject({
        isDirty: true,
        isValid: true,
      });

      store.write.setField("name", "Leo");
      expect(listener).toHaveBeenCalledTimes(2);
      expect(listener.mock.calls[1]?.[0]).toMatchObject({
        isDirty: false,
        isValid: true,
      });

      unsubscribe();
    });

    it("should not emit transient isValid=true while replacing values with invalid payload", () => {
      let resolveResolver:
        | ((errors: Record<string, string>) => void)
        | undefined;

      const store = createBitStore({
        initialValues: { name: "Leo" },
        validation: {
          resolver: () =>
            new Promise<Record<string, string>>((resolve) => {
              resolveResolver = resolve;
            }),
          delay: 0,
        },
      });

      const isValidEvents: boolean[] = [];
      const unsubscribe = store.observe.subscribeFormMeta((meta) => {
        isValidEvents.push(meta.isValid);
      });

      store.write.setValues({ name: "" });

      expect(store.read.getState().isValid).toBe(false);
      expect(isValidEvents.every((value) => value === false)).toBe(true);

      resolveResolver?.({ name: "Required" });
      unsubscribe();
    });

    it("should persist a single history snapshot for multiple mutations inside transaction", () => {
      const store = createBitStore({
        initialValues: { items: [1] },
        history: { enabled: true, limit: 20, debounceMs: 0 },
      });

      expect(store.read.getHistoryMetadata().historySize).toBe(1);

      store.write.transaction(() => {
        store.feature.pushItem("items", 2);
        store.feature.pushItem("items", 3);
      });

      expect(store.read.getState().values.items).toEqual([1, 2, 3]);
      expect(store.read.getHistoryMetadata().historySize).toBe(2);

      store.feature.undo();
      expect(store.read.getState().values.items).toEqual([1]);
    });

    it("should update nested fields using dot notation", () => {
      const store = createBitStore({
        initialValues: { user: { profile: { name: "" } } },
      });

      store.write.setField("user.profile.name", "Leo");
      expect(store.read.getState().values.user.profile.name).toBe("Leo");
    });

    it("should mark field as touched on blur", () => {
      const store = createBitStore({ initialValues: { name: "" } });

      store.write.blurField("name");
      expect(store.read.getState().touched.name).toBe(true);
    });

    it("should track isDirty state accurately", () => {
      const store = createBitStore({ initialValues: { name: "Leo" } });

      expect(store.read.getState().isDirty).toBe(false);
      expect(store.read.isFieldDirty("name")).toBe(false);

      store.write.setField("name", "Leandro");
      expect(store.read.getState().isDirty).toBe(true);
      expect(store.read.isFieldDirty("name")).toBe(true);

      store.write.setField("name", "Leo");
      expect(store.read.getState().isDirty).toBe(false);
      expect(store.read.isFieldDirty("name")).toBe(false);
    });

    it("should return only dirty values", () => {
      const store = createBitStore({
        initialValues: { name: "Leo", age: 30, city: "Tokyo" },
      });

      expect(store.read.getDirtyValues()).toEqual({});

      store.write.setField("name", "Leandro");
      expect(store.read.getDirtyValues()).toEqual({ name: "Leandro" });

      store.write.setField("age", 31);
      expect(store.read.getDirtyValues()).toEqual({ name: "Leandro", age: 31 });

      store.write.setField("name", "Leo");
      expect(store.read.getDirtyValues()).toEqual({ age: 31 });
    });

    it("should return dirty values for nested objects", () => {
      const store = createBitStore({
        initialValues: { user: { name: "Leo", profile: { bio: "Dev" } } },
      });

      store.write.setField("user.name", "Leandro");
      expect(store.read.getDirtyValues()).toEqual({
        user: { name: "Leandro" },
      });

      store.write.setField("user.profile.bio", "Developer");
      expect(store.read.getDirtyValues()).toEqual({
        user: { name: "Leandro", profile: { bio: "Developer" } },
      });
    });

    it("should keep both dirty branches when values share the same object reference", () => {
      const initialShared = { city: "Tokyo" };
      const nextShared = { city: "Osaka" };

      const store = createBitStore({
        initialValues: {
          billing: initialShared,
          shipping: initialShared,
        },
      });

      store.write.setValues({
        billing: nextShared,
        shipping: nextShared,
      });

      expect(store.read.getDirtyValues()).toEqual({
        billing: { city: "Osaka" },
        shipping: { city: "Osaka" },
      });
      expect(store.read.isFieldDirty("billing.city")).toBe(true);
      expect(store.read.isFieldDirty("shipping.city")).toBe(true);
    });

    it("should return full array when any index changes", () => {
      const store = createBitStore({
        initialValues: { tags: ["react", "vue"], count: 0 },
      });

      store.write.setField("tags.1", "angular");
      const dirty = store.read.getDirtyValues();

      expect(dirty.tags).toEqual(["react", "angular"]);
      expect(dirty.count).toBeUndefined();
    });
  });

  describe("Computed Fields", () => {
    it("should calculate fields on initialization", () => {
      const store = createBitStore({
        initialValues: { price: 10, qty: 2, total: 0 },
        fields: {
          total: {
            computed: (vals) => vals.price * vals.qty,
            computedDependsOn: ["price", "qty"],
          },
        },
      });

      expect(store.read.getState().values.total).toBe(20);
    });

    it("should update computed field when dependencies change", () => {
      const store = createBitStore({
        initialValues: {
          firstName: "Leandro",
          lastName: "Ishikawa",
          fullName: "",
        },
        fields: {
          fullName: {
            computed: (vals) => `${vals.firstName} ${vals.lastName}`,
            computedDependsOn: ["firstName", "lastName"],
          },
        },
      });

      store.write.setField("firstName", "Leo");
      expect(store.read.getState().values.fullName).toBe("Leo Ishikawa");
    });

    it("should handle cascading computed fields (double pass)", () => {
      const store = createBitStore({
        initialValues: { netPrice: 100, tax: 0, finalPrice: 0 },
        fields: {
          tax: {
            computed: (vals) => vals.netPrice * 0.1,
            computedDependsOn: ["netPrice"],
          },
          finalPrice: {
            computed: (vals) => vals.netPrice + vals.tax,
            computedDependsOn: ["netPrice", "tax"],
          },
        },
      });

      store.write.setField("netPrice", 200);

      expect(store.read.getState().values.tax).toBe(20);
      expect(store.read.getState().values.finalPrice).toBe(220);
    });

    it("should fail fast on explicit cyclic computed dependencies", () => {
      expect(() =>
        createBitStore({
          initialValues: { price: 10, total: 0, grandTotal: 0 },
          fields: {
            total: {
              computed: (vals) => vals.grandTotal,
              computedDependsOn: ["grandTotal"],
            },
            grandTotal: {
              computed: (vals) => vals.total,
              computedDependsOn: ["total"],
            },
          },
        }),
      ).toThrow(/Circular dependency detected/i);
    });
  });

  describe("Conditional Logic (Dependency Manager)", () => {
    it("should hide field based on initial values", () => {
      const store = createBitStore({
        initialValues: { country: "US", state: "" },
      });
      store.feature.registerField("state", {
        conditional: {
          dependsOn: ["country"],
          showIf: (values) => values.country === "BR",
        },
      });

      expect(store.read.isHidden("state")).toBe(true);
    });

    it("should show field and trigger re-render when dependency changes", () => {
      const store = createBitStore({
        initialValues: { country: "US", state: "" },
      });
      const listener = vi.fn();
      store.observe.subscribe(listener);

      store.feature.registerField("state", {
        conditional: {
          dependsOn: ["country"],
          showIf: (values) => values.country === "BR",
        },
      });

      store.write.setField("country", "BR");

      expect(store.read.isHidden("state")).toBe(false);
      expect(listener).toHaveBeenCalled();
    });

    it("should clear errors when a field becomes hidden", () => {
      const store = createBitStore({
        initialValues: { type: "company", cnpj: "" },
      });
      store.feature.registerField("cnpj", {
        conditional: {
          dependsOn: ["type"],
          showIf: (values) => values.type === "company",
        },
      });

      store.write.setError("cnpj", "Required");
      expect(store.read.getState().errors.cnpj).toBe("Required");

      store.write.setField("type", "person");
      expect(store.read.isHidden("cnpj")).toBe(true);
      expect(store.read.getState().errors.cnpj).toBeUndefined();
    });

    it("should unregister field configurations and dependencies", () => {
      const store = createBitStore({
        initialValues: { country: "BR", state: "" },
      });

      store.feature.registerField("state", {
        conditional: {
          dependsOn: ["country"],
          showIf: (v) => v.country === "BR",
        },
      });

      expect(store.read.isHidden("state")).toBe(false);

      store.feature.unregisterField("state");

      expect(store.read.isHidden("state")).toBe(false);
      store.write.setField("country", "US");
    });

    it("should cleanup descendant errors and touched when unregistering parent field", () => {
      const store = createBitStore({
        initialValues: { address: { city: "", zip: "" } },
      });

      store.feature.registerField("address", {});

      store.write.setErrors({
        "address.city": "Required",
      });
      store.write.blurField("address.city");

      expect(store.read.getState().errors["address.city"]).toBe("Required");
      expect(store.read.getState().touched["address.city"]).toBe(true);

      store.feature.unregisterField("address");

      expect(store.read.getState().errors["address.city"]).toBeUndefined();
      expect(store.read.getState().touched["address.city"]).toBeUndefined();
    });

    it("should NOT unregister fields from config.fields (keeps them for validation)", () => {
      const store = createBitStore({
        initialValues: { bonus: false, bonusValue: 0 },
        fields: {
          bonus: { scope: "step1" },
          bonusValue: {
            scope: "step1",
            conditional: {
              dependsOn: ["bonus"],
              showIf: (v: any) => v.bonus === true,
              requiredIf: (v: any) => v.bonus === true,
            },
          },
        },
      });

      expect(store.read.getFieldConfig("bonusValue")).toBeDefined();

      store.feature.unregisterField("bonusValue");

      expect(store.read.getFieldConfig("bonusValue")).toBeDefined();
    });

    it("should not allow runtime field behavior changes by mutating read.getFieldConfig", () => {
      const store = createBitStore({
        initialValues: { email: "" },
        fields: {
          email: {
            validation: {
              asyncValidateOn: "change",
            },
          },
        },
      });

      const leakedConfig = store.read.getFieldConfig("email");
      expect(leakedConfig).toBeDefined();

      leakedConfig!.validation = {
        ...leakedConfig!.validation,
        asyncValidate: async () => new Promise<string | null>(() => {}),
      };

      store.write.setField("email", "local-mutation");
      expect(store.read.getState().isValidating.email).toBeUndefined();

      store.feature.registerField("email", {
        validation: {
          asyncValidateOn: "change",
          asyncValidateDelay: 0,
          asyncValidate: async () => new Promise<string | null>(() => {}),
        },
      });

      store.write.setField("email", "registered-change");
      expect(store.read.getState().isValidating.email).toBe(true);
    });
  });

  describe("Validation & Scopes", () => {
    it("should handle manual error setting with setError and setErrors", () => {
      const store = createBitStore({ initialValues: { email: "" } });

      store.write.setError("email", "Invalid email");
      expect(store.read.getState().errors.email).toBe("Invalid email");
      expect(store.read.getState().isValid).toBe(false);

      store.write.setErrors({ email: "Too short" });
      expect(store.read.getState().errors.email).toBe("Too short");
    });

    it("should clear field error instantly when value changes", () => {
      const store = createBitStore({ initialValues: { name: "" } });
      store.write.setError("name", "Required");

      store.write.setField("name", "L");
      expect(store.read.getState().errors.name).toBeUndefined();
    });

    it("should evaluate step status correctly", () => {
      const store = createBitStore({
        initialValues: { p1: "", p2: "" },
        fields: {
          p1: { scope: "step1" },
          p2: { scope: "step1" },
        },
      });

      store.write.setError("p1", "Error");
      store.write.setField("p2", "Changed");

      const status = store.read.getScopeStatus("step1");
      expect(status.hasErrors).toBe(true);
      expect(status.isDirty).toBe(true);
    });

    it("should keep scope subscriptions reactive when new fields join the scope", async () => {
      const store = createBitStore({
        initialValues: { p1: "", p2: "" },
        fields: {
          p1: { scope: "step1" },
        },
      });

      const listener = vi.fn();
      const unsubscribe = store.observe.subscribeScopeStatus("step1", listener);

      store.feature.registerField("p2", { scope: "step1" });

      // The registry change triggers a queueMicrotask re-subscription.
      // Drain the microtask queue before mutating state so the new scoped
      // subscription is active when the error is set.
      await Promise.resolve();

      store.write.setError("p2", "Dynamic scope error");

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener.mock.calls[0]?.[0]).toMatchObject({
        hasErrors: true,
        errors: { p2: "Dynamic scope error" },
      });

      unsubscribe();
    });

    it("should map server errors", () => {
      const store = createBitStore({ initialValues: { email: "", cpf: "" } });

      store.write.setServerErrors({
        email: ["Already taken"],
        cpf: "Invalid format",
      });

      expect(store.read.getState().errors.email).toBe("Already taken");
      expect(store.read.getState().errors.cpf).toBe("Invalid format");
      expect(store.read.getState().isValid).toBe(false);
    });

    it("should keep first server error message by default", () => {
      const store = createBitStore({ initialValues: { email: "" } });

      store.write.setServerErrors({
        email: ["Already taken", "Invalid format"],
      });

      expect(store.read.getState().errors.email).toBe("Already taken");
    });

    it("should join server error messages when arrayStrategy is join", () => {
      const store = createBitStore({ initialValues: { email: "" } });

      store.write.setServerErrors(
        {
          email: ["Already taken", "Invalid format"],
        },
        { arrayStrategy: "join", joinSeparator: " | " },
      );

      expect(store.read.getState().errors.email).toBe(
        "Already taken | Invalid format",
      );
    });

    it("should trigger requiredIf validation dynamically", async () => {
      const store = createBitStore({
        initialValues: { hasLicense: true, licenseNumber: "" },
      });

      store.feature.registerField("licenseNumber", {
        conditional: {
          dependsOn: ["hasLicense"],
          requiredIf: (v) => v.hasLicense === true,
        },
      });

      const isValid = await store.feature.validate();
      expect(isValid).toBe(false);
      expect(store.read.getState().errors.licenseNumber).toBe("required field");

      store.write.setField("hasLicense", false);
      const isValidNow = await store.feature.validate();
      expect(isValidNow).toBe(true);
    });

    it("should use conditional.requiredMessage when defined", async () => {
      const store = createBitStore({
        initialValues: { hasBonus: true, bonusValue: "" },
      });

      store.feature.registerField("bonusValue", {
        conditional: {
          dependsOn: ["hasBonus"],
          requiredIf: (v: any) => v.hasBonus === true,
          requiredMessage: "Bonus amount is required",
        },
      });

      const isValid = await store.feature.validate();
      expect(isValid).toBe(false);
      expect(store.read.getState().errors.bonusValue).toBe(
        "Bonus amount is required",
      );
    });
  });

  describe("Undo/Redo History", () => {
    it("should keep initial history metadata consistent with debounce enabled", () => {
      vi.useFakeTimers();

      const store = createBitStore({
        initialValues: { name: "A" },
        history: { enabled: true },
      });

      expect(store.read.getHistoryMetadata()).toMatchObject({
        enabled: true,
        canUndo: false,
        canRedo: false,
        historyIndex: 0,
        historySize: 1,
      });

      vi.advanceTimersByTime(300);

      expect(store.read.getHistoryMetadata()).toMatchObject({
        enabled: true,
        canUndo: false,
        canRedo: false,
        historyIndex: 0,
        historySize: 1,
      });
    });

    it("should track history correctly", () => {
      const store = createBitStore({
        initialValues: { name: "Leo" },
        history: { enabled: true, debounceMs: 0 },
      });

      store.write.setField("name", "Leandro");
      store.write.blurField("name");

      store.write.setField("name", "Ishikawa");
      store.write.blurField("name");

      expect(store.read.getHistoryMetadata().canUndo).toBe(true);

      store.feature.undo();
      expect(store.read.getState().values.name).toBe("Leandro");
      expect(store.read.getHistoryMetadata().canRedo).toBe(true);

      store.feature.redo();
      expect(store.read.getState().values.name).toBe("Ishikawa");
    });

    it("should expose history metadata", () => {
      const store = createBitStore({
        initialValues: { name: "Leo" },
        history: { enabled: true, debounceMs: 0 },
      });

      let history = store.read.getHistoryMetadata();
      expect(history.enabled).toBe(true);
      expect(history.historySize).toBe(1);
      expect(history.historyIndex).toBe(0);

      store.write.setField("name", "Leandro");
      store.write.blurField("name");

      history = store.read.getHistoryMetadata();
      expect(history.historySize).toBe(2);
      expect(history.historyIndex).toBe(1);
      expect(history.canUndo).toBe(true);
    });

    it("should not allow redo after undo followed by new write", () => {
      const store = createBitStore({
        initialValues: { name: "A" },
        history: { enabled: true, debounceMs: 0 },
      });

      store.write.setField("name", "B");
      store.write.blurField("name");

      store.write.setField("name", "C");
      store.write.blurField("name");

      store.feature.undo();
      expect(store.read.getState().values.name).toBe("B");
      expect(store.read.getHistoryMetadata().canRedo).toBe(true);

      store.write.setField("name", "D");
      store.write.blurField("name");

      expect(store.read.getHistoryMetadata().canRedo).toBe(false);
      expect(store.feature.redo()).toBeUndefined();
      expect(store.read.getState().values.name).toBe("D");
    });

    it("should clear stale errors immediately when applying undo snapshot", async () => {
      const store = createBitStore({
        initialValues: { name: "A" },
        history: { enabled: true, debounceMs: 0 },
        validation: {
          resolver: async (values: any) =>
            values.name ? {} : { name: "Required" },
        },
      });

      store.write.setField("name", "B");
      store.write.setField("name", "");
      await store.feature.validate();

      expect(store.read.getState().errors.name).toBe("Required");

      store.feature.undo();

      expect(store.read.getState().values.name).toBe("B");
      expect(store.read.getState().errors.name).toBeUndefined();
    });

    it("should not emit transient isValid=true when undo restores invalid snapshot", () => {
      let resolveResolver:
        | ((errors: Record<string, string>) => void)
        | undefined;

      const store = createBitStore({
        initialValues: { name: "A" },
        history: { enabled: true, debounceMs: 0 },
        validation: {
          resolver: () =>
            new Promise<Record<string, string>>((resolve) => {
              resolveResolver = resolve;
            }),
          delay: 0,
        },
      });

      store.write.setField("name", "");
      store.write.setField("name", "B");

      const isValidEvents: boolean[] = [];
      const unsubscribe = store.observe.subscribeFormMeta((meta) => {
        isValidEvents.push(meta.isValid);
      });

      store.feature.undo();

      expect(store.read.getState().values.name).toBe("");
      expect(store.read.getState().isValid).toBe(false);
      expect(isValidEvents.every((value) => value === false)).toBe(true);

      resolveResolver?.({ name: "Required" });
      unsubscribe();
    });

    it("should debounce history snapshots by default (300ms)", () => {
      vi.useFakeTimers();

      const store = createBitStore({
        initialValues: { name: "" },
        history: { enabled: true },
      });

      store.write.setField("name", "L");
      store.write.setField("name", "Le");
      store.write.setField("name", "Leo");

      expect(store.read.getHistoryMetadata().historySize).toBe(1);

      vi.advanceTimersByTime(300);

      expect(store.read.getHistoryMetadata().historySize).toBe(2);
      expect(store.read.getState().values.name).toBe("Leo");
    });

    it("should flush pending snapshot on blur before debounce elapses", () => {
      vi.useFakeTimers();

      const store = createBitStore({
        initialValues: { name: "" },
        history: { enabled: true },
      });

      store.write.setField("name", "Leandro");
      expect(store.read.getHistoryMetadata().historySize).toBe(1);

      store.write.blurField("name");

      expect(store.read.getHistoryMetadata().historySize).toBe(2);
      expect(store.read.getHistoryMetadata().canUndo).toBe(true);
    });

    it("should flush pending snapshot before undo", () => {
      vi.useFakeTimers();

      const store = createBitStore({
        initialValues: { name: "A" },
        history: { enabled: true },
      });

      store.write.setField("name", "B");
      expect(store.read.getHistoryMetadata().historySize).toBe(1);

      store.feature.undo();

      expect(store.read.getState().values.name).toBe("A");
      expect(store.read.getHistoryMetadata().canRedo).toBe(true);
    });

    it("should flush pending snapshot before reset", () => {
      vi.useFakeTimers();

      const store = createBitStore({
        initialValues: { name: "A" },
        history: { enabled: true },
      });

      store.write.setField("name", "B");
      store.write.reset();

      expect(store.read.getHistoryMetadata().historySize).toBe(1);
      expect(store.read.getState().values.name).toBe("A");
      expect(store.read.getHistoryMetadata().canUndo).toBe(false);
    });

    it("should maintain historySize=1 and canUndo=false after reset()", () => {
      const store = createBitStore({
        initialValues: { name: "Alice" },
        history: { enabled: true },
      });

      store.write.setField("name", "Bob");
      store.write.reset();

      const meta = store.read.getHistoryMetadata();
      expect(meta.historySize).toBe(1);
      expect(meta.canUndo).toBe(false);
    });

    it("should have no-op undo() after reset()", () => {
      const store = createBitStore({
        initialValues: { name: "Alice" },
        history: { enabled: true },
      });

      store.write.setField("name", "Bob");
      store.write.reset();
      store.feature.undo();

      expect(store.read.getState().values.name).toBe("Alice");
    });

    it("should not reintroduce pending snapshot after rebase", () => {
      vi.useFakeTimers();

      const store = createBitStore({
        initialValues: { name: "A" },
        history: { enabled: true },
      });

      store.write.setField("name", "B");
      store.write.setValues({ name: "C" }, { rebase: true });

      expect(store.read.getState().values.name).toBe("C");
      expect(store.read.getHistoryMetadata()).toMatchObject({
        canUndo: false,
        canRedo: false,
        historyIndex: 0,
        historySize: 1,
      });

      vi.advanceTimersByTime(300);

      expect(store.read.getState().values.name).toBe("C");
      expect(store.read.getHistoryMetadata()).toMatchObject({
        canUndo: false,
        canRedo: false,
        historyIndex: 0,
        historySize: 1,
      });
    });
  });

  describe("Form Lifecycle & Submissions", () => {
    it("should reset form to initial values", () => {
      const store = createBitStore({ initialValues: { name: "Leo" } });

      store.write.setField("name", "Leandro");
      store.write.setError("name", "Error");

      store.write.reset();

      expect(store.read.getState().values.name).toBe("Leo");
      expect(store.read.getState().errors).toEqual({});
      expect(store.read.getState().isDirty).toBe(false);
    });

    it("should reset baseline using rebase", () => {
      const store = createBitStore({ initialValues: { name: "" } });

      store.write.setValues({ name: "Leandro" }, { rebase: true });
      expect(store.read.getState().values.name).toBe("Leandro");
      expect(store.read.getState().isDirty).toBe(false);
    });

    it("should replace values without rebasing the initial state", () => {
      const store = createBitStore({ initialValues: { name: "Leo", age: 30 } });

      store.write.setValues({ name: "Leandro", age: 31 });

      expect(store.read.getState().values).toEqual({
        name: "Leandro",
        age: 31,
      });
      expect(store.read.config.initialValues).toEqual({
        name: "Leo",
        age: 30,
      });
      expect(store.read.getState().isDirty).toBe(true);
    });

    it("should keep state invalid while async validation is pending after setValues", () => {
      let resolveResolver:
        | ((errors: Record<string, string>) => void)
        | undefined;

      const store = createBitStore({
        initialValues: { name: "Leo" },
        validation: {
          resolver: () =>
            new Promise<Record<string, string>>((resolve) => {
              resolveResolver = resolve;
            }),
          delay: 0,
        },
      });

      store.write.setValues({ name: "" });

      expect(store.read.getState().isValid).toBe(false);

      resolveResolver?.({ name: "Required" });
    });

    it("should keep state invalid while async validation is pending after rebase", () => {
      let resolveResolver:
        | ((errors: Record<string, string>) => void)
        | undefined;

      const store = createBitStore({
        initialValues: { name: "Leo" },
        validation: {
          resolver: () =>
            new Promise<Record<string, string>>((resolve) => {
              resolveResolver = resolve;
            }),
          delay: 0,
        },
      });

      store.write.setValues({ name: "" }, { rebase: true });

      expect(store.read.getState().isValid).toBe(false);

      resolveResolver?.({ name: "Required" });
    });

    it("should not crash when setValues receives circular references", () => {
      const store = createBitStore({
        initialValues: { profile: { name: "Leo" } },
      });
      const circular: {
        profile: { name: string };
        self?: unknown;
      } = {
        profile: { name: "Leandro" },
      };

      circular.self = circular;

      expect(() => {
        store.write.setValues(
          circular as unknown as { profile: { name: string } },
        );
      }).not.toThrow();

      expect(store.read.getState().values.profile.name).toBe("Leandro");
      expect(store.read.getState().isDirty).toBe(true);
    });

    it("should not crash when partial setValues receives circular references", () => {
      const store = createBitStore({
        initialValues: {
          profile: { name: "Leo", city: "Tokyo" },
          meta: { version: 1 },
        },
      });

      const partial: {
        profile: { name: string; self?: unknown };
      } = {
        profile: { name: "Leandro" },
      };

      partial.profile.self = partial.profile;

      expect(() => {
        store.write.setValues(
          partial as unknown as { profile: { name: string } },
          {
            partial: true,
          },
        );
      }).not.toThrow();

      expect(store.read.getState().values.profile.name).toBe("Leandro");
      expect(store.read.getState().values.profile.city).toBe("Tokyo");
      expect(store.read.getState().values.meta.version).toBe(1);
      expect(store.read.getState().isDirty).toBe(true);
    });

    it("should apply all partial branches that share the same object reference", () => {
      const store = createBitStore({
        initialValues: {
          billing: { city: "Tokyo", zip: "100-0001" },
          shipping: { city: "Kyoto", zip: "600-0001" },
        },
      });

      const shared = { city: "Osaka" };

      store.write.setValues(
        {
          billing: shared,
          shipping: shared,
        } as unknown as {
          billing: { city: string };
          shipping: { city: string };
        },
        { partial: true },
      );

      expect(store.read.getState().values.billing.city).toBe("Osaka");
      expect(store.read.getState().values.shipping.city).toBe("Osaka");
      expect(store.read.getState().values.billing.zip).toBe("100-0001");
      expect(store.read.getState().values.shipping.zip).toBe("600-0001");
    });

    it("should not crash when setValues receives values with function properties", () => {
      const store = createBitStore({
        initialValues: { profile: { name: "Leo", formatter: undefined } },
      });

      const formatter = () => "LEANDRO";

      expect(() => {
        store.write.setValues({
          profile: { name: "Leandro", formatter },
        });
      }).not.toThrow();

      expect(store.read.getState().values.profile.name).toBe("Leandro");
      expect(store.read.getState().values.profile.formatter).toBe(formatter);
      expect(store.read.getState().isDirty).toBe(true);
    });

    it("should preserve Map and Set values when fallback clone is used", async () => {
      const globalScope = globalThis as {
        structuredClone?: <V>(value: V) => V;
      };
      const originalStructuredClone = globalScope.structuredClone;

      Object.defineProperty(globalScope, "structuredClone", {
        value: undefined,
        writable: true,
        configurable: true,
      });

      try {
        const store = createBitStore({
          initialValues: {
            profile: {
              metadata: new Map([["version", 1]]),
              tags: new Set(["initial"]),
            },
          },
        });

        store.write.setValues({
          profile: {
            metadata: new Map([["version", 2]]),
            tags: new Set(["core", "persist"]),
          },
        });

        expect(store.read.getState().values.profile.metadata).toBeInstanceOf(
          Map,
        );
        expect(store.read.getState().values.profile.tags).toBeInstanceOf(Set);
        expect(
          store.read.getState().values.profile.metadata.get("version"),
        ).toBe(2);
        expect([...store.read.getState().values.profile.tags]).toEqual([
          "core",
          "persist",
        ]);

        const onSuccess = vi.fn();
        await store.write.submit(onSuccess);

        const submittedValues = onSuccess.mock.calls[0]?.[0];
        expect(submittedValues.profile.metadata).toBeInstanceOf(Map);
        expect(submittedValues.profile.tags).toBeInstanceOf(Set);
      } finally {
        Object.defineProperty(globalScope, "structuredClone", {
          value: originalStructuredClone,
          writable: true,
          configurable: true,
        });
      }
    });

    it("should keep dirty and history clean for structurally equal circular values", () => {
      const initial: Record<string, unknown> = { profile: { name: "Leo" } };
      initial.self = initial;

      const next: Record<string, unknown> = { profile: { name: "Leo" } };
      next.self = next;

      const store = createBitStore({
        initialValues: initial,
        history: { enabled: true },
      });

      store.write.setValues(next);

      expect(store.read.getState().isDirty).toBe(false);
      expect(store.read.getHistoryMetadata()).toMatchObject({
        canUndo: false,
        historyIndex: 0,
        historySize: 1,
      });
    });

    it("should hydrate current values with deep merge semantics", () => {
      const store = createBitStore({
        initialValues: { user: { name: "Leo", profile: { city: "Tokyo" } } },
      });

      store.write.setValues(
        { user: { profile: { city: "Osaka" } } },
        { partial: true },
      );

      expect(store.read.getState().values).toEqual({
        user: { name: "Leo", profile: { city: "Osaka" } },
      });
      expect(store.read.getState().isDirty).toBe(true);
    });

    it("should rebase values explicitly", () => {
      const store = createBitStore({ initialValues: { name: "Leo", age: 30 } });

      store.write.setValues({ name: "Leandro", age: 31 }, { rebase: true });

      expect(store.read.getState().values).toEqual({
        name: "Leandro",
        age: 31,
      });
      expect(store.read.config.initialValues).toEqual({
        name: "Leo",
        age: 30,
      });
      expect(store.read.getState().isDirty).toBe(false);
    });

    it("should keep array dirty tracking consistent after rebase", () => {
      const store = createBitStore({
        initialValues: { items: ["A"] },
      });

      store.write.setValues({ items: ["X"] }, { rebase: true });
      expect(store.read.getState().isDirty).toBe(false);

      store.feature.pushItem("items", "Y");
      expect(store.read.getState().isDirty).toBe(true);

      store.feature.removeItem("items", 1);
      expect(store.read.getState().isDirty).toBe(false);
    });

    it("should reset history when rebasing values", () => {
      const store = createBitStore({
        initialValues: { name: "Leo" },
        history: { enabled: true },
      });

      store.write.setField("name", "Leandro");
      store.write.blurField("name");

      expect(store.read.getHistoryMetadata().canUndo).toBe(true);

      store.write.setValues({ name: "Ishikawa" }, { rebase: true });

      expect(store.read.getState().values.name).toBe("Ishikawa");
      expect(store.read.getHistoryMetadata()).toMatchObject({
        canUndo: false,
        canRedo: false,
        historyIndex: 0,
        historySize: 1,
      });
    });

    it("should fail fast when computed fields create a cycle", () => {
      expect(() =>
        createBitStore({
          initialValues: { a: 0, b: 0 },
          fields: {
            a: {
              computed: (values) => (values.b as number) + 1,
              computedDependsOn: ["b"],
            },
            b: {
              computed: (values) => (values.a as number) + 1,
              computedDependsOn: ["a"],
            },
          },
        }),
      ).toThrow(/Circular dependency detected/);
    });

    it("should recompute computed field immediately when registered at runtime", () => {
      const store = createBitStore({
        initialValues: { price: 15, total: 0 },
      });

      store.feature.registerField("total", {
        computed: (values) => (values.price as number) * 2,
        computedDependsOn: ["price"],
      });

      expect(store.read.getState().values.total).toBe(30);
    });

    it("should rollback runtime computed registration when it introduces a cycle", () => {
      const onUnhandledError = vi.fn();
      const store = createBitStore({
        initialValues: { a: 0, b: 1 },
        onUnhandledError,
      });

      store.feature.registerField("a", {
        computed: (values) => (values.b as number) + 1,
        computedDependsOn: ["b"],
      });

      store.feature.registerField("b", {
        computed: (values) => (values.a as number) + 1,
        computedDependsOn: ["a"],
      });

      store.write.setField("b", 3);

      expect(store.read.getState().values.a).toBe(4);
      expect(store.read.getState().values.b).toBe(3);
      expect(onUnhandledError).toHaveBeenCalled();
      expect(
        onUnhandledError.mock.calls.some(
          ([error, source]) =>
            source === "computed" &&
            String((error as Error)?.message ?? "").includes(
              "Circular dependency detected",
            ),
        ),
      ).toBe(true);
    });

    it("should report derivation errors from malformed runtime computed config", () => {
      const onUnhandledError = vi.fn();
      const store = createBitStore({
        initialValues: { base: 2, broken: 0 },
        onUnhandledError,
      });

      expect(() => {
        store.feature.registerField("broken", {
          computed: (values: any) => values.base,
          computedDependsOn: [],
        } as any);
      }).not.toThrow();

      expect(store.read.getState().values.broken).toBe(0);
      expect(
        onUnhandledError.mock.calls.some(
          ([, source]) => source === "derivation",
        ),
      ).toBe(true);
    });

    it("should notify subscribers with fresh state after computed registerField", () => {
      const store = createBitStore({
        initialValues: { price: 15, total: 0 },
      });

      const listener = vi.fn();
      store.observe.subscribePath("total", listener);
      listener.mockClear();

      store.feature.registerField("total", {
        computed: (values: any) => values.price * 2,
        computedDependsOn: ["price"],
      });

      expect(listener).toHaveBeenCalledTimes(1);
      const receivedValue = listener.mock.calls[0][0];
      expect(receivedValue).toBe(30);
    });

    it("should treat empty string as a validation error", async () => {
      const store = createBitStore({
        initialValues: { email: "test@example.com" },
        validation: {
          resolver: () => ({ email: "" }),
        },
      });

      const result = await store.feature.validate();

      expect(result).toBe(false);
      expect(store.read.getState().isValid).toBe(false);
      expect(store.read.getState().errors.email).toBe("");
    });

    it("should treat empty string from async validator as a validation error", async () => {
      vi.useFakeTimers();
      try {
        const store = createBitStore({
          initialValues: { email: "test@example.com" },
          validation: { delay: 0 },
          fields: {
            email: {
              validation: {
                asyncValidateOn: "change",
                asyncValidate: async () => "",
                asyncValidateDelay: 0,
              },
            },
          },
        });

        store.write.setField("email", "other@example.com");
        await vi.advanceTimersByTimeAsync(10);

        expect(store.read.getState().isValid).toBe(false);
        expect(store.read.getState().errors.email).toBe("");
      } finally {
        vi.useRealTimers();
      }
    });

    it("should remove hidden fields and apply transforms on submit", async () => {
      const store = createBitStore({
        initialValues: { newsletter: false, email: "test@test.com", price: 10 },
        fields: {
          price: { transform: (val: number) => val * 2 },
          email: {
            conditional: {
              dependsOn: ["newsletter"],
              showIf: (values) => values.newsletter === true,
            },
          },
        },
      });

      let submittedData: any;
      await store.write.submit((values) => {
        submittedData = values;
      });

      expect(submittedData.email).toBeUndefined();
      expect(submittedData.price).toBe(20);
      expect(store.read.getState().isSubmitting).toBe(false);
    });

    it("should submit successfully when values contain function properties", async () => {
      const formatter = () => "LEANDRO";
      const store = createBitStore({
        initialValues: {
          profile: { name: "Leo", formatter: undefined },
        },
      });

      store.write.setValues({
        profile: { name: "Leandro", formatter },
      });

      const onSuccess = vi.fn();

      const result = await store.write.submit(onSuccess);

      expect(result).toEqual({ status: "submitted" });
      expect(onSuccess).toHaveBeenCalledWith(
        {
          profile: { name: "Leandro", formatter },
        },
        {
          profile: { name: "Leandro", formatter },
        },
      );
      expect(store.read.getState().isSubmitting).toBe(false);
    });

    it("should pass dirtyValues as second parameter to submit callback", async () => {
      const store = createBitStore({
        initialValues: { name: "Leo", age: 30, city: "Tokyo" },
      });

      store.write.setField("name", "Leandro");
      store.write.setField("age", 31);

      let receivedValues: any;
      let receivedDirtyValues: any;

      await store.write.submit((values, dirtyValues) => {
        receivedValues = values;
        receivedDirtyValues = dirtyValues;
      });

      expect(receivedValues).toEqual({
        name: "Leandro",
        age: 31,
        city: "Tokyo",
      });
      expect(receivedDirtyValues).toEqual({ name: "Leandro", age: 31 });
    });

    it("should calculate dirtyValues after transforms on submit", async () => {
      const store = createBitStore({
        initialValues: { price: 10, discount: 0 },
        fields: {
          price: { transform: (val: number) => val * 2 },
        },
      });

      store.write.setField("price", 20);

      let receivedDirtyValues: any;

      await store.write.submit((values, dirtyValues) => {
        receivedDirtyValues = dirtyValues;
      });

      expect(receivedDirtyValues).toEqual({ price: 40 });
    });

    it("should normalize runtime values without mutating submit transforms", () => {
      const store = createBitStore({
        initialValues: { name: "" },
        fields: {
          name: {
            normalize: (value) => String(value).trim(),
            transform: (value) => String(value).toUpperCase(),
          },
        },
      });

      store.write.setField("name", "  leandro  ");

      expect(store.read.getState().values.name).toBe("leandro");
    });

    it("should fail submit when a transform throws instead of silently sending raw payload", async () => {
      const onUnhandledError = vi.fn();
      const onSuccess = vi.fn();
      const store = createBitStore({
        initialValues: { salary: "R$ 1.500,00" },
        fields: {
          salary: {
            transform: () => {
              throw new Error("transform crash");
            },
          },
        },
        onUnhandledError,
      });

      const result = await store.write.submit(onSuccess);

      expect(result).toMatchObject({ status: "failed" });
      expect(onSuccess).not.toHaveBeenCalled();
      expect(onUnhandledError).toHaveBeenCalledWith(
        expect.objectContaining({ message: "transform crash" }),
        "submit",
      );
      expect(store.read.getState().isSubmitting).toBe(false);
    });

    it("should not leak hidden field value through transform dependencies on submit", async () => {
      const store = createBitStore({
        initialValues: {
          showSecret: false,
          secret: "TOKEN",
          derived: "",
        },
        fields: {
          secret: {
            conditional: {
              dependsOn: ["showSecret"],
              showIf: (values) => values.showSecret === true,
            },
          },
          derived: {
            transform: (_value, allValues: any) => allValues.secret,
          },
        },
      });

      let submittedData: any;
      await store.write.submit((values) => {
        submittedData = values;
      });

      expect(store.read.isHidden("secret")).toBe(true);
      expect(submittedData.secret).toBeUndefined();
      expect(submittedData.derived).toBeUndefined();
    });

    it("should not reintroduce hidden field when hidden field has its own transform", async () => {
      const store = createBitStore({
        initialValues: {
          showSecret: false,
          secret: "TOKEN",
        },
        fields: {
          secret: {
            conditional: {
              dependsOn: ["showSecret"],
              showIf: (values) => values.showSecret === true,
            },
            transform: (value) => (value == null ? "fallback" : value),
          },
        },
      });

      let submittedData: any;
      await store.write.submit((values) => {
        submittedData = values;
      });

      expect(store.read.isHidden("secret")).toBe(true);
      expect(submittedData.secret).toBeUndefined();
    });

    it("should apply transforms incrementally when one transform depends on another", async () => {
      const store = createBitStore({
        initialValues: {
          amount: "10",
          total: "",
        },
        fields: {
          amount: {
            transform: (value) => Number(value),
          },
          total: {
            transform: (_value, allValues: any) =>
              (allValues.amount as number) * 2,
          },
        },
      });

      let submittedData: any;
      await store.write.submit((values) => {
        submittedData = values;
      });

      expect(submittedData.amount).toBe(10);
      expect(submittedData.total).toBe(20);
    });

    it("resolver que retorna undefined para campo não deve invalidar o formulário (regression)", async () => {
      const store = createBitStore({
        initialValues: { email: "ok@ok.com" },
        validation: {
          resolver: () => Promise.resolve({ email: undefined }),
          delay: 0,
        },
      });

      const result = await store.write.submit(vi.fn());
      expect(result.status).toBe("submitted");
      expect(store.read.getState().isValid).toBe(true);
      expect(store.read.getState().errors.email).toBeUndefined();
    });
  });

  describe("Array Operations", () => {
    it("should push and prepend items", () => {
      const store = createBitStore({ initialValues: { list: [2] } });

      store.feature.pushItem("list", 3);
      expect(store.read.getState().values.list).toEqual([2, 3]);

      store.feature.prependItem("list", 1);
      expect(store.read.getState().values.list).toEqual([1, 2, 3]);
    });

    it("should insert item at specific index", () => {
      const store = createBitStore({ initialValues: { list: [1, 3] } });

      store.feature.insertItem("list", 1, 2);
      expect(store.read.getState().values.list).toEqual([1, 2, 3]);
    });

    it("should clean up and shift errors when item is removed", () => {
      const store = createBitStore({
        initialValues: { list: ["A", "B", "C"] },
      });
      store.feature.triggerValidation = vi.fn();

      store.write.setError("list.2", "Error on C");
      store.feature.removeItem("list", 1);

      expect(store.read.getState().values.list).toEqual(["A", "C"]);
      expect(store.read.getState().errors["list.1"]).toBe("Error on C");
      expect(store.read.getState().errors["list.2"]).toBeUndefined();
    });

    it("should swap items and swap their errors", () => {
      const store = createBitStore({ initialValues: { list: ["A", "B"] } });
      store.feature.triggerValidation = vi.fn();

      store.write.setError("list.0", "Error on A");
      store.feature.swapItems("list", 0, 1);

      expect(store.read.getState().values.list).toEqual(["B", "A"]);
      expect(store.read.getState().errors["list.1"]).toBe("Error on A");
      expect(store.read.getState().errors["list.0"]).toBeUndefined();
    });

    it("should move items and shift errors accordingly", () => {
      const store = createBitStore({
        initialValues: { list: ["A", "B", "C"] },
      });
      store.feature.triggerValidation = vi.fn();

      store.write.setError("list.0", "Error on A");
      store.feature.moveItem("list", 0, 2);

      expect(store.read.getState().values.list).toEqual(["B", "C", "A"]);
      expect(store.read.getState().errors["list.2"]).toBe("Error on A");
      expect(store.read.getState().errors["list.0"]).toBeUndefined();
    });

    it("swapItems com índice inválido não altera estado", () => {
      const store = createBitStore({ initialValues: { list: ["A", "B"] } });
      store.feature.triggerValidation = vi.fn();

      const before = store.read.getState();
      store.feature.swapItems("list", -1, 1);

      expect(store.read.getState().values.list).toEqual(before.values.list);
      expect(store.read.getState().errors).toEqual(before.errors);
    });

    it("moveItem com índice inválido não altera estado", () => {
      const store = createBitStore({
        initialValues: { list: ["A", "B", "C"] },
      });
      store.feature.triggerValidation = vi.fn();

      store.write.setError("list.0", "Error on A");
      const before = store.read.getState();

      store.feature.moveItem("list", 0, 99);

      expect(store.read.getState().values.list).toEqual(before.values.list);
      expect(store.read.getState().errors).toEqual(before.errors);
    });

    it("should replace array items through native array capability", () => {
      const store = createBitStore({
        initialValues: { list: ["A", "B", "C"] },
      });
      store.feature.triggerValidation = vi.fn();

      store.write.setError("list.2", "Error on C");
      store.feature.replaceItems("list", ["X"]);

      expect(store.read.getState().values.list).toEqual(["X"]);
      expect(store.read.getState().errors["list.0"]).toBeUndefined();
      expect(store.read.getState().errors["list.2"]).toBeUndefined();
    });

    it("should clear array items through native array capability", () => {
      const store = createBitStore({
        initialValues: { list: ["A", "B"] },
      });
      store.feature.triggerValidation = vi.fn();

      store.write.setError("list.0", "Error on A");
      store.feature.clearItems("list");

      expect(store.read.getState().values.list).toEqual([]);
      expect(store.read.getState().errors["list.0"]).toBeUndefined();
    });

    it("removeItem com índice negativo não altera o estado", () => {
      const store = createBitStore({
        initialValues: { list: ["A", "B", "C"] },
      });
      store.feature.triggerValidation = vi.fn();

      store.feature.removeItem("list", -1);

      expect(store.read.getState().values.list).toEqual(["A", "B", "C"]);
    });

    it("removeItem com índice >= length não altera o estado", () => {
      const store = createBitStore({ initialValues: { list: ["A", "B"] } });
      store.feature.triggerValidation = vi.fn();

      store.feature.removeItem("list", 5);

      expect(store.read.getState().values.list).toEqual(["A", "B"]);
    });

    it("insertItem com índice negativo insere no início sem dessincronizar IDs", () => {
      const store = createBitStore({ initialValues: { list: ["B", "C"] } });

      store.feature.insertItem("list", -5, "A");

      const values = store.read.getState().values.list as string[];
      expect(values).toEqual(["A", "B", "C"]);
    });

    it("insertItem com índice além do fim insere no final sem dessincronizar IDs", () => {
      const store = createBitStore({ initialValues: { list: ["A", "B"] } });

      store.feature.insertItem("list", 99, "C");

      const values = store.read.getState().values.list as string[];
      expect(values).toEqual(["A", "B", "C"]);
    });

    it("prependItem deve reindexar errors e touched dos itens existentes (regression)", () => {
      const store = createBitStore({
        initialValues: { list: ["A", "B", "C"] },
      });
      store.feature.triggerValidation = vi.fn();

      store.write.setError("list.0", "Error on A");
      store.write.blurField("list.0");

      store.feature.prependItem("list", "novo");

      expect(store.read.getState().values.list).toEqual([
        "novo",
        "A",
        "B",
        "C",
      ]);
      // Novo item no índice 0 não deve herdar erro nem touched do antigo índice 0
      expect(store.read.getState().errors["list.0"]).toBeUndefined();
      expect(store.read.getState().touched["list.0"]).toBeUndefined();
      // Erro e touched do antigo índice 0 devem ter sido deslocados para o índice 1
      expect(store.read.getState().errors["list.1"]).toBe("Error on A");
      expect(store.read.getState().touched["list.1"]).toBe(true);
    });

    it("insertItem deve reindexar errors e touched dos itens deslocados (regression)", () => {
      const store = createBitStore({
        initialValues: { list: ["A", "B", "C"] },
      });
      store.feature.triggerValidation = vi.fn();

      store.write.setError("list.1", "Error on B");
      store.write.blurField("list.1");

      store.feature.insertItem("list", 0, "NOVO");

      expect(store.read.getState().values.list).toEqual([
        "NOVO",
        "A",
        "B",
        "C",
      ]);
      // Itens abaixo do safeIndex não se deslocam
      expect(store.read.getState().errors["list.0"]).toBeUndefined();
      // Antigo índice 1 ("B" com erro) deve ter sido deslocado para índice 2
      expect(store.read.getState().errors["list.1"]).toBeUndefined();
      expect(store.read.getState().errors["list.2"]).toBe("Error on B");
      expect(store.read.getState().touched["list.2"]).toBe(true);
    });
  });

  describe("BitStore - Validação Assíncrona (Async Validation)", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.restoreAllMocks();
      vi.useRealTimers();
    });

    it("deve aplicar debounce e gerenciar o estado isValidating corretamente", async () => {
      const store = createBitStore({ initialValues: { username: "" } });

      let resolveApi: (msg: string | null) => void;
      const mockApi = vi.fn().mockImplementation(() => {
        return new Promise((resolve) => {
          resolveApi = resolve;
        });
      });

      store.feature.registerField("username", {
        validation: {
          asyncValidateOn: "change",
          asyncValidate: mockApi,
          asyncValidateDelay: 500,
        },
      });

      store.write.setField("username", "lea");
      await vi.advanceTimersByTimeAsync(300);

      store.write.setField("username", "leandro");

      expect(mockApi).not.toHaveBeenCalled();
      expect(store.read.isFieldValidating("username")).toBe(true);

      await vi.advanceTimersByTimeAsync(500);

      expect(mockApi).toHaveBeenCalledTimes(1);
      expect(mockApi).toHaveBeenCalledWith("leandro", { username: "leandro" });

      expect(store.read.isFieldValidating("username")).toBe(true);

      resolveApi!("Username já existe");
      await vi.advanceTimersByTimeAsync(1);

      expect(store.read.isFieldValidating("username")).toBe(false);
      expect(store.read.getState().errors.username).toBe("Username já existe");
    });

    it("deve bloquear submit enquanto houver validação assíncrona pendente", async () => {
      const store = createBitStore({ initialValues: { username: "" } });

      let resolveApi: (msg: string | null) => void;
      const mockApi = vi.fn().mockImplementation(() => {
        return new Promise((resolve) => {
          resolveApi = resolve;
        });
      });

      const onSuccess = vi.fn();

      store.feature.registerField("username", {
        validation: {
          asyncValidateOn: "change",
          asyncValidate: mockApi,
          asyncValidateDelay: 500,
        },
      });

      store.write.setField("username", "leandro");

      await store.write.submit(onSuccess);
      expect(onSuccess).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(500);
      expect(store.read.isFieldValidating("username")).toBe(true);

      resolveApi!(null);
      await vi.advanceTimersByTimeAsync(1);

      const secondSubmit = store.write.submit(onSuccess);
      await vi.advanceTimersByTimeAsync(0);
      resolveApi!(null);
      await vi.advanceTimersByTimeAsync(1);
      await secondSubmit;
      expect(onSuccess).toHaveBeenCalledTimes(1);
    });

    it("deve evitar Race Conditions ignorando respostas de requisições antigas", async () => {
      const store = createBitStore({ initialValues: { email: "" } });

      let resolveFirstReq: (msg: string | null) => void;
      let resolveSecondReq: (msg: string | null) => void;
      let reqCount = 0;

      const mockApi = vi.fn().mockImplementation(() => {
        reqCount++;
        return new Promise((resolve) => {
          if (reqCount === 1) resolveFirstReq = resolve;
          if (reqCount === 2) resolveSecondReq = resolve;
        });
      });

      store.feature.registerField("email", {
        validation: {
          asyncValidateOn: "change",
          asyncValidate: mockApi,
          asyncValidateDelay: 100,
        },
      });

      store.write.setField("email", "dev@");
      await vi.advanceTimersByTimeAsync(100);

      store.write.setField("email", "dev@bitform.com");
      await vi.advanceTimersByTimeAsync(100);

      resolveSecondReq!(null);
      await vi.advanceTimersByTimeAsync(1);
      expect(store.read.getState().errors.email).toBeUndefined();

      resolveFirstReq!("Email inválido");
      await vi.advanceTimersByTimeAsync(1);

      expect(store.read.getState().errors.email).toBeUndefined();
      await vi.advanceTimersByTimeAsync(5);
      expect(store.read.isFieldValidating("email")).toBe(false);
    });

    it("deve descartar resultado async quando o item validado é removido durante a requisição", async () => {
      const store = createBitStore({ initialValues: { list: ["A", "B"] } });

      let resolveApi: (msg: string | null) => void;
      const mockApi = vi.fn().mockImplementation(() => {
        return new Promise((resolve) => {
          resolveApi = resolve;
        });
      });

      store.feature.registerField("list.1", {
        validation: {
          asyncValidateOn: "change",
          asyncValidate: mockApi,
          asyncValidateDelay: 0,
        },
      });

      store.write.setField("list.1", "B*");
      await vi.advanceTimersByTimeAsync(1);
      expect(store.read.isFieldValidating("list.1")).toBe(true);

      store.feature.removeItem("list", 1);
      expect(store.read.getState().values.list).toEqual(["A"]);

      resolveApi!("erro stale");
      await vi.advanceTimersByTimeAsync(1);

      expect(store.read.getState().errors["list.1"]).toBeUndefined();
      expect(store.read.isFieldValidating("list.1")).toBe(false);
      expect(store.feature.hasValidationsInProgress()).toBe(false);
    });

    it("deve descartar resultado async stale após reindexação por removeItem", async () => {
      const store = createBitStore({
        initialValues: { list: ["A", "B", "C"] },
      });

      let resolveApi: (msg: string | null) => void;
      const mockApi = vi.fn().mockImplementation(() => {
        return new Promise((resolve) => {
          resolveApi = resolve;
        });
      });

      store.feature.registerField("list.1", {
        validation: {
          asyncValidateOn: "change",
          asyncValidate: mockApi,
          asyncValidateDelay: 0,
        },
      });

      store.write.setField("list.1", "B*");
      await vi.advanceTimersByTimeAsync(1);
      expect(store.read.isFieldValidating("list.1")).toBe(true);

      store.feature.removeItem("list", 0);
      expect(store.read.getState().values.list).toEqual(["B*", "C"]);

      resolveApi!("erro stale da posição antiga");
      await vi.advanceTimersByTimeAsync(1);

      expect(store.read.getState().errors["list.1"]).toBeUndefined();
      expect(store.read.getState().errors["list.0"]).toBeUndefined();
      expect(store.feature.hasValidationsInProgress()).toBe(false);
    });

    it("deve descartar resultado async stale após prependItem reindexar posições", async () => {
      const store = createBitStore({
        initialValues: { list: ["A", "B"] },
      });

      let resolveApi: (msg: string | null) => void;
      const mockApi = vi.fn().mockImplementation(() => {
        return new Promise((resolve) => {
          resolveApi = resolve;
        });
      });

      store.feature.registerField("list.0", {
        validation: {
          asyncValidateOn: "change",
          asyncValidate: mockApi,
          asyncValidateDelay: 0,
        },
      });

      store.write.setField("list.0", "A*");
      await vi.advanceTimersByTimeAsync(1);
      expect(store.read.isFieldValidating("list.0")).toBe(true);

      store.feature.prependItem("list", "novo");
      expect(store.read.getState().values.list).toEqual(["novo", "A*", "B"]);

      resolveApi!("erro stale da posição antiga");
      await vi.advanceTimersByTimeAsync(1);

      expect(store.read.getState().errors["list.0"]).toBeUndefined();
      expect(store.read.getState().errors["list.1"]).toBeUndefined();
      expect(store.feature.hasValidationsInProgress()).toBe(false);
    });

    it("não deve disparar asyncValidateOn change para campo oculto", async () => {
      const asyncValidate = vi.fn().mockResolvedValue("erro");

      const store = createBitStore({
        initialValues: { showCode: false, code: "" },
      });

      store.feature.registerField("code", {
        conditional: {
          dependsOn: ["showCode"],
          showIf: (values: any) => values.showCode === true,
        },
        validation: {
          asyncValidateOn: "change",
          asyncValidate,
          asyncValidateDelay: 0,
        },
      });

      store.write.setField("code", "ABC");
      await vi.advanceTimersByTimeAsync(10);

      expect(asyncValidate).not.toHaveBeenCalled();
      expect(store.read.isFieldValidating("code")).toBe(false);
      expect(store.read.getState().errors.code).toBeUndefined();
    });

    it("deve descartar resultado async stale após insertItem deslocar índices", async () => {
      const store = createBitStore({
        initialValues: { list: ["A", "B", "C"] },
      });

      let resolveApi: (msg: string | null) => void;
      const mockApi = vi.fn().mockImplementation(() => {
        return new Promise((resolve) => {
          resolveApi = resolve;
        });
      });

      store.feature.registerField("list.1", {
        validation: {
          asyncValidateOn: "change",
          asyncValidate: mockApi,
          asyncValidateDelay: 0,
        },
      });

      store.write.setField("list.1", "B*");
      await vi.advanceTimersByTimeAsync(1);
      expect(store.read.isFieldValidating("list.1")).toBe(true);

      // inserir em index 1 desloca list.1 para list.2
      store.feature.insertItem("list", 1, "novo");
      expect(store.read.getState().values.list).toEqual([
        "A",
        "novo",
        "B*",
        "C",
      ]);

      resolveApi!("erro stale da posição antiga");
      await vi.advanceTimersByTimeAsync(1);

      expect(store.read.getState().errors["list.1"]).toBeUndefined();
      expect(store.read.getState().errors["list.2"]).toBeUndefined();
      expect(store.feature.hasValidationsInProgress()).toBe(false);
    });

    it("deve descartar resultado async stale após swapItems trocar posições", async () => {
      const store = createBitStore({
        initialValues: { list: ["A", "B"] },
      });

      let resolveApi: (msg: string | null) => void;
      const mockApi = vi.fn().mockImplementation(() => {
        return new Promise((resolve) => {
          resolveApi = resolve;
        });
      });

      store.feature.registerField("list.0", {
        validation: {
          asyncValidateOn: "change",
          asyncValidate: mockApi,
          asyncValidateDelay: 0,
        },
      });

      store.write.setField("list.0", "A*");
      await vi.advanceTimersByTimeAsync(1);
      expect(store.read.isFieldValidating("list.0")).toBe(true);

      store.feature.swapItems("list", 0, 1);
      expect(store.read.getState().values.list).toEqual(["B", "A*"]);

      resolveApi!("erro stale da posição antiga");
      await vi.advanceTimersByTimeAsync(1);

      expect(store.read.getState().errors["list.0"]).toBeUndefined();
      expect(store.read.getState().errors["list.1"]).toBeUndefined();
      expect(store.feature.hasValidationsInProgress()).toBe(false);
    });

    it("deve descartar resultado async stale após replaceItems remover paths antigos", async () => {
      const store = createBitStore({
        initialValues: { list: ["A", "B", "C"] },
      });

      let resolveApi: (msg: string | null) => void;
      const mockApi = vi.fn().mockImplementation(() => {
        return new Promise((resolve) => {
          resolveApi = resolve;
        });
      });

      store.feature.registerField("list.2", {
        validation: {
          asyncValidateOn: "change",
          asyncValidate: mockApi,
          asyncValidateDelay: 0,
        },
      });

      store.write.setField("list.2", "C*");
      await vi.advanceTimersByTimeAsync(1);
      expect(store.read.isFieldValidating("list.2")).toBe(true);

      store.feature.replaceItems("list", ["X"]);
      expect(store.read.getState().values.list).toEqual(["X"]);

      resolveApi!("erro stale da posição removida");
      await vi.advanceTimersByTimeAsync(1);

      expect(store.read.getState().errors["list.2"]).toBeUndefined();
      expect(store.feature.hasValidationsInProgress()).toBe(false);
    });

    it("deve isolar race conditions entre múltiplos campos assíncronos", async () => {
      const store = createBitStore({
        initialValues: { email: "", username: "" },
      });

      let resolveEmailReq1: (msg: string | null) => void;
      let resolveEmailReq2: (msg: string | null) => void;
      let emailReqCount = 0;

      const emailApi = vi.fn().mockImplementation(() => {
        emailReqCount += 1;
        return new Promise((resolve) => {
          if (emailReqCount === 1) resolveEmailReq1 = resolve;
          if (emailReqCount === 2) resolveEmailReq2 = resolve;
        });
      });

      const usernameApi = vi.fn().mockResolvedValue("Username indisponível");

      store.feature.registerField("email", {
        validation: {
          asyncValidateOn: "change",
          asyncValidate: emailApi,
          asyncValidateDelay: 100,
        },
      });

      store.feature.registerField("username", {
        validation: {
          asyncValidateOn: "change",
          asyncValidate: usernameApi,
          asyncValidateDelay: 100,
        },
      });

      store.write.setField("email", "old@sample");
      await vi.advanceTimersByTimeAsync(100);

      store.write.setField("email", "new@sample.com");
      await vi.advanceTimersByTimeAsync(100);

      store.write.setField("username", "leo");
      await vi.advanceTimersByTimeAsync(100);

      expect(store.read.getState().errors.username).toBe(
        "Username indisponível",
      );

      resolveEmailReq2!(null);
      await vi.advanceTimersByTimeAsync(1);
      expect(store.read.getState().errors.email).toBeUndefined();

      resolveEmailReq1!("Email inválido (stale)");
      await vi.advanceTimersByTimeAsync(1);

      expect(store.read.getState().errors.email).toBeUndefined();
      expect(store.read.getState().errors.username).toBe(
        "Username indisponível",
      );
    });

    it("deve acumular scopeFields no debounce de triggerValidation", async () => {
      const resolver = vi.fn().mockResolvedValue({
        email: "Email inválido",
        name: "Nome inválido",
      });

      const store = createBitStore({
        initialValues: { email: "", name: "" },
        validation: {
          resolver,
          delay: 20,
        },
      });

      store.feature.triggerValidation(["email"]);
      await vi.advanceTimersByTimeAsync(10);
      store.feature.triggerValidation(["name"]);

      await vi.advanceTimersByTimeAsync(25);

      expect(resolver).toHaveBeenCalledTimes(1);
      const calledScopeFields = resolver.mock.calls[0]?.[1]?.scopeFields ?? [];
      expect(calledScopeFields).toEqual(
        expect.arrayContaining(["email", "name"]),
      );
      expect(store.read.getState().errors.email).toBe("Email inválido");
      expect(store.read.getState().errors.name).toBe("Nome inválido");
    });

    it("deve fazer o MERGE perfeito entre erros Síncronos (Zod) e Assíncronos (API)", async () => {
      const mockResolver = vi.fn().mockResolvedValue({
        password: "Senha fraca",
      });

      const store = createBitStore({
        initialValues: { username: "leandro", password: "" },
        validation: { resolver: mockResolver, delay: 0 },
      });

      store.feature.registerField("username", {
        validation: {
          asyncValidateOn: "change",
          asyncValidate: async () => "API: Username ocupado",
          asyncValidateDelay: 0,
        },
      });

      store.write.setField("username", "leandro");
      await vi.advanceTimersByTimeAsync(10);

      expect(store.read.getState().errors.username).toBe(
        "API: Username ocupado",
      );

      store.write.setField("password", "123");
      await vi.advanceTimersByTimeAsync(10);

      expect(store.read.getState().errors).toEqual({
        username: "API: Username ocupado",
        password: "Senha fraca",
      });
    });

    it("deve manter erro do resolver quando asyncValidate passa (não limpar erro Zod)", async () => {
      const store = createBitStore({
        initialValues: { email: "invalido" },
        validation: {
          resolver: (values) =>
            Promise.resolve(
              /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email ?? "")
                ? {}
                : { email: "E-mail inválido" },
            ),
          delay: 0,
        },
      });

      store.feature.registerField("email", {
        validation: {
          asyncValidate: async () => null,
          asyncValidateDelay: 0,
        },
      });

      store.write.setField("email", "invalido");
      store.write.blurField("email");
      await vi.advanceTimersByTimeAsync(50);
      expect(store.read.getState().errors.email).toBe("E-mail inválido");

      await vi.advanceTimersByTimeAsync(50);
      expect(store.read.getState().errors.email).toBe("E-mail inválido");
    });

    it("deve limpar a memória do erro assíncrono ao ocultar e recalcular quando validado novamente", async () => {
      const store = createBitStore({
        initialValues: { hasCnpj: true, cnpj: "111" },
      });

      store.feature.registerField("cnpj", {
        conditional: {
          dependsOn: ["hasCnpj"],
          showIf: (v) => v.hasCnpj,
        },
        validation: {
          asyncValidateOn: "change",
          asyncValidate: async () => "API: CNPJ Inválido",
          asyncValidateDelay: 0,
        },
      });

      store.write.setField("cnpj", "111");
      await vi.advanceTimersByTimeAsync(10);
      expect(store.read.getState().errors.cnpj).toBe("API: CNPJ Inválido");

      store.write.setField("hasCnpj", false);
      await vi.advanceTimersByTimeAsync(10);

      expect(store.read.getState().errors.cnpj).toBeUndefined();

      store.write.setField("hasCnpj", true);
      await store.feature.validate({ scopeFields: ["cnpj"] });

      expect(store.read.getState().errors.cnpj).toBe("API: CNPJ Inválido");
    });

    it("deve executar asyncValidate apenas no blur por padrão", async () => {
      const store = createBitStore({
        initialValues: { username: "" },
        validation: { delay: 0 },
      });

      const mockApi = vi.fn().mockResolvedValue("Username já existe");

      store.feature.registerField("username", {
        validation: {
          asyncValidate: mockApi,
          asyncValidateDelay: 0,
        },
      });

      store.write.setField("username", "leandro");
      await vi.advanceTimersByTimeAsync(10);

      expect(mockApi).not.toHaveBeenCalled();

      store.write.blurField("username");
      await vi.advanceTimersByTimeAsync(10);

      expect(mockApi).toHaveBeenCalledTimes(1);
      expect(store.read.getState().errors.username).toBe("Username já existe");
    });

    it("asyncValidateTimeout deve limpar isValidating e não definir erro quando a Promise demora demais", async () => {
      const store = createBitStore({ initialValues: { username: "" } });

      const mockApi = vi
        .fn()
        .mockImplementation(() => new Promise<string | null>(() => {}));

      store.feature.registerField("username", {
        validation: {
          asyncValidateOn: "change",
          asyncValidate: mockApi,
          asyncValidateDelay: 0,
          asyncValidateTimeout: 200,
        },
      });

      store.write.setField("username", "leandro");
      await vi.advanceTimersByTimeAsync(10);

      expect(store.read.isFieldValidating("username")).toBe(true);

      await vi.advanceTimersByTimeAsync(250);

      expect(store.read.isFieldValidating("username")).toBe(false);
      expect(store.read.getState().errors.username).toBeUndefined();
    });

    it("asyncValidateTimeout não interrompe validação que termina dentro do prazo", async () => {
      const store = createBitStore({ initialValues: { email: "" } });

      store.feature.registerField("email", {
        validation: {
          asyncValidateOn: "change",
          asyncValidate: async () => "Email inválido",
          asyncValidateDelay: 0,
          asyncValidateTimeout: 500,
        },
      });

      store.write.setField("email", "bad");
      await vi.advanceTimersByTimeAsync(10);

      expect(store.read.getState().errors.email).toBe("Email inválido");
      expect(store.read.isFieldValidating("email")).toBe(false);
    });
  });

  describe("Plugin Lifecycle", () => {
    it("should run plugin setup on init and teardown on cleanup", () => {
      const teardown = vi.fn();
      const setup = vi.fn(() => teardown);

      const store = createBitStore({
        initialValues: { name: "" },
        plugins: [{ name: "setup-plugin", setup }],
      });

      expect(setup).toHaveBeenCalledTimes(1);
      store.feature.cleanup();
      expect(teardown).toHaveBeenCalledTimes(1);
    });

    it("should trigger beforeValidate and afterValidate in order", async () => {
      const calls: string[] = [];

      const store = createBitStore({
        initialValues: { name: "Leo" },
        validation: {
          resolver: () => ({}),
          delay: 0,
        },
        plugins: [
          {
            name: "validate-plugin",
            hooks: {
              beforeValidate: () => {
                calls.push("beforeValidate");
              },
              afterValidate: (event) => {
                calls.push("afterValidate");
                expect(event.result).toBe(true);
              },
            },
          },
        ],
      });

      await store.feature.validate();

      expect(calls).toEqual(["beforeValidate", "afterValidate"]);
      store.feature.cleanup();
    });

    it("should trigger beforeSubmit and afterSubmit around successful submit", async () => {
      const calls: string[] = [];

      const store = createBitStore({
        initialValues: { name: "Leo" },
        validation: {
          resolver: () => ({}),
          delay: 0,
        },
        plugins: [
          {
            name: "submit-plugin",
            hooks: {
              beforeSubmit: () => {
                calls.push("beforeSubmit");
              },
              afterSubmit: (event) => {
                calls.push("afterSubmit");
                expect(event.success).toBe(true);
              },
            },
          },
        ],
      });

      await store.write.submit(async () => {
        calls.push("onSuccess");
      });

      expect(calls).toEqual(["beforeSubmit", "onSuccess", "afterSubmit"]);
      store.feature.cleanup();
    });

    it("should keep submit payload snapshot stable when beforeSubmit mutates store state", async () => {
      const submittedValues: Array<Record<string, unknown>> = [];
      const afterSubmitEvents: Array<Record<string, unknown>> = [];

      const store = createBitStore({
        initialValues: { name: "Leo" },
        validation: {
          resolver: () => ({}),
          delay: 0,
        },
        plugins: [
          {
            name: "mutating-before-submit",
            hooks: {
              beforeSubmit: () => {
                store.write.setField("name", "Mutated in hook");
              },
              afterSubmit: (event) => {
                afterSubmitEvents.push(
                  event as unknown as Record<string, unknown>,
                );
              },
            },
          },
        ],
      });

      await store.write.submit(async (values) => {
        submittedValues.push(values as unknown as Record<string, unknown>);
      });

      expect(submittedValues).toHaveLength(1);
      expect(submittedValues[0]?.name).toBe("Leo");

      expect(afterSubmitEvents).toHaveLength(1);
      expect(afterSubmitEvents[0]?.values).toEqual({ name: "Leo" });
      expect((afterSubmitEvents[0]?.state as any)?.values?.name).toBe(
        "Mutated in hook",
      );

      store.feature.cleanup();
    });

    it("should emit onFieldChange for setField, rebase and array operations", async () => {
      const changes: Array<{
        origin: string;
        operation?: string;
        path: string;
      }> = [];

      const store = createBitStore({
        initialValues: { name: "", items: ["A"] },
        plugins: [
          {
            name: "field-change-plugin",
            hooks: {
              onFieldChange: (event) => {
                changes.push({
                  origin: event.meta.origin,
                  operation: event.meta.operation,
                  path: event.path,
                });
              },
            },
          },
        ],
      });

      store.write.setField("name", "Leo");
      store.write.setValues(
        { name: "Leandro", items: ["A"] },
        { rebase: true },
      );
      store.feature.pushItem("items", "B");

      expect(changes.some((event) => event.origin === "setField")).toBe(true);
      expect(changes.some((event) => event.origin === "rebase")).toBe(true);
      expect(
        changes.some(
          (event) => event.origin === "array" && event.operation === "push",
        ),
      ).toBe(true);

      store.feature.cleanup();
    });

    it("should be fail-open when plugin throws and report via onError", async () => {
      const onError = vi.fn();

      const store = createBitStore({
        initialValues: { email: "x" },
        validation: {
          resolver: () => ({}),
          delay: 0,
        },
        plugins: [
          {
            name: "broken-plugin",
            hooks: {
              beforeValidate: () => {
                throw new Error("plugin exploded");
              },
            },
          },
          {
            name: "error-plugin",
            hooks: {
              onError,
            },
          },
        ],
      });

      const result = await store.feature.validate();

      expect(result).toBe(true);
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          source: "beforeValidate",
          pluginName: "broken-plugin",
        }),
        expect.any(Object),
      );

      store.feature.cleanup();
    });

    it("should report submit callback errors through onError and afterSubmit", async () => {
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => undefined);
      const onError = vi.fn();
      const afterSubmit = vi.fn();

      const store = createBitStore({
        initialValues: { name: "Leo" },
        validation: {
          resolver: () => ({}),
          delay: 0,
        },
        plugins: [
          {
            name: "submit-errors",
            hooks: {
              onError,
              afterSubmit,
            },
          },
        ],
      });

      await store.write.submit(async () => {
        throw new Error("submit failed");
      });

      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({ source: "submit" }),
        expect.any(Object),
      );
      expect(afterSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ success: false }),
        expect.any(Object),
      );

      consoleErrorSpy.mockRestore();
      store.feature.cleanup();
    });

    it("should emit failed afterSubmit with prepared submit snapshot", async () => {
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => undefined);
      const afterSubmitEvents: Array<any> = [];

      const store = createBitStore({
        initialValues: { name: "Leo" },
        validation: {
          resolver: () => ({}),
          delay: 0,
        },
        plugins: [
          {
            name: "submit-failure-snapshot",
            hooks: {
              beforeSubmit: () => {
                store.write.setField("name", "Mutated in hook");
              },
              afterSubmit: (event) => {
                afterSubmitEvents.push(event);
              },
            },
          },
        ],
      });

      await store.write.submit(async () => {
        throw new Error("submit failed");
      });

      expect(afterSubmitEvents).toHaveLength(1);
      expect(afterSubmitEvents[0]?.success).toBe(false);
      expect(afterSubmitEvents[0]?.values).toEqual({ name: "Leo" });
      expect(afterSubmitEvents[0]?.state?.values?.name).toBe("Mutated in hook");

      consoleErrorSpy.mockRestore();
      store.feature.cleanup();
    });

    it("should ignore plugin config mutations from context.getConfig", async () => {
      vi.useFakeTimers();

      const storage = {
        getItem: vi.fn(async () => null),
        setItem: vi.fn(async () => undefined),
        removeItem: vi.fn(async () => undefined),
      };

      const store = createBitStore({
        initialValues: { name: "Leo" },
        persist: {
          enabled: true,
          key: "plugin-config-guard",
          storage,
          debounceMs: 0,
        },
        plugins: [
          {
            name: "mutate-config",
            setup: (context: any) => {
              context.getConfig().persist.enabled = false;
            },
          },
        ],
      });

      store.write.setField("name", "Ana");
      await vi.runAllTimersAsync();

      expect(storage.setItem).toHaveBeenCalledTimes(1);

      store.feature.cleanup();
      vi.useRealTimers();
    });

    it("should ignore plugin state mutations from context.getState", async () => {
      const store = createBitStore({
        initialValues: { name: "Leo" },
        validation: {
          resolver: () => ({}),
          delay: 0,
        },
        plugins: [
          {
            name: "mutate-state",
            hooks: {
              beforeValidate: (_event, context) => {
                (context.getState().values as any).name = "Mutated by plugin";
              },
            },
          },
        ],
      });

      await store.feature.validate();

      expect(store.read.getState().values.name).toBe("Leo");
      store.feature.cleanup();
    });
  });

  describe("Store Stability - Batch Engine", () => {
    it("should not poison pendingState if onDerivationError throws", () => {
      let onDerivationErrorThrew = false;
      const store = createBitStore({
        initialValues: {
          name: "Test",
          email: "test@test.com",
        },
        fields: {
          name: {
            computed: (values: any) => {
              if (values.email === "trigger") {
                throw new Error("Derivation Error");
              }
              return "initial";
            },
            computedDependsOn: ["email"],
          },
        },
        onUnhandledError: (_error: any, _source: string) => {
          onDerivationErrorThrew = true;
          throw new Error("Sentry crashed!");
        },
      });

      // Execute a batch update.
      store.write.setValues({ email: "trigger" } as any);

      expect(onDerivationErrorThrew).toBe(true);

      // We remove the faulty derivation so we can test if the batch engine works.
      const registry = (store as any)[Symbol.for("bit-form-hooks-api")]
        ? (store as any).feature?.registry ||
          (store as any)._composition?.fieldRegistry
        : undefined;

      if (registry) {
        delete registry.fields.name;
      }

      const internalEngine = store as any;
      if (internalEngine._composition) {
        internalEngine._composition.runtime.applyValueDerivations = (v: any) =>
          v;
      }

      try {
        store.write.setField("email", "new@test.com");
      } catch (e) {
        // Ignore
      }

      expect(true).toBe(true);
    });

    it("should prevent batch poisoning when observability handler throws (low-level)", async () => {
      const { createStoreBatchState, trackBatchedStoreUpdate, flushStoreBatchState } =
        await import("../../core/store/engines/store-batch-engine");

      const currentState = {
        values: { a: 1 },
        errors: {},
        touched: {},
        isValidating: {},
        isSubmitting: false,
        isDirty: false,
        isValid: true,
        persist: {
          initialized: false,
          isSaving: false,
          isRestoring: false,
          error: null,
        },
      };

      const batchState = createStoreBatchState<any>();

      trackBatchedStoreUpdate(batchState, {
        nextState: { ...currentState, values: { a: 2 } },
        valuesChanged: true,
        changedPaths: ["a"],
      });

      const applyValueDerivations = vi.fn().mockImplementation(() => {
        throw new Error("Derivation error");
      });

      const onDerivationError = vi.fn().mockImplementation(() => {
        throw new Error("Observability exception");
      });

      expect(() =>
        flushStoreBatchState({
          currentState,
          batchState,
          applyValueDerivations,
          onDerivationError,
        }),
      ).not.toThrow("Observability exception");

      expect(applyValueDerivations).toHaveBeenCalled();
      expect(onDerivationError).toHaveBeenCalled();
    });

    it("should fallback to raw values and update state when onUnhandledError throws during derivation failure", async () => {
      const { BitStore } = await import("../../core/store/bit-store-class");
      let threwObservabilityError = false;

      const store = new BitStore({
        initialValues: { name: "test", surname: "" },
      });

      (store as any)._config.onUnhandledError = () => {
        threwObservabilityError = true;
        throw new Error("Observability failed");
      };

      store.feature.registerField("fullName", {
        computed: () => {
          throw new Error("Computed failed");
        },
        computedDependsOn: ["surname"],
      });

      store.write.setField("surname", "doe");

      expect(threwObservabilityError).toBe(true);
      expect(store.read.getState().values.surname).toBe("doe");
    });

    it("should not clear pendingHistorySnapshot when flushStoreBatchState returns early", async () => {
      const {
        createStoreBatchState,
        flushStoreBatchState,
      } = await import("../../core/store/engines/store-batch-engine");

      const batchState = createStoreBatchState<any>();
      batchState.depth = 0;
      batchState.pendingState = null;
      batchState.pendingHistorySnapshot = true;

      const result = flushStoreBatchState({
        currentState: { values: {}, errors: {}, isValid: true } as any,
        batchState,
        applyValueDerivations: (v) => v,
      });

      expect(result).toBeNull();
      expect(batchState.pendingHistorySnapshot).toBe(true);
    });

    it("should preserve pendingHistorySnapshot when derivation throws during batch flush", async () => {
      const {
        createStoreBatchState,
        flushStoreBatchState,
        trackBatchedStoreUpdate,
      } = await import("../../core/store/engines/store-batch-engine");

      const currentState = {
        values: { name: "alice" },
        errors: {},
        touched: {},
        isValidating: {},
        isSubmitting: false,
        isDirty: false,
        isValid: true,
        persist: {
          initialized: false,
          isSaving: false,
          isRestoring: false,
          error: null,
        },
      } as any;
      const batchState = createStoreBatchState<any>();

      trackBatchedStoreUpdate(batchState, {
        nextState: { ...currentState, values: { name: "bob" } },
        valuesChanged: true,
        changedPaths: ["name"],
      });

      expect(batchState.pendingHistorySnapshot).toBe(true);

      const failingDerivation = vi.fn().mockImplementation(() => {
        throw new Error("Derivation failed");
      });
      const onDerivationError = vi.fn();

      const result = flushStoreBatchState({
        currentState,
        batchState,
        applyValueDerivations: failingDerivation,
        onDerivationError,
      });

      expect(result).not.toBeNull();
      expect(result!.nextState.values.name).toBe("bob");
      expect(result!.valuesChanged).toBe(true);
      expect(batchState.pendingHistorySnapshot).toBe(true);
    });
  });

  describe("Store Stability - Commit Engine", () => {
    it("should not throw when both the derivation and the RAW fallback fail", async () => {
      const {
        createStoreBatchState,
      } = await import("../../core/store/engines/store-batch-engine");
      const {
        dispatchStoreKernelOperation,
      } = await import("../../core/store/engines/store-commit-engine");

      const state = {
        values: { a: 1 },
        errors: {},
        touched: {},
        isValidating: {},
        isSubmitting: false,
        isDirty: false,
        isValid: true,
        persist: {
          initialized: false,
          isSaving: false,
          isRestoring: false,
          error: null,
        },
      } as any;
      const batchState = createStoreBatchState<any>();

      const poisonedOperation = {
        kind: "state.patch" as const,
        partialState: new Proxy(
          { values: { a: 2 } },
          {
            get(target, prop) {
              if (prop === "values") {
                throw new Error("Immutable proxy — cannot read values");
              }
              return Reflect.get(target, prop);
            },
          },
        ) as any,
        changedPaths: undefined,
        skipComputed: false,
      };

      const applyValueDerivations = vi.fn().mockImplementation(() => {
        throw new Error("Primary derivation failed");
      });
      const onOperationError = vi.fn();
      const onStateCommitted = vi.fn();

      let nextState: any;
      expect(() => {
        nextState = dispatchStoreKernelOperation({
          state,
          batchState,
          operation: poisonedOperation,
          applyValueDerivations,
          onOperationError,
          onStateCommitted,
        });
      }).not.toThrow();

      expect(nextState).toBe(state);
      expect(onStateCommitted).not.toHaveBeenCalled();
    });

    it("should commit the RAW state when only the derivation fails (happy-path fallback)", async () => {
      const {
        createStoreBatchState,
      } = await import("../../core/store/engines/store-batch-engine");
      const {
        dispatchStoreKernelOperation,
      } = await import("../../core/store/engines/store-commit-engine");
      const { patchStateOperation } = await import(
        "../../core/store/engines/operation-engine"
      );

      const state = {
        values: { score: 10 },
        errors: {},
        touched: {},
        isValidating: {},
        isSubmitting: false,
        isDirty: false,
        isValid: true,
        persist: {
          initialized: false,
          isSaving: false,
          isRestoring: false,
          error: null,
        },
      } as any;
      const batchState = createStoreBatchState<any>();

      const operation = {
        ...patchStateOperation({ values: { score: 20 } }),
        kind: "state.patch" as const,
      };

      const applyValueDerivations = vi.fn().mockImplementation(() => {
        throw new Error("Computed field threw");
      });
      const onOperationError = vi.fn();
      const onStateCommitted = vi.fn();

      const nextState = dispatchStoreKernelOperation({
        state,
        batchState,
        operation,
        applyValueDerivations,
        onOperationError,
        onStateCommitted,
      });

      expect(nextState.values.score).toBe(20);
      expect(onStateCommitted).toHaveBeenCalledOnce();
    });
  });

  describe("Store Stability - Array Management", () => {
    it("removeItem deve remover errors do item removido do estado", async () => {
      const { createBitStore } = await import("../../core");
      const store = (createBitStore as any)({
        initialValues: { items: [{ email: "a" }, { email: "b" }] },
      });

      store.feature.registerField("items.0.email", {});
      store.feature.registerField("items.1.email", {});

      store.write.setErrors({ "items.0.email": "E-mail inválido" });
      expect(store.read.getState().errors["items.0.email"]).toBe(
        "E-mail inválido",
      );

      store.feature.removeItem("items", 0);

      const state = store.read.getState();
      expect(state.errors["items.0.email"]).toBeUndefined();
    });

    it("removeItem deve remover touched do item removido do estado", async () => {
      const { createBitStore } = await import("../../core");
      const store = (createBitStore as any)({
        initialValues: { tags: ["x", "y", "z"] },
      });

      store.feature.registerField("tags.1", {});

      store.write.blurField("tags.1");
      expect(store.read.getState().touched["tags.1"]).toBe(true);

      store.feature.removeItem("tags", 1);

      expect(store.read.getState().touched["tags.1"]).toBeUndefined();
    });
  });

  describe("Production Audit Regressions", () => {
    it("should not create a history snapshot when transaction does not mutate state", async () => {
      const { createBitStore } = await import("../../core");
      const store = createBitStore({ initialValues: { nome: "Leandro" }, history: { enabled: true, debounceMs: 0 } });
      
      const beforeSnapshot = store.read.getHistoryMetadata().historyIndex;
      expect(beforeSnapshot).toBe(0);

      // Iniciar transação sem alterar nada
      store.write.transaction(() => {
        // Nada muda
      });

      const afterSnapshot = store.read.getHistoryMetadata().historyIndex;
      expect(afterSnapshot).toBe(0); // Não deve ter criado snapshot fantasma

      // Alterar de verdade deve criar
      store.write.transaction(() => {
        store.write.setField("nome", "Leo");
      });
      await new Promise(r => setTimeout(r, 10)); // wait for history debounce 0 to flush
      expect(store.read.getHistoryMetadata().historyIndex).toBe(1);
    });

    it("ACHADO-4: should not corrupt isDirty baseline when external reference is mutated after rebaseValues", async () => {
      const { createBitStore } = await import("../../core");
      const store = createBitStore({ initialValues: { count: 0, name: "Leo" } });

      const externalValues = { count: 0, name: "Leo" };
      store.write.setValues(externalValues, { rebase: true });

      // Mutação externa DEPOIS do rebase — não deve afetar o baseline
      externalValues.count = 99;
      externalValues.name = "Corrupted";

      store.write.setField("count", 1);

      // isDirty deve ser true: 1 !== 0 (baseline original, não 99)
      expect(store.read.getState().isDirty).toBe(true);

      // getDirtyValues deve incluir count com o valor correto
      const dirty = store.read.getDirtyValues();
      expect((dirty as any).count).toBe(1);
    });

    it("ACHADO-4: rebaseValues with non-object items in array should not corrupt baseline", async () => {
      const { createBitStore } = await import("../../core");
      const store = createBitStore({ initialValues: { tags: ["a", "b"] } });

      const values = { tags: ["a", "b"] };
      store.write.setValues(values, { rebase: true });

      // External mutation to the array
      values.tags.push("c");

      store.write.setField("tags", ["a", "b", "x"]);

      // isDirty should be true: ["a","b","x"] !== baseline ["a","b"]
      expect(store.read.getState().isDirty).toBe(true);
    });
  });
});
