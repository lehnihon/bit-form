import { describe, expect, it, vi } from "vitest";
import {
  createStoreBatchState,
  flushStoreBatchState,
  trackBatchedStoreUpdate,
} from "../../core/store/engines/store-batch-engine";
import { BitSubscriptionEngine } from "../../core/store/engines/subscription-engine";
import { BitPersistManager } from "../../core/store/managers/features/persist-manager";

describe("Production Audit 10 - Regression Tests", () => {
  describe("FINDING-1: Batch State Poisoning", () => {
    it("should prevent batch poisoning when observability handler throws", () => {
      const currentState = {
        values: { a: 1 },
        errors: {},
        touched: {},
        isValidating: {},
        isSubmitting: false,
        isDirty: false,
        isValid: true,
        persist: { initialized: false, isSaving: false, isRestoring: false, error: null },
      };

      const batchState = createStoreBatchState<any>();

      // Adiciona uma alteração ao lote
      trackBatchedStoreUpdate(batchState, {
        nextState: { ...currentState, values: { a: 2 } },
        valuesChanged: true,
        changedPaths: ["a"],
      });

      const applyValueDerivations = vi.fn().mockImplementation(() => {
        throw new Error("Derivation error");
      });

      const onDerivationError = vi.fn().mockImplementation(() => {
        throw new Error("Observability exception");
      });

      // Se a falha na observabilidade não for contida, flushStoreBatchState jogará o erro e abortará o commit
      expect(() =>
        flushStoreBatchState({
          currentState,
          batchState,
          applyValueDerivations,
          onDerivationError,
        }),
      ).not.toThrow("Observability exception");

      // Deve ter tentado aplicar a derivação e chamado o observer
      expect(applyValueDerivations).toHaveBeenCalled();
      expect(onDerivationError).toHaveBeenCalled();

      // Sem a correção, a linha expect não to throw falharia e o kernel entraria em deadlock ou perderia os dados silenciosamente
    });
  });

  describe("FINDING-2: Unhandled Observability Exceptions Quebrando Inscrições", () => {
    it("should not break subscription notification loop if observer throws", () => {
      const getState = () => ({
        values: {},
        errors: {},
        touched: {},
        isValidating: {},
        isSubmitting: false,
        isDirty: false,
        isValid: true,
        persist: { isSaving: false, isRestoring: false, error: null },
      });

      const onError = vi.fn().mockImplementation(() => {
        throw new Error("Log timeout");
      });

      const engine = new BitSubscriptionEngine(getState, onError);

      const listener1 = vi.fn().mockImplementation(() => {
        throw new Error("Render error");
      });
      const listener2 = vi.fn();
      const listener3 = vi.fn();

      engine.subscribe(listener1);
      engine.subscribe(listener2);
      engine.subscribe(listener3);

      // Notifica todos. Se o listener1 lançar o render error, a engine aciona o onError.
      // Se onError também lançar erro, a correção previne que listener2 e listener3 sejam ignorados.
      expect(() => engine.notify(getState(), ["*"])).not.toThrow();

      expect(listener1).toHaveBeenCalled();
      expect(onError).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled(); // DEVE ser chamado, não interrompido
      expect(listener3).toHaveBeenCalled(); // DEVE ser chamado, não interrompido
    });
  });

  describe("FINDING-3: Persist Engine Callback Deadlocks", () => {
    it("should call onWriteSettled even if onWriteSuccess throws", async () => {
      const getValues = () => ({});
      const getDirtyValues = () => ({});
      const applyRestoredValues = vi.fn();

      const onWriteStart = vi.fn();
      const onWriteSuccess = vi.fn().mockImplementation(() => {
        throw new Error("Component unmounted");
      });
      const onWriteError = vi.fn();
      const onWriteSettled = vi.fn();
      const onError = vi.fn();

      const callbacks = {
        onWriteStart,
        onWriteSuccess,
        onWriteError,
        onWriteSettled,
        onError,
      };

      const storage = {
        getItem: vi.fn(),
        setItem: vi.fn().mockResolvedValue(undefined), // Simulando sucesso no storage
        removeItem: vi.fn(),
      };

      const manager = new BitPersistManager(
        {
          key: "test",
          enabled: true,
          mode: "values",
          autoSave: false,
          debounceMs: 0,
          serialize: (v) => JSON.stringify(v),
          deserialize: (v) => JSON.parse(v),
          storage,
        },
        getValues,
        getDirtyValues,
        applyRestoredValues,
        callbacks,
      );

      // Salva agora e aguarda
      // O método rejeitará a Promise devido ao onWriteSuccess lançando erro, mas onWriteSettled deve rodar
      await expect(manager.saveNow()).rejects.toThrow("Component unmounted");

      expect(onWriteStart).toHaveBeenCalled();
      expect(onWriteSuccess).toHaveBeenCalled();
      expect(onWriteSettled).toHaveBeenCalled(); // Se isso for false, é deadlock
    });

    it("should call onWriteSettled even if onWriteError throws", async () => {
      const getValues = () => ({});
      const getDirtyValues = () => ({});
      const applyRestoredValues = vi.fn();

      const onWriteStart = vi.fn();
      const onWriteSuccess = vi.fn();
      const onWriteError = vi.fn().mockImplementation(() => {
        throw new Error("Secondary error handler failed");
      });
      const onWriteSettled = vi.fn();
      const onError = vi.fn();

      const callbacks = {
        onWriteStart,
        onWriteSuccess,
        onWriteError,
        onWriteSettled,
        onError,
      };

      const storage = {
        getItem: vi.fn(),
        setItem: vi.fn().mockRejectedValue(new Error("Storage failed")), // Simulando falha no storage
        removeItem: vi.fn(),
      };

      const manager = new BitPersistManager(
        {
          key: "test",
          enabled: true,
          mode: "values",
          autoSave: false,
          debounceMs: 0,
          serialize: (v) => JSON.stringify(v),
          deserialize: (v) => JSON.parse(v),
          storage,
        },
        getValues,
        getDirtyValues,
        applyRestoredValues,
        callbacks,
      );

      // Salva agora e aguarda
      // A primeira falha aciona onWriteError, e se onWriteError falhar, o settle deve ocorrer
      await expect(manager.saveNow()).rejects.toThrow("Secondary error handler failed");

      expect(onWriteStart).toHaveBeenCalled();
      expect(onWriteError).toHaveBeenCalled();
      expect(onWriteSettled).toHaveBeenCalled(); // Se isso for false, é deadlock
    });
  });
});
