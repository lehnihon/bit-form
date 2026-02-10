import { describe, it, expect } from 'vitest';
import { BitFormStore } from '../../src/core/bit-store';
import { zodResolver } from '../../src/resolvers/zod';
import { createPatternMask } from '../../src/core/mask-utils';
import { z } from 'zod';

describe('Integration: Full Form Flow', () => {
  it('should validate, mask, and track status throughout a user session', async () => {
    // 1. Definição do Schema
    const userSchema = z.object({
      phone: z.string().min(14, 'Telefone incompleto'),
      age: z.number().min(18, 'Deve ser maior de idade')
    });

    // 2. Setup da Store com Máscaras e Resolvers
    const store = new BitFormStore(
      { phone: '', age: 0 },
      {
        validator: zodResolver(userSchema),
        masks: { phone: createPatternMask('(##) ####-####') }
      }
    );

    // 3. Simulação de Digitação (Máscara em ação)
    await store.setState({ phone: '1199998888' });
    expect(store.getState().phone).toBe('(11) 9999-8888');

    // 4. Validação em Tempo Real
    expect(store.getErrors().phone).toBeUndefined(); // Válido agora
    
    await store.setState({ age: 15 });
    expect(store.getErrors().age).toBe('Deve ser maior de idade');

    // 5. Verificação de Estado Global
    expect(store.isDirty()).toBe(true);
    
    // 6. Reset
    store.reset();
    expect(store.getState().phone).toBe('');
    expect(store.isDirty()).toBe(false);
  });
});