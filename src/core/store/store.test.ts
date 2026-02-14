import { describe, it, expect, vi, beforeEach } from "vitest";
import { BitStore } from "../../core/store";

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

  describe("Validation & Race Conditions", () => {
    it("should handle manual error setting with setError and setErrors", () => {
      const store = new BitStore({ initialValues: { email: "" } });

      store.setError("email", "Invalid email");
      expect(store.getState().errors.email).toBe("Invalid email");
      expect(store.isValid).toBe(false);

      store.setErrors({ password: "Too short" });
      expect(store.getState().errors.password).toBe("Too short");
    });

    it("should ignore stale validation results (Race Condition protection)", async () => {
      let resolveFirst: any;
      const firstValidation = new Promise((resolve) => {
        resolveFirst = resolve;
      });

      const resolver = vi
        .fn()
        .mockReturnValueOnce(firstValidation)
        .mockReturnValueOnce({ name: "Error from second" });

      const store = new BitStore({ initialValues: { name: "" }, resolver });

      const p1 = store.validate();
      const p2 = store.validate();

      resolveFirst({ name: "Error from first" });

      await Promise.all([p1, p2]);

      expect(store.getState().errors.name).toBe("Error from second");
    });

    it("should clear field error instantly when value changes", () => {
      const store = new BitStore({ initialValues: { name: "" } });
      store.setError("name", "Required");

      store.setField("name", "L");
      expect(store.getState().errors.name).toBeUndefined();
    });
  });

  describe("Server Errors (Laravel Adapter)", () => {
    it("should map server errors from array (Laravel) or string", () => {
      const store = new BitStore({ initialValues: { email: "", cpf: "" } });

      store.setServerErrors({
        email: ["Already taken"],
        cpf: "Invalid format",
      });

      expect(store.getState().errors.email).toBe("Already taken");
      expect(store.getState().errors.cpf).toBe("Invalid format");
      expect(store.isValid).toBe(false);
    });
  });

  describe("Field Dirty State", () => {
    it("should check if an individual field is dirty", () => {
      const store = new BitStore({ initialValues: { name: "Leo", age: 30 } });

      expect(store.isFieldDirty("name")).toBe(false);

      store.setField("name", "Leandro");
      expect(store.isFieldDirty("name")).toBe(true);
      expect(store.isFieldDirty("age")).toBe(false);

      store.setField("name", "Leo");
      expect(store.isFieldDirty("name")).toBe(false);
    });
  });

  describe("Undo/Redo History", () => {
    it("should not track history if enableHistory is false", () => {
      const store = new BitStore({
        initialValues: { name: "Leo" },
        enableHistory: false,
      });

      store.setField("name", "A");
      store.blurField("name");

      expect(store.canUndo).toBe(false);
    });

    it("should undo and redo state changes correctly", () => {
      const store = new BitStore({
        initialValues: { name: "Leo" },
        enableHistory: true,
      });

      store.setField("name", "Leandro");
      store.blurField("name");

      store.setField("name", "Ishikawa");
      store.blurField("name");

      expect(store.getState().values.name).toBe("Ishikawa");

      store.undo();
      expect(store.getState().values.name).toBe("Leandro");

      store.undo();
      expect(store.getState().values.name).toBe("Leo");

      store.redo();
      expect(store.getState().values.name).toBe("Leandro");
    });

    it("should discard future history if change happens after undo", () => {
      const store = new BitStore({
        initialValues: { val: 1 },
        enableHistory: true,
      });

      store.setField("val", 2);
      store.blurField("val");

      store.undo();
      store.setField("val", 3);
      store.blurField("val");

      expect(store.canRedo).toBe(false);
      store.undo();
      expect(store.getState().values.val).toBe(1);
    });
  });

  describe("Form Lifecycle & Arrays", () => {
    it("should hydrate state using setValues for edit mode", () => {
      const store = new BitStore({
        initialValues: { name: "", id: null as number | null },
      });

      store.setValues({ name: "Leandro", id: 1 });
      expect(store.getState().values.name).toBe("Leandro");
      expect(store.getState().isDirty).toBe(false);
    });

    it("should push items and update history", () => {
      const store = new BitStore({
        initialValues: { tags: [] },
        enableHistory: true,
      });

      store.pushItem("tags", "JS");
      expect(store.getState().values.tags).toEqual(["JS"]);
      expect(store.canUndo).toBe(true);
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
});
