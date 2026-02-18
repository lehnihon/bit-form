import { getDevToolsCSS } from "./styles";

export interface DevToolsActions {
  onUndo: (storeId: string) => void;
  onRedo: (storeId: string) => void;
  onReset: (storeId: string) => void;
}

export class BitFormDevToolsUI {
  private container: HTMLElement;
  private actions: DevToolsActions;
  private rootElement: HTMLDivElement;
  private currentStoresState: Record<string, any> = {};

  // O seu state 'isOpen' do React
  private isOpen: boolean = false;

  constructor(container: HTMLElement, actions: DevToolsActions) {
    this.container = container;
    this.actions = actions;

    if (!document.getElementById("bit-devtools-styles")) {
      const style = document.createElement("style");
      style.id = "bit-devtools-styles";
      style.textContent = getDevToolsCSS();
      document.head.appendChild(style);
    }

    this.rootElement = document.createElement("div");
    this.rootElement.className = "bit-devtools-container";
    this.container.appendChild(this.rootElement);

    this.rootElement.addEventListener("click", (e) => {
      const target = e.target as HTMLElement;

      // Evento do botão flutuante
      if (target.closest(".bit-devtools-trigger")) {
        this.isOpen = !this.isOpen;
        this.render();
        return;
      }

      // Eventos dos botões de ação
      const btn = target.closest(".bit-action-btn");
      if (btn && !btn.hasAttribute("disabled")) {
        const action = btn.getAttribute("data-action");
        const storeId = btn.getAttribute("data-store");

        if (action && storeId) {
          if (action === "undo") this.actions.onUndo(storeId);
          if (action === "redo") this.actions.onRedo(storeId);
          if (action === "reset") this.actions.onReset(storeId);
        }
      }
    });
  }

  public updateState(storesState: Record<string, any>) {
    this.currentStoresState = storesState;
    this.render();
  }

  private render() {
    const storeEntries = Object.entries(this.currentStoresState);
    if (storeEntries.length === 0) {
      this.rootElement.innerHTML = "";
      return;
    }

    let panelHtml = "";

    if (this.isOpen) {
      panelHtml = `
        <div class="bit-devtools-panel">
          <div class="bit-devtools-header">
            <h2><span style="font-size: 20px;">🛠</span> Bit-Form DevTools</h2>
            <span style="font-size: 11px; color: #64748b;">v1.0.0</span>
          </div>
      `;

      for (const [id, state] of storeEntries) {
        const hasErrors = Object.keys(state.errors || {}).length > 0;

        // Lemos os metadados do histórico que o adaptador injetou
        const meta = state._meta || {
          totalSteps: 0,
          currentIndex: -1,
          canUndo: false,
          canRedo: false,
        };
        const currentStep = meta.currentIndex + 1;
        const totalSteps = meta.totalSteps;

        panelHtml += `
          <div class="bit-store-block">
            <div class="bit-store-header">
              <h3 class="bit-store-title">${id}</h3>
              <div class="bit-badge-group">
                <span class="bit-badge ${state.isValid ? "badge-success" : "badge-error"}">
                  ${state.isValid ? "✓ Valid" : "✕ Invalid"}
                </span>
                ${state.isDirty ? `<span class="bit-badge badge-warn">Dirty</span>` : ""}
                ${state.isSubmitting ? `<span class="bit-badge badge-info">⏳ Submitting</span>` : ""}
              </div>
            </div>

            <span class="bit-section-title">Time Travel (${currentStep}/${totalSteps})</span>
            
            <div class="bit-controls">
              <button class="bit-action-btn" data-action="undo" data-store="${id}" ${meta.canUndo ? "" : "disabled"}>
                <span>↺</span> Undo
              </button>
              <button class="bit-action-btn" data-action="redo" data-store="${id}" ${meta.canRedo ? "" : "disabled"}>
                <span>↻</span> Redo
              </button>
              <button class="bit-action-btn bit-btn-reset" data-action="reset" data-store="${id}">
                <span>🗑</span> Reset
              </button>
            </div>
        `;

        if (hasErrors) {
          panelHtml += `
            <span class="bit-section-title" style="color: #f87171;">⚠️ Validations Failing</span>
            <pre class="bit-error-box">${JSON.stringify(state.errors, null, 2)}</pre>
          `;
        }

        panelHtml += `
            <span class="bit-section-title">Values</span>
            <pre class="bit-pre">${JSON.stringify(state.values, null, 2)}</pre>
          </div>
        `;
      }

      panelHtml += `</div>`;
    }

    // Botão Flutuante (sempre renderizado)
    const triggerHtml = `
      <button class="bit-devtools-trigger" style="transform: ${this.isOpen ? "scale(0.9)" : "scale(1)"};" title="Abrir DevTools">
        ${this.isOpen ? "✖" : "Bit"}
      </button>
    `;

    this.rootElement.innerHTML = panelHtml + triggerHtml;
  }
}
