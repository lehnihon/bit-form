import { describe, it, expect } from 'vitest';
import { BitStore } from '../../src/core/bit-store';

describe('Integration: Cross-Framework Consistency', () => {
  it('should sync state across different subscription types', async () => {
    const store = new BitStore({ count: 0 });
    
    let reactValue = 0;
    let vueValue = 0;

    // Simula o subscribe do React
    store.subscribe(() => {
      reactValue = store.getState().count;
    });

    // Simula o subscribe do Vue
    store.subscribe(() => {
      vueValue = store.getState().count;
    });

    await store.setState({ count: 10 });

    expect(reactValue).toBe(10);
    expect(vueValue).toBe(10);
  });
});