import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createBitStore } from "../../core";
import { BitStore } from "../../core/store";

describe("BitStore Core", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  describe("Public Store Facade", () => {
    it("should create a public facade with core operations", async () => {
      const store = createBitStore({ initialValues: { name: "Leo", age: 30 } });

      store.setField("name", "Leandro");

      let submittedValues: any;
      let submittedDirtyValues: any;

      await store.submit((values, dirtyValues) => {
        submittedValues = values;
        submittedDirtyValues = dirtyValues;
      });

      expect(submittedValues).toEqual({ name: "Leandro", age: 30 });
      expect(submittedDirtyValues).toEqual({ name: "Leandro" });
    });

    it("should expose the full public API without leaking internal managers", () => {
      const store = createBitStore({ initialValues: { name: "Leo" } }) as any;

      expect("undo" in store).toBe(true);
      expect("redo" in store).toBe(true);
      expect("getHistoryMetadata" in store).toBe(true);
      expect("subscribeSelector" in store).toBe(true);
      expect("subscribePath" in store).toBe(true);
      expect("replaceValues" in store).toBe(true);
      expect("hydrate" in store).toBe(true);
      expect("rebase" in store).toBe(true);
      expect("historyMg" in store).toBe(false);
      expect("depsMg" in store).toBe(false);
    });
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

    it("should support selector-based subscriptions", () => {
      const store = new BitStore({
        initialValues: { user: { name: "Leo" }, age: 30 },
      });
      const listener = vi.fn();

      const unsubscribe = store.subscribeSelector(
        (state) => state.values.user.name,
        listener,
      );

      store.setField("age", 31);
      expect(listener).not.toHaveBeenCalled();

      store.setField("user.name", "Leandro");
      expect(listener).toHaveBeenCalledWith("Leandro");

      unsubscribe();
    });

    it("should support selector options emitImmediately and equalityFn", () => {
      const store = new BitStore({
        initialValues: { user: { name: "Leo" }, age: 30 },
      });

      const listener = vi.fn();

      const unsubscribe = store.subscribeSelector(
        (state) => state.values.user,
        listener,
        {
          emitImmediately: true,
          equalityFn: (prev, next) => prev.name === next.name,
        },
      );

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith({ name: "Leo" });

      store.setField("age", 31);
      expect(listener).toHaveBeenCalledTimes(1);

      store.setField("user.name", "Leandro");
      expect(listener).toHaveBeenCalledTimes(2);
      expect(listener).toHaveBeenLastCalledWith({ name: "Leandro" });

      unsubscribe();
    });

    it("should support path-based subscriptions", () => {
      const store = new BitStore({
        initialValues: { user: { name: "Leo" }, age: 30 },
      });
      const listener = vi.fn();

      const unsubscribe = store.subscribePath("user.name", listener);

      store.setField("age", 31);
      expect(listener).not.toHaveBeenCalled();

      store.setField("user.name", "Leandro");
      expect(listener).toHaveBeenCalledWith("Leandro");

      unsubscribe();
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

    it("should return only dirty values", () => {
      const store = new BitStore({
        initialValues: { name: "Leo", age: 30, city: "Tokyo" },
      });

      expect(store.getDirtyValues()).toEqual({});

      store.setField("name", "Leandro");
      expect(store.getDirtyValues()).toEqual({ name: "Leandro" });

      store.setField("age", 31);
      expect(store.getDirtyValues()).toEqual({ name: "Leandro", age: 31 });

      store.setField("name", "Leo");
      expect(store.getDirtyValues()).toEqual({ age: 31 });
    });

    it("should return dirty values for nested objects", () => {
      const store = new BitStore({
        initialValues: { user: { name: "Leo", profile: { bio: "Dev" } } },
      });

      store.setField("user.name", "Leandro");
      expect(store.getDirtyValues()).toEqual({ user: { name: "Leandro" } });

      store.setField("user.profile.bio", "Developer");
      expect(store.getDirtyValues()).toEqual({
        user: { name: "Leandro", profile: { bio: "Developer" } },
      });
    });

    it("should return full array when any index changes", () => {
      const store = new BitStore({
        initialValues: { tags: ["react", "vue"], count: 0 },
      });

      store.setField("tags.1", "angular");
      const dirty = store.getDirtyValues();

      expect(dirty.tags).toEqual(["react", "angular"]);
      expect(dirty.count).toBeUndefined();
    });
  });

  describe("Computed Fields", () => {
    it("should calculate fields on initialization", () => {
      const store = new BitStore({
        initialValues: { price: 10, qty: 2, total: 0 },
        fields: {
          total: { computed: (vals) => vals.price * vals.qty },
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
        fields: {
          fullName: {
            computed: (vals) => `${vals.firstName} ${vals.lastName}`,
          },
        },
      });

      store.setField("firstName", "Leo");
      expect(store.getState().values.fullName).toBe("Leo Ishikawa");
    });

    it("should handle cascading computed fields (double pass)", () => {
      const store = new BitStore({
        initialValues: { netPrice: 100, tax: 0, finalPrice: 0 },
        fields: {
          tax: { computed: (vals) => vals.netPrice * 0.1 },
          finalPrice: { computed: (vals) => vals.netPrice + vals.tax },
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
      store.registerField("state", {
        conditional: {
          dependsOn: ["country"],
          showIf: (values) => values.country === "BR",
        },
      });

      expect(store.isHidden("state")).toBe(true);
    });

    it("should show field and trigger re-render when dependency changes", () => {
      const store = new BitStore({
        initialValues: { country: "US", state: "" },
      });
      const listener = vi.fn();
      store.subscribe(listener);

      store.registerField("state", {
        conditional: {
          dependsOn: ["country"],
          showIf: (values) => values.country === "BR",
        },
      });

      store.setField("country", "BR");

      expect(store.isHidden("state")).toBe(false);
      expect(listener).toHaveBeenCalled();
    });

    it("should clear errors when a field becomes hidden", () => {
      const store = new BitStore({
        initialValues: { type: "company", cnpj: "" },
      });
      store.registerField("cnpj", {
        conditional: {
          dependsOn: ["type"],
          showIf: (values) => values.type === "company",
        },
      });

      store.setError("cnpj", "Required");
      expect(store.getState().errors.cnpj).toBe("Required");

      store.setField("type", "person");
      expect(store.isHidden("cnpj")).toBe(true);
      expect(store.getState().errors.cnpj).toBeUndefined();
    });

    it("should unregister field configurations and dependencies", () => {
      const store = new BitStore({
        initialValues: { country: "BR", state: "" },
      });

      store.registerField("state", {
        conditional: {
          dependsOn: ["country"],
          showIf: (v) => v.country === "BR",
        },
      });

      expect(store.isHidden("state")).toBe(false);

      store.unregisterField("state");

      expect(store.isHidden("state")).toBe(false);
      store.setField("country", "US");
    });

    it("should NOT unregister fields from config.fields (keeps them for validation)", () => {
      const store = new BitStore({
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

      expect(store.getFieldConfig("bonusValue")).toBeDefined();

      store.unregisterField("bonusValue");

      expect(store.getFieldConfig("bonusValue")).toBeDefined();
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
        fields: {
          p1: { scope: "step1" },
          p2: { scope: "step1" },
        },
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

      store.registerField("licenseNumber", {
        conditional: {
          dependsOn: ["hasLicense"],
          requiredIf: (v) => v.hasLicense === true,
        },
      });

      const isValid = await store.validate();
      expect(isValid).toBe(false);
      expect(store.getState().errors.licenseNumber).toBe("required field");

      store.setField("hasLicense", false);
      const isValidNow = await store.validate();
      expect(isValidNow).toBe(true);
    });

    it("should use conditional.requiredMessage when defined", async () => {
      const store = new BitStore({
        initialValues: { hasBonus: true, bonusValue: "" },
      });

      store.registerField("bonusValue", {
        conditional: {
          dependsOn: ["hasBonus"],
          requiredIf: (v: any) => v.hasBonus === true,
          requiredMessage: "Bonus amount is required",
        },
      });

      const isValid = await store.validate();
      expect(isValid).toBe(false);
      expect(store.getState().errors.bonusValue).toBe(
        "Bonus amount is required",
      );
    });
  });

  describe("Undo/Redo History", () => {
    it("should track history correctly", () => {
      const store = new BitStore({
        initialValues: { name: "Leo" },
        history: { enabled: true },
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

    it("should expose history metadata", () => {
      const store = new BitStore({
        initialValues: { name: "Leo" },
        history: { enabled: true },
      });

      let history = store.getHistoryMetadata();
      expect(history.enabled).toBe(true);
      expect(history.historySize).toBe(1);
      expect(history.historyIndex).toBe(0);

      store.setField("name", "Leandro");
      store.blurField("name");

      history = store.getHistoryMetadata();
      expect(history.historySize).toBe(2);
      expect(history.historyIndex).toBe(1);
      expect(history.canUndo).toBe(true);
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

    it("should replace values without rebasing the initial state", () => {
      const store = new BitStore({ initialValues: { name: "Leo", age: 30 } });

      store.replaceValues({ name: "Leandro", age: 31 });

      expect(store.getState().values).toEqual({ name: "Leandro", age: 31 });
      expect(store.getConfig().initialValues).toEqual({ name: "Leo", age: 30 });
      expect(store.isDirty).toBe(true);
    });

    it("should hydrate current values with deep merge semantics", () => {
      const store = new BitStore({
        initialValues: { user: { name: "Leo", profile: { city: "Tokyo" } } },
      });

      store.hydrate({ user: { profile: { city: "Osaka" } } });

      expect(store.getState().values).toEqual({
        user: { name: "Leo", profile: { city: "Osaka" } },
      });
      expect(store.isDirty).toBe(true);
    });

    it("should rebase values explicitly", () => {
      const store = new BitStore({ initialValues: { name: "Leo", age: 30 } });

      store.rebase({ name: "Leandro", age: 31 });

      expect(store.getState().values).toEqual({ name: "Leandro", age: 31 });
      expect(store.getConfig().initialValues).toEqual({
        name: "Leandro",
        age: 31,
      });
      expect(store.isDirty).toBe(false);
    });

    it("should remove hidden fields and apply transforms on submit", async () => {
      const store = new BitStore({
        initialValues: { newsletter: false, email: "test@test.com", price: 10 },
        fields: {
          price: { transform: (val) => val * 2 },
          email: {
            conditional: {
              dependsOn: ["newsletter"],
              showIf: (values) => values.newsletter === true,
            },
          },
        },
      });

      let submittedData: any;
      await store.submit((values) => {
        submittedData = values;
      });

      expect(submittedData.email).toBeUndefined();
      expect(submittedData.price).toBe(20);
      expect(store.isSubmitting).toBe(false);
    });

    it("should pass dirtyValues as second parameter to submit callback", async () => {
      const store = new BitStore({
        initialValues: { name: "Leo", age: 30, city: "Tokyo" },
      });

      store.setField("name", "Leandro");
      store.setField("age", 31);

      let receivedValues: any;
      let receivedDirtyValues: any;

      await store.submit((values, dirtyValues) => {
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
      const store = new BitStore({
        initialValues: { price: 10, discount: 0 },
        fields: {
          price: { transform: (val) => val * 2 },
        },
      });

      store.setField("price", 20);

      let receivedDirtyValues: any;

      await store.submit((values, dirtyValues) => {
        receivedDirtyValues = dirtyValues;
      });

      expect(receivedDirtyValues).toEqual({ price: 40 });
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
      store.triggerValidation = vi.fn();

      store.setError("list.2", "Error on C");
      store.removeItem("list", 1);

      expect(store.getState().values.list).toEqual(["A", "C"]);
      expect(store.getState().errors["list.1"]).toBe("Error on C");
      expect(store.getState().errors["list.2"]).toBeUndefined();
    });

    it("should swap items and swap their errors", () => {
      const store = new BitStore({ initialValues: { list: ["A", "B"] } });
      store.triggerValidation = vi.fn();

      store.setError("list.0", "Error on A");
      store.swapItems("list", 0, 1);

      expect(store.getState().values.list).toEqual(["B", "A"]);
      expect(store.getState().errors["list.1"]).toBe("Error on A");
      expect(store.getState().errors["list.0"]).toBeUndefined();
    });

    it("should move items and shift errors accordingly", () => {
      const store = new BitStore({ initialValues: { list: ["A", "B", "C"] } });
      store.triggerValidation = vi.fn();

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

      expect(store.config.masks!["custom"]).toBeDefined();
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
      const store = new BitStore({ initialValues: { username: "" } });

      let resolveApi: (msg: string | null) => void;
      const mockApi = vi.fn().mockImplementation(() => {
        return new Promise((resolve) => {
          resolveApi = resolve;
        });
      });

      store.registerField("username", {
        validation: {
          asyncValidate: mockApi,
          asyncValidateDelay: 500,
        },
      });

      store.setField("username", "lea");
      await vi.advanceTimersByTimeAsync(300);

      store.setField("username", "leandro");

      expect(mockApi).not.toHaveBeenCalled();
      expect(store.isFieldValidating("username")).toBe(true);

      await vi.advanceTimersByTimeAsync(500);

      expect(mockApi).toHaveBeenCalledTimes(1);
      expect(mockApi).toHaveBeenCalledWith("leandro", { username: "leandro" });

      expect(store.isFieldValidating("username")).toBe(true);

      resolveApi!("Username já existe");
      await vi.advanceTimersByTimeAsync(1);

      expect(store.isFieldValidating("username")).toBe(false);
      expect(store.getState().errors.username).toBe("Username já existe");
    });

    it("deve bloquear submit enquanto houver validação assíncrona pendente", async () => {
      const store = new BitStore({ initialValues: { username: "" } });

      let resolveApi: (msg: string | null) => void;
      const mockApi = vi.fn().mockImplementation(() => {
        return new Promise((resolve) => {
          resolveApi = resolve;
        });
      });

      const onSuccess = vi.fn();

      store.registerField("username", {
        validation: {
          asyncValidate: mockApi,
          asyncValidateDelay: 500,
        },
      });

      store.setField("username", "leandro");

      await store.submit(onSuccess);
      expect(onSuccess).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(500);
      expect(store.isFieldValidating("username")).toBe(true);

      resolveApi!(null);
      await vi.advanceTimersByTimeAsync(1);

      await store.submit(onSuccess);
      expect(onSuccess).toHaveBeenCalledTimes(1);
    });

    it("deve evitar Race Conditions ignorando respostas de requisições antigas", async () => {
      const store = new BitStore({ initialValues: { email: "" } });

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

      store.registerField("email", {
        validation: {
          asyncValidate: mockApi,
          asyncValidateDelay: 100,
        },
      });

      store.setField("email", "dev@");
      await vi.advanceTimersByTimeAsync(100);

      store.setField("email", "dev@bitform.com");
      await vi.advanceTimersByTimeAsync(100);

      resolveSecondReq!(null);
      await vi.advanceTimersByTimeAsync(1);
      expect(store.getState().errors.email).toBeUndefined();

      resolveFirstReq!("Email inválido");
      await vi.advanceTimersByTimeAsync(1);

      expect(store.getState().errors.email).toBeUndefined();
      expect(store.isFieldValidating("email")).toBe(false);
    });

    it("deve fazer o MERGE perfeito entre erros Síncronos (Zod) e Assíncronos (API)", async () => {
      const mockResolver = vi.fn().mockResolvedValue({
        password: "Senha fraca",
      });

      const store = new BitStore({
        initialValues: { username: "leandro", password: "" },
        validation: { resolver: mockResolver, delay: 0 },
      });

      store.registerField("username", {
        validation: {
          asyncValidate: async () => "API: Username ocupado",
          asyncValidateDelay: 0,
        },
      });

      store.setField("username", "leandro");
      await vi.advanceTimersByTimeAsync(10);

      expect(store.getState().errors.username).toBe("API: Username ocupado");

      store.setField("password", "123");
      await vi.advanceTimersByTimeAsync(10);

      expect(store.getState().errors).toEqual({
        username: "API: Username ocupado",
        password: "Senha fraca",
      });
    });

    it("deve manter erro do resolver quando asyncValidate passa (não limpar erro Zod)", async () => {
      const store = new BitStore({
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

      store.registerField("email", {
        validation: {
          asyncValidate: async () => null,
          asyncValidateDelay: 0,
        },
      });

      store.setField("email", "invalido");
      store.blurField("email");
      await vi.advanceTimersByTimeAsync(50);
      expect(store.getState().errors.email).toBe("E-mail inválido");

      await vi.advanceTimersByTimeAsync(50);
      expect(store.getState().errors.email).toBe("E-mail inválido");
    });

    it("deve limpar a memória do erro Assíncrono se o campo for ocultado (showIf)", async () => {
      const store = new BitStore({
        initialValues: { hasCnpj: true, cnpj: "111" },
      });

      store.registerField("cnpj", {
        conditional: {
          dependsOn: ["hasCnpj"],
          showIf: (v) => v.hasCnpj,
        },
        validation: {
          asyncValidate: async () => "API: CNPJ Inválido",
          asyncValidateDelay: 0,
        },
      });

      store.setField("cnpj", "111");
      await vi.advanceTimersByTimeAsync(10);
      expect(store.getState().errors.cnpj).toBe("API: CNPJ Inválido");

      store.setField("hasCnpj", false);
      await vi.advanceTimersByTimeAsync(10);

      expect(store.getState().errors.cnpj).toBeUndefined();

      store.setField("hasCnpj", true);
      await store.validate({ scopeFields: ["cnpj"] });

      expect(store.getState().errors.cnpj).toBeUndefined();
    });
  });

  describe("Plugin Lifecycle", () => {
    it("should run plugin setup on init and teardown on cleanup", () => {
      const teardown = vi.fn();
      const setup = vi.fn(() => teardown);

      const store = new BitStore({
        initialValues: { name: "" },
        plugins: [{ name: "setup-plugin", setup }],
      });

      expect(setup).toHaveBeenCalledTimes(1);
      store.cleanup();
      expect(teardown).toHaveBeenCalledTimes(1);
    });

    it("should trigger beforeValidate and afterValidate in order", async () => {
      const calls: string[] = [];

      const store = new BitStore({
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

      await store.validate();

      expect(calls).toEqual(["beforeValidate", "afterValidate"]);
      store.cleanup();
    });

    it("should trigger beforeSubmit and afterSubmit around successful submit", async () => {
      const calls: string[] = [];

      const store = new BitStore({
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

      await store.submit(async () => {
        calls.push("onSuccess");
      });

      expect(calls).toEqual(["beforeSubmit", "onSuccess", "afterSubmit"]);
      store.cleanup();
    });

    it("should emit onFieldChange for setField, rebase and array operations", async () => {
      const changes: Array<{
        origin: string;
        operation?: string;
        path: string;
      }> = [];

      const store = new BitStore({
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

      store.setField("name", "Leo");
      store.setValues({ name: "Leandro", items: ["A"] });
      store.pushItem("items", "B");

      expect(changes.some((event) => event.origin === "setField")).toBe(true);
      expect(changes.some((event) => event.origin === "rebase")).toBe(true);
      expect(
        changes.some(
          (event) => event.origin === "array" && event.operation === "push",
        ),
      ).toBe(true);

      store.cleanup();
    });

    it("should be fail-open when plugin throws and report via onError", async () => {
      const onError = vi.fn();

      const store = new BitStore({
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

      const result = await store.validate();

      expect(result).toBe(true);
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          source: "beforeValidate",
          pluginName: "broken-plugin",
        }),
        expect.any(Object),
      );

      store.cleanup();
    });

    it("should report submit callback errors through onError and afterSubmit", async () => {
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => undefined);
      const onError = vi.fn();
      const afterSubmit = vi.fn();

      const store = new BitStore({
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

      await store.submit(async () => {
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
      store.cleanup();
    });
  });
});
