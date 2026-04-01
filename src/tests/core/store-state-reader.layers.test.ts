import { describe, expect, it } from "vitest";
import { BitStoreStateReader } from "../../core/store/shared/store-state-reader";

describe("BitStoreStateReader layers", () => {
  it("deve expor camadas sem quebrar getState", () => {
    const state = {
      values: { name: "Leandro" },
      errors: { name: "required" },
      touched: { name: true },
      isValidating: { name: true },
      persist: { isSaving: false, isRestoring: false, error: null },
      isValid: false,
      isSubmitting: true,
      isDirty: true,
    };

    const reader = new BitStoreStateReader<any>({
      getState: () => state,
      isHidden: () => false,
      isRequired: () => false,
      isFieldDirty: () => false,
      isFieldValidating: () => false,
    });

    expect(reader.getState()).toBe(state);

    expect(reader.getUserLayer()).toEqual({
      values: state.values,
      touched: state.touched,
    });

    expect(reader.getValidationLayer()).toEqual({
      errors: state.errors,
      isValidating: state.isValidating,
      isValid: state.isValid,
    });

    expect(reader.getDerivedLayer()).toEqual({
      isDirty: state.isDirty,
    });

    expect(reader.getFeatureLayer()).toEqual({
      persist: state.persist,
      isSubmitting: state.isSubmitting,
    });
  });
});
