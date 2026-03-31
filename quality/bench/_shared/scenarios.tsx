import { useForm as useTanstackForm } from "@tanstack/react-form";
import { act, renderHook } from "@testing-library/react";
import { useFormik } from "formik";
import { useForm } from "react-hook-form";
import { createBitStore } from "../../../src";

export type CompareFormValues = Record<string, string> & {
  email: string;
  username: string;
};

export function createLargeValues(total: number): CompareFormValues {
  const values: Record<string, string> = {
    email: "",
    username: "",
  };

  for (let index = 0; index < total; index++) {
    values[`field_${index}`] = "";
  }

  return values as CompareFormValues;
}

export interface BenchmarkHarness {
  run: () => Promise<void>;
  teardown?: () => void | Promise<void>;
}

export async function settleReactCommit(): Promise<void> {
  await Promise.resolve();
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  await act(async () => {});
}

export function createBitFormBulkHarness(
  totalFields: number,
): BenchmarkHarness {
  const initialValues = createLargeValues(totalFields);
  const store = createBitStore<CompareFormValues>({
    initialValues,
    validation: {
      resolver: (values) => {
        const errors: Record<string, string | undefined> = {};
        if (!values.email) errors.email = "required";
        return errors;
      },
    },
  });

  return {
    run: async () => {
      for (let index = 0; index < totalFields; index++) {
        store.write.setField(
          `field_${index}` as keyof CompareFormValues & string,
          `value-${index}`,
        );
      }

      await store.feature.validate({ touch: false });
      store.write.reset();
    },
  };
}

export function createRhfBulkHarness(totalFields: number): BenchmarkHarness {
  const initialValues = createLargeValues(totalFields);
  const { result, unmount } = renderHook(() =>
    useForm<CompareFormValues>({
      defaultValues: initialValues,
      mode: "onSubmit",
      reValidateMode: "onSubmit",
    }),
  );

  result.current.register("email", {
    validate: (value) => (value ? true : "required"),
  });

  return {
    run: async () => {
      await act(async () => {
        for (let index = 0; index < totalFields; index++) {
          result.current.setValue(
            `field_${index}` as keyof CompareFormValues,
            `value-${index}`,
            {
              shouldDirty: true,
              shouldTouch: false,
              shouldValidate: false,
            },
          );
        }

        await result.current.trigger("email");
        result.current.reset(initialValues);
      });
    },
    teardown: () => {
      unmount();
    },
  };
}

export function createBitFormAsyncBurstHarness(
  iterations: number,
): BenchmarkHarness {
  const store = createBitStore<CompareFormValues>({
    initialValues: createLargeValues(220),
    fields: {
      username: {
        validation: {
          asyncValidateDelay: 5,
          asyncValidate: async (value) => {
            await new Promise((resolve) => setTimeout(resolve, 2));
            if (String(value).toLowerCase() === "taken") {
              return "already used";
            }
            return undefined;
          },
        },
      },
    },
  });

  return {
    run: async () => {
      for (let index = 0; index < iterations; index++) {
        store.write.setField(
          "username",
          index % 2 === 0 ? "taken" : `user-${index}`,
        );
      }

      await store.feature.validate({ touch: false });
      store.write.reset();
    },
  };
}

export function createRhfAsyncBurstHarness(
  iterations: number,
): BenchmarkHarness {
  const initialValues = createLargeValues(220);
  const { result, unmount } = renderHook(() =>
    useForm<CompareFormValues>({
      defaultValues: initialValues,
      mode: "onSubmit",
      reValidateMode: "onSubmit",
    }),
  );

  result.current.register("username", {
    validate: async (value) => {
      await new Promise((resolve) => setTimeout(resolve, 2));
      return String(value).toLowerCase() === "taken" ? "already used" : true;
    },
  });

  return {
    run: async () => {
      await act(async () => {
        for (let index = 0; index < iterations; index++) {
          result.current.setValue(
            "username",
            index % 2 === 0 ? "taken" : `user-${index}`,
            {
              shouldDirty: true,
              shouldTouch: false,
              shouldValidate: false,
            },
          );
        }

        await result.current.trigger("username");
        result.current.reset(initialValues);
      });
    },
    teardown: () => {
      unmount();
    },
  };
}

export function createFormikBulkHarness(totalFields: number): BenchmarkHarness {
  const initialValues = createLargeValues(totalFields);
  const { result, unmount } = renderHook(() =>
    useFormik<CompareFormValues>({
      initialValues,
      validateOnBlur: false,
      validateOnChange: false,
      validate: (values) => {
        const errors: Partial<Record<keyof CompareFormValues, string>> = {};
        if (!values.email) {
          errors.email = "required";
        }
        return errors;
      },
      onSubmit: () => {},
    }),
  );

  return {
    run: async () => {
      await act(async () => {
        for (let index = 0; index < totalFields; index++) {
          await result.current.setFieldValue(
            `field_${index}` as keyof CompareFormValues,
            `value-${index}`,
            false,
          );
        }

        await result.current.validateForm();
        result.current.resetForm({ values: initialValues });
      });
    },
    teardown: () => {
      unmount();
    },
  };
}

