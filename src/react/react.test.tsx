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
}

describe("React Integration (Context + Hooks)", () => {
  const createTestStore = (initialValues?: Partial<MyForm>) =>
    new BitStore<MyForm>({
      initialValues: {
        salary: 10,
        user: { firstName: "Leandro", lastName: "Ishikawa" },
        skills: ["React"],
        ...initialValues,
      },
      validationDelay: 0,
    });

  const wrapper = ({ children, store }: any) => (
    <BitFormProvider store={store}>{children}</BitFormProvider>
  );

  describe("Basic Field Logic", () => {
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

      await act(async () => {
        result.current.field.setValue("Kenji");
      });

      expect(result.current.field.value).toBe("Kenji");
      expect(result.current.form.isDirty).toBe(true);

      await act(async () => {
        store.setError("user.firstName", "Erro");
        result.current.field.setBlur();
      });

      expect(result.current.field.invalid).toBe(true);
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

      await act(async () => {
        result.current.setValue("R$ 2.500,50");
      });

      expect(result.current.props.value).toBe("R$ 2.500,50");
      expect(store.getState().values.salary).toBe(2500.5);
    });

    it("deve aceitar máscaras de padrão (pattern) como CPF", async () => {
      const store = createTestStore();
      const { result } = renderHook(
        () => useBitField("user.lastName", { mask: "cpf" }),
        { wrapper: (props) => wrapper({ ...props, store }) },
      );

      await act(async () => {
        result.current.setValue("12345678901");
      });

      expect(result.current.props.value).toBe("123.456.789-01");
      expect(store.getState().values.user.lastName).toBe("12345678901");
    });
  });

  describe("Arrays & Iteration", () => {
    it("deve gerenciar listas dinâmicas com useBitFieldArray e keys estáveis", async () => {
      const store = createTestStore();
      const { result } = renderHook(() => useBitFieldArray("skills"), {
        wrapper: (props) => wrapper({ ...props, store }),
      });

      const initialKey = result.current.fields[0].key;
      expect(initialKey).toBeDefined();

      await act(async () => {
        result.current.append("Vue");
      });

      await act(async () => {
        result.current.move(0, 1);
      });

      expect(store.getState().values.skills).toEqual(["Vue", "React"]);
      expect(result.current.fields[1].key).toBe(initialKey);
    });
  });

  describe("Watchers & Helpers", () => {
    it("deve observar campos específicos com useBitWatch", async () => {
      const store = createTestStore();
      const { result } = renderHook(() => useBitWatch("user.firstName"), {
        wrapper: (props) => wrapper({ ...props, store }),
      });

      expect(result.current).toBe("Leandro");

      await act(async () => {
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

      await act(async () => {
        result.current.field.setValue("Novo Nome");
        result.current.field.setBlur();
        store.setError("user.firstName", "Erro");
      });

      await act(async () => {
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

      await act(async () => {
        await result.current.submit(onSubmit)(mockEvent);
      });

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(onSubmit).toHaveBeenCalled();

      expect(result.current.getValues().salary).toBe(10);
    });
  });
});
