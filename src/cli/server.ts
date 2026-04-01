import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { getDevToolsDashboardHtml } from "./devtools-dashboard";
import { attachDevToolsRelay } from "./devtools-relay";

export function startDevServer(port = 3000) {
  const server = http.createServer((req, res) => {
    if (req.url === "/" || req.url === "/index.html") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(getDevToolsDashboardHtml(port));
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
      } catch {
        res.writeHead(500);
        res.end("Internal Error");
      }
      return;
    }

    res.writeHead(404);
    res.end("Not Found");
  });

  attachDevToolsRelay(server);

  server.listen(port, () => {
    console.log(`🚀 BitForm DevServer rodando em http://localhost:${port}`);
  });
}