export function createTanstackBulkHarness(
  totalFields: number,
): BenchmarkHarness {
  const initialValues = createLargeValues(totalFields);
  const { result, unmount } = renderHook(() =>
    useTanstackForm<CompareFormValues>({
      defaultValues: initialValues,
      validators: {
        onSubmit: ({ value }) => {
          if (!value.email) {
            return {
              email: "required",
            };
          }
          return undefined;
        },
      },
      onSubmit: async () => {},
    }),
  );

  return {
    run: async () => {
      await act(async () => {
        for (let index = 0; index < totalFields; index++) {
          result.current.setFieldValue(
            `field_${index}` as keyof CompareFormValues,
            `value-${index}`,
            { dontValidate: true },
          );
        }

        await result.current.validateAllFields("submit");
        result.current.reset(initialValues);
      });
    },
    teardown: () => {
      unmount();
    },
  };
}

export function createFormikAsyncBurstHarness(
  iterations: number,
): BenchmarkHarness {
  const initialValues = createLargeValues(220);
  const { result, unmount } = renderHook(() =>
    useFormik<CompareFormValues>({
      initialValues,
      validateOnBlur: false,
      validateOnChange: false,
      validate: async (values) => {
        const errors: Partial<Record<keyof CompareFormValues, string>> = {};
        await new Promise((resolve) => setTimeout(resolve, 2));
        if (String(values.username).toLowerCase() === "taken") {
          errors.username = "already used";
        }
        return errors;
      },
      onSubmit: () => {},
    }),
  );

  return {
    run: async () => {
      await act(async () => {
        for (let index = 0; index < iterations; index++) {
          await result.current.setFieldValue(
            "username",
            index % 2 === 0 ? "taken" : `user-${index}`,
            false,
          );
        }

        await result.current.validateField("username");
        result.current.resetForm({ values: initialValues });
      });
    },
    teardown: () => {
      unmount();
    },
  };
}

export function createTanstackAsyncBurstHarness(
  iterations: number,
): BenchmarkHarness {
  const initialValues = createLargeValues(220);
  const { result, unmount } = renderHook(() =>
    useTanstackForm<CompareFormValues>({
      defaultValues: initialValues,
      validators: {
        onSubmitAsyncDebounceMs: 5,
        onSubmitAsync: async ({ value }) => {
          await new Promise((resolve) => setTimeout(resolve, 2));
          if (String(value.username).toLowerCase() === "taken") {
            return {
              username: "already used",
            };
          }
          return undefined;
        },
      },
      onSubmit: async () => {},
    }),
  );

  return {
    run: async () => {
      await act(async () => {
        for (let index = 0; index < iterations; index++) {
          result.current.setFieldValue(
            "username",
            index % 2 === 0 ? "taken" : `user-${index}`,
            { dontValidate: true },
          );
        }

        await result.current.validateField("username", "submit");
        result.current.reset(initialValues);
      });
    },
    teardown: () => {
      unmount();
    },
  };
}

export async function runBitFormBulkUpdate(totalFields: number) {
  const store = createBitStore<CompareFormValues>({
    initialValues: createLargeValues(totalFields),
    validation: {
      resolver: (values) => {
        const errors: Record<string, string | undefined> = {};
        if (!values.email) errors.email = "required";
        return errors;
      },
    },
  });

  for (let index = 0; index < totalFields; index++) {
    store.write.setField(
      `field_${index}` as keyof CompareFormValues & string,
      `value-${index}`,
    );
  }

  await store.feature.validate();
}

export async function runRhfBulkUpdate(totalFields: number) {
  const { result, unmount } = renderHook(() =>
    useForm<CompareFormValues>({
      defaultValues: createLargeValues(totalFields),
      mode: "onChange",
    }),
  );

  await act(async () => {
    for (let index = 0; index < totalFields; index++) {
      result.current.setValue(
        `field_${index}` as keyof CompareFormValues,
        `value-${index}`,
        {
          shouldDirty: true,
          shouldTouch: false,
          shouldValidate: false,
        },
      );
    }

    const emailValue = result.current.getValues("email");
    if (!emailValue) {
      result.current.setError("email", {
        type: "required",
        message: "required",
      });
    }
  });

  unmount();
}

export async function runBitFormAsyncBurst(iterations: number) {
  const store = createBitStore<CompareFormValues>({
    initialValues: createLargeValues(220),
    fields: {
      username: {
        validation: {
          asyncValidateDelay: 5,
          asyncValidate: async (value) => {
            await new Promise((resolve) => setTimeout(resolve, 2));
            if (String(value).toLowerCase() === "taken") {
              return "already used";
            }
            return undefined;
          },
        },
      },
    },
  });

  for (let index = 0; index < iterations; index++) {
    store.write.setField(
      "username",
      index % 2 === 0 ? "taken" : `user-${index}`,
    );
  }

  await store.feature.validate();
}

export async function runRhfAsyncBurst(iterations: number) {
  const { result, unmount } = renderHook(() =>
    useForm<CompareFormValues>({
      defaultValues: createLargeValues(220),
      mode: "onChange",
    }),
  );

  result.current.register("username", {
    validate: async (value) => {
      await new Promise((resolve) => setTimeout(resolve, 2));
      return String(value).toLowerCase() === "taken" ? "already used" : true;
    },
  });

  await act(async () => {
    for (let index = 0; index < iterations; index++) {
      result.current.setValue(
        "username",
        index % 2 === 0 ? "taken" : `user-${index}`,
        {
          shouldDirty: true,
          shouldTouch: false,
          shouldValidate: false,
        },
      );
    }

    await result.current.trigger("username");
  });

  unmount();
}
