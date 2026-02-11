import { describe, it, expect, vi } from 'vitest';
import { BitStore } from 'bit-form/core/bit-store';
import { createPatternMask, unmaskCurrency } from 'bit-form/core/mask-utils';

describe('Form Lifecycle Flow', () => {
  it('should process the full lifecycle from raw input to unmasked data', async () => {
    const mockResolver = vi.fn().mockResolvedValue({}); 
    
    const store = new BitStore({
      initialValues: { 
        coupon: '', 
        price: '' 
      },
      resolver: mockResolver,
      transform: {
        price: unmaskCurrency 
      }
    });

    const couponMask = createPatternMask('AAAA-##');
    store.setField('coupon', couponMask('save20'));
    store.setField('price', 'R$ 1.500,90');

    expect(store.getState().values.coupon).toBe('save-20');
    expect(store.getState().values.price).toBe('R$ 1.500,90');

    let finalPayload: any = null;
    await store.submit((values) => {
      finalPayload = values;
    });

    expect(finalPayload).toEqual({
      coupon: 'save-20', 
      price: 1500.90     
    });

    expect(mockResolver).toHaveBeenCalled();
    expect(store.getState().isSubmitting).toBe(false);
  });
});