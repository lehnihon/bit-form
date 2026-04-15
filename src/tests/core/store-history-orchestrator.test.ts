import { describe, expect, it, vi } from "vitest";
import { BitStoreHistoryOrchestrator } from "../../core/store/orchestration/store-history-orchestrator";

function createHistoryStub<T extends object>(args: {
  metadata: {
    enabled: boolean;
    canUndo: boolean;
    canRedo: boolean;
    historyIndex: number;
    historySize: number;
  };
  saveSnapshot?: (values: T) => void;
}) {
  return {
    saveSnapshot: vi.fn((values: T) => {
      args.saveSnapshot?.(values);
    }),
    getMetadata: vi.fn(() => args.metadata),
  };
}

describe("BitStoreHistoryOrchestrator", () => {
  it("debounces snapshots and records only the latest pending value", () => {
    vi.useFakeTimers();

    const notifyHistoryChanged = vi.fn();
    let metadata = {
      enabled: true,
      canUndo: false,
      canRedo: false,
      historyIndex: 0,
      historySize: 1,
    };
    const history = createHistoryStub<{ name: string }>({
      metadata,
      saveSnapshot: () => {
        metadata = {
          enabled: true,
          canUndo: true,
          canRedo: false,
          historyIndex: 1,
          historySize: 2,
        };
        history.getMetadata.mockImplementation(() => metadata);
      },
    });

    const orchestrator = new BitStoreHistoryOrchestrator<{ name: string }>({
      debounceMs: 300,
      history,
      notifyHistoryChanged,
    });

    orchestrator.queueSnapshot({ name: "A" });
    orchestrator.queueSnapshot({ name: "B" });

    expect(history.saveSnapshot).not.toHaveBeenCalled();

    vi.advanceTimersByTime(300);

    expect(history.saveSnapshot).toHaveBeenCalledTimes(1);
    expect(history.saveSnapshot).toHaveBeenCalledWith({ name: "B" });
    expect(notifyHistoryChanged).toHaveBeenCalledTimes(1);
  });

  it("flushes pending snapshot immediately", () => {
    vi.useFakeTimers();

    const notifyHistoryChanged = vi.fn();
    let metadata = {
      enabled: true,
      canUndo: false,
      canRedo: false,
      historyIndex: 0,
      historySize: 1,
    };
    const history = createHistoryStub<{ name: string }>({
      metadata,
      saveSnapshot: () => {
        metadata = {
          enabled: true,
          canUndo: true,
          canRedo: false,
          historyIndex: 1,
          historySize: 2,
        };
        history.getMetadata.mockImplementation(() => metadata);
      },
    });

    const orchestrator = new BitStoreHistoryOrchestrator<{ name: string }>({
      debounceMs: 300,
      history,
      notifyHistoryChanged,
    });

    orchestrator.queueSnapshot({ name: "A" });
    orchestrator.flushPendingSnapshot();

    expect(history.saveSnapshot).toHaveBeenCalledTimes(1);
    expect(history.saveSnapshot).toHaveBeenCalledWith({ name: "A" });
    expect(notifyHistoryChanged).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(300);
    expect(history.saveSnapshot).toHaveBeenCalledTimes(1);
  });

  it("does not notify when metadata does not change", () => {
    const notifyHistoryChanged = vi.fn();
    const metadata = {
      enabled: true,
      canUndo: false,
      canRedo: false,
      historyIndex: 0,
      historySize: 1,
    };
    const history = createHistoryStub<{ name: string }>({ metadata });

    const orchestrator = new BitStoreHistoryOrchestrator<{ name: string }>({
      debounceMs: 0,
      history,
      notifyHistoryChanged,
    });

    orchestrator.queueSnapshot({ name: "A" });

    expect(history.saveSnapshot).toHaveBeenCalledTimes(1);
    expect(notifyHistoryChanged).not.toHaveBeenCalled();
  });

  it("disposes pending timer and values", () => {
    vi.useFakeTimers();

    const history = createHistoryStub<{ name: string }>({
      metadata: {
        enabled: true,
        canUndo: false,
        canRedo: false,
        historyIndex: 0,
        historySize: 1,
      },
    });

    const orchestrator = new BitStoreHistoryOrchestrator<{ name: string }>({
      debounceMs: 300,
      history,
      notifyHistoryChanged: vi.fn(),
    });

    orchestrator.queueSnapshot({ name: "A" });
    orchestrator.dispose();

    vi.advanceTimersByTime(300);

    expect(history.saveSnapshot).not.toHaveBeenCalled();
  });
});
