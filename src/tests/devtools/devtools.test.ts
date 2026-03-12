import { describe, it, expect, vi, beforeEach } from "vitest";
import { BitStore } from "../../core/store";
import * as devtools from "../../devtools/index";
import * as bridge from "../../devtools/bridge";

vi.mock("../../devtools/index", () => ({
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

  it("deve ignorar a inicializacao se devTools for undefined", () => {
    new BitStore({ initialValues: {} });

    expect(devtools.initDevTools).not.toHaveBeenCalled();
    expect(bridge.setupRemoteBridge).not.toHaveBeenCalled();
  });

  it("deve inicializar em modo local se devTools for true", () => {
    new BitStore({
      initialValues: {},
      devTools: true,
    } as any);

    expect(devtools.initDevTools).toHaveBeenCalled();
    expect(bridge.setupRemoteBridge).not.toHaveBeenCalled();
  });

  it("deve inicializar em modo remote com url padrao", () => {
    new BitStore({
      initialValues: {},
      devTools: { mode: "remote" },
    } as any);

    expect(bridge.setupRemoteBridge).toHaveBeenCalledWith(
      "ws://localhost:3000",
    );
    expect(devtools.initDevTools).not.toHaveBeenCalled();
  });

  it("deve inicializar em modo remote com url customizada", () => {
    new BitStore({
      initialValues: {},
      devTools: { mode: "remote", url: "ws://meu-app.com:4000" },
    } as any);

    expect(bridge.setupRemoteBridge).toHaveBeenCalledWith(
      "ws://meu-app.com:4000",
    );
  });

  it("deve chamar as funcoes de destroy corretamente", () => {
    const mockDestroyLocal = vi.fn();
    vi.mocked(devtools.initDevTools).mockReturnValueOnce({
      destroy: mockDestroyLocal,
    } as any);

    const storeLocal = new BitStore({
      initialValues: {},
      devTools: true,
    } as any);
    (storeLocal as any).devtoolsMg.destroy();
    expect(mockDestroyLocal).toHaveBeenCalled();

    const mockDestroyRemote = vi.fn();
    vi.mocked(bridge.setupRemoteBridge).mockReturnValueOnce(mockDestroyRemote);

    const storeRemote = new BitStore({
      initialValues: {},
      devTools: { mode: "remote" },
    } as any);
    (storeRemote as any).devtoolsMg.destroy();
    expect(mockDestroyRemote).toHaveBeenCalled();
  });
});
