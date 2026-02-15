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
      global: {
        provide: {
          [BIT_STORE_KEY as any]: store,
        },
      },
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

  it("should apply masks and handle displayValue vs raw value", async () => {
    const store = new BitStore({
      initialValues: { salary: 10 },
    });

    const wrapper = createWrapper(store, () => ({
      salary: useBitField("salary", { mask: "brl" }),
    }));

    expect(wrapper.vm.salary.displayValue.value).toBe("R$ 10,00");

    wrapper.vm.salary.setValue("R$ 2.500,50");
    await nextTick();

    expect(wrapper.vm.salary.displayValue.value).toBe("R$ 2.500,50");
    expect(store.getState().values.salary).toBe(2500.5);
  });

  it("should react to advanced array manipulations with stable keys", async () => {
    const store = new BitStore({
      initialValues: { tags: ["A", "B", "C"] },
    });

    const wrapper = createWrapper(store, () => ({
      list: useBitFieldArray("tags"),
      form: useBitForm(),
    }));

    const initialKey = wrapper.vm.list.fields.value[0].key;

    wrapper.vm.list.swap(0, 2);
    await nextTick();

    expect(wrapper.vm.form.getValues().tags).toEqual(["C", "B", "A"]);
    expect(wrapper.vm.list.fields.value[2].key).toBe(initialKey);
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
    expect(wrapper.vm.form.isSubmitting.value).toBe(false);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("should reset form to initial values", async () => {
    const store = new BitStore({ initialValues: { count: 0 } });
    const wrapper = createWrapper(store, () => ({ form: useBitForm() }));

    store.setField("count", 10);
    await nextTick();

    wrapper.vm.form.reset();
    await nextTick();

    expect(wrapper.vm.form.getValues().count).toBe(0);
    expect(wrapper.vm.form.isDirty.value).toBe(false);
  });
});
