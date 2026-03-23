import { afterEach, describe, expect, it, vi } from "vitest";
import { setupRemoteBridge } from "../../devtools/bridge";
import { DEVTOOLS_PROTOCOL_VERSION } from "../../devtools/protocol";

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  readyState = MockWebSocket.CONNECTING;
  sent: string[] = [];

  constructor(public readonly url: string) {
    MockWebSocket.instances.push(this);
  }

  send(data: string) {
    this.sent.push(data);
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.();
  }

  open() {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.();
  }

  receive(payload: unknown) {
    this.onmessage?.({ data: JSON.stringify(payload) });
  }
}

function createActionableStore() {
  return {
    getState: () => ({
      values: { name: "leo" },
      errors: {},
      touched: {},
      isValidating: {},
      persist: { isSaving: false, isRestoring: false, error: null },
      isValid: true,
      isSubmitting: false,
      isDirty: false,
    }),
    getHistoryMetadata: () => ({
      canUndo: true,
      canRedo: false,
      historySize: 2,
      historyIndex: 1,
    }),
    undo: vi.fn(),
    redo: vi.fn(),
    reset: vi.fn(),
  };
}

describe("devtools remote bridge flow", () => {
  afterEach(() => {
    MockWebSocket.instances = [];
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("envia HELLO e STATE_UPDATE versionados ao conectar", () => {
    vi.stubGlobal("WebSocket", MockWebSocket as unknown as typeof WebSocket);

    const store = createActionableStore();

    const bus = {
      stores: { checkout: store },
      subscribe: () => () => undefined,
    };

    const cleanup = setupRemoteBridge("ws://localhost:3000", bus as any);
    const socket = MockWebSocket.instances[0];

    socket.open();

    const sentMessages = socket.sent.map((entry) => JSON.parse(entry));

    expect(sentMessages[0]).toMatchObject({
      type: "HELLO",
      protocolVersion: DEVTOOLS_PROTOCOL_VERSION,
      payload: {
        role: "server",
        protocolVersion: DEVTOOLS_PROTOCOL_VERSION,
      },
    });

    expect(sentMessages[1]).toMatchObject({
      type: "STATE_UPDATE",
      protocolVersion: DEVTOOLS_PROTOCOL_VERSION,
    });

    cleanup();
  });

  it("executa ações somente quando protocolVersion é suportada", () => {
    vi.stubGlobal("WebSocket", MockWebSocket as unknown as typeof WebSocket);

    const store = createActionableStore();

    const bus = {
      stores: { checkout: store },
      subscribe: () => () => undefined,
    };

    const cleanup = setupRemoteBridge("ws://localhost:3000", bus as any);
    const socket = MockWebSocket.instances[0];

    socket.open();

    socket.receive({
      type: "ACTION",
      payload: { storeId: "checkout", action: "undo" },
    });

    expect(store.undo).not.toHaveBeenCalled();

    socket.receive({
      type: "ACTION",
      protocolVersion: DEVTOOLS_PROTOCOL_VERSION,
      payload: { storeId: "checkout", action: "undo" },
    });

    expect(store.undo).toHaveBeenCalledTimes(1);

    cleanup();
  });
});
