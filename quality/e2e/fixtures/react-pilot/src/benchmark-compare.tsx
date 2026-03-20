import React, { useEffect, useMemo, useState } from "react";
import { useFormik } from "formik";
import { useForm as useReactHookForm } from "react-hook-form";
import { useForm as useTanstackForm } from "@tanstack/react-form";
import { createBitStore } from "../../../../../src/core";

type CompareValues = Record<string, string> & {
  email: string;
  username: string;
};

type ScenarioResult = {
  scenario: string;
  bitFormMedianMs: number;
  rhfMedianMs: number;
  formikMedianMs: number;
  tanstackMedianMs: number;
  bitVsRhf: number;
  bitVsFormik: number;
  bitVsTanstack: number;
};

type BenchmarkResult = {
  status: "done";
  scenarios: ScenarioResult[];
};

declare global {
  interface Window {
    __BIT_FORM_COMPARE_BENCH__?: {
      run: () => Promise<BenchmarkResult>;
    };
  }
}

function createValues(total: number): CompareValues {
  const values: Record<string, string> = {
    email: "",
    username: "",
  };

  for (let index = 0; index < total; index++) {
    values[`field_${index}`] = "";
  }

  return values as CompareValues;
}

async function settleCommit() {
  await Promise.resolve();
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 0) return 0;
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

async function runMeasured(
  run: () => Promise<void>,
  warmups: number,
  samples: number,
) {
  for (let index = 0; index < warmups; index++) {
    await settleCommit();
    await run();
    await settleCommit();
  }

  const values: number[] = [];

  for (let index = 0; index < samples; index++) {
    await settleCommit();
    const start = performance.now();
    await run();
    await settleCommit();
    values.push(performance.now() - start);
  }

  return median(values);
}

