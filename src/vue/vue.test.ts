import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { defineComponent, nextTick } from 'vue';
import { BitStore } from '../core/bit-store';
import { useBitField, useBitForm } from './index';
import { unmask } from '../core/mask-utils';

describe('Vue Integration', () => {
  
  it('should handle deep nested updates and unmasked submission', async () => {
    const store = new BitStore({
      initialValues: { 
        user: { info: { phone: '(11) 9999-9999' } } 
      },
      transform: { 
        'user.info.phone': unmask 
      }
    });

    const TestComponent = defineComponent({
      setup() {
        // Desestruturamos para 'phone' para ficar mais limpo
        const { value: phone, blur } = useBitField(store, 'user.info.phone');
        const form = useBitForm(store);
        return { phone, form, blur };
      },
      template: '<div></div>'
    });

    const wrapper = mount(TestComponent);
    
    // Tipagem do mock para evitar erro de unknown
    const onSubmit = vi.fn((_values: any): void => {});

    // No Vue Test Utils, propriedades do setup são acessadas diretamente.
    // Como 'phone' é uma Ref no setup, no script do teste usamos .value
    (wrapper.vm.phone as any) = '(22) 8888-8888'; 
    
    // Se o TS ainda reclamar, use a forma explícita de Ref:
    // wrapper.vm.phone = '(22) 8888-8888' as any;

    await nextTick();

    // Executa o submit (chamando o handler retornado)
    await wrapper.vm.form.submit(onSubmit)();

    expect(onSubmit).toHaveBeenCalledWith({ 
      user: { info: { phone: '2288888888' } } 
    });
  });

  it('should react to array manipulations (push/remove)', async () => {
    const store = new BitStore({
      initialValues: { tags: ['Vue'] }
    });

    const TestComponent = defineComponent({
      setup() {
        const form = useBitForm(store);
        return { form };
      },
      template: '<div></div>'
    });

    const wrapper = mount(TestComponent);

    wrapper.vm.form.pushItem('tags', 'Vitest');
    await nextTick();
    // Acessamos .value pois 'values' é uma computed retornada pelo hook
    expect(wrapper.vm.form.values.value.tags).toEqual(['Vue', 'Vitest']);

    wrapper.vm.form.removeItem('tags', 0);
    await nextTick();
    expect(wrapper.vm.form.values.value.tags).toEqual(['Vitest']);
  });

  it('should track isSubmitting state during async submission', async () => {
    const store = new BitStore({ initialValues: {} });
    
    const onSubmit = vi.fn((_v: any): Promise<void> => 
      new Promise(resolve => setTimeout(resolve, 50))
    );

    const TestComponent = defineComponent({
      setup() {
        const form = useBitForm(store);
        return { form };
      },
      template: '<div></div>'
    });

    const wrapper = mount(TestComponent);
    
    const submission = wrapper.vm.form.submit(onSubmit)();
    
    // .value é necessário para ler a computed 'isSubmitting'
    expect(wrapper.vm.form.isSubmitting.value).toBe(true);

    await submission;
    expect(wrapper.vm.form.isSubmitting.value).toBe(false);
  });
});