import { WebSocketServer } from "ws";
import type http from "node:http";
import type { WebSocket } from "ws";
import {
  isDevToolsHelloMessage,
  isDevToolsPingMessage,
} from "../devtools/protocol";

const MAX_MESSAGE_SIZE = 1 * 1024 * 1024; // 1 MB
const MAX_MESSAGES_PER_SECOND = 100;

export function attachDevToolsRelay(server: http.Server): WebSocketServer {
  const wss = new WebSocketServer({
    server,
    maxPayload: MAX_MESSAGE_SIZE,
    pingInterval: 30000,
    pingTimeout: 10000,
  });

  const MAX_CONNECTIONS = 50;
  let activeConnections = 0;

  const clientRateLimit = new Map<
    WebSocket,
    { count: number; resetAt: number }
  >();

  wss.on("connection", (ws) => {
    if (++activeConnections > MAX_CONNECTIONS) {
      const code = 1013; // Try Again Later
      ws.close(code, "Too many connections");
      activeConnections = MAX_CONNECTIONS;
      return;
    }

    clientRateLimit.set(ws, { count: 0, resetAt: Date.now() + 1000 });

    ws.on("message", (messageBuffer) => {
      const rate = clientRateLimit.get(ws);
      if (!rate) return;

      if (Date.now() > rate.resetAt) {
        rate.count = 0;
        rate.resetAt = Date.now() + 1000;
      }

      if (++rate.count > MAX_MESSAGES_PER_SECOND) {
        return;
      }

      const messageStr = messageBuffer.toString();

      if (messageStr.length > MAX_MESSAGE_SIZE) {
        return;
      }

      try {
        const data = JSON.parse(messageStr) as unknown;

        if (isDevToolsPingMessage(data) || isDevToolsHelloMessage(data)) {
          return;
        }
      } catch {
        return;
      }

      wss.clients.forEach((client) => {
        if (client !== ws && client.readyState === 1) {
          client.send(messageStr);
        }
      });
    });

    ws.on("close", () => {
      activeConnections = Math.max(0, activeConnections - 1);
      clientRateLimit.delete(ws);
    });
  });

  return wss;
}
