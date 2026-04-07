// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createBitStore as createBitStoreRuntime } from "../../../core";
import { createBitReactNativeBindings } from "../../../react-native";

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

  it("deve retornar props específicas para React Native (onChangeText)", () => {
    const store = createTestStore({ name: "Leandro" });
    const bit = createBitReactNativeBindings<any>(store);
    const { result } = renderHook(() => bit.useBitField("name"));

    expect((result.current.props as any).onChange).toBeUndefined();
    expect(result.current.props.onChangeText).toBeDefined();
  });

  it("deve garantir que o value seja SEMPRE uma string (requisito do TextInput)", () => {
    const store = createTestStore({ age: 25, price: null });
    const bit = createBitReactNativeBindings<any>(store);
    const { result: ageField } = renderHook(() => bit.useBitField("age"));
    expect(ageField.current.props.value).toBe("25");
  });

  it("deve atualizar a store corretamente via onChangeText", () => {
    const store = createTestStore({ bio: "" });
    const bit = createBitReactNativeBindings<any>(store);
    const { result } = renderHook(() => bit.useBitField("bio"));

    act(() => {
      result.current.props.onChangeText("Desenvolvedor BitForm");
    });

    expect(result.current.value).toBe("Desenvolvedor BitForm");
    expect(store.read.getState().values.bio).toBe("Desenvolvedor BitForm");
  });

  it("deve disparar onBlur corretamente no mobile", () => {
    const store = createTestStore({ email: "" });
    const bit = createBitReactNativeBindings<any>(store);
    const { result } = renderHook(() => bit.useBitField("email"));

    act(() => {
      result.current.props.onBlur();
    });

    expect(result.current.meta.touched).toBe(true);
  });

  it("deve reagir a isHidden e isRequired no mobile", () => {
    const store = createTestStore({ type: "PF", cnpj: "" });
    const bit = createBitReactNativeBindings<any>(store);
    store.feature.registerField("cnpj", {
      conditional: {
        dependsOn: ["type"],
        showIf: (v: any) => v.type === "PJ",
      },
    });

    const { result } = renderHook(() => ({
      type: bit.useBitField("type"),
      cnpj: bit.useBitField("cnpj"),
    }));

    expect(result.current.cnpj.meta.isHidden).toBe(true);

    act(() => {
      result.current.type.setValue("PJ");
    });

    expect(result.current.cnpj.meta.isHidden).toBe(false);
  });

  it("deve limpar config ao desmontar o hook no mobile", () => {
    const store = createTestStore({ name: "" });
    const bit = createBitReactNativeBindings<any>(store);
    const spy = vi.spyOn(store.feature, "unregisterField");

    const { unmount } = renderHook(() => bit.useBitField("name"));

    unmount();
    expect(spy).toHaveBeenCalledWith("name");
  });
});
