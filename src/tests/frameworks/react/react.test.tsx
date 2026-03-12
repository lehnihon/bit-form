import React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { BitStore } from "../../../core/store";
import {
  BitFormProvider,
  useBitField,
  useBitForm,
  useBitArray,
  useBitHistory,
  useBitScope,
  useBitSteps,
  useBitWatch,
  useBitPersist,
} from "bit-form/react";

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

describe("React Integration (Context + Hooks)", () => {
  const createTestStore = (
    initialValues?: Partial<MyForm>,
    fields?: Record<string, any>,
  ) =>
    new BitStore<MyForm>({
      initialValues: {
        salary: 10,
        user: { firstName: "Leandro", lastName: "Ishikawa" },
        skills: ["React"],
        hasBonus: false,
        bonusValue: 0,
        ...initialValues,
      },
      fields,
      validation: { delay: 0 },
    });

  const wrapper = ({ children, store }: any) => (
    <BitFormProvider store={store}>{children}</BitFormProvider>
  );

  describe("Basic Field Logic & Lifecycle", () => {
    it("deve sincronizar useBitField, rastrear isDirty e invalid", async () => {
      const store = createTestStore();
      const { result } = renderHook(
        () => ({
          field: useBitField("user.firstName"),
          form: useBitForm(),
        }),
        { wrapper: (props) => wrapper({ ...props, store }) },
      );

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
        store.setError("user.firstName", "Erro");
      });

      expect(result.current.field.meta.invalid).toBe(true);
    });

    it("deve chamar unregisterField ao desmontar o componente", () => {
      const store = createTestStore();
      const spy = vi.spyOn(store, "unregisterField");

      const { unmount } = renderHook(() => useBitField("user.firstName"), {
        wrapper: (props) => wrapper({ ...props, store }),
      });

      unmount();
      expect(spy).toHaveBeenCalledWith("user.firstName");
    });
  });

  describe("Reactivity & Conditional Logic", () => {
    it("deve reagir a mudanças de isHidden e isRequired via DependencyManager", async () => {
      const store = createTestStore();

      store.registerField("bonusValue", {
        conditional: {
          dependsOn: ["hasBonus"],
          showIf: (v) => v.hasBonus === true,
          requiredIf: (v) => v.hasBonus === true,
        },
      });

      const { result } = renderHook(
        () => ({
          bonus: useBitField("hasBonus"),
          value: useBitField("bonusValue"),
        }),
        {
          wrapper: (props) => wrapper({ ...props, store }),
        },
      );

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
      const { result } = renderHook(() => useBitField("salary"), {
        wrapper: (props) => wrapper({ ...props, store }),
      });

      expect(result.current.props.value).toBe("R$ 10,00");

      await act(() => {
        result.current.setValue("R$ 2.500,50");
      });

      expect(result.current.props.value).toBe("R$ 2.500,50");
      expect(store.getState().values.salary).toBe(2500.5);
    });

    it("deve aceitar máscaras de padrão (pattern) como CPF", async () => {
      const store = createTestStore(undefined, {
        "user.lastName": { mask: "cpf" },
      });
      store.registerMask("cpf", {
        format: (v) => v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4"),
        parse: (v) => v.replace(/\D/g, ""),
      });

      const { result } = renderHook(() => useBitField("user.lastName"), {
        wrapper: (props) => wrapper({ ...props, store }),
      });

      await act(() => {
        result.current.setValue("12345678901");
      });

      expect(result.current.props.value).toBe("123.456.789-01");
      expect(store.getState().values.user.lastName).toBe("12345678901");
    });
  });

  describe("Arrays & Iteration", () => {
    it("deve gerenciar listas dinâmicas e remapear erros ao mover itens", async () => {
      const store = createTestStore({ skills: ["React", "Vue"] });
      (store as any).validate = vi.fn();
      (store as any).triggerValidation = vi.fn();

      const { result } = renderHook(() => useBitArray("skills"), {
        wrapper: (props) => wrapper({ ...props, store }),
      });

      await act(() => {
        store.setError("skills.0", "Erro no React");
      });

      const initialKeyReact = result.current.fields[0].key;

      await act(() => {
        result.current.move(0, 1);
      });

      expect(store.getState().values.skills).toEqual(["Vue", "React"]);
      expect(result.current.fields[1].key).toBe(initialKeyReact);
      expect(store.getState().errors["skills.1"]).toBe("Erro no React");
      expect(store.getState().errors["skills.0"]).toBeUndefined();
    });

    it("deve limpar erros residuais ao remover um item do array", async () => {
      const store = createTestStore({ skills: ["React", "Vue"] });
      (store as any).validate = vi.fn();
      (store as any).triggerValidation = vi.fn();

      const { result } = renderHook(() => useBitArray("skills"), {
        wrapper: (props) => wrapper({ ...props, store }),
      });

      await act(() => {
        store.setError("skills.1", "Erro no Vue");
        result.current.remove(1);
      });

      expect(store.getState().values.skills).toEqual(["React"]);
      expect(store.getState().errors["skills.1"]).toBeUndefined();
    });
  });

  describe("Watchers & Helpers", () => {
    it("não deve expor registerMask no useBitForm", () => {
      const store = createTestStore();
      const { result } = renderHook(() => useBitForm<MyForm>(), {
        wrapper: (props) => wrapper({ ...props, store }),
      });

      expect("registerMask" in result.current).toBe(false);
    });

    it("deve observar campos específicos com useBitWatch", async () => {
      const store = createTestStore();
      const { result } = renderHook(() => useBitWatch("user.firstName"), {
        wrapper: (props) => wrapper({ ...props, store }),
      });

      expect(result.current).toBe("Leandro");

      await act(() => {
        store.setField("user.firstName", "Kenji");
      });

      expect(result.current).toBe("Kenji");
    });

    it("deve expor undo/redo e metadados no useBitHistory", async () => {
      const store = new BitStore<MyForm>({
        initialValues: {
          salary: 10,
          user: { firstName: "Leandro", lastName: "Ishikawa" },
          skills: ["React"],
          hasBonus: false,
          bonusValue: 0,
        },
        history: { enabled: true },
      });

      const { result } = renderHook(
        () => ({
          history: useBitHistory<MyForm>(),
          field: useBitField("user.firstName"),
        }),
        { wrapper: (props) => wrapper({ ...props, store }) },
      );

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

      expect(store.getState().values.user.firstName).toBe("Leandro");
      expect(result.current.history.canRedo).toBe(true);
    });

    it("deve resetar o formulário e limpar estados", async () => {
      const store = createTestStore();
      const { result } = renderHook(
        () => ({
          field: useBitField("user.firstName"),
          form: useBitForm(),
        }),
        { wrapper: (props) => wrapper({ ...props, store }) },
      );

      await act(() => {
        result.current.field.setValue("Novo Nome");
        result.current.field.setBlur();
      });

      await act(() => {
        store.setError("user.firstName", "Erro");
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
      const { result } = renderHook(() => useBitForm<MyForm>(), {
        wrapper: (props) => wrapper({ ...props, store }),
      });

      const mockEvent = { preventDefault: vi.fn() } as any;

      await act(() => {
        result.current.submit(onSubmit)(mockEvent);
      });

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(onSubmit).toHaveBeenCalled();
    });

    it("deve expor getDirtyValues e retornar apenas valores alterados", async () => {
      const store = createTestStore();
      const { result } = renderHook(() => useBitForm<MyForm>(), {
        wrapper: (props) => wrapper({ ...props, store }),
      });

      expect(result.current.getDirtyValues()).toEqual({});

      await act(() => {
        store.setField("user.firstName", "Kenji");
      });

      expect(result.current.getDirtyValues()).toEqual({
        user: { firstName: "Kenji" },
      });
    });

    it("deve passar dirtyValues como segundo parâmetro no submit", async () => {
      const store = createTestStore();
      const submitHandler = vi.fn();
      const { result } = renderHook(() => useBitForm<MyForm>(), {
        wrapper: (props) => wrapper({ ...props, store }),
      });

      await act(() => {
        store.setField("user.firstName", "Updated");
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
      const { result } = renderHook(() => useBitForm<MyForm>(), {
        wrapper: (props) => wrapper({ ...props, store }),
      });

      await act(() => {
        store.setField("salary", 5000);
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
    it("deve rastrear status do step com reatividade e expor validateStep", async () => {
      const store = new BitStore<MyForm>({
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

      const { result } = renderHook(() => useBitScope("step1"), {
        wrapper: (props) => wrapper({ ...props, store }),
      });

      expect(result.current.status.hasErrors).toBe(false);
      expect(result.current.status.isDirty).toBe(false);
      expect(result.current.isValid).toBe(true);

      act(() => {
        store.setField("user.firstName", "Leo");
      });

      expect(result.current.status.isDirty).toBe(true);
      expect(result.current.isDirty).toBe(true);

      act(() => {
        store.setField("user.firstName", "");
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
      const store = new BitStore<MyForm>({
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

      const { result } = renderHook(() => useBitSteps(["step1", "step2"]), {
        wrapper: (props) => wrapper({ ...props, store }),
      });

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
        store.setField("user.firstName", "Leo");
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

      const store = new BitStore<{ name: string; email: string }>({
        initialValues: { name: "", email: "" },
        fields: {
          name: {
            scope: "step1",
            validation: {
              asyncValidate: async () => null,
              asyncValidateDelay: 500,
            },
          },
          email: { scope: "step2" },
        },
        validation: { delay: 0 },
      });

      const { result } = renderHook(() => useBitSteps(["step1", "step2"]), {
        wrapper: (props) => wrapper({ ...props, store }),
      });

      await act(() => {
        store.setField("name", "Leo");
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
      const store = new BitStore<MyForm>({
        initialValues: {
          salary: 0,
          user: { firstName: "", lastName: "" },
          skills: [],
          hasBonus: false,
          bonusValue: 0,
        },
        persist: { enabled: true, key: "react-test", storage, autoSave: false },
      });

      const { result } = renderHook(() => useBitPersist(), {
        wrapper: (props) => wrapper({ ...props, store }),
      });

      expect(typeof result.current.restore).toBe("function");
      expect(typeof result.current.save).toBe("function");
      expect(typeof result.current.clear).toBe("function");
      expect(result.current.meta.isSaving).toBe(false);
      expect(result.current.meta.isRestoring).toBe(false);
      expect(result.current.meta.error).toBeNull();
      store.cleanup();
    });

    it("deve salvar com save() e restaurar com restore()", async () => {
      const storage = createMockStorage();
      const store = new BitStore<MyForm>({
        initialValues: {
          salary: 0,
          user: { firstName: "Leo", lastName: "" },
          skills: [],
          hasBonus: false,
          bonusValue: 0,
        },
        persist: { enabled: true, key: "react-test", storage, autoSave: false },
      });

      const { result } = renderHook(() => useBitPersist(), {
        wrapper: (props) => wrapper({ ...props, store }),
      });

      await act(() => result.current.save());
      expect(storage.setItem).toHaveBeenCalled();

      store.setField("user.firstName", "Changed");
      const ok = await act(() => result.current.restore());
      expect(ok).toBe(true);
      expect(store.getState().values.user.firstName).toBe("Leo");
      store.cleanup();
    });

    it("deve limpar o rascunho com clear()", async () => {
      const storage = createMockStorage();
      storage._data["react-test"] = JSON.stringify({ salary: 999 });

      const store = new BitStore<MyForm>({
        initialValues: {
          salary: 0,
          user: { firstName: "", lastName: "" },
          skills: [],
          hasBonus: false,
          bonusValue: 0,
        },
        persist: { enabled: true, key: "react-test", storage },
      });

      const { result } = renderHook(() => useBitPersist(), {
        wrapper: (props) => wrapper({ ...props, store }),
      });

      await act(() => result.current.clear());
      expect(storage.removeItem).toHaveBeenCalledWith("react-test");
      store.cleanup();
    });
  });
});
