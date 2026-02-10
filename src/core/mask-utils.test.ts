import { describe, it, expect } from 'vitest';
import { createPatternMask, currencyMask } from './mask-utils';

describe('Mask Utils', () => {
  it('deve aplicar máscara de CPF', () => {
    const mask = createPatternMask('###.###.###-##');
    expect(mask('12345678901')).toBe('123.456.789-01');
  });

  it('deve lidar com valores incompletos na máscara', () => {
    const mask = createPatternMask('##/##/####');
    expect(mask('12')).toBe('12/');
    expect(mask('1212')).toBe('12/12/');
  });

  it('deve formatar moeda brasileira corretamente', () => {
    const result = currencyMask(10.5);
    // Normaliza espaços inseparáveis do Intl
    expect(result.replace(/\u00a0/g, ' ')).toMatch(/R\$\s10,50/);
  });
});