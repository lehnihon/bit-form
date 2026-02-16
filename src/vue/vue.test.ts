import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { defineComponent, nextTick } from "vue";
import { BitStore } from "../core";
import { useBitField, useBitForm, useBitFieldArray } from "./index";
import { BIT_STORE_KEY } from "./context";

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

    expect(wrapper.vm.form.isDirty.value).toBe(false);

    wrapper.vm.field.setValue("Leandro");
    await nextTick();

    expect(wrapper.vm.form.getValues().user.info.name).toBe("Leandro");
    expect(wrapper.vm.form.isDirty.value).toBe(true);
  });

  it("should react to isHidden and isRequired changes", async () => {
    const store = new BitStore({ initialValues: { type: "PF", cnpj: "" } });
    store.registerConfig("cnpj", {
      dependsOn: ["type"],
      showIf: (v: any) => v.type === "PJ",
      requiredIf: (v: any) => v.type === "PJ",
    });

    const wrapper = createWrapper(store, () => ({
      type: useBitField("type"),
      cnpj: useBitField("cnpj"),
    }));

    expect(wrapper.vm.cnpj.isHidden.value).toBe(true);

    wrapper.vm.type.setValue("PJ");
    await nextTick();

    expect(wrapper.vm.cnpj.isHidden.value).toBe(false);
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
    const store = new BitStore({ initialValues: { salary: 10 } });
    const wrapper = createWrapper(store, () => ({
      salary: useBitField("salary", undefined, { mask: "brl" }),
    }));

    expect(wrapper.vm.salary.displayValue.value).toBe("R$ 10,00");

    wrapper.vm.salary.setValue("R$ 2.500,50");
    await nextTick();

    expect(store.getState().values.salary).toBe(2500.5);
  });

  it("should shift errors and keep stable keys in arrays", async () => {
    const store = new BitStore({ initialValues: { tags: ["A", "B", "C"] } });
    (store as any).validate = vi.fn();
    (store as any).triggerValidation = vi.fn();

    const wrapper = createWrapper(store, () => ({
      list: useBitFieldArray("tags"),
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
    (store as any).validate = vi.fn();
    (store as any).triggerValidation = vi.fn();

    const wrapper = createWrapper(store, () => ({
      list: useBitFieldArray("tags"),
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
      list: useBitFieldArray("tags"),
    }));
    wrapper.unmount();
    expect(spy).toHaveBeenCalledWith("tags.");
  });

  it("should track isSubmitting and validation state", async () => {
    const store = new BitStore({
      initialValues: { email: "" },
      validationDelay: 0,
      resolver: (vals: any) => (!vals.email ? { email: "Erro" } : {}),
    });

    const onSubmit = vi.fn();
    const wrapper = createWrapper(store, () => ({ form: useBitForm() }));

    const submitFn = wrapper.vm.form.submit(onSubmit);
    const promise = submitFn();
    expect(wrapper.vm.form.isSubmitting.value).toBe(true);

    await promise;
    expect(wrapper.vm.form.isValid.value).toBe(false);
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
});
