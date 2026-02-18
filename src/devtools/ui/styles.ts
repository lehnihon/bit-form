export function getDevToolsCSS(): string {
  return `
    .bit-devtools-container {
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 9999;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
    }

    .bit-devtools-trigger {
      background: #10b981;
      color: #fff;
      border: none;
      border-radius: 50%;
      width: 48px;
      height: 48px;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
      font-weight: bold;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.2s;
      font-size: 16px;
      margin-top: 16px;
    }
    .bit-devtools-trigger:hover { transform: scale(1.05); }

    .bit-devtools-panel {
      width: 450px;
      max-height: 80vh;
      background: #0f172a;
      color: #f8fafc;
      border-radius: 8px;
      padding: 16px;
      overflow-y: auto;
      box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5), 0 8px 10px -6px rgba(0,0,0,0.5);
      border: 1px solid #334155;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .bit-devtools-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 12px;
      border-bottom: 1px solid #1e293b;
    }
    .bit-devtools-header h2 { margin: 0; font-size: 16px; display: flex; align-items: center; gap: 8px; }

    .bit-store-block {
      background: #1e293b;
      border-radius: 6px;
      padding: 12px;
      border: 1px solid #334155;
    }

    .bit-store-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }
    .bit-store-title { margin: 0; color: #38bdf8; font-size: 14px; font-weight: bold; }

    .bit-badge-group { display: flex; gap: 6px; flex-wrap: wrap; }
    .bit-badge { font-size: 10px; padding: 2px 6px; border-radius: 4px; text-transform: uppercase; font-weight: bold; }
    .badge-success { background: rgba(16, 185, 129, 0.2); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.2); }
    .badge-error { background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.2); }
    .badge-warn { background: rgba(245, 158, 11, 0.2); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.2); }
    .badge-info { background: rgba(56, 189, 248, 0.2); color: #7dd3fc; border: 1px solid rgba(56, 189, 248, 0.2); }

    .bit-section-title { font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; margin: 12px 0 4px 0; display: block; }

    .bit-controls { display: flex; gap: 6px; margin-bottom: 12px; background: #0f172a; padding: 8px; border-radius: 6px; }
    .bit-action-btn { flex: 1; background: #334155; color: #e2e8f0; border: 1px solid #475569; padding: 6px 0; border-radius: 4px; cursor: pointer; font-size: 11px; display: flex; align-items: center; justify-content: center; gap: 4px; transition: all 0.2s; }
    .bit-action-btn:hover:not(:disabled) { background: #475569; }
    .bit-action-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .bit-btn-reset { color: #fca5a5; border-color: rgba(239,68,68,0.3); }
    .bit-btn-reset:hover { background: rgba(239,68,68,0.1) !important; }

    pre.bit-pre { background: #020617; padding: 10px; border-radius: 4px; font-size: 11px; overflow-x: auto; border: 1px solid #1e293b; margin: 0; color: #e2e8f0; }
    pre.bit-error-box { background: rgba(239, 68, 68, 0.05); padding: 10px; border-radius: 4px; font-size: 11px; border: 1px dashed #ef4444; color: #fca5a5; margin: 0; overflow-x: auto; }
  `;
}
