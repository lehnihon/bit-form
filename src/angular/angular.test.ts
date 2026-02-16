import { describe, it, expect, beforeEach, vi } from "vitest";
import { TestBed } from "@angular/core/testing";
import { Component, DestroyRef } from "@angular/core";
import { BitStore } from "../core/store";
import {
  injectBitField,
  injectBitForm,
  injectBitFieldArray,
  provideBitStore,
} from "./index";

interface MyForm {
  user: { name: string };
  salary: number;
  items: string[];
  hasBonus: boolean;
  bonusValue: number;
}

@Component({ standalone: true, template: "" })
class HostComponent {
  form = injectBitForm<MyForm>();
  userName = injectBitField<string>("user.name");
  salary = injectBitField<number>("salary", undefined, { mask: "brl" });
  list = injectBitFieldArray<string>("items");
  bonusValue = injectBitField<number>("bonusValue");
}

describe("Angular Integration (Signals)", () => {
  let store: BitStore<MyForm>;

  beforeEach(() => {
    store = new BitStore<MyForm>({
      initialValues: {
        user: { name: "Leo" },
        salary: 10,
        items: ["Item 1", "Item 2"],
        hasBonus: false,
        bonusValue: 0,
      },
      validationDelay: 0,
    });

    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideBitStore(store)],
    });
  });

  it("deve gerenciar listas com keys estáveis e remapear erros ao mover", () => {
    (store as any).validate = vi.fn();
    (store as any).triggerValidation = vi.fn();

    const fixture = TestBed.createComponent(HostComponent);
    const app = fixture.componentInstance;
    fixture.detectChanges();

    store.setError("items.0", "Erro no Item 1");
    const initialKey0 = app.list.fields()[0].key;

    app.list.move(0, 1);
    fixture.detectChanges();

    expect(app.form.getValues().items).toEqual(["Item 2", "Item 1"]);
    expect(app.list.fields()[1].key).toBe(initialKey0);
    expect(store.getState().errors["items.1"]).toBe("Erro no Item 1");
  });

  it("deve limpar erros residuais ao remover item da lista", () => {
    (store as any).validate = vi.fn();
    (store as any).triggerValidation = vi.fn();

    const fixture = TestBed.createComponent(HostComponent);
    const app = fixture.componentInstance;
    fixture.detectChanges();

    store.setError("items.1", "Erro no Item 2");
    app.list.remove(1);
    fixture.detectChanges();

    expect(app.form.getValues().items).toEqual(["Item 1"]);
    expect(store.getState().errors["items.1"]).toBeUndefined();
  });

  it("deve reagir a mudanças de visibilidade e obrigatoriedade via Signals", () => {
    const fixture = TestBed.createComponent(HostComponent);
    const app = fixture.componentInstance;

    store.registerConfig("bonusValue", {
      dependsOn: ["hasBonus"],
      showIf: (v) => v.hasBonus === true,
      requiredIf: (v) => v.hasBonus === true,
    });
    fixture.detectChanges();
    expect(app.bonusValue.isHidden()).toBe(true);

    store.setField("hasBonus", true);
    fixture.detectChanges();
    expect(app.bonusValue.isHidden()).toBe(false);
  });

  it("deve aplicar máscara no displayValue e manter valor numérico na store", () => {
    const fixture = TestBed.createComponent(HostComponent);
    const app = fixture.componentInstance;
    fixture.detectChanges();

    app.salary.setValue("R$ 2.500,50");
    fixture.detectChanges();

    expect(app.form.getValues().salary).toBe(2500.5);
  });

  it("deve chamar unregister ao destruir o componente", () => {
    const spyField = vi.spyOn(store, "unregisterField");
    const spyPrefix = vi.spyOn(store, "unregisterPrefix");
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    fixture.destroy();

    expect(spyField).toHaveBeenCalledWith("user.name");
    expect(spyPrefix).toHaveBeenCalledWith("items.");
  });

  it("deve rastrear o estado isDirty e permitir Reset", () => {
    const fixture = TestBed.createComponent(HostComponent);
    const app = fixture.componentInstance;
    fixture.detectChanges();

    app.userName.setValue("Mudou");
    fixture.detectChanges();
    expect(app.form.isDirty()).toBe(true);

    app.form.reset();
    fixture.detectChanges();
    expect(app.form.isDirty()).toBe(false);
  });

  it("deve validar campos dinamicamente com Signals e resolver", async () => {
    const storeWithResolver = new BitStore<MyForm>({
      initialValues: {
        user: { name: "" },
        salary: 0,
        items: [],
        hasBonus: false,
        bonusValue: 0,
      },
      validationDelay: 0,
      resolver: (vals) =>
        !vals.user.name ? { "user.name": "Obrigatório" } : {},
    });

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideBitStore(storeWithResolver)],
    });

    const fixture = TestBed.createComponent(HostComponent);
    const app = fixture.componentInstance;

    await storeWithResolver.validate();
    storeWithResolver.blurField("user.name");
    fixture.detectChanges();

    expect(app.userName.invalid()).toBe(true);
    expect(app.userName.error()).toBe("Obrigatório");
  });
});
