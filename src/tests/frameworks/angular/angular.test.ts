// @vitest-environment jsdom

import { Component } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { createBitAngularBindings } from "bit-form/angular";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createBitStore as createBitStoreRuntime } from "../../../core";
import { maskBRL } from "../../../mask";

interface MyForm {
  user: { name: string };
  salary: number;
  items: string[];
  hasBonus: boolean;
  bonusValue: number;
}

function createBitStore<T extends object = Record<string, unknown>>(
  config?: any,
) {
  return createBitStoreRuntime<T>(config) as any;
}

let bindings: ReturnType<typeof createBitAngularBindings<any>>;

@Component({ standalone: true, template: "" })
class HostComponent {
  form = bindings.injectBitForm();
  history = bindings.injectBitHistory();
  userName = bindings.injectBitField("user.name");
  salary = bindings.injectBitField("salary");
  list = bindings.injectBitArray("items");
  bonusValue = bindings.injectBitField("bonusValue");
}

describe("Angular Integration (Signals)", () => {
  let store: ReturnType<typeof createBitStore<MyForm>>;

  beforeEach(() => {
    store = createBitStore<MyForm>({
      initialValues: {
        user: { name: "Leo" },
        salary: 10,
        items: ["Item 1", "Item 2"],
        hasBonus: false,
        bonusValue: 0,
      },
      masks: { brl: maskBRL },
      fields: {
        salary: { mask: "brl" },
      },
      history: { enabled: true },
      validation: { delay: 0 },
    });

    bindings = createBitAngularBindings<any>(store);

    TestBed.configureTestingModule({
      imports: [HostComponent],
    });
  });

  it("deve gerenciar listas com keys estáveis e remapear erros ao mover", () => {
    (store as any).triggerValidation = vi.fn();

    const fixture = TestBed.createComponent(HostComponent);
    const app = fixture.componentInstance;
    fixture.detectChanges();

    store.write.setError("items.0", "Erro no Item 1");
    const initialKey0 = app.list.fields()[0].key;

    app.list.move(0, 1);
    fixture.detectChanges();

    expect(app.form.getValues().items).toEqual(["Item 2", "Item 1"]);
    expect(app.list.fields()[1].key).toBe(initialKey0);
    expect(store.read.getState().errors["items.1"]).toBe("Erro no Item 1");
  });

  it("deve limpar erros residuais ao remover item da lista", () => {
    (store as any).triggerValidation = vi.fn();

    const fixture = TestBed.createComponent(HostComponent);
    const app = fixture.componentInstance;
    fixture.detectChanges();

    store.write.setError("items.1", "Erro no Item 2");
    app.list.remove(1);
    fixture.detectChanges();

    expect(app.form.getValues().items).toEqual(["Item 1"]);
    expect(store.read.getState().errors["items.1"]).toBeUndefined();
  });

  it("deve reagir a mudanças de visibilidade e obrigatoriedade via Signals", () => {
    const fixture = TestBed.createComponent(HostComponent);
    const app = fixture.componentInstance;

    store.feature.registerField("bonusValue", {
      conditional: {
        dependsOn: ["hasBonus"],
        showIf: (v) => v.hasBonus === true,
        requiredIf: (v) => v.hasBonus === true,
      },
    });
    fixture.detectChanges();
    expect(app.bonusValue.meta.isHidden()).toBe(true);

    store.write.setField("hasBonus", true);
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
    const spyField = vi.spyOn(store.feature, "unregisterField");
    const spyPrefix = vi.spyOn(store.feature, "unregisterPrefix");
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

    expect(store.read.getState().values.user.name).toBe("Leo");
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

    store.write.setField("user.name", "Updated");
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

    store.write.setField("salary", 5000);
    fixture.detectChanges();

    const submitFn = app.form.onSubmit(apiHandler);
    await submitFn();

    expect(apiHandler).toHaveBeenCalled();
    const [values, dirtyValues] = apiHandler.mock.calls[0];
    expect(values.salary).toBe(5000);
    expect(dirtyValues).toEqual({ salary: 5000 });
  });

  it("deve validar campos dinamicamente com Signals e resolver", async () => {
    const storeWithResolver = createBitStore<MyForm>({
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
    });

    const resolverBindings = createBitAngularBindings<any>(storeWithResolver);

    @Component({ standalone: true, template: "" })
    class ResolverHostComponent {
      form = resolverBindings.injectBitForm();
      history = resolverBindings.injectBitHistory();
      userName = resolverBindings.injectBitField("user.name");
      salary = resolverBindings.injectBitField("salary");
      list = resolverBindings.injectBitArray("items");
      bonusValue = resolverBindings.injectBitField("bonusValue");
    }

    const fixture = TestBed.createComponent(ResolverHostComponent);
    const app = fixture.componentInstance;

    await storeWithResolver.feature.validate();
    storeWithResolver.write.blurField("user.name");
    fixture.detectChanges();

    expect(app.userName.meta.invalid()).toBe(true);
    expect(app.userName.meta.error()).toBe("Obrigatório");
  });

  it("deve rastrear status do scope com injectBitScope", () => {
    const storeWithScopes = createBitStore<MyForm>({
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
      step = scopedBindings.injectBitScope("step1");
    }

    const scopedBindings = createBitAngularBindings<any>(storeWithScopes);

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [StepHostComponent],
    });

    const fixture = TestBed.createComponent(StepHostComponent);
    const app = fixture.componentInstance;
    fixture.detectChanges();

    expect(app.step.status().hasErrors).toBe(false);
    expect(app.step.status().isDirty).toBe(false);

    storeWithScopes.write.setField("user.name", "Leo");
    fixture.detectChanges();

    expect(app.step.status().isDirty).toBe(true);
    expect(app.step.isDirty()).toBe(true);

    storeWithScopes.write.setError("user.name", "Erro");
    fixture.detectChanges();

    expect(app.step.status().hasErrors).toBe(true);
    expect(app.step.status().errors["user.name"]).toBe("Erro");
    expect(app.step.isValid()).toBe(false);
  });

  it("deve navegar entre steps com injectBitSteps", async () => {
    const storeWithScopes = createBitStore<MyForm>({
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
      steps = scopedBindings.injectBitSteps(["step1", "step2"]);
    }

    const scopedBindings = createBitAngularBindings<any>(storeWithScopes);

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [StepsHostComponent],
    });

    const fixture = TestBed.createComponent(StepsHostComponent);
    const app = fixture.componentInstance;
    fixture.detectChanges();

    expect(app.steps.step()).toBe(1);
    expect(app.steps.scope()).toBe("step1");

    storeWithScopes.write.setField("user.name", "Leo");
    fixture.detectChanges();

    const advanced = await app.steps.next();
    expect(advanced).toBe(true);
    expect(app.steps.step()).toBe(2);
    expect(app.steps.scope()).toBe("step2");

    app.steps.prev();
    fixture.detectChanges();

    expect(app.steps.step()).toBe(1);
  });

  describe("injectBitPersist", () => {
    function createMockStorage() {
      const data: Record<string, string> = {};
      return {
        getItem: vi.fn((key: string) => data[key] ?? null),
        setItem: vi.fn((key: string, value: string) => {
          data[key] = value;
        }),
        removeItem: vi.fn((key: string) => {
          delete data[key];
        }),
        _data: data,
      };
    }

    @Component({ standalone: true, template: "" })
    class PersistHostComponent {
      persist = persistBindings.injectBitPersist();
    }

    let persistBindings: ReturnType<typeof createBitAngularBindings<any>>;

    it("deve expor restore, save, clear e meta como signals", async () => {
      const storage = createMockStorage();
      const persistStore = createBitStore<MyForm>({
        initialValues: {
          user: { name: "Leo" },
          salary: 0,
          items: [],
          hasBonus: false,
          bonusValue: 0,
        },
        persist: { enabled: true, key: "ng-test", storage, autoSave: false },
      });

      persistBindings = createBitAngularBindings<any>(persistStore);

      TestBed.configureTestingModule({
        imports: [PersistHostComponent],
      });

      const fixture = TestBed.createComponent(PersistHostComponent);
      const app = fixture.componentInstance;
      fixture.detectChanges();

      expect(typeof app.persist.save).toBe("function");
      expect(typeof app.persist.restore).toBe("function");
      expect(typeof app.persist.clear).toBe("function");
      expect(app.persist.meta.isSaving()).toBe(false);
      expect(app.persist.meta.isRestoring()).toBe(false);
      expect(app.persist.meta.error()).toBeNull();
    });

    it("deve salvar e restaurar valores", async () => {
      const storage = createMockStorage();
      const persistStore = createBitStore<MyForm>({
        initialValues: {
          user: { name: "Leo" },
          salary: 0,
          items: [],
          hasBonus: false,
          bonusValue: 0,
        },
        persist: { enabled: true, key: "ng-test", storage, autoSave: false },
      });

      persistBindings = createBitAngularBindings<any>(persistStore);

      TestBed.configureTestingModule({
        imports: [PersistHostComponent],
      });

      const fixture = TestBed.createComponent(PersistHostComponent);
      const app = fixture.componentInstance;
      fixture.detectChanges();

      await app.persist.save();
      expect(storage.setItem).toHaveBeenCalled();

      persistStore.write.setField("user.name", "Changed");
      const ok = await app.persist.restore();
      expect(ok).toBe(true);
      expect(persistStore.read.getState().values.user.name).toBe("Leo");
    });
  });
});
