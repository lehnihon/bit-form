import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { runInInjectionContext, Component } from '@angular/core';
import { BitStore } from '../core/bit-store';
import { injectBitField, injectBitForm } from './index';
import { unmaskCurrency } from '../core/mask-utils';

@Component({
  standalone: true,
  template: ''
})
class HostComponent {
  store = new BitStore({
    initialValues: { 
      total: 'R$ 50,00',
      user: { name: 'Leo', address: { city: 'São Paulo' } },
      items: ['Item 1'] as string[]
    },
    transform: { 
      total: unmaskCurrency,
      'user.name': (v: string) => v.toUpperCase()
    }
  });

  // Fields
  totalField = injectBitField(this.store, 'total');
  cityName = injectBitField(this.store, 'user.address.city');
  userName = injectBitField(this.store, 'user.name');
  
  // Form engine
  form = injectBitForm(this.store);
}

describe('Angular Integration', () => {
  
  it('should handle nested object access and transformation', async () => {
    TestBed.configureTestingModule({ imports: [HostComponent] });
    const fixture = TestBed.createComponent(HostComponent);
    const app = fixture.componentInstance;
    const onSubmit = vi.fn();

    // Testa valor inicial aninhado profundamente
    expect(app.cityName.value()).toBe('São Paulo');

    // Testa alteração em nível intermediário
    app.userName.setValue('leo');
    
    await app.form.submit(onSubmit)(); // Executa o handler de submit

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      user: { 
        name: 'LEO', // Transformação aplicada
        address: { city: 'São Paulo' } 
      }
    }));
  });

  it('should react to array manipulations (push/remove)', () => {
    TestBed.configureTestingModule({ imports: [HostComponent] });
    const fixture = TestBed.createComponent(HostComponent);
    const app = fixture.componentInstance;

    // Inicial
    expect(app.form.values().items).toEqual(['Item 1']);

    // Push
    app.form.pushItem('items', 'Item 2');
    fixture.detectChanges(); // Garante ciclo do Angular (opcional com signals mas boa prática)
    expect(app.form.values().items).toEqual(['Item 1', 'Item 2']);

    // Remove
    app.form.removeItem('items', 0);
    expect(app.form.values().items).toEqual(['Item 2']);
  });

  it('should synchronize field signals with array items', () => {
    TestBed.configureTestingModule({ imports: [HostComponent] });
    const fixture = TestBed.createComponent(HostComponent);
    const app = fixture.componentInstance;

    const firstItem = runInInjectionContext(fixture.debugElement.injector, () => 
      injectBitField(app.store, 'items.0')
    );
    
    expect(firstItem.value()).toBe('Item 1');

    firstItem.setValue('Item Alterado');
    expect(app.form.values().items[0]).toBe('Item Alterado');
  });

  it('should submit unmasked values and arrays using signals', async () => {
    TestBed.configureTestingModule({ imports: [HostComponent] });
    const fixture = TestBed.createComponent(HostComponent);
    const app = fixture.componentInstance;
    const onSubmit = vi.fn();

    app.form.pushItem('items', 'Novo Item');
    await app.form.submit(onSubmit)();

    expect(app.totalField.value()).toBe('R$ 50,00'); 
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ 
      total: 50, // Unmasked
      items: ['Item 1', 'Novo Item']
    }));
  });
});