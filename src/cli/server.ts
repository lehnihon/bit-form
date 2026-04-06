import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { getDevToolsDashboardHtml } from "./devtools-dashboard";
import { attachDevToolsRelay } from "./devtools-relay";

export function startDevServer(port = 3000) {
  const server = http.createServer((req, res) => {
    const requestPath = req.url?.split("?")[0] ?? "";

    if (requestPath === "/" || requestPath === "/index.html") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(getDevToolsDashboardHtml(port));
      return;
    }

    if (requestPath.startsWith("/dist/")) {
      const distRoot = path.resolve(__dirname, "..", "..", "dist");
      const encodedRelativePath = requestPath.slice("/dist/".length);

      let relativePath: string;
      try {
        relativePath = decodeURIComponent(encodedRelativePath);
      } catch {
        res.writeHead(400);
        res.end("Bad Request");
        return;
      }

      const filePath = path.resolve(distRoot, relativePath);
      const relativeToRoot = path.relative(distRoot, filePath);

      if (relativeToRoot.startsWith("..") || path.isAbsolute(relativeToRoot)) {
        res.writeHead(403);
        res.end("Forbidden");
        return;
      }

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
