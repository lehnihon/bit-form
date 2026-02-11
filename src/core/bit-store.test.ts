import { describe, it, expect, vi } from 'vitest';
import { BitStore } from './bit-store';

describe('BitStore Core', () => {
  
  it('should initialize with correct state', () => {
    const store = new BitStore({ initialValues: { name: 'Leo' } });
    
    expect(store.getState().values.name).toBe('Leo');
    expect(store.isValid).toBe(true); // Agora acessível via getter
  });

  it('should update field and notify listeners', () => {
    const store = new BitStore({ initialValues: { name: '' } });
    const listener = vi.fn();
    store.subscribe(listener);

    store.setField('name', 'Leo');
    
    expect(store.getState().values.name).toBe('Leo');
    expect(listener).toHaveBeenCalled();
  });

  it('should update nested fields using dot notation', () => {
    const store = new BitStore({ 
      initialValues: { user: { profile: { name: '' } } } 
    });
    
    store.setField('user.profile.name', 'Leo');
    expect(store.getState().values.user.profile.name).toBe('Leo');
  });

  it('should push items to a deep array', () => {
    const store = new BitStore({ 
      initialValues: { tags: [] as string[] } 
    });

    store.pushItem('tags', 'TS');
    expect(store.getState().values.tags).toEqual(['TS']);
  });

  it('should remove items and clean up state', async () => {
    const store = new BitStore({ 
      initialValues: { list: ['a', 'b'] },
      resolver: (vals) => (vals.list.length > 1 ? { 'list.1': 'Erro' } : {})
    });

    await store.validate();
    store.blurField('list.1');

    expect(store.getState().errors['list.1']).toBe('Erro');

    store.removeItem('list', 1);

    expect(store.getState().values.list).toEqual(['a']);
    expect(store.getState().errors['list.1']).toBeUndefined();
    expect(store.getState().touched['list.1']).toBeUndefined();
  });

  it('should apply transformations on submit', async () => {
    const store = new BitStore({
      initialValues: { price: '100' },
      transform: { price: (v) => Number(v) }
    });

    const onSubmit = vi.fn();
    await store.submit(onSubmit);

    expect(onSubmit).toHaveBeenCalledWith({ price: 100 });
  });

  it('should reflect isSubmitting state during async submit', async () => {
    const store = new BitStore({ initialValues: {} });
    const onSubmit = () => new Promise(resolve => setTimeout(resolve, 20));

    const promise = store.submit(onSubmit as any);
    expect(store.isSubmitting).toBe(true); // Agora acessível via getter
    
    await promise;
    expect(store.isSubmitting).toBe(false);
  });
});