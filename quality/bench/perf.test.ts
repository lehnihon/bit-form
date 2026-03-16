import { describe, expect, it } from "vitest";
import { createBitStore } from "../../src";

type BigForm = Record<string, string> & {
  email: string;
  username: string;
};

function createBigValues(total: number): BigForm {
  const values: Record<string, string> = {
    email: "",
    username: "",
  };

  for (let index = 0; index < total; index++) {
    values[`field_${index}`] = "";
  }

  return values as BigForm;
}

describe("quality perf baseline", () => {
  it("updates 300 fields under baseline budget", () => {
    const store = createBitStore<BigForm>({
      initialValues: createBigValues(300),
      validation: {
        resolver: (values) => {
          const errors: Record<string, string | undefined> = {};
          if (!values.email) errors.email = "required";
          return errors;
        },
      },
    });

    const start = performance.now();

    for (let index = 0; index < 300; index++) {
      store.setField(
        `field_${index}` as keyof BigForm & string,
        `value-${index}`,
      );
    }

    const duration = performance.now() - start;
    expect(duration).toBeLessThan(250);
  });

  it("handles async validation burst under baseline budget", async () => {
    const store = createBitStore<BigForm>({
      initialValues: createBigValues(220),
      fields: {
        username: {
          validation: {
            asyncValidateDelay: 10,
            asyncValidate: async (value) => {
              await new Promise((resolve) => setTimeout(resolve, 15));
              if (String(value).toLowerCase() === "taken") {
                return "already used";
              }
              return undefined;
            },
          },
        },
      },
      validation: {
        resolver: (values) => {
          const errors: Record<string, string | undefined> = {};
          if (!values.email) errors.email = "required";
          return errors;
        },
      },
    });

    const start = performance.now();

    for (let index = 0; index < 120; index++) {
      store.setField("username", index % 2 === 0 ? "taken" : `user-${index}`);
    }

    await store.validate();

    const duration = performance.now() - start;
    expect(duration).toBeLessThan(50);
  });
});
