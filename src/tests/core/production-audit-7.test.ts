import { describe, expect, it } from "vitest";
import { BitPersistManager } from "../../core/store/managers/features/persist-manager";

describe("Production Audit 7 - Regression Tests", () => {
  describe("Persist Engine State Poisoning Bug", () => {
    it("should recover activeWrites count and continue processing if onWriteStart throws", async () => {
      let writeStartThrows = true;
      let onWriteStartCalls = 0;
      let onWriteSuccessCalls = 0;

      const manager = new BitPersistManager<any>(
        {
          enabled: true,
          key: "test-key",
          storage: {
            getItem: async () => null,
            setItem: async () => {},
            removeItem: async () => {},
          },
          serialize: (v) => JSON.stringify(v),
          deserialize: (v) => JSON.parse(v),
          autoSave: false,
          mode: "values",
          debounceMs: 500,
        },
        () => ({}),
        () => ({}),
        () => {},
        {
          onWriteStart: () => {
            onWriteStartCalls++;
            if (writeStartThrows) {
              throw new Error("UI State Reducer Crash!");
            }
          },
          onWriteSuccess: () => {
            onWriteSuccessCalls++;
          },
        }
      );

      // Primeira tentativa de salvar quebra silenciosamente por causa da UI
      try {
        await manager.saveNow();
      } catch (e: any) {
        expect(e.message).toBe("UI State Reducer Crash!");
      }

      // Verificamos que o onWriteStart foi acionado.
      expect(onWriteStartCalls).toBe(1);

      // Agora a UI se recuperou ou a próxima tentativa foi engatilhada de forma sadia.
      writeStartThrows = false;

      // Se a contagem estivesse envenenada, a segunda chamada NÃO engatilharia o onWriteStart.
      // E também NÃO engatilharia o onWriteSuccess.
      await manager.saveNow();

      expect(onWriteStartCalls).toBe(2);
      expect(onWriteSuccessCalls).toBe(1);
    });
  });
});
