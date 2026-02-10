import { beforeAll, afterAll, vi } from 'vitest';

beforeAll(() => {
  // Mock de APIs do browser que não existem no Node (ex: Intl para máscaras de moeda)
  if (!global.Intl) {
    require('intl');
    require('intl/locale-data/jsonp/pt-BR');
  }
});

afterAll(() => {
  vi.clearAllMocks();
});