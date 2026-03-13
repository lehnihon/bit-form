import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { defineComponent, nextTick } from "vue";
import { BitStore } from "../../../core/store";
import {
  useBitField,
  useBitForm,
  useBitArray,
  useBitHistory,
  useBitScope,
  useBitSteps,
  useBitPersist,
} from "bit-form/vue";
import { BIT_STORE_KEY } from "../../../vue/context";

describe("Vue Integration", () => {
  const createWrapper = (store: BitStore<any>, setupFn: () => any) => {
    const TestComponent = defineComponent({
      setup() {
        return setupFn();
      },
      template: "<div></div>",
    });

    return mount(TestComponent, {
      global: { provide: { [BIT_STORE_KEY as any]: store } },
    });
  };

  it("should handle deep nested updates and isDirty state", async () => {
    const store = new BitStore({
      initialValues: { user: { info: { name: "Leo" } } },
    });

    const wrapper = createWrapper(store, () => ({
      field: useBitField("user.info.name"),
      form: useBitForm(),
    }));

    expect(wrapper.vm.form.meta.isDirty.value).toBe(false);

    wrapper.vm.field.setValue("Leandro");
    await nextTick();

    expect(wrapper.vm.form.getValues().user.info.name).toBe("Leandro");
    expect(wrapper.vm.form.meta.isDirty.value).toBe(true);
  });

  it("should react to isHidden and isRequired changes", async () => {
    const store = new BitStore({ initialValues: { type: "PF", cnpj: "" } });
    store.registerField("cnpj", {
      conditional: {
        dependsOn: ["type"],
        showIf: (v: any) => v.type === "PJ",
        requiredIf: (v: any) => v.type === "PJ",
      },
    });

    const wrapper = createWrapper(store, () => ({
      type: useBitField("type"),
      cnpj: useBitField("cnpj"),
    }));

    expect(wrapper.vm.cnpj.meta.isHidden.value).toBe(true);

    wrapper.vm.type.setValue("PJ");
    await nextTick();

    expect(wrapper.vm.cnpj.meta.isHidden.value).toBe(false);
  });

  it("should call unregisterField on unmount", async () => {
    const store = new BitStore({ initialValues: { name: "" } });
    const spy = vi.spyOn(store, "unregisterField");

    const wrapper = createWrapper(store, () => ({
      field: useBitField("name"),
    }));
    wrapper.unmount();
    expect(spy).toHaveBeenCalledWith("name");
  });

  it("should apply masks and handle displayValue vs raw value", async () => {
    const store = new BitStore({
      initialValues: { salary: 10 },
      fields: { salary: { mask: "brl" } },
    });
    const wrapper = createWrapper(store, () => ({
      salary: useBitField("salary"),
    }));

    expect(wrapper.vm.salary.displayValue.value).toBe("R$ 10,00");

    wrapper.vm.salary.setValue("R$ 2.500,50");
    await nextTick();

    expect(store.getState().values.salary).toBe(2500.5);
  });

  it("should shift errors and keep stable keys in arrays", async () => {
    const store = new BitStore({ initialValues: { tags: ["A", "B", "C"] } });
    store.triggerValidation = vi.fn();

    const wrapper = createWrapper(store, () => ({
      list: useBitArray("tags"),
      form: useBitForm(),
    }));

    store.setError("tags.2", "Error on C");
    const initialKeyC = wrapper.vm.list.fields.value[2].key;

    wrapper.vm.list.remove(1);
    await nextTick();

    expect(wrapper.vm.form.getValues().tags).toEqual(["A", "C"]);
    expect(store.getState().errors["tags.1"]).toBe("Error on C");
    expect(wrapper.vm.list.fields.value[1].key).toBe(initialKeyC);
  });

  it("should swap items and their respective errors", async () => {
    const store = new BitStore({ initialValues: { tags: ["A", "B"] } });
    store.triggerValidation = vi.fn();

    const wrapper = createWrapper(store, () => ({
      list: useBitArray("tags"),
    }));

    store.setError("tags.0", "Error on A");
    wrapper.vm.list.swap(0, 1);
    await nextTick();

    expect(store.getState().values.tags).toEqual(["B", "A"]);
    expect(store.getState().errors["tags.1"]).toBe("Error on A");
  });

  it("should call unregisterPrefix on array unmount", async () => {
    const store = new BitStore({ initialValues: { tags: [] } });
    const spy = vi.spyOn(store, "unregisterPrefix");

    const wrapper = createWrapper(store, () => ({
      list: useBitArray("tags"),
    }));
    wrapper.unmount();
    expect(spy).toHaveBeenCalledWith("tags.");
  });

  it("should track isSubmitting and validation state", async () => {
    const store = new BitStore({
      initialValues: { email: "" },
      validation: {
        delay: 0,
        resolver: (vals: any) => (!vals.email ? { email: "Erro" } : {}),
      },
    });

    const onSubmit = vi.fn();
    const wrapper = createWrapper(store, () => ({ form: useBitForm() }));

    const submitFn = wrapper.vm.form.submit(onSubmit);
    const promise = submitFn();
    expect(wrapper.vm.form.meta.isSubmitting.value).toBe(true);

    await promise;
    expect(wrapper.vm.form.meta.isValid.value).toBe(false);
  });

  it("should reset form to initial values", async () => {
    const store = new BitStore({ initialValues: { count: 0 } });
    const wrapper = createWrapper(store, () => ({ form: useBitForm() }));

    store.setField("count", 10);
    await nextTick();

    wrapper.vm.form.reset();
    await nextTick();

    expect(wrapper.vm.form.getValues().count).toBe(0);
  });

  it("should expose undo/redo and metadata through useBitHistory", async () => {
    const store = new BitStore({
      initialValues: { name: "Leo" },
      history: { enabled: true },
    });

    const wrapper = createWrapper(store, () => ({
      field: useBitField("name"),
      history: useBitHistory(),
    }));

    expect(wrapper.vm.history.historySize.value).toBe(1);
    expect(wrapper.vm.history.historyIndex.value).toBe(0);
    expect(wrapper.vm.history.canUndo.value).toBe(false);

    wrapper.vm.field.setValue("Leandro");
    await nextTick();
    wrapper.vm.field.setBlur();
    await nextTick();

    expect(wrapper.vm.history.canUndo.value).toBe(true);
    expect(wrapper.vm.history.historySize.value).toBe(2);

    wrapper.vm.history.undo();
    await nextTick();

    expect(store.getState().values.name).toBe("Leo");
    expect(wrapper.vm.history.canRedo.value).toBe(true);
  });

  it("should not expose registerMask on useBitForm", () => {
    const store = new BitStore({ initialValues: { name: "" } });
    const wrapper = createWrapper(store, () => ({ form: useBitForm() }));

    expect("registerMask" in wrapper.vm.form).toBe(false);
  });

  it("should expose getDirtyValues and return only changed values", async () => {
    const store = new BitStore({ initialValues: { name: "Leo", age: 30 } });
    const wrapper = createWrapper(store, () => ({ form: useBitForm() }));

    expect(wrapper.vm.form.getDirtyValues()).toEqual({});

    store.setField("name", "Leandro");
    await nextTick();

    expect(wrapper.vm.form.getDirtyValues()).toEqual({ name: "Leandro" });
  });

  it("should pass dirtyValues as second parameter in submit", async () => {
    const store = new BitStore({ initialValues: { name: "Leo", age: 30 } });
    const submitHandler = vi.fn();
    const wrapper = createWrapper(store, () => ({ form: useBitForm() }));

    store.setField("name", "Updated");
    await nextTick();

    const submitFn = wrapper.vm.form.submit(submitHandler);
    await submitFn();

    expect(submitHandler).toHaveBeenCalled();
    const [values, dirtyValues] = submitHandler.mock.calls[0];
    expect(values.name).toBe("Updated");
    expect(dirtyValues).toEqual({ name: "Updated" });
  });

  it("should pass dirtyValues as second parameter in onSubmit", async () => {
    const store = new BitStore({ initialValues: { email: "old@test.com" } });
    const apiHandler = vi.fn().mockResolvedValue({ success: true });
    const wrapper = createWrapper(store, () => ({ form: useBitForm() }));

    store.setField("email", "new@test.com");
    await nextTick();

    const submitFn = wrapper.vm.form.onSubmit(apiHandler);
    await submitFn();

    expect(apiHandler).toHaveBeenCalled();
    const [values, dirtyValues] = apiHandler.mock.calls[0];
    expect(values.email).toBe("new@test.com");
    expect(dirtyValues).toEqual({ email: "new@test.com" });
  });

  it("should track scope status with useBitScope", async () => {
    const store = new BitStore({
      initialValues: { name: "", email: "" },
      fields: {
        name: { scope: "step1" },
        email: { scope: "step1" },
      },
    });

    const wrapper = createWrapper(store, () => ({
      step: useBitScope("step1"),
    }));

    expect(wrapper.vm.step.status.value.hasErrors).toBe(false);
    expect(wrapper.vm.step.status.value.isDirty).toBe(false);

    store.setField("name", "Leo");
    await nextTick();

    expect(wrapper.vm.step.status.value.isDirty).toBe(true);
    expect(wrapper.vm.step.isDirty.value).toBe(true);

    store.setError("name", "Erro");
    await nextTick();

    expect(wrapper.vm.step.status.value.hasErrors).toBe(true);
    expect(wrapper.vm.step.status.value.errors.name).toBe("Erro");
    expect(wrapper.vm.step.isValid.value).toBe(false);
  });

  it("should navigate steps with useBitSteps", async () => {
    const store = new BitStore({
      initialValues: { name: "", email: "" },
      fields: {
        name: { scope: "step1" },
        email: { scope: "step2" },
      },
      validation: { delay: 0 },
    });

    const wrapper = createWrapper(store, () => ({
      steps: useBitSteps(["step1", "step2"]),
    }));

    expect(wrapper.vm.steps.step.value).toBe(1);
    expect(wrapper.vm.steps.scope.value).toBe("step1");

    store.setField("name", "Leo");
    await nextTick();

    const advanced = await wrapper.vm.steps.next();
    expect(advanced).toBe(true);
    expect(wrapper.vm.steps.step.value).toBe(2);
    expect(wrapper.vm.steps.scope.value).toBe("step2");

    wrapper.vm.steps.prev();
    await nextTick();

    expect(wrapper.vm.steps.step.value).toBe(1);
  });

  describe("useBitPersist", () => {
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

    it("deve expor restore, save, clear e meta reativos", async () => {
      const storage = createMockStorage();
      const store = new BitStore({
        initialValues: { name: "Leo" },
        persist: { enabled: true, key: "vue-test", storage, autoSave: false },
      });

      const wrapper = createWrapper(store, () => ({
        persist: useBitPersist(),
      }));

      expect(typeof wrapper.vm.persist.save).toBe("function");
      expect(typeof wrapper.vm.persist.restore).toBe("function");
      expect(typeof wrapper.vm.persist.clear).toBe("function");
      expect(wrapper.vm.persist.meta.isSaving.value).toBe(false);
      expect(wrapper.vm.persist.meta.isRestoring.value).toBe(false);
      expect(wrapper.vm.persist.meta.error.value).toBeNull();
      store.cleanup();
    });

    it("deve salvar e restaurar valores", async () => {
      const storage = createMockStorage();
      const store = new BitStore({
        initialValues: { name: "Leo" },
        persist: { enabled: true, key: "vue-test", storage, autoSave: false },
      });

      const wrapper = createWrapper(store, () => ({
        persist: useBitPersist(),
      }));

      await wrapper.vm.persist.save();
      expect(storage.setItem).toHaveBeenCalled();

      store.setField("name", "Changed");
      const ok = await wrapper.vm.persist.restore();
      expect(ok).toBe(true);
      expect(store.getState().values.name).toBe("Leo");
      store.cleanup();
    });
  });
});
