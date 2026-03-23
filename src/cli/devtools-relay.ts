import { WebSocketServer } from "ws";
import type http from "node:http";
import { isDevToolsPingMessage } from "../devtools/protocol";

export function attachDevToolsRelay(server: http.Server): WebSocketServer {
  const wss = new WebSocketServer({ server });

  wss.on("connection", (ws) => {
    ws.on("message", (messageBuffer) => {
      const messageStr = messageBuffer.toString();

      try {
        const data = JSON.parse(messageStr) as unknown;

        if (isDevToolsPingMessage(data)) {
          return;
        }
      } catch {
        // ignore malformed relay payloads and forward raw message below
      }

      wss.clients.forEach((client) => {
        if (client !== ws && client.readyState === 1) {
          client.send(messageStr);
        }
      });
    });
  });

  return wss;
}
