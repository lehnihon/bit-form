import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { BitStore } from '../core/bit-store';
import { 
  injectBitField, 
  injectBitForm, 
  injectBitFieldArray,
  provideBitStore 
} from './index';

interface MyForm {
  user: { name: string };
  items: string[];
}

@Component({
  standalone: true,
  template: '',
})
class HostComponent {
  form = injectBitForm<MyForm>();
  userName = injectBitField<string>('user.name');
  list = injectBitFieldArray<string>('items');
}

describe('Angular Integration (Signals)', () => {
  let store: BitStore<MyForm>;

  beforeEach(() => {
    store = new BitStore<MyForm>({
      initialValues: { 
        user: { name: 'Leo' },
        items: ['Item 1'] 
      },
      validationDelay: 0
    });

    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideBitStore(store)]
    });
  });

  it('deve gerenciar listas com IDs estáveis usando injectBitFieldArray', () => {
    const fixture = TestBed.createComponent(HostComponent);
    const app = fixture.componentInstance;

    const initialId = app.list.fields()[0].id;
    app.list.append('Item 2');
    app.list.move(0, 1);

    expect(app.form.values().items).toEqual(['Item 2', 'Item 1']);
    expect(app.list.fields()[1].id).toBe(initialId);
  });

  it('deve rastrear o estado isDirty e permitir Reset', () => {
    const fixture = TestBed.createComponent(HostComponent);
    const app = fixture.componentInstance;

    app.userName.setValue('Mudou');
    expect(app.form.isDirty()).toBe(true);

    app.form.reset();
    expect(app.form.isDirty()).toBe(false);
    expect(app.userName.value()).toBe('Leo');
  });

  it('deve validar campos dinamicamente com Signals', async () => {
    const storeWithResolver = new BitStore<MyForm>({
      initialValues: { user: { name: '' }, items: [] },
      validationDelay: 0,
      resolver: (vals) => (!vals.user.name ? { 'user.name': 'Obrigatório' } : {})
    });

    await storeWithResolver.validate();

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideBitStore(storeWithResolver)]
    });

    const fixture = TestBed.createComponent(HostComponent);
    const app = fixture.componentInstance;

    expect(app.form.isValid()).toBe(false);

    app.userName.setValue('Leandro');
    
    await new Promise(resolve => setTimeout(resolve, 0));
    fixture.detectChanges(); 

    expect(app.form.isValid()).toBe(true);
  });
});