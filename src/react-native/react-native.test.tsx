/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { BitStore } from '../core';
// Importamos explicitamente do entry point native
import { BitFormProvider, useBitField } from './index';

describe('React Native Integration (bit-form/react-native)', () => {
  
  const createTestStore = (initialValues: any) => new BitStore({
    initialValues,
    validationDelay: 0 
  });

  const wrapper = ({ children, store }: any) => (
    <BitFormProvider store={store}>{children}</BitFormProvider>
  );

  it('deve retornar props específicas para React Native (onChangeText)', () => {
    const store = createTestStore({ name: 'Leandro' });
    const { result } = renderHook(() => useBitField('name'), {
      wrapper: (props) => wrapper({ ...props, store })
    });

    // No Native, não deve existir 'onChange', apenas 'onChangeText'
    expect((result.current.props as any).onChange).toBeUndefined();
    expect(result.current.props.onChangeText).toBeDefined();
    expect(typeof result.current.props.onChangeText).toBe('function');
  });

  it('deve garantir que o value seja SEMPRE uma string (requisito do TextInput)', () => {
    const store = createTestStore({ age: 25, price: null, active: undefined });
    
    const { result: ageField } = renderHook(() => useBitField('age'), {
      wrapper: (props) => wrapper({ ...props, store })
    });
    const { result: priceField } = renderHook(() => useBitField('price'), {
      wrapper: (props) => wrapper({ ...props, store })
    });

    // Mesmo sendo number na store, deve ser string nas props
    expect(ageField.current.props.value).toBe('25');
    expect(typeof ageField.current.props.value).toBe('string');

    // Nulos ou undefined devem virar string vazia para evitar crash no Native
    expect(priceField.current.props.value).toBe('');
  });

  it('deve atualizar a store corretamente via onChangeText', async () => {
    const store = createTestStore({ bio: '' });
    const { result } = renderHook(() => useBitField('bio'), {
      wrapper: (props) => wrapper({ ...props, store })
    });

    await act(async () => {
      // Simula o comportamento do TextInput enviando apenas a string
      result.current.props.onChangeText('Desenvolvedor BitForm');
    });

    expect(result.current.value).toBe('Desenvolvedor BitForm');
    expect(store.getState().values.bio).toBe('Desenvolvedor BitForm');
  });

  it('deve disparar onBlur corretamente no mobile', async () => {
    const store = createTestStore({ email: '' });
    const { result } = renderHook(() => useBitField('email'), {
      wrapper: (props) => wrapper({ ...props, store })
    });

    expect(result.current.touched).toBe(false);

    await act(async () => {
      result.current.props.onBlur();
    });

    expect(result.current.touched).toBe(true);
  });
});