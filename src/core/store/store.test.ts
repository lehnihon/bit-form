import { describe, it, expect, vi, beforeEach } from "vitest";
import { BitStore } from "../../core/store";
import { bitMasks } from "../../core/mask";

describe("BitStore Core", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  describe("Basic Functionality", () => {
    it("should initialize with correct state", () => {
      const store = new BitStore({ initialValues: { name: "Leo" } });
      const state = store.getState();

      expect(state.values.name).toBe("Leo");
      expect(state.isValid).toBe(true);
      expect(state.isDirty).toBe(false);
      expect(state.isSubmitting).toBe(false);
    });

    it("should update field and notify listeners", () => {
      const store = new BitStore({ initialValues: { name: "" } });
      const listener = vi.fn();
      store.subscribe(listener);

      store.setField("name", "Leo");

      expect(store.getState().values.name).toBe("Leo");
      expect(listener).toHaveBeenCalled();
    });

    it("should update nested fields using dot notation", () => {
      const store = new BitStore({
        initialValues: { user: { profile: { name: "" } } },
      });

      store.setField("user.profile.name", "Leo");
      expect(store.getState().values.user.profile.name).toBe("Leo");
    });

    it("should track isDirty state accurately", () => {
      const store = new BitStore({ initialValues: { name: "Leo" } });

      expect(store.getState().isDirty).toBe(false);

      store.setField("name", "Leandro");
      expect(store.getState().isDirty).toBe(true);

      store.setField("name", "Leo");
      expect(store.getState().isDirty).toBe(false);
    });
  });

  describe("Computed Fields", () => {
    it("should calculate fields on initialization", () => {
      const store = new BitStore({
        initialValues: { price: 10, qty: 2, total: 0 },
        computed: {
          total: (vals) => vals.price * vals.qty,
        },
      });

      expect(store.getState().values.total).toBe(20);
    });

    it("should update computed field when dependencies change", () => {
      const store = new BitStore({
        initialValues: {
          firstName: "Leandro",
          lastName: "Ishikawa",
          fullName: "",
        },
        computed: {
          fullName: (vals) => `${vals.firstName} ${vals.lastName}`,
        },
      });

      store.setField("firstName", "Leo");
      expect(store.getState().values.fullName).toBe("Leo Ishikawa");
    });

    it("should handle cascading computed fields (double pass)", () => {
      const store = new BitStore({
        initialValues: { netPrice: 100, tax: 0, finalPrice: 0 },
        computed: {
          tax: (vals) => vals.netPrice * 0.1,
          finalPrice: (vals) => vals.netPrice + vals.tax,
        },
      });

      store.setField("netPrice", 200);

      expect(store.getState().values.tax).toBe(20);
      expect(store.getState().values.finalPrice).toBe(220);
    });

    it("should prevent infinite loops if values remain identical", () => {
      const store = new BitStore({
        initialValues: { count: 1 },
        computed: {
          count: (vals) => (vals.count > 10 ? 10 : vals.count),
        },
      });

      store.setField("count", 20);
      expect(store.getState().values.count).toBe(10);
    });
  });

  describe("Configuration & Masks", () => {
    it("should use 'true' as default for defaultUnmask if not provided", () => {
      const store = new BitStore({ initialValues: {} });
      expect(store.defaultUnmask).toBe(true);
    });

    it("should accept custom configuration for defaultUnmask", () => {
      const store = new BitStore({
        initialValues: {},
        defaultUnmask: false,
      });
      expect(store.defaultUnmask).toBe(false);
    });

    it("should load default presets (bitMasks) if no masks provided", () => {
      const store = new BitStore({ initialValues: {} });
      expect(store.masks).toHaveProperty("brl");
      expect(store.masks).toHaveProperty("cpf");
    });

    it("should allow registering new masks dynamically", () => {
      const store = new BitStore({ initialValues: {} });
      const customMask = {
        format: (v: any) => `X-${v}`,
        parse: (v: string) => v,
      };

      store.registerMask("custom", customMask);
      expect(store.masks.custom.format("test")).toBe("X-test");
    });
  });

  describe("Validation & Errors", () => {
    it("should handle manual error setting with setError and setErrors", () => {
      const store = new BitStore({ initialValues: { email: "" } });

      store.setError("email", "Invalid email");
      expect(store.getState().errors.email).toBe("Invalid email");
      expect(store.isValid).toBe(false);

      store.setErrors({ password: "Too short" });
      expect(store.getState().errors.password).toBe("Too short");
    });

    it("should mark all fields as touched if submit fails validation", async () => {
      const store = new BitStore({
        initialValues: { name: "" },
        resolver: (vals) => (!vals.name ? { name: "Required" } : {}),
      });

      await store.submit(vi.fn());
      expect(store.getState().touched.name).toBe(true);
    });
  });

  describe("Form Lifecycle (Edit, Reset, Submit)", () => {
    it("should hydrate state using setValues for edit mode", () => {
      const store = new BitStore({
        initialValues: { name: "", id: null as number | null },
      });

      store.setValues({ name: "Leandro", id: 1 });
      expect(store.getState().values.name).toBe("Leandro");
      expect(store.getState().isDirty).toBe(false);
    });

    it("should apply transformations during submit", async () => {
      const store = new BitStore({
        initialValues: { age: "25" },
        transform: { age: (v) => Number(v) },
      });

      const onSubmit = vi.fn();
      await store.submit(onSubmit);

      expect(onSubmit).toHaveBeenCalledWith({ age: 25 });
    });
  });

  describe("Advanced Array Manipulations", () => {
    it("should push and prepend items correctly", () => {
      const store = new BitStore({ initialValues: { tags: ["JS"] } });

      store.pushItem("tags", "TS");
      expect(store.getState().values.tags).toEqual(["JS", "TS"]);

      store.prependItem("tags", "HTML");
      expect(store.getState().values.tags).toEqual(["HTML", "JS", "TS"]);
    });

    it("should swap and move items correctly", () => {
      const store = new BitStore({ initialValues: { list: ["a", "b", "c"] } });

      store.swapItems("list", 0, 2);
      expect(store.getState().values.list).toEqual(["c", "b", "a"]);
    });

    it("should clean up errors and touched state when an item is removed", () => {
      const store = new BitStore({
        initialValues: { list: ["item1", "item2"] },
      });

      store.setError("list.1", "Error");
      store.removeItem("list", 1);

      expect(store.getState().errors["list.1"]).toBeUndefined();
    });
  });

  describe("Advanced Features (Watch & Debounce)", () => {
    it("should debounce validation execution", () => {
      vi.useFakeTimers();
      const resolver = vi.fn().mockReturnValue({});
      const store = new BitStore({
        initialValues: { name: "" },
        resolver,
        validationDelay: 500,
      });

      store.setField("name", "Leo");
      expect(resolver).not.toHaveBeenCalled();

      vi.advanceTimersByTime(500);
      expect(resolver).toHaveBeenCalledTimes(1);
    });

    it("should watch for specific field changes", () => {
      const store = new BitStore({ initialValues: { name: "Leo", age: 30 } });
      const nameWatcher = vi.fn();

      const unsubscribe = store.watch("name", nameWatcher);
      store.setField("name", "Leandro");

      expect(nameWatcher).toHaveBeenCalledWith("Leandro");
      unsubscribe();
    });
  });
});
