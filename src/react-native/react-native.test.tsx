import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { BitStore } from "../core";
import { BitFormProvider, useBitField } from "./index";

describe("React Native Integration (bit-form/react-native)", () => {
  const createTestStore = (initialValues: any) =>
    new BitStore({
      initialValues,
      validationDelay: 0,
    });

  const wrapper = ({ children, store }: any) => (
    <BitFormProvider store={store}>{children}</BitFormProvider>
  );

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
    expect(store.getState().values.bio).toBe("Desenvolvedor BitForm");
  });

  it("deve disparar onBlur corretamente no mobile", () => {
    const store = createTestStore({ email: "" });
    const { result } = renderHook(() => useBitField("email"), {
      wrapper: (props) => wrapper({ ...props, store }),
    });

    act(() => {
      result.current.props.onBlur();
    });

    expect(result.current.touched).toBe(true);
  });

  it("deve reagir a isHidden e isRequired no mobile", () => {
    const store = createTestStore({ type: "PF", cnpj: "" });
    store.registerConfig("cnpj", {
      dependsOn: ["type"],
      showIf: (v: any) => v.type === "PJ",
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

    expect(result.current.cnpj.isHidden).toBe(true);

    act(() => {
      result.current.type.setValue("PJ");
    });

    expect(result.current.cnpj.isHidden).toBe(false);
  });

  it("deve limpar config ao desmontar o hook no mobile", () => {
    const store = createTestStore({ name: "" });
    const spy = vi.spyOn(store, "unregisterField");

    const { unmount } = renderHook(() => useBitField("name"), {
      wrapper: (props) => wrapper({ ...props, store }),
    });

    unmount();
    expect(spy).toHaveBeenCalledWith("name");
  });
});
