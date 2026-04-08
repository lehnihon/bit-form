import { describe, expect, it, vi } from "vitest";
import { BitAsyncValidationScheduler } from "../../core/store/managers/features/validation/async-validation-scheduler";

describe("BitAsyncValidationScheduler", () => {
  it("should cleanup abortController from Map after validation completes (memory leak prevention)", async () => {
    vi.useFakeTimers();

    const port = {
      schedule: (fn: () => void, delayMs: number) => {
        const timeoutId = setTimeout(fn, delayMs);
        return () => clearTimeout(timeoutId);
      },
      getValues: () => ({ username: "john" }),
      setFieldValidating: vi.fn(),
      setAsyncError: vi.fn(),
      clearAsyncError: vi.fn(),
      onValidationPassed: vi.fn(),
      onError: vi.fn(),
    };

    const scheduler = new BitAsyncValidationScheduler(port);

    const asyncValidate = vi.fn().mockResolvedValue(null); // Success

    // First validation
    scheduler.handle("username", "john", asyncValidate, 100);
    expect((scheduler as any).abortControllers.size).toBe(1);

    await vi.advanceTimersByTimeAsync(100);
    await vi.runAllTimersAsync();

    // After validation completes, abortController should be cleaned up
    expect((scheduler as any).abortControllers.size).toBe(0);

    // Second validation with same path should create new controller
    scheduler.handle("username", "jane", asyncValidate, 100);
    expect((scheduler as any).abortControllers.size).toBe(1);

    await vi.advanceTimersByTimeAsync(100);
    await vi.runAllTimersAsync();

    expect((scheduler as any).abortControllers.size).toBe(0);

    vi.useRealTimers();
  });

  it("should guard against stale abortController cleanup (controller identity check)", async () => {
    vi.useFakeTimers();

    const port = {
      schedule: (fn: () => void, delayMs: number) => {
        const timeoutId = setTimeout(fn, delayMs);
        return () => clearTimeout(timeoutId);
      },
      getValues: () => ({ username: "john" }),
      setFieldValidating: vi.fn(),
      setAsyncError: vi.fn(),
      clearAsyncError: vi.fn(),
      onValidationPassed: vi.fn(),
      onError: vi.fn(),
    };

    const scheduler = new BitAsyncValidationScheduler(port);
    const asyncValidate = vi.fn().mockResolvedValue(null);

    // First validation
    scheduler.handle("username", "john", asyncValidate, 100);
    const firstController = (scheduler as any).abortControllers.get("username");
    expect(firstController).toBeDefined();

    // Cancel before it completes
    scheduler.cancel("username");
    expect((scheduler as any).abortControllers.size).toBe(0);

    // Start second validation
    scheduler.handle("username", "jane", asyncValidate, 100);
    const secondController = (scheduler as any).abortControllers.get(
      "username",
    );
    expect(secondController).toBeDefined();
    expect(secondController).not.toBe(firstController);

    await vi.advanceTimersByTimeAsync(100);
    await vi.runAllTimersAsync();

    // Only the current controller should be in the map initially
    expect((scheduler as any).abortControllers.size).toBe(0);

    vi.useRealTimers();
  });
});
