import { describe, it, expect, vi, beforeEach } from "vitest";
import { BitStore } from "../../core";

describe("BitStore Core", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  describe("Basic State and Getters", () => {
    it("should initialize with correct state", () => {
      const store = new BitStore({ initialValues: { name: "Leo" } });
      const state = store.getState();

      expect(state.values.name).toBe("Leo");
      expect(store.isValid).toBe(true);
      expect(store.isDirty).toBe(false);
      expect(store.isSubmitting).toBe(false);
      expect(store.getConfig().initialValues).toEqual({ name: "Leo" });
    });

    it("should update field and notify listeners", () => {
      const store = new BitStore({ initialValues: { name: "" } });
      const listener = vi.fn();
      store.subscribe(listener);

      store.setField("name", "Leo");

      expect(store.getState().values.name).toBe("Leo");
      expect(listener).toHaveBeenCalled();
    });

    it("should allow watching specific fields", () => {
      const store = new BitStore({
        initialValues: { user: { name: "Leo", age: 30 } },
      });
      const watcher = vi.fn();

      store.watch("user.name", watcher);

      store.setField("user.age", 31);
      expect(watcher).not.toHaveBeenCalled();

      store.setField("user.name", "Leandro");
      expect(watcher).toHaveBeenCalledWith("Leandro");
    });

    it("should update nested fields using dot notation", () => {
      const store = new BitStore({
        initialValues: { user: { profile: { name: "" } } },
      });

      store.setField("user.profile.name", "Leo");
      expect(store.getState().values.user.profile.name).toBe("Leo");
    });

    it("should mark field as touched on blur", () => {
      const store = new BitStore({ initialValues: { name: "" } });

      store.blurField("name");
      expect(store.getState().touched.name).toBe(true);
    });

    it("should track isDirty state accurately", () => {
      const store = new BitStore({ initialValues: { name: "Leo" } });

      expect(store.isDirty).toBe(false);
      expect(store.isFieldDirty("name")).toBe(false);

      store.setField("name", "Leandro");
      expect(store.isDirty).toBe(true);
      expect(store.isFieldDirty("name")).toBe(true);

      store.setField("name", "Leo");
      expect(store.isDirty).toBe(false);
      expect(store.isFieldDirty("name")).toBe(false);
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
  });

  describe("Conditional Logic (Dependency Manager)", () => {
    it("should hide field based on initial values", () => {
      const store = new BitStore({
        initialValues: { country: "US", state: "" },
      });
      store.registerConfig("state", {
        dependsOn: ["country"],
        showIf: (values) => values.country === "BR",
      });

      expect(store.isHidden("state")).toBe(true);
    });

    it("should show field and trigger re-render when dependency changes", () => {
      const store = new BitStore({
        initialValues: { country: "US", state: "" },
      });
      const listener = vi.fn();
      store.subscribe(listener);

      store.registerConfig("state", {
        dependsOn: ["country"],
        showIf: (values) => values.country === "BR",
      });

      store.setField("country", "BR");

      expect(store.isHidden("state")).toBe(false);
      expect(listener).toHaveBeenCalled();
    });

    it("should clear errors when a field becomes hidden", () => {
      const store = new BitStore({
        // Inicia como company para o cnpj nascer visível
        initialValues: { type: "company", cnpj: "" },
      });
      store.registerConfig("cnpj", {
        dependsOn: ["type"],
        showIf: (values) => values.type === "company",
      });

      store.setError("cnpj", "Required");
      expect(store.getState().errors.cnpj).toBe("Required");

      // Mudar para person oculta o campo e deve limpar o erro
      store.setField("type", "person");
      expect(store.isHidden("cnpj")).toBe(true);
      expect(store.getState().errors.cnpj).toBeUndefined();
    });

    it("should unregister field configurations and dependencies", () => {
      const store = new BitStore({
        initialValues: { country: "BR", state: "" },
      });

      store.registerConfig("state", {
        dependsOn: ["country"],
        showIf: (v) => v.country === "BR",
      });

      expect(store.isHidden("state")).toBe(false);

      store.unregisterField("state");

      expect(store.isHidden("state")).toBe(false);
      store.setField("country", "US");
    });
  });

  describe("Validation & Scopes", () => {
    it("should handle manual error setting with setError and setErrors", () => {
      const store = new BitStore({ initialValues: { email: "" } });

      store.setError("email", "Invalid email");
      expect(store.getState().errors.email).toBe("Invalid email");
      expect(store.isValid).toBe(false);

      store.setErrors({ password: "Too short" });
      expect(store.getState().errors.password).toBe("Too short");
    });

    it("should clear field error instantly when value changes", () => {
      const store = new BitStore({ initialValues: { name: "" } });
      store.setError("name", "Required");

      store.setField("name", "L");
      expect(store.getState().errors.name).toBeUndefined();
    });

    it("should evaluate step status correctly", () => {
      const store = new BitStore({
        initialValues: { p1: "", p2: "" },
        scopes: { step1: ["p1", "p2"] },
      });

      store.setError("p1", "Error");
      store.setField("p2", "Changed");

      const status = store.getStepStatus("step1");
      expect(status.hasErrors).toBe(true);
      expect(status.isDirty).toBe(true);
    });

    it("should map server errors", () => {
      const store = new BitStore({ initialValues: { email: "", cpf: "" } });

      store.setServerErrors({
        email: ["Already taken"],
        cpf: "Invalid format",
      });

      expect(store.getState().errors.email).toBe("Already taken");
      expect(store.getState().errors.cpf).toBe("Invalid format");
      expect(store.isValid).toBe(false);
    });

    it("should trigger requiredIf validation dynamically", async () => {
      const store = new BitStore({
        initialValues: { hasLicense: true, licenseNumber: "" },
      });

      store.registerConfig("licenseNumber", {
        dependsOn: ["hasLicense"],
        requiredIf: (v) => v.hasLicense === true,
      });

      const isValid = await store.validate();
      expect(isValid).toBe(false);
      expect(store.getState().errors.licenseNumber).toBe(
        "Este campo é obrigatório",
      );

      store.setField("hasLicense", false);
      const isValidNow = await store.validate();
      expect(isValidNow).toBe(true);
    });
  });

  describe("Undo/Redo History", () => {
    it("should track history correctly", () => {
      const store = new BitStore({
        initialValues: { name: "Leo" },
        enableHistory: true,
      });

      store.setField("name", "Leandro");
      store.blurField("name");

      store.setField("name", "Ishikawa");
      store.blurField("name");

      expect(store.canUndo).toBe(true);

      store.undo();
      expect(store.getState().values.name).toBe("Leandro");
      expect(store.canRedo).toBe(true);

      store.redo();
      expect(store.getState().values.name).toBe("Ishikawa");
    });
  });

  describe("Form Lifecycle & Submissions", () => {
    it("should reset form to initial values", () => {
      const store = new BitStore({ initialValues: { name: "Leo" } });

      store.setField("name", "Leandro");
      store.setError("name", "Error");

      store.reset();

      expect(store.getState().values.name).toBe("Leo");
      expect(store.getState().errors).toEqual({});
      expect(store.isDirty).toBe(false);
    });

    it("should hydrate state using setValues", () => {
      const store = new BitStore({ initialValues: { name: "" } });

      store.setValues({ name: "Leandro" });
      expect(store.getState().values.name).toBe("Leandro");
      expect(store.isDirty).toBe(false);
    });

    it("should remove hidden fields and apply transforms on submit", async () => {
      const store = new BitStore({
        initialValues: { newsletter: false, email: "test@test.com", price: 10 },
        transform: {
          price: (val) => val * 2,
        },
      });

      store.registerConfig("email", {
        dependsOn: ["newsletter"],
        showIf: (values) => values.newsletter === true,
      });

      let submittedData: any;
      await store.submit((values) => {
        submittedData = values;
      });

      expect(submittedData.email).toBeUndefined();
      expect(submittedData.price).toBe(20);
      expect(store.isSubmitting).toBe(false);
    });
  });

  describe("Array Operations", () => {
    it("should push and prepend items", () => {
      const store = new BitStore({ initialValues: { list: [2] } });

      store.pushItem("list", 3);
      expect(store.getState().values.list).toEqual([2, 3]);

      store.prependItem("list", 1);
      expect(store.getState().values.list).toEqual([1, 2, 3]);
    });

    it("should insert item at specific index", () => {
      const store = new BitStore({ initialValues: { list: [1, 3] } });

      store.insertItem("list", 1, 2);
      expect(store.getState().values.list).toEqual([1, 2, 3]);
    });

    it("should clean up and shift errors when item is removed", () => {
      const store = new BitStore({ initialValues: { list: ["A", "B", "C"] } });
      (store as any).validate = vi.fn();
      (store as any).triggerValidation = vi.fn();

      store.setError("list.2", "Error on C");
      store.removeItem("list", 1);

      expect(store.getState().values.list).toEqual(["A", "C"]);
      expect(store.getState().errors["list.1"]).toBe("Error on C");
      expect(store.getState().errors["list.2"]).toBeUndefined();
    });

    it("should swap items and swap their errors", () => {
      const store = new BitStore({ initialValues: { list: ["A", "B"] } });
      (store as any).validate = vi.fn();
      (store as any).triggerValidation = vi.fn();

      store.setError("list.0", "Error on A");
      store.swapItems("list", 0, 1);

      expect(store.getState().values.list).toEqual(["B", "A"]);
      expect(store.getState().errors["list.1"]).toBe("Error on A");
      expect(store.getState().errors["list.0"]).toBeUndefined();
    });

    it("should move items and shift errors accordingly", () => {
      const store = new BitStore({ initialValues: { list: ["A", "B", "C"] } });
      (store as any).validate = vi.fn();
      (store as any).triggerValidation = vi.fn();

      store.setError("list.0", "Error on A");
      store.moveItem("list", 0, 2);

      expect(store.getState().values.list).toEqual(["B", "C", "A"]);
      expect(store.getState().errors["list.2"]).toBe("Error on A");
      expect(store.getState().errors["list.0"]).toBeUndefined();
    });
  });

  describe("Masks Registration", () => {
    it("should register dynamic masks", () => {
      const store = new BitStore();

      store.registerMask("custom", {
        parse: (val) => val,
        format: (val) => `X-${val}`,
      });

      expect(store.masks["custom"]).toBeDefined();
    });
  });
});
