import { describe, expect, it, vi } from "vitest";
import { BitValidationManager } from "../../core/store/managers/features/validation-manager";

describe("BitValidationManager", () => {
  it("should accumulate scopeFields during debounce window", async () => {
    vi.useFakeTimers();

    const manager = new BitValidationManager<any>({
      getState: () => ({
        values: {},
        errors: {},
        touched: {},
        isValidating: {},
        persist: { isSaving: false, isRestoring: false, error: null },
        isValid: true,
        isSubmitting: false,
        isDirty: false,
      }),
      dispatch: () => {},
      setError: () => {},
      getFieldConfig: () => undefined,
      getScopeFields: () => [],
      forEachFieldConfig: () => {},
      config: { validationDelay: 20 } as any,
      getRequiredErrors: () => ({}),
      getHiddenFields: () => new Set<string>(),
      emitBeforeValidate: async () => {},
      emitAfterValidate: async () => {},
    });

    const validateSpy = vi.spyOn(manager, "validate").mockResolvedValue(true);

    manager.trigger(["email"]);
    await vi.advanceTimersByTimeAsync(10);
    manager.trigger(["name"]);

    await vi.advanceTimersByTimeAsync(25);

    expect(validateSpy).toHaveBeenCalledTimes(1);
    const scopeFields = validateSpy.mock.calls[0]?.[0]?.scopeFields ?? [];
    expect(scopeFields).toEqual(expect.arrayContaining(["email", "name"]));

    vi.useRealTimers();
  });

  it("should cancel pending trigger and timers on cancelAll", async () => {
    vi.useFakeTimers();

    const manager = new BitValidationManager<any>({
      getState: () => ({
        values: { username: "a" },
        errors: {},
        touched: {},
        isValidating: {},
        persist: { isSaving: false, isRestoring: false, error: null },
        isValid: true,
        isSubmitting: false,
        isDirty: false,
      }),
      dispatch: () => {},
      setError: () => {},
      getFieldConfig: () => ({
        validation: {
          asyncValidateDelay: 100,
          asyncValidate: async () => null,
        },
      }),
      getScopeFields: () => [],
      forEachFieldConfig: () => {},
      config: { validationDelay: 20 } as any,
      getRequiredErrors: () => ({}),
      getHiddenFields: () => new Set<string>(),
      emitBeforeValidate: async () => {},
      emitAfterValidate: async () => {},
    });

    manager.trigger(["username"]);
    manager.handleAsync("username", "a");
    manager.cancelAll();

    const validateSpy = vi.spyOn(manager, "validate");
    await vi.advanceTimersByTimeAsync(150);

    expect(validateSpy).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  it("should commit validation in a single dispatch per validate cycle", async () => {
    const dispatch = vi.fn();

    const manager = new BitValidationManager<any>({
      getState: () => ({
        values: { email: "" },
        errors: {},
        touched: {},
        isValidating: {},
        persist: { isSaving: false, isRestoring: false, error: null },
        isValid: true,
        isSubmitting: false,
        isDirty: false,
      }),
      dispatch,
      setError: () => {},
      getFieldConfig: () => undefined,
      getScopeFields: () => [],
      forEachFieldConfig: () => {},
      config: {
        validationDelay: 0,
        resolver: async () => ({ email: "required" }),
      } as any,
      getRequiredErrors: () => ({}),
      getHiddenFields: () => new Set<string>(),
      emitBeforeValidate: async () => {},
      emitAfterValidate: async () => {},
    });

    await manager.validate();

    const validationCommits = dispatch.mock.calls.filter(
      (call) => call[0]?.kind === "validation.commit",
    );

    expect(validationCommits).toHaveLength(1);
  });

  it("should prioritize scopeFields over scope when both are provided", async () => {
    const resolver = vi.fn().mockResolvedValue({});
    const onUnhandledError = vi.fn();

    const manager = new BitValidationManager<any>({
      getState: () => ({
        values: { direct: "value", scopedField: "value" },
        errors: {},
        touched: {},
        isValidating: {},
        persist: { isSaving: false, isRestoring: false, error: null },
        isValid: true,
        isSubmitting: false,
        isDirty: false,
      }),
      dispatch: () => {},
      setError: () => {},
      getFieldConfig: () => undefined,
      getScopeFields: () => ["scopedField"],
      forEachFieldConfig: () => {},
      config: {
        validationDelay: 0,
        resolver,
        onUnhandledError,
      } as any,
      getRequiredErrors: () => ({}),
      getHiddenFields: () => new Set<string>(),
      emitBeforeValidate: async () => {},
      emitAfterValidate: async () => {},
    });

    await manager.validate({
      scope: "step-1",
      scopeFields: ["direct"],
    } as any);

    expect(resolver).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ scopeFields: ["direct"] }),
    );
    expect(onUnhandledError).toHaveBeenCalledTimes(1);
  });

  it("should clear external error state before awaiting scoped revalidation", async () => {
    const setError = vi.fn();

    const manager = new BitValidationManager<any>({
      getState: () => ({
        values: { email: "a@b.com" },
        errors: { email: "invalid" },
        touched: {},
        isValidating: {},
        persist: { isSaving: false, isRestoring: false, error: null },
        isValid: false,
        isSubmitting: false,
        isDirty: false,
      }),
      dispatch: () => {},
      setError,
      getFieldConfig: () => undefined,
      getScopeFields: () => [],
      forEachFieldConfig: () => {},
      config: { validationDelay: 0 } as any,
      getRequiredErrors: () => ({}),
      getHiddenFields: () => new Set<string>(),
      emitBeforeValidate: async () => {},
      emitAfterValidate: async () => {},
    });

    let resolveValidation: ((value: boolean) => void) | undefined;
    const validateSpy = vi.spyOn(manager, "validate").mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveValidation = resolve;
        }),
    );

    const pending = manager.setExternalError("email", undefined);

    expect(setError).toHaveBeenCalledWith("email", undefined);
    expect(validateSpy).toHaveBeenCalledWith({ scopeFields: ["email"] });

    resolveValidation?.(true);
    await pending;
  });

  it("should report async validation rejections and continue processing later jobs", async () => {
    vi.useFakeTimers();

    const onUnhandledError = vi.fn();
    const state = {
      values: { username: "", email: "" },
      errors: {},
      touched: {},
      isValidating: {},
      persist: { isSaving: false, isRestoring: false, error: null },
      isValid: true,
      isSubmitting: false,
      isDirty: false,
    } as any;
    const setError = vi.fn();
    const dispatch = vi.fn((operation: any) => {
      if (
        operation.kind === "state.patch" &&
        operation.partialState.isValidating
      ) {
        state.isValidating = operation.partialState.isValidating;
      }
    });
    const validators = {
      username: vi.fn(async () => {
        throw new Error("validation backend down");
      }),
      email: vi.fn(async () => "email inválido"),
    } as const;

    const manager = new BitValidationManager<any>({
      getState: () => state,
      dispatch,
      setError,
      getFieldConfig: (path) => ({
        validation: {
          asyncValidateOn: "change",
          asyncValidateDelay: 0,
          asyncValidate: validators[path as keyof typeof validators],
        },
      }),
      getScopeFields: () => [],
      forEachFieldConfig: () => {},
      config: { validationDelay: 0, onUnhandledError } as any,
      getRequiredErrors: () => ({}),
      getHiddenFields: () => new Set<string>(),
      emitBeforeValidate: async () => {},
      emitAfterValidate: async () => {},
    });

    state.values.username = "leo";
    manager.handleAsync("username", "leo");
    await vi.advanceTimersByTimeAsync(0);
    await Promise.resolve();

    expect(onUnhandledError).toHaveBeenCalledTimes(1);
    expect(onUnhandledError).toHaveBeenCalledWith(
      expect.objectContaining({ message: "validation backend down" }),
      "validation",
    );
    expect(state.isValidating.username).toBeUndefined();

    state.values.email = "leo@example.com";
    manager.handleAsync("email", "leo@example.com");
    await vi.advanceTimersByTimeAsync(0);
    await Promise.resolve();

    expect(validators.email).toHaveBeenCalledTimes(1);
    expect(setError).toHaveBeenCalledWith("email", "email inválido");
    expect(state.isValidating.email).toBeUndefined();

    vi.useRealTimers();
  });

  // ── Regressão BUG-1 ──────────────────────────────────────────────────────
  it("BUG-1: cancelAll after rapid re-schedule should not reach a job whose controller was stolen", async () => {
    vi.useFakeTimers();

    let resolveFirstJob!: (v: string | null) => void;

    const firstValidator = vi.fn(
      () =>
        new Promise<string | null>((resolve) => {
          resolveFirstJob = resolve;
        }),
    );
    const secondValidator = vi.fn(() => new Promise<string | null>(() => {})); // never resolves

    const state = {
      values: { email: "a" },
      errors: {},
      touched: {},
      isValidating: {} as Record<string, boolean>,
      persist: { isSaving: false, isRestoring: false, error: null },
      isValid: true,
      isSubmitting: false,
      isDirty: false,
    } as any;

    let pickValidator = firstValidator as any;
    const setValidatingCalls: Array<{ path: string; value: boolean }> = [];
    const dispatch = vi.fn((op: any) => {
      if (op.kind === "state.patch" && op.partialState.isValidating) {
        Object.entries(
          op.partialState.isValidating as Record<string, boolean>,
        ).forEach(([p, v]) => setValidatingCalls.push({ path: p, value: v }));
        state.isValidating = op.partialState.isValidating;
      }
    });

    const manager = new BitValidationManager<any>({
      getState: () => state,
      dispatch,
      setError: vi.fn(),
      getFieldConfig: () => ({
        validation: {
          asyncValidateOn: "change",
          asyncValidateDelay: 0,
          asyncValidate: pickValidator,
        },
      }),
      getScopeFields: () => [],
      forEachFieldConfig: () => {},
      config: { validationDelay: 0, onUnhandledError: vi.fn() } as any,
      getRequiredErrors: () => ({}),
      getHiddenFields: () => new Set<string>(),
      emitBeforeValidate: async () => {},
      emitAfterValidate: async () => {},
    });

    // Job 1 starts
    manager.handleAsync("email", "a");
    await vi.advanceTimersByTimeAsync(0);
    await Promise.resolve();

    // Job 2 scheduled while job 1 awaits (cancel job1, register new controller for job2)
    pickValidator = secondValidator;
    manager.handleAsync("email", "ab");
    await vi.advanceTimersByTimeAsync(0);

    // Job 1 finishes — its finally block must NOT delete job 2's controller
    resolveFirstJob(null);
    await Promise.resolve();
    await Promise.resolve();

    // Even after job 1 cleaned up, cancelAll must abort job 2
    manager.cancelAll();

    // Advance time: job 2 (never-resolving) would eventually escape if controller was stolen
    const callsSnapshot = dispatch.mock.calls.length;
    await vi.advanceTimersByTimeAsync(2000);
    await Promise.resolve();

    // No extra dispatch should have happened after cancelAll
    expect(dispatch.mock.calls.length).toBe(callsSnapshot);
    expect(secondValidator).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  // ── Regressão BUG-2 ──────────────────────────────────────────────────────
  it("BUG-2: immediate async stage finally must not clear a newer controller registered for the same path", async () => {
    vi.useFakeTimers();

    let resolveFirst!: (v: null) => void;

    const state = {
      values: { email: "a" },
      errors: {},
      touched: {},
      isValidating: {} as Record<string, boolean>,
      persist: { isSaving: false, isRestoring: false, error: null },
      isValid: true,
      isSubmitting: false,
      isDirty: false,
    } as any;

    let callIndex = 0;
    const validators = [
      vi.fn(
        () =>
          new Promise<null>((resolve) => {
            resolveFirst = resolve;
          }),
      ),
      vi.fn(() => new Promise<null>(() => {})), // never resolves
    ];

    const dispatch = vi.fn((op: any) => {
      if (op.kind === "state.patch" && op.partialState.isValidating) {
        state.isValidating = op.partialState.isValidating;
      }
      if (op.kind === "validation.commit") {
        state.errors = op.errors;
        state.isValid = op.isValid;
      }
    });

    const manager = new BitValidationManager<any>({
      getState: () => state,
      dispatch,
      setError: vi.fn(),
      getFieldConfig: () => ({
        validation: {
          asyncValidate: validators[callIndex],
        },
      }),
      getScopeFields: () => [],
      forEachFieldConfig: (cb: any) =>
        cb({ validation: { asyncValidate: validators[callIndex] } }, "email"),
      config: { validationDelay: 0, onUnhandledError: vi.fn() } as any,
      getRequiredErrors: () => ({}),
      getHiddenFields: () => new Set<string>(),
      emitBeforeValidate: async () => {},
      emitAfterValidate: async () => {},
    });

    // First validate — kicks off immediate async with validators[0]
    callIndex = 0;
    const p1 = manager.validate({ scopeFields: ["email"] });
    await vi.advanceTimersByTimeAsync(0);
    await Promise.resolve();

    // Second validate — cancels first, registers new controller, starts validators[1]
    callIndex = 1;
    const p2 = manager.validate({ scopeFields: ["email"] });
    await vi.advanceTimersByTimeAsync(0);
    await Promise.resolve();

    // Finish the first validator — its finally must NOT delete validators[1]'s controller
    resolveFirst(null);
    await p1.catch(() => {});
    await Promise.resolve();
    await Promise.resolve();

    // cancelAll should still be able to stop validators[1]'s job
    manager.cancelAll();

    const callsSnapshot = dispatch.mock.calls.length;
    await vi.advanceTimersByTimeAsync(2000);
    await Promise.resolve();

    // validators[1] should have been called exactly once and produce no output after cancelAll
    expect(validators[1]).toHaveBeenCalledTimes(1);
    expect(dispatch.mock.calls.length).toBe(callsSnapshot);

    vi.useRealTimers();
  });

  it("BUG-3: async validation timeout should be inconclusive and not force success", async () => {
    vi.useFakeTimers();

    const state = {
      values: { email: "leo" },
      errors: {},
      touched: {},
      isValidating: {} as Record<string, boolean>,
      persist: { isSaving: false, isRestoring: false, error: null },
      isValid: true,
      isSubmitting: false,
      isDirty: false,
    } as any;

    const setError = vi.fn();
    const dispatch = vi.fn((op: any) => {
      if (op.kind === "state.patch" && op.partialState.isValidating) {
        state.isValidating = op.partialState.isValidating;
      }
    });

    const manager = new BitValidationManager<any>({
      getState: () => state,
      dispatch,
      setError,
      getFieldConfig: () => ({
        validation: {
          asyncValidateOn: "change",
          asyncValidateDelay: 0,
          asyncValidateTimeout: 20,
          asyncValidate: async () =>
            new Promise<string | null>((resolve) => {
              setTimeout(() => resolve("backend says invalid"), 200);
            }),
        },
      }),
      getScopeFields: () => [],
      forEachFieldConfig: () => {},
      config: { validationDelay: 0, onUnhandledError: vi.fn() } as any,
      getRequiredErrors: () => ({}),
      getHiddenFields: () => new Set<string>(),
      emitBeforeValidate: async () => {},
      emitAfterValidate: async () => {},
    });

    manager.handleAsync("email", "leo");
    await vi.advanceTimersByTimeAsync(25);
    await Promise.resolve();

    expect(setError).not.toHaveBeenCalled();
    expect(state.isValidating.email).toBeUndefined();

    vi.useRealTimers();
  });

  it("BUG-4: timeout race should clear timeout handles after async resolve", async () => {
    vi.useFakeTimers();

    const state = {
      values: { email: "leo@example.com" },
      errors: {},
      touched: {},
      isValidating: {} as Record<string, boolean>,
      persist: { isSaving: false, isRestoring: false, error: null },
      isValid: true,
      isSubmitting: false,
      isDirty: false,
    } as any;

    const manager = new BitValidationManager<any>({
      getState: () => state,
      dispatch: vi.fn((op: any) => {
        if (op.kind === "state.patch" && op.partialState.isValidating) {
          state.isValidating = op.partialState.isValidating;
        }
      }),
      setError: vi.fn(),
      getFieldConfig: () => ({
        validation: {
          asyncValidateOn: "change",
          asyncValidateDelay: 0,
          asyncValidateTimeout: 1000,
          asyncValidate: async () => null,
        },
      }),
      getScopeFields: () => [],
      forEachFieldConfig: () => {},
      config: { validationDelay: 0, onUnhandledError: vi.fn() } as any,
      getRequiredErrors: () => ({}),
      getHiddenFields: () => new Set<string>(),
      emitBeforeValidate: async () => {},
      emitAfterValidate: async () => {},
    });

    for (let i = 0; i < 10; i += 1) {
      manager.handleAsync("email", `leo${i}@example.com`);
    }

    await vi.advanceTimersByTimeAsync(0);
    await Promise.resolve();
    await Promise.resolve();

    expect(vi.getTimerCount()).toBe(0);

    vi.useRealTimers();
  });

  it("BUG-5: stale async error must be cleared when new timed-out validation starts", async () => {
    vi.useFakeTimers();

    const state = {
      values: { email: "first" },
      errors: {} as Record<string, string>,
      touched: {},
      isValidating: {} as Record<string, boolean>,
      persist: { isSaving: false, isRestoring: false, error: null },
      isValid: true,
      isSubmitting: false,
      isDirty: false,
    } as any;

    const dispatch = vi.fn((op: any) => {
      if (op.kind === "state.patch" && op.partialState.isValidating) {
        state.isValidating = op.partialState.isValidating;
      }
    });

    const setError = vi.fn((path: string, message: string | undefined) => {
      if (message === undefined) {
        delete state.errors[path];
      } else {
        state.errors[path] = message;
      }
    });

    const manager = new BitValidationManager<any>({
      getState: () => state,
      dispatch,
      setError,
      getFieldConfig: () => ({
        validation: {
          asyncValidateOn: "change",
          asyncValidateDelay: 0,
          asyncValidateTimeout: 20,
          asyncValidate: async (value: string) => {
            if (value === "first") {
              return "taken";
            }

            return new Promise<string | null>((resolve) => {
              setTimeout(() => resolve(null), 200);
            });
          },
        },
      }),
      getScopeFields: () => [],
      forEachFieldConfig: () => {},
      config: { validationDelay: 0, onUnhandledError: vi.fn() } as any,
      getRequiredErrors: () => ({}),
      getHiddenFields: () => new Set<string>(),
      emitBeforeValidate: async () => {},
      emitAfterValidate: async () => {},
    });

    manager.handleAsync("email", "first");
    await vi.advanceTimersByTimeAsync(0);
    await Promise.resolve();

    expect(state.errors.email).toBe("taken");

    state.values.email = "second";
    manager.handleAsync("email", "second");
    await vi.advanceTimersByTimeAsync(25);
    await Promise.resolve();

    expect(state.errors.email).toBeUndefined();
    expect(state.isValidating.email).toBeUndefined();

    vi.useRealTimers();
  });

  it("BUG-7: clearing async state must not remove resolver error with same message", async () => {
    vi.useFakeTimers();

    const state = {
      values: { email: "first" },
      errors: { email: "required" } as Record<string, string>,
      touched: {},
      isValidating: {} as Record<string, boolean>,
      persist: { isSaving: false, isRestoring: false, error: null },
      isValid: false,
      isSubmitting: false,
      isDirty: false,
    } as any;

    const dispatch = vi.fn((op: any) => {
      if (op.kind === "state.patch" && op.partialState.isValidating) {
        state.isValidating = op.partialState.isValidating;
      }
      if (op.kind === "validation.commit") {
        state.errors = op.errors;
        state.isValid = op.isValid;
      }
    });

    const setError = vi.fn((path: string, message: string | undefined) => {
      if (message === undefined) {
        delete state.errors[path];
      } else {
        state.errors[path] = message;
      }
    });

    const manager = new BitValidationManager<any>({
      getState: () => state,
      dispatch,
      setError,
      getFieldConfig: () => ({
        validation: {
          asyncValidateOn: "change",
          asyncValidateDelay: 0,
          asyncValidateTimeout: 20,
          asyncValidate: async () =>
            new Promise<string | null>((resolve) => {
              setTimeout(() => resolve(null), 200);
            }),
        },
      }),
      getScopeFields: () => [],
      forEachFieldConfig: () => {},
      config: {
        validationDelay: 0,
        resolver: async () => ({ email: "required" }),
        onUnhandledError: vi.fn(),
      } as any,
      getRequiredErrors: () => ({}),
      getHiddenFields: () => new Set<string>(),
      emitBeforeValidate: async () => {},
      emitAfterValidate: async () => {},
    });

    manager.handleAsync("email", "second");
    await vi.advanceTimersByTimeAsync(25);
    await Promise.resolve();

    // Resolver error should remain despite async cleanup/timeout.
    const validatePromise = manager.validate({ scopeFields: ["email"] });
    await vi.advanceTimersByTimeAsync(25);
    await validatePromise;
    expect(state.errors.email).toBe("required");

    vi.useRealTimers();
  });

  it("BUG-6: immediate validate with timeout must not reuse stale async error", async () => {
    vi.useFakeTimers();

    const state = {
      values: { email: "first" },
      errors: {} as Record<string, string>,
      touched: {},
      isValidating: {} as Record<string, boolean>,
      persist: { isSaving: false, isRestoring: false, error: null },
      isValid: true,
      isSubmitting: false,
      isDirty: false,
    } as any;

    const dispatch = vi.fn((op: any) => {
      if (op.kind === "state.patch" && op.partialState.isValidating) {
        state.isValidating = op.partialState.isValidating;
      }
      if (op.kind === "validation.commit") {
        state.errors = op.errors;
        state.isValid = op.isValid;
      }
    });

    const setError = vi.fn((path: string, message: string | undefined) => {
      if (message === undefined) {
        delete state.errors[path];
      } else {
        state.errors[path] = message;
      }
    });

    const manager = new BitValidationManager<any>({
      getState: () => state,
      dispatch,
      setError,
      getFieldConfig: () => ({
        validation: {
          asyncValidateOn: "change",
          asyncValidateDelay: 0,
          asyncValidateTimeout: 20,
          asyncValidate: async (value: string) => {
            if (value === "first") {
              return "taken";
            }
            return new Promise<string | null>((resolve) => {
              setTimeout(() => resolve(null), 200);
            });
          },
        },
      }),
      getScopeFields: () => [],
      forEachFieldConfig: () => {},
      config: { validationDelay: 0, onUnhandledError: vi.fn() } as any,
      getRequiredErrors: () => ({}),
      getHiddenFields: () => new Set<string>(),
      emitBeforeValidate: async () => {},
      emitAfterValidate: async () => {},
    });

    manager.handleAsync("email", "first");
    await vi.advanceTimersByTimeAsync(0);
    await Promise.resolve();
    expect(state.errors.email).toBe("taken");

    state.values.email = "second";
    const pendingValidation = manager.validate({ scopeFields: ["email"] });
    await vi.advanceTimersByTimeAsync(25);
    await Promise.resolve();
    const result = await pendingValidation;

    expect(result).toBe(true);
    expect(state.errors.email).toBeUndefined();

    vi.useRealTimers();
  });

  // ── Regressão BUG-abort-result ────────────────────────────────────────
  it("BUG-abort-result: aborted validate() must return live isValid and emit correct result in afterValidate", async () => {
    vi.useFakeTimers();

    // State starts valid; second validation will commit errors making it invalid.
    const state: any = {
      values: { email: "" },
      errors: {} as Record<string, string>,
      touched: {},
      isValidating: {},
      persist: { isSaving: false, isRestoring: false, error: null },
      isValid: true,
      isSubmitting: false,
      isDirty: false,
    };

    const afterValidateEvents: Array<{ result: boolean; aborted?: boolean }> =
      [];
    let resolveFirstBeforeHook!: () => void;

    const manager = new BitValidationManager<any>({
      getState: () => state,
      dispatch: vi.fn((op: any) => {
        if (op.kind === "validation.commit") {
          state.isValid = op.isValid;
          state.errors = op.errors;
        }
      }),
      setError: vi.fn(),
      getFieldConfig: () => undefined,
      getScopeFields: () => [],
      forEachFieldConfig: () => {},
      config: {
        validationDelay: 0,
        resolver: async () => ({ email: "required" }),
        onUnhandledError: vi.fn(),
      } as any,
      getRequiredErrors: () => ({}),
      getHiddenFields: () => new Set<string>(),
      emitBeforeValidate: async (_event: any) => {
        // First call: stall until we start the second validate.
        if (!resolveFirstBeforeHook) {
          await new Promise<void>((resolve) => {
            resolveFirstBeforeHook = resolve;
          });
        }
      },
      emitAfterValidate: async (event: any) => {
        afterValidateEvents.push({
          result: event.result,
          aborted: event.aborted,
        });
      },
    });

    // Start first validate — it will stall inside emitBeforeValidate.
    const p1 = manager.validate();
    await vi.advanceTimersByTimeAsync(0);
    await Promise.resolve();

    // Start second validate — it will advance to completion and commit isValid=false.
    const p2 = manager.validate();
    await vi.advanceTimersByTimeAsync(0);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    // p2 should be done now and state must be invalid.
    expect(state.isValid).toBe(false);

    // Unblock and finish p1 (which will be aborted because validationId advanced).
    resolveFirstBeforeHook();
    const [r1, r2] = await Promise.all([p1, p2]);

    // p1 was aborted — must reflect live isValid (false), NOT the stale snapshot (true).
    expect(r1).toBe(false);
    expect(r2).toBe(false);

    // The afterValidate event for the aborted p1 must also carry result=false.
    const abortedEvent = afterValidateEvents.find((e) => e.aborted);
    expect(abortedEvent).toBeDefined();
    expect(abortedEvent!.result).toBe(false);

    vi.useRealTimers();
  });
});
