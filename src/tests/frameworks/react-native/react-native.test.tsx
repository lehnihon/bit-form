// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { createBitStore as createBitStoreRuntime } from "../../../core";
import { BitFormProvider, useBitField } from "../../../react-native";

function createBitStore<T extends object = Record<string, unknown>>(
  config?: any,
) {
  return createBitStoreRuntime<T>(config) as any;
}

describe("React Native Integration (bit-form/react-native)", () => {
  const createTestStore = (initialValues: any) =>
    createBitStore({
      initialValues,
      validation: { delay: 0 },
    });

  const wrapper = ({ children, store }: any) => (
    <BitFormProvider store={store}>{children}</BitFormProvider>
  );

  it("deve aceitar store estritamente tipada no BitFormProvider reexportado", () => {
    const strictStore = createBitStoreRuntime<{ name: string }>({
      initialValues: { name: "Leandro" },
      validation: { delay: 0 },
    });

    const { result } = renderHook(() => useBitField("name"), {
      wrapper: ({ children }) => (
        <BitFormProvider store={strictStore}>{children}</BitFormProvider>
      ),
    });

    expect(result.current.value).toBe("Leandro");
  });

  it("deve aceitar store estritamente tipada com React.createElement no reexport", () => {
    const strictStore = createBitStoreRuntime<{ name: string }>({
      initialValues: { name: "Leandro" },
      validation: { delay: 0 },
    });

    const { result } = renderHook(() => useBitField("name"), {
      wrapper: ({ children }) =>
        React.createElement(BitFormProvider, {
          store: strictStore,
          children,
        }),
    });

    expect(result.current.value).toBe("Leandro");
  });

  it("deve retornar props específicas para React Native (onChangeText)", () => {
    const store = createTestStore({ name: "Leandro" });
    const { result } = renderHook(() => useBitField("name"), {
      wrapper: (props) => wrapper({ ...props, store }),
    });

    expect((result.current.props as any).onChange).toBeUndefined();
    expect(result.current.props.onChangeText).toBeDefined();
  });

  it("deve garantir que o value seja SEMPRE uma string (requisito do TextInput)", () => {
    const store = createTestStore({ age: 25, price: null });
    const { result: ageField } = renderHook(() => useBitField("age"), {
      wrapper: (props) => wrapper({ ...props, store }),
    });
    expect(ageField.current.props.value).toBe("25");
  });

  it("deve atualizar a store corretamente via onChangeText", () => {
    const store = createTestStore({ bio: "" });
    const { result } = renderHook(() => useBitField("bio"), {
      wrapper: (props) => wrapper({ ...props, store }),
    });

    act(() => {
      result.current.props.onChangeText("Desenvolvedor BitForm");
    });

    expect(result.current.value).toBe("Desenvolvedor BitForm");
    expect(store.read.getState().values.bio).toBe("Desenvolvedor BitForm");
  });

  it("deve disparar onBlur corretamente no mobile", () => {
    const store = createTestStore({ email: "" });
    const { result } = renderHook(() => useBitField("email"), {
      wrapper: (props) => wrapper({ ...props, store }),
    });

    act(() => {
      result.current.props.onBlur();
    });

    expect(result.current.meta.touched).toBe(true);
  });

  it("deve reagir a isHidden e isRequired no mobile", () => {
    const store = createTestStore({ type: "PF", cnpj: "" });
    store.feature.registerField("cnpj", {
      conditional: {
        dependsOn: ["type"],
        showIf: (v: any) => v.type === "PJ",
      },
    });

    const { result } = renderHook(
      () => ({
        type: useBitField("type"),
        cnpj: useBitField("cnpj"),
      }),
      {
        wrapper: (props) => wrapper({ ...props, store }),
      },
    );

    expect(result.current.cnpj.meta.isHidden).toBe(true);

    act(() => {
      result.current.type.setValue("PJ");
    });

    expect(result.current.cnpj.meta.isHidden).toBe(false);
  });

  it("deve limpar config ao desmontar o hook no mobile", () => {
    const store = createTestStore({ name: "" });
    const spy = vi.spyOn(store.feature, "unregisterField");

    const { unmount } = renderHook(() => useBitField("name"), {
      wrapper: (props) => wrapper({ ...props, store }),
    });

    unmount();
    expect(spy).toHaveBeenCalledWith("name");
  });
});
