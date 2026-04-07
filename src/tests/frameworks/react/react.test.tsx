// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { createBitReactBindings } from "bit-form/react";
import { describe, expect, it, vi } from "vitest";
import { createBitStore as createBitStoreRuntime } from "../../../core";
import { maskBRL } from "../../../mask";

interface MyForm {
  salary: number;
  user: {
    firstName: string;
    lastName: string;
  };
  skills: string[];
  hasBonus: boolean;
  bonusValue: number;
}

function createBitStore<T extends object = Record<string, unknown>>(
  config?: any,
) {
  return createBitStoreRuntime<T>(config) as any;
}

describe("React Integration (Context + Hooks)", () => {
  const createTestStore = (
    initialValues?: Partial<MyForm>,
    fields?: Record<string, any>,
    masks?: Record<string, any>,
  ) =>
    createBitStore<MyForm>({
      initialValues: {
        salary: 10,
        user: { firstName: "Leandro", lastName: "Ishikawa" },
        skills: ["React"],
        hasBonus: false,
        bonusValue: 0,
        ...initialValues,
      },
      masks: { brl: maskBRL, ...masks },
      fields,
      validation: { delay: 0 },
    });

  describe("Basic Field Logic & Lifecycle", () => {
    it("deve sincronizar useBitField, rastrear isDirty e invalid", async () => {
      const store = createTestStore();
      const bit = createBitReactBindings<any>(store);
      const { result } = renderHook(() => ({
        field: bit.useBitField("user.firstName"),
        form: bit.useBitForm(),
      }));

      expect(result.current.form.meta.isDirty).toBe(false);

      await act(() => {
        result.current.field.setValue("Kenji");
      });

      expect(result.current.field.value).toBe("Kenji");
      expect(result.current.form.meta.isDirty).toBe(true);

      await act(() => {
        result.current.field.setBlur();
      });

      await act(() => {
        store.write.setError("user.firstName", "Erro");
      });

      expect(result.current.field.meta.invalid).toBe(true);
    });

    it("deve chamar unregisterField ao desmontar o componente", () => {
      const store = createTestStore();
      const bit = createBitReactBindings<any>(store);
      const spy = vi.spyOn(store.feature, "unregisterField");

      const { unmount } = renderHook(() => bit.useBitField("user.firstName"));

      unmount();
      expect(spy).toHaveBeenCalledWith("user.firstName");
    });
  });

  describe("Reactivity & Conditional Logic", () => {
    it("deve reagir a mudanças de isHidden e isRequired via DependencyManager", async () => {
      const store = createTestStore();
      const bit = createBitReactBindings<any>(store);

      store.feature.registerField("bonusValue", {
        conditional: {
          dependsOn: ["hasBonus"],
          showIf: (v) => v.hasBonus === true,
          requiredIf: (v) => v.hasBonus === true,
        },
      });

      const { result } = renderHook(() => ({
        bonus: bit.useBitField("hasBonus"),
        value: bit.useBitField("bonusValue"),
      }));

      expect(result.current.value.meta.isHidden).toBe(true);
      expect(result.current.value.meta.isRequired).toBe(false);

      await act(() => {
        result.current.bonus.setValue(true);
      });

      expect(result.current.value.meta.isHidden).toBe(false);
      expect(result.current.value.meta.isRequired).toBe(true);
    });
  });

  describe("Masks & Formatting", () => {
    it("deve aplicar máscara no displayValue mas manter valor limpo na store", async () => {
      const store = createTestStore(
        { salary: 10 },
        { salary: { mask: "brl" } },
      );
      const bit = createBitReactBindings<any>(store);
      const { result } = renderHook(() => bit.useBitField("salary"));

      expect(result.current.props.value).toBe("R$ 10,00");

      await act(() => {
        result.current.setValue("R$ 2.500,50");
      });

      expect(result.current.props.value).toBe("R$ 2.500,50");
      expect(store.read.getState().values.salary).toBe(2500.5);
    });

    it("deve aceitar máscaras de padrão (pattern) como CPF", async () => {
      const cpfMask = {
        format: (v: string) =>
          v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4"),
        parse: (v: string) => v.replace(/\D/g, ""),
      };

      const store = createTestStore(
        {}, // initialValues
        { "user.lastName": { mask: "cpf" } }, // fields
        { cpf: cpfMask }, // masks
      );
      const bit = createBitReactBindings<any>(store);

      const { result } = renderHook(() => bit.useBitField("user.lastName"));

      await act(() => {
        result.current.setValue("12345678901");
      });

      expect(result.current.props.value).toBe("123.456.789-01");
      expect(store.read.getState().values.user.lastName).toBe("12345678901");
    });
  });

  describe("Arrays & Iteration", () => {
    it("deve gerenciar listas dinâmicas e remapear erros ao mover itens", async () => {
      const store = createTestStore({ skills: ["React", "Vue"] });
      const bit = createBitReactBindings<any>(store);
      (store as any).triggerValidation = vi.fn();

      const { result } = renderHook(() => bit.useBitArray("skills"));

      await act(() => {
        store.write.setError("skills.0", "Erro no React");
      });

      const initialKeyReact = result.current.fields[0].key;

      await act(() => {
        result.current.move(0, 1);
      });

      expect(store.read.getState().values.skills).toEqual(["Vue", "React"]);
      expect(result.current.fields[1].key).toBe(initialKeyReact);
      expect(store.read.getState().errors["skills.1"]).toBe("Erro no React");
      expect(store.read.getState().errors["skills.0"]).toBeUndefined();
    });

    it("deve limpar erros residuais ao remover um item do array", async () => {
      const store = createTestStore({ skills: ["React", "Vue"] });
      const bit = createBitReactBindings<any>(store);
      (store as any).triggerValidation = vi.fn();

      const { result } = renderHook(() => bit.useBitArray("skills"));

      await act(() => {
        store.write.setError("skills.1", "Erro no Vue");
        result.current.remove(1);
      });

      expect(store.read.getState().values.skills).toEqual(["React"]);
      expect(store.read.getState().errors["skills.1"]).toBeUndefined();
    });

    it("deve chamar unregisterPrefix ao desmontar useBitArray", () => {
      const store = createTestStore({ skills: [] });
      const bit = createBitReactBindings<any>(store);
      const spy = vi.spyOn(store.feature, "unregisterPrefix");

      const { unmount } = renderHook(() => bit.useBitArray("skills"));

      unmount();

      expect(spy).toHaveBeenCalledWith("skills.");
    });
  });

  describe("Watchers & Helpers", () => {
    it("não deve expor registerMask no useBitForm", () => {
      const store = createTestStore();
      const bit = createBitReactBindings<any>(store);
      const { result } = renderHook(() => bit.useBitForm());

      expect("registerMask" in result.current).toBe(false);
    });

    it("deve observar campos específicos com useBitWatch", async () => {
      const store = createTestStore();
      const bit = createBitReactBindings<any>(store);
      const { result } = renderHook(() => bit.useBitWatch("user.firstName"));

      expect(result.current).toBe("Leandro");

      await act(() => {
        store.write.setField("user.firstName", "Kenji");
      });

      expect(result.current).toBe("Kenji");
    });

    it("deve expor undo/redo e metadados no useBitHistory", async () => {
      const store = createBitStore<MyForm>({
        initialValues: {
          salary: 10,
          user: { firstName: "Leandro", lastName: "Ishikawa" },
          skills: ["React"],
          hasBonus: false,
          bonusValue: 0,
        },
        history: { enabled: true },
      });
      const bit = createBitReactBindings<any>(store);

      const { result } = renderHook(() => ({
        history: bit.useBitHistory(),
        field: bit.useBitField("user.firstName"),
      }));

      expect(result.current.history.historySize).toBe(1);
      expect(result.current.history.historyIndex).toBe(0);
      expect(result.current.history.canUndo).toBe(false);

      await act(() => {
        result.current.field.setValue("Novo Nome");
      });

      await act(() => {
        result.current.field.setBlur();
      });

      expect(result.current.history.canUndo).toBe(true);
      expect(result.current.history.historySize).toBe(2);

      await act(() => {
        result.current.history.undo();
      });

      expect(store.read.getState().values.user.firstName).toBe("Leandro");
      expect(result.current.history.canRedo).toBe(true);
    });

    it("deve resetar o formulário e limpar estados", async () => {
      const store = createTestStore();
      const bit = createBitReactBindings<any>(store);
      const { result } = renderHook(() => ({
        field: bit.useBitField("user.firstName"),
        form: bit.useBitForm(),
      }));

      await act(() => {
        result.current.field.setValue("Novo Nome");
        result.current.field.setBlur();
      });

      await act(() => {
        store.write.setError("user.firstName", "Erro");
      });

      await act(() => {
        result.current.form.reset();
      });

      expect(result.current.field.value).toBe("Leandro");
      expect(result.current.field.meta.error).toBeUndefined();
      expect(result.current.form.meta.isDirty).toBe(false);
    });

    it("deve lidar com submissão e preventDefault", async () => {
      const store = createTestStore();
      const onSubmit = vi.fn();
      const bit = createBitReactBindings<any>(store);
      const { result } = renderHook(() => bit.useBitForm());

      const mockEvent = { preventDefault: vi.fn() } as any;

      await act(() => {
        result.current.submit(onSubmit)(mockEvent);
      });

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(onSubmit).toHaveBeenCalled();
    });

    it("deve expor getDirtyValues e retornar apenas valores alterados", async () => {
      const store = createTestStore();
      const bit = createBitReactBindings<any>(store);
      const { result } = renderHook(() => bit.useBitForm());

      expect(result.current.getDirtyValues()).toEqual({});

      await act(() => {
        store.write.setField("user.firstName", "Kenji");
      });

      expect(result.current.getDirtyValues()).toEqual({
        user: { firstName: "Kenji" },
      });
    });

    it("deve passar dirtyValues como segundo parâmetro no submit", async () => {
      const store = createTestStore();
      const submitHandler = vi.fn();
      const bit = createBitReactBindings<any>(store);
      const { result } = renderHook(() => bit.useBitForm());

      await act(() => {
        store.write.setField("user.firstName", "Updated");
      });

      await act(() => {
        result.current.submit(submitHandler)();
      });

      expect(submitHandler).toHaveBeenCalled();
      const [values, dirtyValues] = submitHandler.mock.calls[0];
      expect(values.user.firstName).toBe("Updated");
      expect(dirtyValues).toEqual({ user: { firstName: "Updated" } });
    });

    it("deve passar dirtyValues como segundo parâmetro no onSubmit", async () => {
      const store = createTestStore();
      const apiHandler = vi.fn().mockResolvedValue({ success: true });
      const bit = createBitReactBindings<any>(store);
      const { result } = renderHook(() => bit.useBitForm());

      await act(() => {
        store.write.setField("salary", 5000);
      });

      await act(() => {
        result.current.onSubmit(apiHandler)();
      });

      expect(apiHandler).toHaveBeenCalled();
      const [values, dirtyValues] = apiHandler.mock.calls[0];
      expect(values.salary).toBe(5000);
      expect(dirtyValues).toEqual({ salary: 5000 });
    });
  });

  describe("Scope Validation (useBitScope)", () => {
    it("deve rastrear status do scope com reatividade", async () => {
      const store = createBitStore<MyForm>({
        initialValues: {
          salary: 10,
          user: { firstName: "", lastName: "" },
          skills: [],
          hasBonus: false,
          bonusValue: 0,
        },
        fields: {
          "user.firstName": { scope: "step1" },
          "user.lastName": { scope: "step1" },
        },
        validation: {
          delay: 0,
          resolver: (vals) =>
            !vals.user?.firstName ? { "user.firstName": "Erro no nome" } : {},
        },
      });
      const bit = createBitReactBindings<any>(store);

      const { result } = renderHook(() => bit.useBitScope("step1"));

      expect(result.current.status.hasErrors).toBe(false);
      expect(result.current.status.isDirty).toBe(false);
      expect(result.current.isValid).toBe(true);

      act(() => {
        store.write.setField("user.firstName", "Leo");
      });

      expect(result.current.status.isDirty).toBe(true);
      expect(result.current.isDirty).toBe(true);

      act(() => {
        store.write.setField("user.firstName", "");
      });

      let validateResult: { valid: boolean; errors: Record<string, string> };
      await act(() =>
        result.current.validate().then((res) => {
          validateResult = res;
        }),
      );

      expect(result.current.status.hasErrors).toBe(true);
      expect(result.current.status.errors["user.firstName"]).toBe(
        "Erro no nome",
      );
      expect(result.current.isValid).toBe(false);
      expect(validateResult!.valid).toBe(false);
      expect(validateResult!.errors["user.firstName"]).toBe("Erro no nome");
    });
  });

  describe("Wizard Steps (useBitSteps)", () => {
    it("deve navegar entre steps e validar antes de avançar", async () => {
      const store = createBitStore<MyForm>({
        initialValues: {
          salary: 10,
          user: { firstName: "", lastName: "" },
          skills: [],
          hasBonus: false,
          bonusValue: 0,
        },
        fields: {
          "user.firstName": { scope: "step1" },
          "user.lastName": { scope: "step1" },
          salary: { scope: "step2" },
        },
        validation: {
          delay: 0,
          resolver: (vals) =>
            !vals.user?.firstName
              ? { "user.firstName": "Nome obrigatório" }
              : {},
        },
      });
      const bit = createBitReactBindings<any>(store);

      const { result } = renderHook(() => bit.useBitSteps(["step1", "step2"]));

      expect(result.current.step).toBe(1);
      expect(result.current.scope).toBe("step1");
      expect(result.current.isFirst).toBe(true);
      expect(result.current.isLast).toBe(false);

      let advanced = false;
      await act(() =>
        result.current.next().then((res) => {
          advanced = res;
        }),
      );
      expect(advanced).toBe(false);
      expect(result.current.step).toBe(1);

      await act(() => {
        store.write.setField("user.firstName", "Leo");
      });

      await act(() =>
        result.current.next().then((res) => {
          advanced = res;
        }),
      );
      expect(advanced).toBe(true);
      expect(result.current.step).toBe(2);
      expect(result.current.scope).toBe("step2");
      expect(result.current.isFirst).toBe(false);
      expect(result.current.isLast).toBe(true);

      act(() => result.current.prev());
      expect(result.current.step).toBe(1);
    });

    it("deve bloquear next enquanto o scope atual estiver validando assincronamente", async () => {
      vi.useFakeTimers();

      const store = createBitStore<{ name: string; email: string }>({
        initialValues: { name: "", email: "" },
        fields: {
          name: {
            scope: "step1",
            validation: {
              asyncValidate: async () => null,
              asyncValidateOn: "change",
              asyncValidateDelay: 500,
            },
          },
          email: { scope: "step2" },
        },
        validation: { delay: 0 },
      });
      const bit = createBitReactBindings<any>(store);

      const { result } = renderHook(() => bit.useBitSteps(["step1", "step2"]));

      await act(() => {
        store.write.setField("name", "Leo");
      });

      let advanced = false;

      await act(() =>
        result.current.next().then((res) => {
          advanced = res;
        }),
      );

      expect(advanced).toBe(false);
      expect(result.current.step).toBe(1);

      await act(() => vi.advanceTimersByTimeAsync(500));

      await act(() =>
        result.current.next().then((res) => {
          advanced = res;
        }),
      );

      expect(advanced).toBe(true);
      expect(result.current.step).toBe(2);

      vi.useRealTimers();
    });
  });

  describe("useBitPersist", () => {
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

    it("deve expor restore, save, clear e meta", async () => {
      const storage = createMockStorage();
      const store = createBitStore<MyForm>({
        initialValues: {
          salary: 0,
          user: { firstName: "", lastName: "" },
          skills: [],
          hasBonus: false,
          bonusValue: 0,
        },
        persist: { enabled: true, key: "react-test", storage, autoSave: false },
      });
      const bit = createBitReactBindings(store);

      const { result } = renderHook(() => bit.useBitPersist());

      expect(typeof result.current.restore).toBe("function");
      expect(typeof result.current.save).toBe("function");
      expect(typeof result.current.clear).toBe("function");
      expect(result.current.meta.isSaving).toBe(false);
      expect(result.current.meta.isRestoring).toBe(false);
      expect(result.current.meta.error).toBeNull();
    });

    it("deve salvar com save() e restaurar com restore()", async () => {
      const storage = createMockStorage();
      const store = createBitStore<MyForm>({
        initialValues: {
          salary: 0,
          user: { firstName: "Leo", lastName: "" },
          skills: [],
          hasBonus: false,
          bonusValue: 0,
        },
        persist: { enabled: true, key: "react-test", storage, autoSave: false },
      });
      const bit = createBitReactBindings(store);

      const { result } = renderHook(() => bit.useBitPersist());

      await act(() => result.current.save());
      expect(storage.setItem).toHaveBeenCalled();

      store.write.setField("user.firstName", "Changed");
      const ok = await act(() => result.current.restore());
      expect(ok).toBe(true);
      expect(store.read.getState().values.user.firstName).toBe("Leo");
    });

    it("deve limpar o rascunho com clear()", async () => {
      const storage = createMockStorage();
      storage._data["react-test"] = JSON.stringify({ salary: 999 });

      const store = createBitStore<MyForm>({
        initialValues: {
          salary: 0,
          user: { firstName: "", lastName: "" },
          skills: [],
          hasBonus: false,
          bonusValue: 0,
        },
        persist: { enabled: true, key: "react-test", storage },
      });
      const bit = createBitReactBindings(store);

      const { result } = renderHook(() => bit.useBitPersist());

      await act(() => result.current.clear());
      expect(storage.removeItem).toHaveBeenCalledWith("react-test");
    });
  });
});
