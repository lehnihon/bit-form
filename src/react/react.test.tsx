/* eslint-disable @typescript-eslint/no-explicit-any */
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
  salary: string | number;
  user: {
    firstName: string;
    lastName: string;
  };
  skills: string[];
}

describe("React Integration (Context + Hooks)", () => {
  const createTestStore = () =>
    new BitStore<MyForm>({
      initialValues: {
        salary: "R$ 1.000,00",
        user: { firstName: "Leandro", lastName: "Ishikawa" },
        skills: ["React"],
      },
      validationDelay: 0,
    });

  const wrapper = ({ children, store }: any) => (
    <BitFormProvider store={store}>{children}</BitFormProvider>
  );

  it("deve sincronizar useBitField, rastrear isDirty e invalid", async () => {
    const store = createTestStore();
    const { result } = renderHook(
      () => ({
        field: useBitField("user.firstName"),
        form: useBitForm(),
      }),
      {
        wrapper: (props) => wrapper({ ...props, store }),
      },
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

  it("deve gerenciar listas dinâmicas com useBitFieldArray e IDs estáveis", async () => {
    const store = createTestStore();
    const { result } = renderHook(() => useBitFieldArray("skills"), {
      wrapper: (props) => wrapper({ ...props, store }),
    });

    const initialId = result.current.fields[0].id;
    expect(initialId).toBeDefined();

    await act(async () => {
      result.current.append("Vue");
      result.current.move(0, 1);
    });

    expect(store.getState().values.skills).toEqual(["Vue", "React"]);
    expect(result.current.fields[1].id).toBe(initialId);
  });

  it("deve observar campos específicos com useBitWatch sem afetar o estado global do componente", async () => {
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

  it("deve resetar o formulário e limpar estados de erro/touched", async () => {
    const store = createTestStore();
    const { result } = renderHook(
      () => ({
        field: useBitField("user.firstName"),
        form: useBitForm(),
      }),
      {
        wrapper: (props) => wrapper({ ...props, store }),
      },
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

  it("deve lidar com submissão e preventDefault corretamente", async () => {
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
  });

  // --- NOVO TESTE PARA REACT NATIVE ---
  it("deve fornecer mobileProps compatíveis com React Native (TextInput)", async () => {
    const store = createTestStore();
    const { result } = renderHook(
      () => ({
        // Testando um campo numérico para garantir a conversão para string
        // React Native crasha se passar number para TextInput value
        salaryField: useBitField("salary"),
        nameField: useBitField("user.firstName"),
      }),
      {
        wrapper: (props) => wrapper({ ...props, store }),
      },
    );

    // 1. Verifica se mobileProps existe e tem as chaves certas
    expect(result.current.nameField.mobileProps).toBeDefined();
    expect(result.current.nameField.mobileProps.onChangeText).toBeDefined();

    // 2. Simula digitação no Mobile (onChangeText recebe string direta, não evento)
    await act(async () => {
      result.current.nameField.mobileProps.onChangeText("Mobile User");
    });

    expect(result.current.nameField.value).toBe("Mobile User");
    expect(store.getState().values.user.firstName).toBe("Mobile User");

    // 3. Verifica segurança de tipo (Safety String Check)
    // Mesmo que na store seja number, no mobileProps.value deve vir string
    await act(async () => {
      store.setField("salary", 5000);
    });

    expect(store.getState().values.salary).toBe(5000); // Store tem number
    expect(typeof result.current.salaryField.mobileProps.value).toBe("string"); // Mobile recebe string "5000"
    expect(result.current.salaryField.mobileProps.value).toBe("5000");
  });
});
