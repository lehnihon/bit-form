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
});
