/**
 * @group contract
 * Testes de contrato para os facades do BitStore.
 * Garante que a divisão em facades (read/write/observe/register/feature) não
 * quebrou nenhum método público. Importa APENAS via entrypoint público.
 */
import { describe, it, expect, vi } from "vitest";
import { createBitStore } from "../../../core";

describe("Store Facades Contract", () => {
  // ── Read Facade ──────────────────────────────────────────────────────────

  describe("ReadFacade (getState / getFieldState / query)", () => {
    it("getState retorna o estado atual", () => {
      const store = createBitStore({ initialValues: { x: 1 } });
      const state = store.getState();
      expect((state.values as any).x).toBe(1);
      expect(state.isValid).toBeDefined();
      expect(state.isDirty).toBeDefined();
    });

    it("getFieldState retorna snapshot com value, isDirty, etc.", () => {
      const store = createBitStore({ initialValues: { name: "Leo" } });
      store.setField("name" as any, "Ana" as any);
      const fs = store.getFieldState("name" as any);
      expect(fs.value).toBe("Ana");
      expect(fs.isDirty).toBe(true);
    });

    it("isValid / isSubmitting / isDirty são getters", () => {
      const store = createBitStore({ initialValues: { x: 1 } });
      expect(typeof store.isValid).toBe("boolean");
      expect(typeof store.isSubmitting).toBe("boolean");
      expect(typeof store.isDirty).toBe("boolean");
    });

    it("isFieldDirty retorna false antes de mudar e true depois", () => {
      const store = createBitStore({ initialValues: { x: 1 } });
      expect(store.isFieldDirty("x")).toBe(false);
      store.setField("x" as any, 2 as any);
      expect(store.isFieldDirty("x")).toBe(true);
    });

    it("getDirtyValues retorna apenas campos modificados", () => {
      const store = createBitStore({
        initialValues: { name: "Leo", age: 30 },
      });
      store.setField("name" as any, "Ana" as any);
      const dirty = store.getDirtyValues();
      expect(Object.keys(dirty)).toEqual(["name"]);
      expect((dirty as any).name).toBe("Ana");
    });

    it("getPersistMetadata retorna objeto de persist do estado", () => {
      const store = createBitStore({ initialValues: { x: 1 } });
      const meta = store.getPersistMetadata();
      expect(meta).toHaveProperty("isSaving");
      expect(meta).toHaveProperty("isRestoring");
    });

    it("getHistoryMetadata retorna objeto de histórico", () => {
      const store = createBitStore({ initialValues: { x: 1 } });
      const meta = store.getHistoryMetadata();
      expect(meta).toHaveProperty("canUndo");
      expect(meta).toHaveProperty("canRedo");
    });

    it("getScopeStatus retorna status de escopo com campos hasErrors/isDirty/errors", () => {
      const store = createBitStore({ initialValues: { x: 1 } });
      const status = store.getScopeStatus("myScope");
      expect(status).toBeDefined();
      expect(status).toHaveProperty("hasErrors");
      expect(status).toHaveProperty("isDirty");
      expect(status).toHaveProperty("errors");
    });

    it("getScopeErrors retorna errors de escopo (vazio por padrão)", () => {
      const store = createBitStore({ initialValues: { x: 1 } });
      const errors = store.getScopeErrors("myScope");
      expect(typeof errors).toBe("object");
    });
  });

  // ── Write Facade ─────────────────────────────────────────────────────────

  describe("WriteFacade (setField / setValues / errors / reset / submit)", () => {
    it("setField atualiza valor no estado", () => {
      const store = createBitStore({ initialValues: { x: 0 } });
      store.setField("x" as any, 42 as any);
      expect((store.getState().values as any).x).toBe(42);
    });

    it("setValues substitui múltiplos valores de uma vez", () => {
      const store = createBitStore({ initialValues: { a: 1, b: 2 } });
      store.setValues({ a: 10, b: 20 });
      expect((store.getState().values as any).a).toBe(10);
      expect((store.getState().values as any).b).toBe(20);
    });

    it("setValues com partial:true só atualiza campos fornecidos", () => {
      const store = createBitStore({ initialValues: { a: 1, b: 2 } });
      store.setValues({ a: 99 }, { partial: true });
      expect((store.getState().values as any).a).toBe(99);
      expect((store.getState().values as any).b).toBe(2);
    });

    it("setError seta erro manualmente em um campo", () => {
      const store = createBitStore({ initialValues: { name: "" } });
      store.setError("name", "obrigatório");
      expect((store.getState().errors as any)["name"]).toBe("obrigatório");
    });

    it("setErrors seta múltiplos erros de uma vez", () => {
      const store = createBitStore({ initialValues: { name: "", age: 0 } });
      store.setErrors({ name: "obrigatório", age: "inválido" } as any);
      expect((store.getState().errors as any).name).toBe("obrigatório");
      expect((store.getState().errors as any).age).toBe("inválido");
    });

    it("reset volta o store ao estado inicial", () => {
      const store = createBitStore({ initialValues: { a: 1 } });
      store.setField("a" as any, 99 as any);
      store.reset();
      expect((store.getState().values as any).a).toBe(1);
      expect(store.isDirty).toBe(false);
    });

    it("transaction agrupa múltiplos setField em um único batch", () => {
      const store = createBitStore({ initialValues: { a: 1, b: 2 } });
      const listener = vi.fn();
      store.subscribe(listener);

      store.transaction(() => {
        store.setField("a" as any, 10 as any);
        store.setField("b" as any, 20 as any);
      });

      // transaction deve resultar em notificação consolidada (1 ou poucas chamadas)
      expect(listener.mock.calls.length).toBeLessThanOrEqual(2);
      expect((store.getState().values as any).a).toBe(10);
      expect((store.getState().values as any).b).toBe(20);
    });

    it("submit retorna status=submitted e chama onSuccess com os valores", async () => {
      const store = createBitStore({ initialValues: { name: "Leo" } });
      const onSuccess = vi.fn();

      const result = await store.submit(onSuccess);

      expect(result.status).toBe("submitted");
      expect(onSuccess).toHaveBeenCalledWith(
        { name: "Leo" },
        expect.any(Object),
      );
    });

    it("markFieldsTouched toca os campos corretamente", () => {
      const store = createBitStore({ initialValues: { a: 1, b: 2 } });
      store.markFieldsTouched(["a"]);
      expect((store.getState().touched as any).a).toBe(true);
      expect((store.getState().touched as any).b).toBeUndefined();
    });
  });

  // ── Feature Facade (arrays) ──────────────────────────────────────────────

  describe("FeatureFacade - Arrays", () => {
    it("pushItem adiciona item ao fim do array", () => {
      const store = createBitStore({
        initialValues: { items: [] as string[] },
      });
      store.pushItem("items" as any, "primeiro");
      store.pushItem("items" as any, "segundo");
      expect((store.getState().values as any).items).toEqual([
        "primeiro",
        "segundo",
      ]);
    });

    it("removeItem remove item pelo índice", () => {
      const store = createBitStore({
        initialValues: { items: ["a", "b", "c"] },
      });
      store.removeItem("items" as any, 1);
      expect((store.getState().values as any).items).toEqual(["a", "c"]);
    });

    it("swapItems troca dois itens de posição", () => {
      const store = createBitStore({
        initialValues: { items: ["a", "b", "c"] },
      });
      store.swapItems("items" as any, 0, 2);
      expect((store.getState().values as any).items).toEqual(["c", "b", "a"]);
    });

    it("clearItems limpa o array", () => {
      const store = createBitStore({
        initialValues: { items: ["a", "b", "c"] },
      });
      store.clearItems("items" as any);
      expect((store.getState().values as any).items).toEqual([]);
    });
  });

  // ── Feature Facade (history) ─────────────────────────────────────────────

  describe("FeatureFacade - History (undo/redo)", () => {
    it("canUndo e canRedo são getters booleanos", () => {
      const store = createBitStore({ initialValues: { x: 0 } });
      expect(typeof store.canUndo).toBe("boolean");
      expect(typeof store.canRedo).toBe("boolean");
    });

    it("deve expor canUndo=true após ter mudanças para desfazer", () => {
      const store = createBitStore({
        initialValues: { x: 0 },
        history: { enabled: true },
      } as any);

      store.blurField("x" as any); // salva snapshot
      store.setField("x" as any, 1 as any);
      store.blurField("x" as any); // salva snapshot

      expect(store.canUndo).toBe(true);
    });
  });

  // ── Feature Facade (validation) ──────────────────────────────────────────

  describe("FeatureFacade - Validation", () => {
    it("validate retorna true quando não há erros de schema", async () => {
      const store = createBitStore({ initialValues: { name: "Leo" } });
      const result = await store.validate();
      expect(result).toBe(true);
    });

    it("hasValidationsInProgress retorna false quando ocioso", () => {
      const store = createBitStore({ initialValues: { x: 1 } });
      expect(store.hasValidationsInProgress()).toBe(false);
    });

    it("triggerValidation é chamável sem erros", () => {
      const store = createBitStore({ initialValues: { x: 1 } });
      expect(() => store.triggerValidation()).not.toThrow();
    });
  });

  // ── Lifecycle ────────────────────────────────────────────────────────────

  describe("Lifecycle - cleanup", () => {
    it("cleanup não lança exceção", () => {
      const store = createBitStore({ initialValues: { x: 1 } });
      expect(() => store.cleanup()).not.toThrow();
    });
  });
});
