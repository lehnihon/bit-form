import { describe, it, expect, vi, beforeEach } from "vitest";
import { createBitStore } from "../../core";
import { createDevToolsPlugin } from "../../devtools";
import * as devtools from "../../devtools/init-dev-tools";
import * as bridge from "../../devtools/bridge";

vi.mock("../../devtools/init-dev-tools", () => ({
  initDevTools: vi.fn(() => ({
    destroy: vi.fn(),
  })),
}));

vi.mock("../../devtools/bridge", () => ({
  setupRemoteBridge: vi.fn(() => vi.fn()),
}));

describe("BitDevtoolsManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deve ignorar a inicializacao se devTools for undefined", async () => {
    createBitStore({ initialValues: {} });

    await Promise.resolve();

    expect(devtools.initDevTools).not.toHaveBeenCalled();
    expect(bridge.setupRemoteBridge).not.toHaveBeenCalled();
  });

  it("deve inicializar em modo local se devTools for true", async () => {
    createBitStore({
      initialValues: {},
      devTools: true,
      plugins: [createDevToolsPlugin()],
    } as any);

    await vi.waitFor(() => {
      expect(devtools.initDevTools).toHaveBeenCalled();
    });

    expect(bridge.setupRemoteBridge).not.toHaveBeenCalled();
  });

  it("deve inicializar em modo remote com url padrao", async () => {
    createBitStore({
      initialValues: {},
      devTools: { mode: "remote" },
      plugins: [createDevToolsPlugin()],
    } as any);

    await vi.waitFor(() => {
      expect(bridge.setupRemoteBridge).toHaveBeenCalledWith(
        "ws://localhost:3000",
        undefined,
      );
    });

    expect(devtools.initDevTools).not.toHaveBeenCalled();
  });

  it("deve inicializar em modo remote com url customizada", async () => {
    createBitStore({
      initialValues: {},
      devTools: { mode: "remote", url: "ws://meu-app.com:4000" },
      plugins: [createDevToolsPlugin()],
    } as any);

    await vi.waitFor(() => {
      expect(bridge.setupRemoteBridge).toHaveBeenCalledWith(
        "ws://meu-app.com:4000",
        undefined,
      );
    });
  });

  it("deve chamar as funcoes de destroy corretamente", async () => {
    const mockDestroyLocal = vi.fn();
    vi.mocked(devtools.initDevTools).mockReturnValueOnce({
      destroy: mockDestroyLocal,
    } as any);

    const storeLocal = createBitStore({
      initialValues: {},
      devTools: true,
      plugins: [createDevToolsPlugin()],
    } as any);

    await vi.waitFor(() => {
      expect(devtools.initDevTools).toHaveBeenCalled();
    });

    storeLocal.cleanup();
    expect(mockDestroyLocal).toHaveBeenCalled();

    const mockDestroyRemote = vi.fn();
    vi.mocked(bridge.setupRemoteBridge).mockReturnValueOnce(mockDestroyRemote);

    const storeRemote = createBitStore({
      initialValues: {},
      devTools: { mode: "remote" },
      plugins: [createDevToolsPlugin()],
    } as any);

    await vi.waitFor(() => {
      expect(bridge.setupRemoteBridge).toHaveBeenCalled();
    });

    storeRemote.cleanup();
    expect(mockDestroyRemote).toHaveBeenCalled();
  });
});