export function BenchmarkCompareApp() {
  const [resultText, setResultText] = useState("idle");

  const bulkFields = 500;
  const asyncIterations = 200;
  const warmups = 6;
  const samples = 24;

  const initialBulkValues = useMemo(
    () => createValues(bulkFields),
    [bulkFields],
  );
  const initialAsyncValues = useMemo(() => createValues(220), []);

  const bitFormBulk = useMemo(
    () =>
      createBitStore<CompareValues>({
        initialValues: initialBulkValues,
        validation: {
          resolver: (values) => ({
            email: values.email ? undefined : "required",
          }),
        },
      }),
    [initialBulkValues],
  );

  const bitFormAsync = useMemo(
    () =>
      createBitStore<CompareValues>({
        initialValues: initialAsyncValues,
        fields: {
          username: {
            validation: {
              asyncValidateDelay: 5,
              asyncValidate: async (value) => {
                await new Promise((resolve) => setTimeout(resolve, 2));
                return String(value).toLowerCase() === "taken"
                  ? "already used"
                  : undefined;
              },
            },
          },
        },
      }),
    [initialAsyncValues],
  );

  const rhfBulk = useReactHookForm<CompareValues>({
    defaultValues: initialBulkValues,
    mode: "onSubmit",
    reValidateMode: "onSubmit",
  });

  const rhfAsync = useReactHookForm<CompareValues>({
    defaultValues: initialAsyncValues,
    mode: "onSubmit",
    reValidateMode: "onSubmit",
  });

  const formikBulk = useFormik<CompareValues>({
    initialValues: initialBulkValues,
    validateOnBlur: false,
    validateOnChange: false,
    validate: (values) => ({
      email: values.email ? undefined : "required",
    }),
    onSubmit: () => {},
  });

  const formikAsync = useFormik<CompareValues>({
    initialValues: initialAsyncValues,
    validateOnBlur: false,
    validateOnChange: false,
    validate: async (values) => {
      await new Promise((resolve) => setTimeout(resolve, 2));
      return {
        username:
          String(values.username).toLowerCase() === "taken"
            ? "already used"
            : undefined,
      };
    },
    onSubmit: () => {},
  });

  const tanstackBulk = useTanstackForm<CompareValues>({
    defaultValues: initialBulkValues,
    validators: {
      onSubmit: ({ value }) => ({
        email: value.email ? undefined : "required",
      }),
    },
    onSubmit: async () => {},
  });

  const tanstackAsync = useTanstackForm<CompareValues>({
    defaultValues: initialAsyncValues,
    validators: {
      onSubmitAsyncDebounceMs: 5,
      onSubmitAsync: async ({ value }) => {
        await new Promise((resolve) => setTimeout(resolve, 2));
        return {
          username:
            String(value.username).toLowerCase() === "taken"
              ? "already used"
              : undefined,
        };
      },
    },
    onSubmit: async () => {},
  });

  useEffect(() => {
    rhfBulk.register("email", {
      validate: (value) => (value ? true : "required"),
    });
    rhfAsync.register("username", {
      validate: async (value) => {
        await new Promise((resolve) => setTimeout(resolve, 2));
        return String(value).toLowerCase() === "taken" ? "already used" : true;
      },
    });
  }, [rhfAsync, rhfBulk]);

  useEffect(() => {
    window.__BIT_FORM_COMPARE_BENCH__ = {
      run: async () => {
        const bitBulkMedian = await runMeasured(
          async () => {
            for (let index = 0; index < bulkFields; index++) {
              bitFormBulk.setField(`field_${index}`, `value-${index}`);
            }
            await bitFormBulk.validate({ touch: false });
            bitFormBulk.reset();
          },
          warmups,
          samples,
        );

        const rhfBulkMedian = await runMeasured(
          async () => {
            for (let index = 0; index < bulkFields; index++) {
              rhfBulk.setValue(`field_${index}`, `value-${index}`, {
                shouldDirty: true,
                shouldTouch: false,
                shouldValidate: false,
              });
            }
            await rhfBulk.trigger("email");
            rhfBulk.reset(initialBulkValues);
          },
          warmups,
          samples,
        );

        const formikBulkMedian = await runMeasured(
          async () => {
            for (let index = 0; index < bulkFields; index++) {
              await formikBulk.setFieldValue(
                `field_${index}`,
                `value-${index}`,
                false,
              );
            }
            await formikBulk.validateForm();
            formikBulk.resetForm({ values: initialBulkValues });
          },
          warmups,
          samples,
        );

        const tanstackBulkMedian = await runMeasured(
          async () => {
            for (let index = 0; index < bulkFields; index++) {
              tanstackBulk.setFieldValue(`field_${index}`, `value-${index}`, {
                dontValidate: true,
              });
            }
            await tanstackBulk.validateAllFields("submit");
            tanstackBulk.reset(initialBulkValues);
          },
          warmups,
          samples,
        );

        const bitAsyncMedian = await runMeasured(
          async () => {
            for (let index = 0; index < asyncIterations; index++) {
              bitFormAsync.setField(
                "username",
                index % 2 === 0 ? "taken" : `user-${index}`,
              );
            }
            await bitFormAsync.validate({ touch: false });
            bitFormAsync.reset();
          },
          warmups,
          samples,
        );

        const rhfAsyncMedian = await runMeasured(
          async () => {
            for (let index = 0; index < asyncIterations; index++) {
              rhfAsync.setValue(
                "username",
                index % 2 === 0 ? "taken" : `user-${index}`,
                {
                  shouldDirty: true,
                  shouldTouch: false,
                  shouldValidate: false,
                },
              );
            }
            await rhfAsync.trigger("username");
            rhfAsync.reset(initialAsyncValues);
          },
          warmups,
          samples,
        );

        const formikAsyncMedian = await runMeasured(
          async () => {
            for (let index = 0; index < asyncIterations; index++) {
              await formikAsync.setFieldValue(
                "username",
                index % 2 === 0 ? "taken" : `user-${index}`,
                false,
              );
            }
            await formikAsync.validateField("username");
            formikAsync.resetForm({ values: initialAsyncValues });
          },
          warmups,
          samples,
        );

        const tanstackAsyncMedian = await runMeasured(
          async () => {
            for (let index = 0; index < asyncIterations; index++) {
              tanstackAsync.setFieldValue(
                "username",
                index % 2 === 0 ? "taken" : `user-${index}`,
                { dontValidate: true },
              );
            }
            await tanstackAsync.validateField("username", "submit");
            tanstackAsync.reset(initialAsyncValues);
          },
          warmups,
          samples,
        );

        const output: BenchmarkResult = {
          status: "done",
          scenarios: [
            {
              scenario: "bulk",
              bitFormMedianMs: Number(bitBulkMedian.toFixed(2)),
              rhfMedianMs: Number(rhfBulkMedian.toFixed(2)),
              formikMedianMs: Number(formikBulkMedian.toFixed(2)),
              tanstackMedianMs: Number(tanstackBulkMedian.toFixed(2)),
              bitVsRhf: Number((bitBulkMedian / rhfBulkMedian).toFixed(2)),
              bitVsFormik: Number(
                (bitBulkMedian / formikBulkMedian).toFixed(2),
              ),
              bitVsTanstack: Number(
                (bitBulkMedian / tanstackBulkMedian).toFixed(2),
              ),
            },
            {
              scenario: "async",
              bitFormMedianMs: Number(bitAsyncMedian.toFixed(2)),
              rhfMedianMs: Number(rhfAsyncMedian.toFixed(2)),
              formikMedianMs: Number(formikAsyncMedian.toFixed(2)),
              tanstackMedianMs: Number(tanstackAsyncMedian.toFixed(2)),
              bitVsRhf: Number((bitAsyncMedian / rhfAsyncMedian).toFixed(2)),
              bitVsFormik: Number(
                (bitAsyncMedian / formikAsyncMedian).toFixed(2),
              ),
              bitVsTanstack: Number(
                (bitAsyncMedian / tanstackAsyncMedian).toFixed(2),
              ),
            },
          ],
        };

        setResultText(JSON.stringify(output, null, 2));
        return output;
      },
    };

    return () => {
      delete window.__BIT_FORM_COMPARE_BENCH__;
    };
  }, [
    asyncIterations,
    bitFormAsync,
    bitFormBulk,
    bulkFields,
    formikAsync,
    formikBulk,
    initialAsyncValues,
    initialBulkValues,
    rhfAsync,
    rhfBulk,
    samples,
    tanstackAsync,
    tanstackBulk,
    warmups,
  ]);

  return (
    <main style={{ display: "grid", gap: 12, padding: 16 }}>
      <h1>Browser Benchmark Compare</h1>
      <button
        data-testid="run-browser-benchmark"
        onClick={async () => {
          setResultText("running");
          const result = await window.__BIT_FORM_COMPARE_BENCH__?.run();
          if (!result) {
            setResultText("error");
          }
        }}
      >
        Run benchmark
      </button>
      <pre data-testid="browser-benchmark-result">{resultText}</pre>
    </main>
  );
}
