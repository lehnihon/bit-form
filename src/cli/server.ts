import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { WebSocketServer } from "ws";

export function startDevServer(port = 3000) {
  const server = http.createServer((req, res) => {
    if (req.url === "/" || req.url === "/index.html") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(getDashboardHTML(port));
      return;
    }

    if (req.url?.startsWith("/dist/")) {
      const relativePath = req.url.replace("/dist/", "");
      const filePath = path.resolve(
        __dirname,
        "..",
        "..",
        "dist",
        relativePath,
      );

      try {
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath);
          const ext = path.extname(filePath);
          const mimeTypes: Record<string, string> = {
            ".js": "application/javascript",
            ".css": "text/css",
          };
          res.writeHead(200, {
            "Content-Type": mimeTypes[ext] || "text/plain",
          });
          res.end(content);
        } else {
          res.writeHead(404);
          res.end("Not Found");
        }
      } catch (err) {
        res.writeHead(500);
        res.end("Internal Error");
      }
      return;
    }

    res.writeHead(404);
    res.end("Not Found");
  });

  const wss = new WebSocketServer({ server });

  wss.on("connection", (ws) => {
    ws.on("message", (messageBuffer) => {
      const messageStr = messageBuffer.toString();

      try {
        const data = JSON.parse(messageStr);

        if (data.type === "PING") {
          return;
        }
      } catch (e) {}

      wss.clients.forEach((client) => {
        if (client !== ws && client.readyState === 1) {
          client.send(messageStr);
        }
      });
    });
  });

  server.listen(port, () => {
    console.log(`🚀 BitForm DevServer rodando em http://localhost:${port}`);
  });
}

function getDashboardHTML(port: number) {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>🛠 Bit-Form Remote Inspector</title>
  <style>
    /* 1. Reset e Box-Sizing (Essencial para não estourar) */
    *, *::before, *::after { 
      box-sizing: border-box; 
    }

    html, body { 
      background: #0f172a; 
      margin: 0; 
      padding: 0; 
      width: 100%; /* Trocado de 100vw para 100% */
      height: 100%; 
      overflow-x: hidden; /* Garante que nunca haverá scroll horizontal */
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }

    /* 2. Mensagem de Loading centralizada */
    .status-container { 
      position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); 
      text-align: center; color: #64748b; z-index: 1;
    }

    /* 3. MÁGICA FULLSCREEN: Ajustada para 100% */
    body.has-panel .bit-devtools-panel {
      display: flex !important;
      flex-direction: column !important;
      position: fixed !important;
      inset: 0 !important;
      width: 100% !important; /* Trocado de 100vw para 100% */
      height: 100% !important;
      max-width: 100% !important;
      max-height: 100% !important;
      margin: 0 !important;
      border-radius: 0 !important;
      border: none !important;
      box-shadow: none !important;
      background: #0f172a !important;
      z-index: 9999 !important;
    }

    /* Ajuste fino para o conteúdo interno */
    body.has-panel .bit-store-block {
      border-bottom: 1px solid #1e293b !important;
      padding: 20px !important;
      width: 100%; /* Garante que o bloco respeite o pai */
    }

    /* 4. Esconde o botão original */
    .bit-devtools-trigger {
      display: none !important;
    }

    body.has-panel .status-container { opacity: 0; visibility: hidden; }
  </style>
</head>
<body>
  <div class="status-container">
    <div style="font-size: 3rem; margin-bottom: 10px;">📡</div>
    <div id="status">Aguardando dados do projeto <strong>bit-form</strong>...</div>
  </div>

  <script type="module">
    import { initDevTools } from "/dist/devtools/index.js";

    const ws = new WebSocket("ws://localhost:${port}");
    
    ws.onopen = () => {
      document.body.classList.add('connected');
      
      const devtools = initDevTools({
        mode: "remote",
        socket: ws,
        container: document.body,
        onUndo: (id) => ws.send(JSON.stringify({ type: 'ACTION', payload: { storeId: id, action: 'undo' } })),
        onRedo: (id) => ws.send(JSON.stringify({ type: 'ACTION', payload: { storeId: id, action: 'redo' } })),
        onReset: (id) => ws.send(JSON.stringify({ type: 'ACTION', payload: { storeId: id, action: 'reset' } })),
      });

      ws.addEventListener('message', (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'STATE_UPDATE') {
          // 1. Injeta os dados na UI
          devtools.updateState(data.payload);

          // 2. Força a abertura se ainda não estiver aberto
          const panel = document.querySelector('.bit-devtools-panel');
          if (!panel) {
            // Buscamos o botão pelo seletor que você criou no UI.ts
            const btn = document.querySelector('.bit-devtools-trigger');
            if (btn) btn.click();
            document.body.classList.add('has-panel');
          }
        }
      });
    };
  </script>
</body>
</html>`;
}
