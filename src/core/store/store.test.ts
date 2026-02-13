import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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

      store.setField("name", "Leo"); // Volta ao original
      expect(store.getState().isDirty).toBe(false);
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
      // Verifica se carregou máscaras comuns como BRL e CPF
      expect(store.masks).toHaveProperty("brl");
      expect(store.masks).toHaveProperty("cpf");
      expect(store.masks.brl).toBeDefined();
    });

    it("should allow registering new masks dynamically", () => {
      const store = new BitStore({ initialValues: {} });
      const customMask = {
        format: (v: any) => `X-${v}`,
        parse: (v: string) => v,
      };

      store.registerMask("custom", customMask);

      expect(store.masks).toHaveProperty("custom");
      expect(store.masks.custom.format("test")).toBe("X-test");
    });

    it("should allow overriding initial masks via config", () => {
      const myMask = { format: () => "", parse: () => "" };
      const store = new BitStore({
        initialValues: {},
        masks: { only_mine: myMask },
      });

      // Se passou masks no config, ele DEVE respeitar o que foi passado (ou mergear, dependendo da sua lógica final.
      // No código atual: this.masks = config.masks ?? bitMasks; -> Ou usa um ou usa outro)
      expect(store.masks).toHaveProperty("only_mine");
      // Se a lógica for substituir:
      expect(store.masks).not.toHaveProperty("brl");
    });
  });

  describe("Validation & Errors", () => {
    it("should handle manual error setting with setError and setErrors", () => {
      const store = new BitStore({ initialValues: { email: "" } });

      store.setError("email", "Invalid email");
      expect(store.getState().errors.email).toBe("Invalid email");
      expect(store.isValid).toBe(false);

      store.setErrors({ password: "Too short", phone: "Invalid" });
      expect(store.getState().errors.password).toBe("Too short");
      expect(store.getState().errors.phone).toBe("Invalid");
    });

    it("should mark all fields as touched if submit fails validation", async () => {
      const store = new BitStore({
        initialValues: { name: "" },
        resolver: (vals) => (!vals.name ? { name: "Required" } : {}),
      });

      await store.submit(vi.fn());

      expect(store.getState().touched.name).toBe(true);
      expect(store.isValid).toBe(false);
    });
  });

  describe("Form Lifecycle (Edit, Reset, Submit)", () => {
    it("should hydrate state using setValues for edit mode", () => {
      const store = new BitStore({
        initialValues: { name: "", id: null as number | null },
      });

      store.setValues({ name: "Leandro", id: 1 });

      const state = store.getState();
      expect(state.values.name).toBe("Leandro");
      expect(state.isDirty).toBe(false); // Novo ponto zero para edição
      expect(state.touched).toEqual({});
    });

    it("should reset to current initialValues", () => {
      const store = new BitStore({ initialValues: { theme: "light" } });

      store.setField("theme", "dark");
      expect(store.getState().isDirty).toBe(true);

      store.reset();
      expect(store.getState().values.theme).toBe("light");
      expect(store.getState().isDirty).toBe(false);
    });

    it("should apply transformations and handle isSubmitting during submit", async () => {
      const store = new BitStore({
        initialValues: { age: "25" },
        transform: { age: (v) => Number(v) },
      });

      const onSubmit = vi.fn();
      const submitPromise = store.submit(onSubmit);

      expect(store.isSubmitting).toBe(true);
      await submitPromise;

      expect(onSubmit).toHaveBeenCalledWith({ age: 25 });
      expect(store.isSubmitting).toBe(false);
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

    it("should insert items at a specific index", () => {
      const store = new BitStore({ initialValues: { list: [1, 3] } });
      store.insertItem("list", 1, 2);
      expect(store.getState().values.list).toEqual([1, 2, 3]);
    });

    it("should swap and move items correctly", () => {
      const store = new BitStore({ initialValues: { list: ["a", "b", "c"] } });

      store.swapItems("list", 0, 2);
      expect(store.getState().values.list).toEqual(["c", "b", "a"]);

      store.moveItem("list", 2, 0);
      expect(store.getState().values.list).toEqual(["a", "c", "b"]);
    });

    it("should clean up errors and touched state when an item is removed", () => {
      const store = new BitStore({
        initialValues: { list: ["item1", "item2"] },
      });

      store.setError("list.1", "Error in item 2");
      store.blurField("list.1");

      expect(store.getState().errors["list.1"]).toBe("Error in item 2");
      expect(store.getState().touched["list.1"]).toBe(true);

      store.removeItem("list", 1);

      expect(store.getState().values.list).toEqual(["item1"]);
      expect(store.getState().errors["list.1"]).toBeUndefined();
      expect(store.getState().touched["list.1"]).toBeUndefined();
    });

    it("should handle array operations in nested paths", () => {
      const store = new BitStore({
        initialValues: { user: { skills: ["React"] } },
      });
      store.pushItem("user.skills", "Vue");
      expect(store.getState().values.user.skills).toEqual(["React", "Vue"]);
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

      store.setField("name", "L");
      store.setField("name", "Le");
      store.setField("name", "Leo");

      // Não deve ter chamado ainda
      expect(resolver).not.toHaveBeenCalled();

      // Avança o tempo
      vi.advanceTimersByTime(500);

      // Deve ter chamado APENAS UMA VEZ após o delay
      expect(resolver).toHaveBeenCalledTimes(1);
      expect(store.getState().values.name).toBe("Leo");
    });

    it("should watch for specific field changes", () => {
      const store = new BitStore({ initialValues: { name: "Leo", age: 30 } });
      const nameWatcher = vi.fn();

      // Monitora apenas 'name'
      const unsubscribe = store.watch("name", nameWatcher);

      store.setField("age", 31);
      expect(nameWatcher).not.toHaveBeenCalled(); // Mudou age, não name

      store.setField("name", "Leandro");
      expect(nameWatcher).toHaveBeenCalledWith("Leandro");
      expect(nameWatcher).toHaveBeenCalledTimes(1);

      unsubscribe();
      store.setField("name", "Leonardo");
      expect(nameWatcher).toHaveBeenCalledTimes(1); // Não chama mais após unsubscribe
    });

    it("should watch nested fields", () => {
      const store = new BitStore({
        initialValues: { config: { active: false } },
      });
      const watcher = vi.fn();

      store.watch("config.active", watcher);

      store.setField("config.active", true);
      expect(watcher).toHaveBeenCalledWith(true);
    });
  });
});
