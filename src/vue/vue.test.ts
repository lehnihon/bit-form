import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import { defineComponent } from 'vue';
import { BitFormStore } from '../core/bit-store';
import { useBitField } from './index';

// Componente de teste (simulando um SFC)
const TestComponent = defineComponent({
  props: ['store'],
  setup(props) {
    const nameField = useBitField(props.store, 'name');
    return { nameField };
  },
  template: `
    <div>
      <input 
        id="name-input"
        :value="nameField.value" 
        @input="nameField.setValue($event.target.value)"
        @blur="nameField.onBlur"
      />
      <span v-if="nameField.error" id="error-msg">{{ nameField.error }}</span>
    </div>
  `
});

describe('Vue Adapter', () => {
  it('deve reagir a mudanças na store', async () => {
    const store = new BitFormStore({ name: 'Bit' });
    const wrapper = mount(TestComponent, { props: { store } });

    const input = wrapper.find('#name-input');
    expect((input.element as HTMLInputElement).value).toBe('Bit');

    await input.setValue('Vue Power');
    expect(store.getState().name).toBe('Vue Power');
  });

  it('deve limpar a subscrição ao desmontar', () => {
    const store = new BitFormStore({ name: 'Bit' });
    const wrapper = mount(TestComponent, { props: { store } });
    
    // @ts-ignore - acessando listeners privados para teste
    const initialListeners = store.listeners.size;
    expect(initialListeners).toBe(1);

    wrapper.unmount();
    
    // @ts-ignore
    expect(store.listeners.size).toBe(0);
  });
});