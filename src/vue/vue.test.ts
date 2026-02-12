import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { defineComponent, nextTick } from "vue";
import { BitStore } from "../core/bit-store";
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
    wrapper.vm.field.value.value = "Leandro";
    await nextTick();

    expect(wrapper.vm.form.values.value.user.info.name).toBe("Leandro");
    expect(wrapper.vm.form.isDirty.value).toBe(true);
  });

  it("should react to advanced array manipulations (move/swap)", async () => {
    const store = new BitStore({
      initialValues: { tags: ["A", "B", "C"] },
    });

    const wrapper = createWrapper(store, () => ({
      list: useBitFieldArray("tags"),
      form: useBitForm(),
    }));

    wrapper.vm.list.swap(0, 2);
    await nextTick();
    expect(wrapper.vm.form.values.value.tags).toEqual(["C", "B", "A"]);
  });

  it("should track isSubmitting and validation debounce", async () => {
    const store = new BitStore({
      initialValues: { email: "" },
      validationDelay: 0,
      resolver: (vals) => (!vals.email ? { email: "Erro" } : {}),
    });

    const onSubmit = vi.fn();
    const wrapper = createWrapper(store, () => ({ form: useBitForm() }));

    await wrapper.vm.form.submit(onSubmit)();
    expect(wrapper.vm.form.isValid.value).toBe(false);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("should reset form to initial values", async () => {
    const store = new BitStore({ initialValues: { count: 0 } });
    const wrapper = createWrapper(store, () => ({ form: useBitForm() }));

    store.setField("count", 10);
    await nextTick();
    wrapper.vm.form.reset();
    await nextTick();
    expect(wrapper.vm.form.values.value.count).toBe(0);
    expect(wrapper.vm.form.isDirty.value).toBe(false);
  });
});
