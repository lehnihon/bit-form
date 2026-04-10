import { describe, expect, it } from "vitest";
import { createHistoryPatch } from "../../core/store/engines/snapshot-diff-engine";
import { BitHistoryManager } from "../../core/store/managers/features/history-manager";

describe("BitHistoryManager", () => {
  it("should clear redo timeline after undo followed by new snapshot", () => {
    const history = new BitHistoryManager<{ name: string }>(true, 10);

    history.reset({ name: "A" });
    history.saveSnapshot({ name: "B" });
    history.saveSnapshot({ name: "C" });

    expect(history.canUndo).toBe(true);
    expect(history.canRedo).toBe(false);

    const prev = history.undo();
    expect(prev).toEqual({ name: "B" });
    expect(history.canRedo).toBe(true);

    history.saveSnapshot({ name: "D" });

    expect(history.canRedo).toBe(false);
    expect(history.redo()).toBeNull();
  });

  it("should respect max history ring buffer size", () => {
    const history = new BitHistoryManager<{ v: number }>(true, 3);

    history.reset({ v: 0 });
    history.saveSnapshot({ v: 1 });
    history.saveSnapshot({ v: 2 });
    history.saveSnapshot({ v: 3 });

    expect(history.getMetadata().historySize).toBe(3);
    expect(history.getMetadata().historyIndex).toBe(2);

    expect(history.undo()).toEqual({ v: 2 });
    expect(history.undo()).toEqual({ v: 1 });
    expect(history.undo()).toBeNull();
  });

  it("should save circular snapshots without stack overflow", () => {
    const history = new BitHistoryManager<Record<string, unknown>>(true, 10);
    const initial = { profile: { name: "A" } };
    const circular: Record<string, unknown> = { profile: { name: "B" } };

    circular.self = circular;

    history.reset(initial);

    expect(() => history.saveSnapshot(circular)).not.toThrow();
    expect(history.getMetadata()).toMatchObject({
      historyIndex: 1,
      historySize: 2,
      canUndo: true,
    });

    const previous = history.undo();

    expect(previous).toEqual(initial);
  });

  it("should not generate patch operations for equivalent circular graphs", () => {
    const previous: Record<string, unknown> = { profile: { name: "Leo" } };
    previous.self = previous;

    const next: Record<string, unknown> = { profile: { name: "Leo" } };
    next.self = next;

    const patch = createHistoryPatch(previous, next);

    expect(patch.operations).toHaveLength(0);
  });

  it("should preserve redo timeline when saveSnapshot is a noop after undo", () => {
    const history = new BitHistoryManager<{ step: string }>(true, 10);

    history.reset({ step: "A" });
    history.saveSnapshot({ step: "B" });
    history.saveSnapshot({ step: "C" });

    expect(history.undo()).toEqual({ step: "B" });
    expect(history.canRedo).toBe(true);

    history.saveSnapshot({ step: "B" });

    expect(history.canRedo).toBe(true);
    expect(history.redo()).toEqual({ step: "C" });
  });

  it("should preserve both branches when snapshots reuse shared references", () => {
    const history = new BitHistoryManager<{
      billing: { city: string };
      shipping: { city: string };
    }>(true, 10);

    const initialShared = { city: "Tokyo" };
    const nextShared = { city: "Osaka" };

    history.reset({
      billing: initialShared,
      shipping: initialShared,
    });

    history.saveSnapshot({
      billing: nextShared,
      shipping: nextShared,
    });

    expect(history.undo()).toEqual({
      billing: { city: "Tokyo" },
      shipping: { city: "Tokyo" },
    });

    expect(history.redo()).toEqual({
      billing: { city: "Osaka" },
      shipping: { city: "Osaka" },
    });
  });
});
