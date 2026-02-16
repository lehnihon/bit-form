import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { BitStore } from "../../src/core";
import {
  BitFormProvider,
  useBitField,
  useBitForm,
  useBitFieldArray,
  useBitWatch,
} from "../../src/react";

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
  const createTestStore = (initialValues?: Partial<MyForm>) =>
    new BitStore<MyForm>({
      initialValues: {
        salary: 10,
        user: { firstName: "Leandro", lastName: "Ishikawa" },
        skills: ["React"],
        hasBonus: false,
        bonusValue: 0,
        ...initialValues,
      },
      validationDelay: 0,
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

      expect(result.current.form.isDirty).toBe(false);

      await act(() => {
        result.current.field.setValue("Kenji");
      });

      expect(result.current.field.value).toBe("Kenji");
      expect(result.current.form.isDirty).toBe(true);

      await act(() => {
        result.current.field.setBlur();
      });

      await act(() => {
        store.setError("user.firstName", "Erro");
      });

      expect(result.current.field.invalid).toBe(true);
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

      store.registerConfig("bonusValue", {
        dependsOn: ["hasBonus"],
        showIf: (v) => v.hasBonus === true,
        requiredIf: (v) => v.hasBonus === true,
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

      expect(result.current.value.isHidden).toBe(true);
      expect(result.current.value.isRequired).toBe(false);

      await act(() => {
        result.current.bonus.setValue(true);
      });

      expect(result.current.value.isHidden).toBe(false);
      expect(result.current.value.isRequired).toBe(true);
    });
  });

  describe("Masks & Formatting", () => {
    it("deve aplicar máscara no displayValue mas manter valor limpo na store", async () => {
      const store = createTestStore({ salary: 10 });
      const { result } = renderHook(
        () => useBitField("salary", { mask: "brl" }),
        { wrapper: (props) => wrapper({ ...props, store }) },
      );

      expect(result.current.props.value).toBe("R$ 10,00");

      await act(() => {
        result.current.setValue("R$ 2.500,50");
      });

      expect(result.current.props.value).toBe("R$ 2.500,50");
      expect(store.getState().values.salary).toBe(2500.5);
    });

    it("deve aceitar máscaras de padrão (pattern) como CPF", async () => {
      const store = createTestStore();
      store.registerMask("cpf", {
        format: (v) => v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4"),
        parse: (v) => v.replace(/\D/g, ""),
      });

      const { result } = renderHook(
        () => useBitField("user.lastName", { mask: "cpf" }),
        { wrapper: (props) => wrapper({ ...props, store }) },
      );

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

      const { result } = renderHook(() => useBitFieldArray("skills"), {
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

      const { result } = renderHook(() => useBitFieldArray("skills"), {
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
      expect(result.current.field.error).toBeUndefined();
      expect(result.current.form.isDirty).toBe(false);
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
  });
});
