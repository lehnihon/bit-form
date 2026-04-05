import { describe, expect, it } from "vitest";
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
});
