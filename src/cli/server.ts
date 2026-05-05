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

      // Resolve symlinks to prevent traversal past the dist path containment
      let resolvedPath: string;
      try {
        resolvedPath = fs.realpathSync(filePath);
      } catch {
        // realpathSync fails if the file does not exist — that is a 404, not a traversal
        res.writeHead(404);
        res.end("Not Found");
        return;
      }

      if (path.relative(distRoot, resolvedPath).startsWith("..")) {
        res.writeHead(403);
        res.end("Forbidden");
        return;
      }

      try {
        const content = fs.readFileSync(resolvedPath);
        const ext = path.extname(resolvedPath);
        const mimeTypes: Record<string, string> = {
          ".js": "application/javascript",
          ".mjs": "application/javascript",
          ".css": "text/css",
          ".json": "application/json",
          ".map": "application/json",
          ".svg": "image/svg+xml",
          ".html": "text/html",
        };
        res.writeHead(200, {
          "Content-Type": mimeTypes[ext] || "text/plain",
        });
        res.end(content);
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
