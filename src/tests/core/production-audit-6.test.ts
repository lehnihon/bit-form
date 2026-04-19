import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createBitStore as createBitStoreRuntime } from "../../core";

function createBitStore<T extends object = Record<string, unknown>>(
  config?: any,
) {
  return createBitStoreRuntime<T>(config) as any;
}

interface TestForm {
  name: string;
  email: string;
}

describe("Production Audit 6 - Regression Tests", () => {
  describe("Observability Exception Leak Bug", () => {
    let unhandledRejectionCaught = false;

    beforeEach(() => {
      unhandledRejectionCaught = false;
      const onUnhandledRejection = () => {
        unhandledRejectionCaught = true;
      };
      // Em ambientes de teste do node, interceptamos para garantir que
      // não foi vazada. O vitest geralmente crasheia se tiver, mas podemos rastrear assim:
      process.on("unhandledRejection", onUnhandledRejection);
    });

    afterEach(() => {
      process.removeAllListeners("unhandledRejection");
    });

    it("should safely isolate observability crashes in validation without rejecting promises", async () => {
      let loggerCalled = 0;

      const store = createBitStore<TestForm>({
        initialValues: {
          name: "Test",
          email: "test@test.com",
        },
        validation: {
          resolver: () => {
            throw new Error("Resolver Crash");
          }
        },
        fields: {
          name: {}
        },
        onUnhandledError: (error: any, source: string) => {
          loggerCalled++;
          // Sentry / Datadog crash!
          throw new Error("Circular JSON inside Observability Tool");
        }
      });

      // Se a correção funcionar, o validate() irá retornar `false` pacificamente,
      // pois o fail-open da configuração irá engolir a falha do Datadog e printar num console nativo.
      // Se não, o validate() vai rejeitar e causar Unhandled Promise Rejection ou quebrar o teste aqui.
      const result = await store.feature.validate();
      
      expect(result).toBe(false);
      expect(loggerCalled).toBe(1);
      
      // Delay pequeno para deixar a microtask do Node rodar, caso a Promise vazia fosse rejeitada.
      await new Promise(r => setTimeout(r, 10));
      expect(unhandledRejectionCaught).toBe(false);
    });

    it("should safely isolate observability crashes in submit without rejecting promises", async () => {
      let loggerCalled = 0;

      const store = createBitStore<TestForm>({
        initialValues: {
          name: "Test",
          email: "test@test.com",
        },
        onUnhandledError: (error: any, source: string) => {
          loggerCalled++;
          throw new Error("Sentry Crash During Submit!");
        }
      });

      // O usuário aciona o submit e dentro do handler dele lança uma exceção inesperada.
      // A engine formata para { status: "failed", error }. 
      // Porém o motor avisa o Sentry. Se o Sentry crashear, não pode quebrar a promessa.
      const result = await store.write.submit(() => {
        throw new Error("API Fetch Error");
      });

      expect(result.status).toBe("failed");
      expect((result as any).error.message).toBe("API Fetch Error");
      expect(loggerCalled).toBe(1);
    });
  });
});
