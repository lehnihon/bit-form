import { describe, expect, it, vi } from "vitest";
import type { BitState } from "../../core/store/contracts/types";
import { BitSubscriptionEngine } from "../../core/store/engines/subscription-engine";

type Values = { user: { name: string; age: number } };

function createState(values: Values): BitState<Values> {
  return {
    values,
    errors: {},
    touched: {},
    isValidating: {},
    persist: {
      isSaving: false,
      isRestoring: false,
      error: null,
    },
    isValid: true,
    isSubmitting: false,
    isDirty: false,
  };
}

describe("BitSubscriptionEngine", () => {
  it("notifica selector scoped somente quando path muda", () => {
    let state = createState({ user: { name: "Leo", age: 30 } });
    const engine = new BitSubscriptionEngine<Values>(() => state);
    const listener = vi.fn();

    engine.subscribeSelector(
      (nextState) => nextState.values.user.name,
      listener,
      { paths: ["user.name"] },
      (a, b) => a === b,
    );

    state = createState({ user: { name: "Leo", age: 31 } });
    engine.notify(state, ["user.age"]);
    expect(listener).not.toHaveBeenCalled();

    state = createState({ user: { name: "Ana", age: 31 } });
    engine.notify(state, ["user.name"]);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith("Ana");
  });

  it("notifica subscribe global em qualquer update", () => {
    let state = createState({ user: { name: "Leo", age: 30 } });
    const engine = new BitSubscriptionEngine<Values>(() => state);
    const listener = vi.fn();

    engine.subscribe(listener);

    state = createState({ user: { name: "Leo", age: 31 } });
    engine.notify(state, ["user.age"]);

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("encaminha erro de subscriber global para handler central", () => {
    let state = createState({ user: { name: "Leo", age: 30 } });
    const onError = vi.fn();
    const engine = new BitSubscriptionEngine<Values>(() => state, onError);

    engine.subscribe(() => {
      throw new Error("global subscriber failed");
    });

    state = createState({ user: { name: "Leo", age: 31 } });
    engine.notify(state, ["user.age"]);

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0]?.[1]).toBe("subscription");
    expect(onError.mock.calls[0]?.[0]).toBeInstanceOf(Error);
  });

  it("encaminha erro de emitImmediately para handler central", () => {
    const state = createState({ user: { name: "Leo", age: 30 } });
    const onError = vi.fn();
    const engine = new BitSubscriptionEngine<Values>(() => state, onError);

    engine.subscribeSelector(
      (s) => s.values.user.name,
      () => {
        throw new Error("emit immediately failed");
      },
      { paths: ["user.name"], emitImmediately: true },
      (a, b) => a === b,
    );

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0]?.[1]).toBe("subscription");
    expect(onError.mock.calls[0]?.[0]).toBeInstanceOf(Error);
  });

  // --- Stress tests ---

  it("fanout: 100 subscribers scoped no mesmo path são todos notificados", () => {
    let state = createState({ user: { name: "Leo", age: 30 } });
    const engine = new BitSubscriptionEngine<Values>(() => state);

    const listeners = Array.from({ length: 100 }, () => vi.fn());

    for (const listener of listeners) {
      engine.subscribeSelector(
        (s) => s.values.user.name,
        listener,
        { paths: ["user.name"] },
        (a, b) => a === b,
      );
    }

    state = createState({ user: { name: "Ana", age: 30 } });
    engine.notify(state, ["user.name"]);

    for (const listener of listeners) {
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith("Ana");
    }
  });

  it("fanout: subscribers em paths distintos não recebem notificação cruzada", () => {
    let state = createState({ user: { name: "Leo", age: 30 } });
    const engine = new BitSubscriptionEngine<Values>(() => state);

    const nameFn = vi.fn();
    const ageFn = vi.fn();

    engine.subscribeSelector(
      (s) => s.values.user.name,
      nameFn,
      { paths: ["user.name"] },
      (a, b) => a === b,
    );
    engine.subscribeSelector(
      (s) => s.values.user.age,
      ageFn,
      { paths: ["user.age"] },
      (a, b) => a === b,
    );

    // Muda apenas age — nameFn NÃO deve ser chamado; ageFn deve ser chamado.
    state = createState({ user: { name: "Leo", age: 99 } });
    engine.notify(state, ["user.age"]);

    expect(nameFn).not.toHaveBeenCalled();
    expect(ageFn).toHaveBeenCalledTimes(1);
    expect(ageFn).toHaveBeenCalledWith(99);
  });

  it("notify com changedPaths=undefined (wildcard) notifica todos os scoped subscribers", () => {
    let state = createState({ user: { name: "Leo", age: 30 } });
    const engine = new BitSubscriptionEngine<Values>(() => state);

    const nameFn = vi.fn();
    const ageFn = vi.fn();

    engine.subscribeSelector(
      (s) => s.values.user.name,
      nameFn,
      { paths: ["user.name"] },
      (a, b) => a === b,
    );
    engine.subscribeSelector(
      (s) => s.values.user.age,
      ageFn,
      { paths: ["user.age"] },
      (a, b) => a === b,
    );

    state = createState({ user: { name: "Ana", age: 99 } });
    // changedPaths undefined => notify global que deve acionar todos
    engine.notify(state, undefined);

    expect(nameFn).toHaveBeenCalledTimes(1);
    expect(ageFn).toHaveBeenCalledTimes(1);
  });

  it("dedupe versionado: changedPaths sobrepostos não duplicam notificação", () => {
    let state = createState({ user: { name: "Leo", age: 30 } });
    const engine = new BitSubscriptionEngine<Values>(() => state);

    const nameFn = vi.fn();

    engine.subscribeSelector(
      (s) => s.values.user.name,
      nameFn,
      { paths: ["user.name"] },
      (a, b) => a === b,
    );

    state = createState({ user: { name: "Ana", age: 30 } });
    engine.notify(state, ["user.name", "user"]);

    expect(nameFn).toHaveBeenCalledTimes(1);
    expect(nameFn).toHaveBeenCalledWith("Ana");
  });

  it("limita caches internos de paths para evitar crescimento sem bound", () => {
    const engine = new BitSubscriptionEngine<Values>(() =>
      createState({ user: { name: "Leo", age: 30 } }),
    );

    const internals = engine as unknown as {
      pathExpansionCache: Map<string, string[]>;
      MAX_PATH_EXPANSION_CACHE_SIZE: number;
      expandPathForIndexing(path: string): string[];
      expandChangedPathForLookup(path: string): string[];
    };

    for (let i = 0; i < 2300; i++) {
      const path = `user.name.${i}`;
      internals.expandPathForIndexing(path);
      internals.expandChangedPathForLookup(path);
    }

    expect(internals.pathExpansionCache.size).toBeLessThanOrEqual(
      internals.MAX_PATH_EXPANSION_CACHE_SIZE,
    );
  });

  it("invalida entradas relacionadas ao prefixo informado", () => {
    const engine = new BitSubscriptionEngine<Values>(() =>
      createState({ user: { name: "Leo", age: 30 } }),
    );

    const internals = engine as unknown as {
      pathExpansionCache: Map<string, string[]>;
      expandPathForIndexing(path: string): string[];
      invalidatePathExpansionCache(prefix?: string): void;
    };

    internals.expandPathForIndexing("user.name");
    internals.expandPathForIndexing("user.age");
    internals.expandPathForIndexing("account.name");

    internals.invalidatePathExpansionCache("user");

    expect(internals.pathExpansionCache.has("user.name")).toBe(false);
    expect(internals.pathExpansionCache.has("user.age")).toBe(false);
    expect(internals.pathExpansionCache.has("account.name")).toBe(true);
  });

  it("expõe métricas de hit/miss/eviction do cache de expansão", () => {
    const engine = new BitSubscriptionEngine<Values>(
      () => createState({ user: { name: "Leo", age: 30 } }),
      2,
    );

    const internals = engine as unknown as {
      expandPathForIndexing(path: string): string[];
    };

    // miss
    internals.expandPathForIndexing("user.name");
    // hit
    internals.expandPathForIndexing("user.name");
    // miss
    internals.expandPathForIndexing("user.age");
    // miss + eviction (capacidade 2)
    internals.expandPathForIndexing("user.email");

    const stats = engine.getPathExpansionCacheStats();

    expect(stats.cacheLimit).toBe(2);
    expect(stats.cacheSize).toBeLessThanOrEqual(2);
    expect(stats.cacheHits).toBeGreaterThanOrEqual(1);
    expect(stats.cacheMisses).toBeGreaterThanOrEqual(3);
    expect(stats.cacheEvictions).toBeGreaterThanOrEqual(1);
  });

  it("expõe quantidade de subscribers ativos", () => {
    let state = createState({ user: { name: "Leo", age: 30 } });
    const engine = new BitSubscriptionEngine<Values>(() => state);

    const unsubA = engine.subscribeSelector(
      (s) => s.values.user.name,
      () => {},
      { paths: ["user.name"] },
      (a, b) => a === b,
    );

    const unsubB = engine.subscribeSelector(
      (s) => s.values.user.age,
      () => {},
      { paths: ["user.age"] },
      (a, b) => a === b,
    );

    expect(engine.getActiveSubscribersCount()).toBe(2);

    unsubA();
    expect(engine.getActiveSubscribersCount()).toBe(1);

    unsubB();
    expect(engine.getActiveSubscribersCount()).toBe(0);
  });

  describe("Integer Wrap Silence Bug", () => {
    it("should continue notifying subscribers even after notifyVersion wraps to negative", () => {
      let currentState = createState({ user: { name: "initial", age: 30 } });

      const engine = new BitSubscriptionEngine<any>(() => currentState);

      // Force notifyVersion to max positive 32-bit integer
      (engine as any).notifyVersion = 2147483647;

      const listener = vi.fn();

      const unsubscribe = engine.subscribeSelector(
        (state) => state.values.user.name,
        listener,
        { paths: ["user.name"], emitImmediately: false },
        (prev, next) => prev === next,
      );

      // Trigger first notification to record the seenVersion (will be -2147483648 because it bumps then wraps)
      currentState = createState({ user: { name: "update1", age: 30 } });
      engine.notify(currentState, ["user.name"]);

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith("update1");

      // Trigger second notification (now notifyVersion is -2147483647, which is mathematically larger,
      // but prior to the fix, a positive seenVersion would incorrectly block it).
      currentState = createState({ user: { name: "update2", age: 30 } });
      engine.notify(currentState, ["user.name"]);

      expect(listener).toHaveBeenCalledTimes(2);
      expect(listener).toHaveBeenCalledWith("update2");

      unsubscribe();
    });
  });

  describe("seenVersion Deduplication Collision", () => {
    it("should notify fresh subscribers even when notifyVersion wraps back to 0", () => {
      let currentState = createState({ user: { name: "initial", age: 30 } });
      const engine = new BitSubscriptionEngine<any>(() => currentState);

      // Force notifyVersion to -1: next wrap brings it to 0
      (engine as any).notifyVersion = -1;

      const listener = vi.fn();

      // Subscribe AFTER forcing notifyVersion so seenVersion is not in the map
      engine.subscribeSelector(
        (state: any) => state.values.user.name,
        listener,
        { paths: ["user.name"], emitImmediately: false },
        (prev: string, next: string) => prev === next,
      );

      // This notification wraps notifyVersion from -1 to 0
      currentState = createState({ user: { name: "update1", age: 30 } });
      engine.notify(currentState, ["user.name"]);

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith("update1");
    });

    it("should deduplicate correctly across multiple paths when notifyVersion is 0", () => {
      let currentState = createState({
        user: { name: "initial", age: 30 },
      }) as any;
      const engine = new BitSubscriptionEngine<any>(() => currentState);

      // Put notifyVersion one step before wrapping to 0
      (engine as any).notifyVersion = -1;

      const listener = vi.fn();

      // Subscribe to BOTH name and email
      engine.subscribeSelector(
        (state: any) => state.values.user,
        listener,
        { paths: ["user.name", "user.age"], emitImmediately: false },
        (prev: any, next: any) => prev === next,
      );

      // Notify both paths changed at once — subscriber should fire exactly once
      currentState = createState({ user: { name: "changed", age: 31 } });
      engine.notify(currentState, ["user.name", "user.age"]);

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it("should continue deduplication normally on subsequent notifications after wrap", () => {
      let currentState = createState({ user: { name: "initial", age: 30 } });
      const engine = new BitSubscriptionEngine<any>(() => currentState);

      // Force wrap scenario: notifyVersion will pass through 0
      (engine as any).notifyVersion = -1;

      const listener = vi.fn();
      engine.subscribeSelector(
        (state: any) => state.values.user.name,
        listener,
        { paths: ["user.name"], emitImmediately: false },
        (prev: string, next: string) => prev === next,
      );

      // Notification at 0
      currentState = createState({ user: { name: "update-at-zero", age: 30 } });
      engine.notify(currentState, ["user.name"]);
      expect(listener).toHaveBeenCalledTimes(1);

      // Notification at 1 — state did not change, equality returns true → skip
      engine.notify(currentState, ["user.name"]);
      expect(listener).toHaveBeenCalledTimes(1);

      // Notification at 2 — state changed
      currentState = createState({ user: { name: "update-at-two", age: 30 } });
      engine.notify(currentState, ["user.name"]);
      expect(listener).toHaveBeenCalledTimes(2);
      expect(listener).toHaveBeenCalledWith("update-at-two");
    });
  });

  describe("Observability Resilience", () => {
    it("should not break subscription notification loop if observer throws", () => {
      const state = createState({ user: { name: "initial", age: 30 } });
      const getState = () => state;

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

      expect(() => engine.notify(state, ["*"])).not.toThrow();

      expect(listener1).toHaveBeenCalled();
      expect(onError).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
      expect(listener3).toHaveBeenCalled();
    });
  });

  describe("Subscription Orphaning", () => {
    it("tracked selector lifecycle handles rapid resubscribe+unmount gracefully", async () => {
      const { createBitStore } = await import("../../core");
      const store = (createBitStore as any)({
        initialValues: { field1: "" },
      });

      for (let i = 0; i < 50; i++) {
        store.write.setField("field1", `value${i}`);
      }

      await new Promise((resolve) => setTimeout(resolve, 10));

      const state = store.read.getState();
      expect(state).toBeDefined();
      expect(state.values.field1).toBe("value49");
    });

    it("should not orphan scope subscription if destroyed during registry change microtask", async () => {
      const { subscribeStoreScopeStatus } = await import("../../core/store/orchestration/store-observe-ops");

      let selectorUnsubscribeCalls = 0;
      let registryListener: any = null;

      const subscribeSelector = vi.fn((selector, listener, options) => {
        if (options.paths.some((p: string) => p.includes("__scope__"))) {
          registryListener = listener;
        }
        return () => {
          selectorUnsubscribeCalls++;
        };
      });

      const unsubscribe = subscribeStoreScopeStatus({
        scopeName: "myScope",
        getScopeFields: () => ["field1"],
        readScopeStatus: () => ({ hasErrors: false, isDirty: false, errors: {} }),
        subscribeSelector: subscribeSelector as any,
        listener: vi.fn(),
      });

      // Simula uma mudança no registry. Isso enfileira a microtask.
      registryListener();

      // Desmonta/destrói o componente/scope *antes* da microtask rodar.
      unsubscribe();

      // Deixa a microtask rodar
      await new Promise(r => setTimeout(r, 0));

      // 1 call from initial scope sub, 1 from registry sub. 
      // Se a microtask vazou e fez um novo resubscribe, selectorUnsubscribeCalls não vai bater (ou a gente vaza memória).
      // Na verdade, o mock subscribeSelector foi chamado mais uma vez se vazou.
      
      const callsAfterFirstSubscribe = subscribeSelector.mock.calls.length;
      
      // se não tivesse `if (destroyed) { unsubscribeScoped(); return; }`, ele chamaria subscribeScoped de novo (mais 1 call pro subscribeSelector)
      expect(subscribeSelector).toHaveBeenCalledTimes(2); // 1 pro escopo, 1 pro registry. A microtask NÃO deve fazer o 3o se destroyed.
    });
  });

  describe("Subscription Stability - Listener Exceptions", () => {
    it("should notify all subscribers even if one throws", async () => {
      const { createBitStore } = await import("../../core");
      const store = (createBitStore as any)({
        initialValues: { field1: "test" },
      });

      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const results: number[] = [];

      const collector1 = () => {
        throw new Error("crash");
      };
      const collector2 = () => {
        results.push(2);
      };
      const collector3 = () => {
        results.push(3);
      };

      store.observe.subscribe(collector1);
      store.observe.subscribe(collector2);
      store.observe.subscribe(collector3);

      store.write.setField("field1", "updated");

      expect(results).toEqual([2, 3]);
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    it("should continue notifying scoped subscribers if one throws", async () => {
      const { createBitStore } = await import("../../core");
      const store = (createBitStore as any)({
        initialValues: { user: { name: "leo", age: 30 } },
      });

      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const results: string[] = [];

      store.observe.subscribeSelector(
        (state) => (state.values as any).user.age,
        () => {
          throw new Error("crash");
        },
        { paths: ["user.age"] },
      );

      store.observe.subscribeSelector(
        (state) => (state.values as any).user.age,
        (age) => {
          results.push(`age:${age}`);
        },
        { paths: ["user.age"] },
      );

      store.write.setField("user.age", 31);

      expect(results).toContain("age:31");
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });
});
