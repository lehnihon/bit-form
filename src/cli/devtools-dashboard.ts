export function getDevToolsDashboardHtml(port: number): string {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>🛠 Bit-Form Remote Inspector</title>
  <style>
    *, *::before, *::after {
      box-sizing: border-box;
    }

    html, body {
      background: #0f172a;
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      overflow-x: hidden;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }

    .status-container {
      position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
      text-align: center; color: #64748b; z-index: 1;
    }

    body.has-panel .bit-devtools-panel {
      display: flex !important;
      flex-direction: column !important;
      position: fixed !important;
      inset: 0 !important;
      width: 100% !important;
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

    body.has-panel .bit-store-block {
      border-bottom: 1px solid #1e293b !important;
      padding: 20px !important;
      width: 100%;
    }

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

    document.body.classList.add('connected');

    initDevTools({
      mode: "remote",
      url: "ws://localhost:${port}",
      container: document.body
    });

    const observer = new MutationObserver(() => {
      const panel = document.querySelector('.bit-devtools-panel');
      const btn = document.querySelector('.bit-devtools-trigger');

      if (btn && !panel) {
        btn.click();
        document.body.classList.add('has-panel');
        observer.disconnect();
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
  </script>
</body>
</html>`;
}
