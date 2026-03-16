import { act, renderHook } from "@testing-library/react";
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
        store.setField(
          `field_${index}` as keyof CompareFormValues & string,
          `value-${index}`,
        );
      }

      await store.validate();
      store.reset();
    },
  };
}

export function createRhfBulkHarness(totalFields: number): BenchmarkHarness {
  const initialValues = createLargeValues(totalFields);
  const { result, unmount } = renderHook(() =>
    useForm<CompareFormValues>({
      defaultValues: initialValues,
      mode: "onChange",
    }),
  );

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

        const emailValue = result.current.getValues("email");
        if (!emailValue) {
          result.current.setError("email", {
            type: "required",
            message: "required",
          });
        }

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
        store.setField("username", index % 2 === 0 ? "taken" : `user-${index}`);
      }

      await store.validate();
      store.reset();
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
      mode: "onChange",
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
    store.setField(
      `field_${index}` as keyof CompareFormValues & string,
      `value-${index}`,
    );
  }

  await store.validate();
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
    store.setField("username", index % 2 === 0 ? "taken" : `user-${index}`);
  }

  await store.validate();
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
