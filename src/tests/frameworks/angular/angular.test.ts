import { describe, it, expect, beforeEach, vi } from "vitest";
import { TestBed } from "@angular/core/testing";
import { Component, DestroyRef } from "@angular/core";
import { BitStore } from "../../../core/store";
import {
  injectBitField,
  injectBitForm,
  injectBitArray,
  injectBitHistory,
  injectBitScope,
  injectBitSteps,
  provideBitStore,
} from "bit-form/angular";

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
  history = injectBitHistory<MyForm>();
  userName = injectBitField<string>("user.name");
  salary = injectBitField<number>("salary");
  list = injectBitArray<MyForm, "items">("items");
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
      fields: {
        salary: { mask: "brl" },
      },
      history: { enabled: true },
      validation: { delay: 0 },
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

    store.registerField("bonusValue", {
      conditional: {
        dependsOn: ["hasBonus"],
        showIf: (v) => v.hasBonus === true,
        requiredIf: (v) => v.hasBonus === true,
      },
    });
    fixture.detectChanges();
    expect(app.bonusValue.meta.isHidden()).toBe(true);

    store.setField("hasBonus", true);
    fixture.detectChanges();
    expect(app.bonusValue.meta.isHidden()).toBe(false);
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
    expect(app.form.meta.isDirty()).toBe(true);

    app.form.reset();
    fixture.detectChanges();
    expect(app.form.meta.isDirty()).toBe(false);
  });

  it("deve expor undo/redo e metadados via injectBitHistory", () => {
    const fixture = TestBed.createComponent(HostComponent);
    const app = fixture.componentInstance;
    fixture.detectChanges();

    expect(app.history.historySize()).toBe(1);
    expect(app.history.historyIndex()).toBe(0);
    expect(app.history.canUndo()).toBe(false);

    app.userName.setValue("Novo");
    fixture.detectChanges();
    app.userName.setBlur();
    fixture.detectChanges();

    expect(app.history.canUndo()).toBe(true);
    expect(app.history.historySize()).toBe(2);

    app.history.undo();
    fixture.detectChanges();

    expect(store.getState().values.user.name).toBe("Leo");
    expect(app.history.canRedo()).toBe(true);
  });

  it("não deve expor registerMask no injectBitForm", () => {
    const fixture = TestBed.createComponent(HostComponent);
    const app = fixture.componentInstance;
    fixture.detectChanges();

    expect("registerMask" in app.form).toBe(false);
  });

  it("deve expor getDirtyValues e retornar apenas valores alterados", () => {
    const fixture = TestBed.createComponent(HostComponent);
    const app = fixture.componentInstance;
    fixture.detectChanges();

    expect(app.form.getDirtyValues()).toEqual({});

    app.userName.setValue("Changed");
    fixture.detectChanges();

    expect(app.form.getDirtyValues()).toEqual({ user: { name: "Changed" } });
  });

  it("deve passar dirtyValues como segundo parâmetro no submit", async () => {
    const submitHandler = vi.fn();
    const fixture = TestBed.createComponent(HostComponent);
    const app = fixture.componentInstance;

    store.setField("user.name", "Updated");
    fixture.detectChanges();

    const submitFn = app.form.submit(submitHandler);
    await submitFn();

    expect(submitHandler).toHaveBeenCalled();
    const [values, dirtyValues] = submitHandler.mock.calls[0];
    expect(values.user.name).toBe("Updated");
    expect(dirtyValues).toEqual({ user: { name: "Updated" } });
  });

  it("deve passar dirtyValues como segundo parâmetro no onSubmit", async () => {
    const apiHandler = vi.fn().mockResolvedValue({ success: true });
    const fixture = TestBed.createComponent(HostComponent);
    const app = fixture.componentInstance;

    store.setField("salary", 5000);
    fixture.detectChanges();

    const submitFn = app.form.onSubmit(apiHandler);
    await submitFn();

    expect(apiHandler).toHaveBeenCalled();
    const [values, dirtyValues] = apiHandler.mock.calls[0];
    expect(values.salary).toBe(5000);
    expect(dirtyValues).toEqual({ salary: 5000 });
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
      validation: {
        delay: 0,
        resolver: (vals) =>
          !vals.user.name ? { "user.name": "Obrigatório" } : {},
      },
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

    expect(app.userName.meta.invalid()).toBe(true);
    expect(app.userName.meta.error()).toBe("Obrigatório");
  });

  it("deve rastrear status do scope com injectBitScope", () => {
    const storeWithScopes = new BitStore<MyForm>({
      initialValues: {
        user: { name: "" },
        salary: 0,
        items: [],
        hasBonus: false,
        bonusValue: 0,
      },
      fields: { "user.name": { scope: "step1" } },
    });

    @Component({ standalone: true, template: "" })
    class StepHostComponent {
      step = injectBitScope("step1");
    }

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [StepHostComponent],
      providers: [provideBitStore(storeWithScopes)],
    });

    const fixture = TestBed.createComponent(StepHostComponent);
    const app = fixture.componentInstance;
    fixture.detectChanges();

    expect(app.step.status().hasErrors).toBe(false);
    expect(app.step.status().isDirty).toBe(false);

    storeWithScopes.setField("user.name", "Leo");
    fixture.detectChanges();

    expect(app.step.status().isDirty).toBe(true);
    expect(app.step.isDirty()).toBe(true);

    storeWithScopes.setError("user.name", "Erro");
    fixture.detectChanges();

    expect(app.step.status().hasErrors).toBe(true);
    expect(app.step.status().errors["user.name"]).toBe("Erro");
    expect(app.step.isValid()).toBe(false);
  });

  it("deve navegar entre steps com injectBitSteps", async () => {
    const storeWithScopes = new BitStore<MyForm>({
      initialValues: {
        user: { name: "" },
        salary: 0,
        items: [],
        hasBonus: false,
        bonusValue: 0,
      },
      fields: {
        "user.name": { scope: "step1" },
        salary: { scope: "step2" },
      },
      validation: { delay: 0 },
    });

    @Component({ standalone: true, template: "" })
    class StepsHostComponent {
      steps = injectBitSteps(["step1", "step2"]);
    }

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [StepsHostComponent],
      providers: [provideBitStore(storeWithScopes)],
    });

    const fixture = TestBed.createComponent(StepsHostComponent);
    const app = fixture.componentInstance;
    fixture.detectChanges();

    expect(app.steps.step()).toBe(1);
    expect(app.steps.scope()).toBe("step1");

    storeWithScopes.setField("user.name", "Leo");
    fixture.detectChanges();

    const advanced = await app.steps.next();
    expect(advanced).toBe(true);
    expect(app.steps.step()).toBe(2);
    expect(app.steps.scope()).toBe("step2");

    app.steps.prev();
    fixture.detectChanges();

    expect(app.steps.step()).toBe(1);
  });
});
