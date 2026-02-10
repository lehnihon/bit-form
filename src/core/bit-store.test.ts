import { describe, it, expect, vi } from 'vitest';
import { BitFormStore } from './bit-store';

describe('BitFormStore', () => {
  it('deve resetar para os valores iniciais', async () => {
    const store = new BitFormStore({ email: 'old@bit.com' });
    await store.setState({ email: 'new@bit.com' });
    expect(store.isDirty()).toBe(true);
    
    store.reset();
    expect(store.getState().email).toBe('old@bit.com');
    expect(store.isDirty()).toBe(false);
  });

  it('deve disparar notificações na subscrição', async () => {
    const store = new BitFormStore({ count: 0 });
    const spy = vi.fn();
    store.subscribe(spy);
    await store.setState({ count: 1 });
    expect(spy).toHaveBeenCalled();
  });
});