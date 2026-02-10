export const createPatternMask = (pattern: string) => {
  return (value: string) => {
    if (!value) return '';
    const cleanValue = value.replace(/\D/g, '');
    let masked = '';
    let j = 0;
    for (let i = 0; i < pattern.length && j < cleanValue.length; i++) {
      if (pattern[i] === '#') {
        masked += cleanValue[j++];
      } else {
        masked += pattern[i];
      }
    }
    return masked;
  };
};

export const currencyMask = (value: number | string) => {
  const amount = typeof value === 'string' 
    ? Number(value.replace(/\D/g, '')) / 100 
    : value;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(amount || 0);
};