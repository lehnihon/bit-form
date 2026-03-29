/**
 * @group contract
 * Testes de contrato para inicialização do store.
 * Importa APENAS via entrypoint público - nunca caminhos internos.
 */
import { describe, it, expect } from "vitest";
import {
  createBitStore as createBitStoreRuntime,
  createFrameworkStoreAdapter,
} from "../../../core";

function adaptToLegacyFlat(store: any) {
  return {
    ...store,
    getState: () => store.read.getState(),
    getFieldState: (path: string) => store.read.getFieldState(path),
    isHidden: (path: string) => store.read.isHidden(path),
    isRequired: (path: string) => store.read.isRequired(path),
    setField: (path: string, value: unknown) =>
      store.write.setField(path, value),
  };
}

const createBitStore = ((config?: any) =>
  adaptToLegacyFlat(
    createFrameworkStoreAdapter(createBitStoreRuntime(config)),
  )) as any;

describe("Store Initialization Contract", () => {
  describe("initialValues", () => {
    it("deve criar store com valores iniciais simples", () => {
      const store = createBitStore({ initialValues: { name: "Leo", age: 30 } });
      expect(store.getState().values).toEqual({ name: "Leo", age: 30 });
    });

    it("deve criar store sem initialValues (objeto vazio)", () => {
      const store = createBitStore();
      expect(store.getState().values).toEqual({});
    });

    it("deve criar store com valores aninhados", () => {
      const store = createBitStore({
        initialValues: { user: { name: "Leo", address: { city: "SP" } } },
      });
      expect(store.getState().values.user.address.city).toBe("SP");
    });
  });

  describe("computed fields", () => {
    it("deve calcular campos computados na inicialização", () => {
      const store = createBitStore({
        initialValues: { price: 10, quantity: 3, total: 0 },
        fields: {
          total: {
            computed: (values: any) => values.price * values.quantity,
            computedDependsOn: ["price", "quantity"],
          },
        },
      });

      expect(store.getState().values.total).toBe(30);
    });

    it("deve recalcular campo computado ao mudar dependência", () => {
      const store = createBitStore({
        initialValues: { price: 10, quantity: 3, total: 0 },
        fields: {
          total: {
            computed: (values: any) => values.price * values.quantity,
            computedDependsOn: ["price", "quantity"],
          },
        },
      });

      store.setField("price" as any, 20 as any);
      expect(store.getState().values.total).toBe(60);
    });

    it("deve encadear campos computados (computed de computed)", () => {
      const store = createBitStore({
        initialValues: { base: 10, doubled: 0, quadrupled: 0 },
        fields: {
          doubled: {
            computed: (values: any) => values.base * 2,
            computedDependsOn: ["base"],
          },
          quadrupled: {
            computed: (values: any) => values.doubled * 2,
            computedDependsOn: ["doubled"],
          },
        },
      });

      store.setField("base" as any, 5 as any);
      expect(store.getState().values.doubled).toBe(10);
      expect(store.getState().values.quadrupled).toBe(20);
    });
  });

  describe("conditional fields", () => {
    it("deve ocultar campo condicional na inicialização quando showIf é falso", () => {
      const store = createBitStore({
        initialValues: { showExtra: false, extra: "" },
        fields: {
          extra: {
            conditional: {
              dependsOn: ["showExtra"],
              showIf: (values: any) => values.showExtra,
            },
          },
        },
      });

      expect(store.isHidden("extra" as any)).toBe(true);
    });

    it("deve mostrar campo condicional quando showIf é verdadeiro", () => {
      const store = createBitStore({
        initialValues: { showExtra: true, extra: "" },
        fields: {
          extra: {
            conditional: {
              dependsOn: ["showExtra"],
              showIf: (values: any) => values.showExtra,
            },
          },
        },
      });

      expect(store.isHidden("extra" as any)).toBe(false);
    });

    it("deve atualizar visibilidade ao mudar dependência condicional", () => {
      const store = createBitStore({
        initialValues: { showExtra: false, extra: "" },
        fields: {
          extra: {
            conditional: {
              dependsOn: ["showExtra"],
              showIf: (values: any) => values.showExtra,
            },
          },
        },
      });

      expect(store.isHidden("extra" as any)).toBe(true);
      store.setField("showExtra" as any, true as any);
      expect(store.isHidden("extra" as any)).toBe(false);
    });
  });

  describe("storeId e config", () => {
    it("não deve expor metadados internos na API pública", () => {
      const store = createBitStoreRuntime({ initialValues: { x: 1 } }) as any;
      expect(store.storeId).toBeUndefined();
      expect(store.config).toBeUndefined();
      expect(store.getConfig).toBeUndefined();
    });
  });
});
