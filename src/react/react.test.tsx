import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { BitFormStore } from '../core/bit-store';
import { useBitField } from './index';

// Componente de teste
const TestForm = ({ store }: { store: BitFormStore<{ name: string }> }) => {
  const nameField = useBitField(store, 'name');
  return (
    <div>
      <input 
        data-testid="name-input"
        value={nameField.value} 
        onChange={(e) => nameField.setValue(e.target.value)}
        onBlur={nameField.onBlur}
      />
      {nameField.error && <span data-testid="error">{nameField.error}</span>}
    </div>
  );
};

describe('React Adapter', () => {
  it('deve atualizar o input quando a store muda', async () => {
    const store = new BitFormStore({ name: 'Bit' });
    render(<TestForm store={store} />);
    
    const input = screen.getByTestId('name-input') as HTMLInputElement;
    expect(input.value).toBe('Bit');

    await act(async () => {
      fireEvent.change(input, { target: { value: 'New Name' } });
    });

    expect(input.value).toBe('New Name');
    expect(store.getState().name).toBe('New Name');
  });

  it('deve mostrar erro apenas após o onBlur (touched)', async () => {
    const store = new BitFormStore({ name: '' }, {
      validator: (values) => (!values.name ? { name: 'Obrigatório' } : {})
    });
    
    render(<TestForm store={store} />);
    
    // Inicialmente sem erro visível
    expect(screen.queryByTestId('error')).toBeNull();

    // Dispara o blur
    await act(async () => {
      fireEvent.blur(screen.getByTestId('name-input'));
    });

    expect(screen.getByTestId('error').textContent).toBe('Obrigatório');
  });
});