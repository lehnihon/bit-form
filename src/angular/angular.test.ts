import { describe, it, expect, vi } from 'vitest';
import { BitFormStore } from '../core/bit-store';
import { createBitSignal } from './index';
import { EnvironmentInjector, runInInjectionContext, DestroyRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';

describe('Angular Adapter (Signals)', () => {
  // Setup para simular o ambiente do Angular
  const setup = () => {
    const store = new BitFormStore({ name: 'Bit', age: 25 });
    const injector = TestBed.inject(EnvironmentInjector);
    return { store, injector };
  };

  it('deve refletir o valor inicial da store no signal', () => {
    const { store, injector } = setup();

    runInInjectionContext(injector, () => {
      const nameField = createBitSignal(store, 'name');
      // No Angular, signals são chamados como funções: nameField.value()
      expect(nameField.value()).toBe('Bit');
    });
  });

  it('deve atualizar o signal quando a store mudar', async () => {
    const { store, injector } = setup();

    await runInInjectionContext(injector, async () => {
      const nameField = createBitSignal(store, 'name');
      
      await store.setState({ name: 'Updated' });
      
      expect(nameField.value()).toBe('Updated');
    });
  });

  it('deve derivar o erro apenas quando o campo for "touched"', async () => {
    const { store, injector } = setup();

    await runInInjectionContext(injector, async () => {
      const ageField = createBitSignal(store, 'age');

      // Simula um erro na store (manualmente para o teste)
      // @ts-ignore - forçando erro para validar o computed
      store['errors'] = { age: 'Muito jovem' };
      store['notify']();

      // Não deve ter erro ainda porque não foi tocado
      expect(ageField.error()).toBeUndefined();

      // Marca como tocado
      ageField.onBlur();
      
      expect(ageField.error()).toBe('Muito jovem');
    });
  });

  it('deve cancelar a subscrição automaticamente no onDestroy', () => {
    const { store, injector } = setup();
    const spy = vi.spyOn(store, 'subscribe');

    runInInjectionContext(injector, () => {
      const destroyRef = TestBed.inject(DestroyRef);
      createBitSignal(store, 'name');

      // O subscribe deve ter sido chamado
      expect(spy).toHaveBeenCalled();

      // Simula a destruição do contexto (componente/provider)
      // @ts-ignore - acessando internals para disparar o destroy
      destroyRef.destroy();

      // Aqui, internamente, o unsubscribe retornado pelo store.subscribe 
      // deve ter sido executado pelo DestroyRef.
    });
  });
});