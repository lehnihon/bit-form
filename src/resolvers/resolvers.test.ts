import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import * as yup from 'yup';
import Joi from 'joi';

import { zodResolver } from './zod';
import { yupResolver } from './yup';
import { joiResolver } from './joi';

describe('Resolvers Validation Consistency', () => {
  const mockData = { email: 'invalid-email', age: 10 };

  // --- TESTE ZOD ---
  it('Zod: deve validar e formatar erros corretamente', async () => {
    const schema = z.object({
      email: z.string().email('Email inválido'),
      age: z.number().min(18, 'Mínimo 18')
    });
    const resolver = zodResolver(schema);
    const errors = await resolver(mockData as any);

    expect(errors).toEqual({
      email: 'Email inválido',
      age: 'Mínimo 18'
    });
  });

  // --- TESTE YUP ---
  it('Yup: deve validar e formatar erros corretamente', async () => {
    const schema = yup.object({
      email: yup.string().email('Email inválido').required(),
      age: yup.number().min(18, 'Mínimo 18').required()
    });
    const resolver = yupResolver(schema);
    const errors = await resolver(mockData as any);

    expect(errors).toEqual({
      email: 'Email inválido',
      age: 'Mínimo 18'
    });
  });

  // --- TESTE JOI ---
  it('Joi: deve validar e formatar erros corretamente', async () => {
    const schema = Joi.object({
      email: Joi.string().email().messages({ 'string.email': 'Email inválido' }),
      age: Joi.number().min(18).messages({ 'number.min': 'Mínimo 18' })
    });
    const resolver = joiResolver(schema);
    const errors = await resolver(mockData as any);

    // O Joi pode retornar caminhos de forma diferente, mas o nosso 
    // resolver mapeia para a chave plana que o BitForm espera.
    expect(errors.email).toBe('Email inválido');
    expect(errors.age).toBe('Mínimo 18');
  });
});