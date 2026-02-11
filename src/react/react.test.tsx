import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { BitStore } from '../core/bit-store';
import { useBitField, useBitForm } from './index';
import { unmaskCurrency } from '../core/mask-utils';

describe('React Integration', () => {
  
  it('should handle deep nested objects and transformations', async () => {
    const store = new BitStore({
      initialValues: { 
        user: { profile: { name: 'leo', salary: 'R$ 1.000,00' } } 
      },
      transform: { 
        'user.profile.salary': unmaskCurrency,
        'user.profile.name': (v: string) => v.toUpperCase()
      }
    });

    const { result: field } = renderHook(() => useBitField(store, 'user.profile.name'));
    const { result: form } = renderHook(() => useBitForm(store));
    const onSubmit = vi.fn();

    expect(field.current.value).toBe('leo');

    // O segredo: await act + await store.validate() para garantir que o ciclo feche
    await act(async () => {
      field.current.setValue('leonardo');
      await store.validate(); // Força o act a esperar a validação interna
    });

    await act(async () => {
      const handler = form.current.submit(onSubmit);
      await handler(); // Aguarda a execução completa do submit
    });

    expect(onSubmit).toHaveBeenCalledWith({
      user: {
        profile: { name: 'LEONARDO', salary: 1000 }
      }
    });
  });

  it('should react to array manipulations (push/remove) and clean state', async () => {
    const store = new BitStore({
      initialValues: { tags: ['React'] },
      resolver: async (vals) => (vals.tags.length > 1 ? { 'tags.1': 'Invalid' } : {})
    });

    const { result: form } = renderHook(() => useBitForm(store));
    
    await act(async () => {
      form.current.pushItem('tags', 'Vue');
      await store.validate();
    });
    
    expect(form.current.values.tags).toEqual(['React', 'Vue']);

    await act(async () => {
      store.blurField('tags.1');
      await store.validate();
    });

    const { result: tagField } = renderHook(() => useBitField(store, 'tags.1'));
    expect(tagField.current.error).toBe('Invalid');

    await act(async () => {
      form.current.removeItem('tags', 1);
      await store.validate();
    });

    expect(form.current.values.tags).toEqual(['React']);
    expect(store.getState().errors['tags.1']).toBeUndefined();
  });

  it('should only show errors when field is touched', async () => {
    const store = new BitStore({
      initialValues: { email: '' },
      resolver: async () => ({ email: 'Required' })
    });

    const { result: field } = renderHook(() => useBitField(store, 'email'));

    await act(async () => {
      await store.validate();
    });
    
    expect(field.current.error).toBeUndefined();

    await act(async () => {
      field.current.setBlur();
      await store.validate();
    });
    
    expect(field.current.error).toBe('Required');
  });

  it('should handle isSubmitting state during async submission', async () => {
    const store = new BitStore({ initialValues: { name: 'Leo' } });
    const { result: form } = renderHook(() => useBitForm(store));
    
    const onSubmit = vi.fn().mockImplementation(() => 
      new Promise(resolve => setTimeout(resolve, 50))
    );

    // Técnica para testar estado intermediário sem perder o act
    let submissionPromise: Promise<void>;

    await act(async () => {
      // O submit() retorna o handler, o handler() retorna a Promise
      submissionPromise = form.current.submit(onSubmit)();
      // Não damos await aqui para poder testar o isSubmitting: true abaixo
    });

    expect(form.current.isSubmitting).toBe(true);

    await act(async () => {
      await submissionPromise; // Agora sim aguardamos o fim
    });

    expect(form.current.isSubmitting).toBe(false);
  });

  it('should sync values between multiple hooks pointing to the same store', async () => {
    const store = new BitStore({ initialValues: { shared: 'A' } });
    const { result: hook1 } = renderHook(() => useBitField(store, 'shared'));
    const { result: hook2 } = renderHook(() => useBitField(store, 'shared'));

    await act(async () => {
      hook1.current.setValue('B');
      await store.validate();
    });

    expect(hook2.current.value).toBe('B');
  });
});