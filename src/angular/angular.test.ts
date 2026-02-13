import { describe, it, expect, beforeEach } from "vitest";
import { TestBed } from "@angular/core/testing";
import { Component } from "@angular/core";
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
}

@Component({
  standalone: true,
  template: "",
})
class HostComponent {
  form = injectBitForm<MyForm>();
  userName = injectBitField<string>("user.name");
  salary = injectBitField<number>("salary", { mask: "brl" });
  list = injectBitFieldArray<string>("items");
}

describe("Angular Integration (Signals)", () => {
  let store: BitStore<MyForm>;

  beforeEach(() => {
    store = new BitStore<MyForm>({
      initialValues: {
        user: { name: "Leo" },
        salary: 10,
        items: ["Item 1"],
      },
      validationDelay: 0,
    });

    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideBitStore(store)],
    });
  });

  it("deve gerenciar listas com keys estáveis usando injectBitFieldArray", () => {
    const fixture = TestBed.createComponent(HostComponent);
    const app = fixture.componentInstance;
    fixture.detectChanges();

    const initialKey = app.list.fields()[0].key;
    app.list.append("Item 2");
    app.list.move(0, 1);
    fixture.detectChanges();

    // Ajuste: getValues() em vez de values()
    expect(app.form.getValues().items).toEqual(["Item 2", "Item 1"]);
    expect(app.list.fields()[1].key).toBe(initialKey);
  });

  it("deve aplicar máscara no displayValue e manter valor numérico na store", () => {
    const fixture = TestBed.createComponent(HostComponent);
    const app = fixture.componentInstance;
    fixture.detectChanges();

    expect(app.salary.displayValue()).toBe("R$ 10,00");

    app.salary.setValue("R$ 2.500,50");
    fixture.detectChanges();

    expect(app.salary.displayValue()).toBe("R$ 2.500,50");
    // Ajuste: getValues()
    expect(app.form.getValues().salary).toBe(2500.5);
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
    expect(app.userName.value()).toBe("Leo");
    expect(app.salary.displayValue()).toBe("R$ 10,00");
  });

  it("deve validar campos dinamicamente com Signals", async () => {
    const storeWithResolver = new BitStore<MyForm>({
      initialValues: { user: { name: "" }, salary: 0, items: [] },
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
    fixture.detectChanges();

    expect(app.form.isValid()).toBe(false);

    app.userName.setValue("Leandro");

    await storeWithResolver.validate();
    fixture.detectChanges();

    expect(app.form.isValid()).toBe(true);
  });
});
