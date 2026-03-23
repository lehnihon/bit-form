import { describe, expect, it } from "vitest";
import {
  DEVTOOLS_PROTOCOL_VERSION,
  isDevToolsActionMessage,
  isDevToolsHelloMessage,
  isDevToolsPingMessage,
  isDevToolsStateUpdateMessage,
} from "../../devtools/protocol";

describe("devtools protocol", () => {
  it("rejeita ACTION sem protocolVersion", () => {
    const message = {
      type: "ACTION",
      payload: { storeId: "checkout", action: "undo" },
    };

    expect(isDevToolsActionMessage(message)).toBe(false);
  });

  it("aceita ACTION com protocolVersion suportada", () => {
    const message = {
      type: "ACTION",
      protocolVersion: DEVTOOLS_PROTOCOL_VERSION,
      payload: { storeId: "checkout", action: "undo" },
    };

    expect(isDevToolsActionMessage(message)).toBe(true);
  });

  it("rejeita ACTION com protocolVersion incompatível", () => {
    const message = {
      type: "ACTION",
      protocolVersion: DEVTOOLS_PROTOCOL_VERSION + 1,
      payload: { storeId: "checkout", action: "undo" },
    };

    expect(isDevToolsActionMessage(message)).toBe(false);
  });

  it("valida HELLO com versão suportada", () => {
    const clientHello = {
      type: "HELLO",
      protocolVersion: DEVTOOLS_PROTOCOL_VERSION,
      payload: {
        role: "client",
        protocolVersion: DEVTOOLS_PROTOCOL_VERSION,
      },
    };

    expect(isDevToolsHelloMessage(clientHello)).toBe(true);
  });

  it("rejeita HELLO com versão divergente", () => {
    const hello = {
      type: "HELLO",
      protocolVersion: DEVTOOLS_PROTOCOL_VERSION,
      payload: {
        role: "server",
        protocolVersion: DEVTOOLS_PROTOCOL_VERSION + 2,
      },
    };

    expect(isDevToolsHelloMessage(hello)).toBe(false);
  });

  it("rejeita HELLO sem protocolVersion no envelope", () => {
    const hello = {
      type: "HELLO",
      payload: {
        role: "client",
        protocolVersion: DEVTOOLS_PROTOCOL_VERSION,
      },
    };

    expect(isDevToolsHelloMessage(hello)).toBe(false);
  });

  it("valida PING e STATE_UPDATE com versão suportada", () => {
    const ping = {
      type: "PING",
      protocolVersion: DEVTOOLS_PROTOCOL_VERSION,
    };

    const stateUpdate = {
      type: "STATE_UPDATE",
      protocolVersion: DEVTOOLS_PROTOCOL_VERSION,
      payload: {},
    };

    expect(isDevToolsPingMessage(ping)).toBe(true);
    expect(isDevToolsStateUpdateMessage(stateUpdate)).toBe(true);
  });
});
