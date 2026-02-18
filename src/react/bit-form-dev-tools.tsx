import React, { useEffect, useState } from "react";

const styles = {
  container: {
    position: "fixed",
    bottom: 20,
    right: 20,
    zIndex: 9999,
    fontFamily:
      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  },
  triggerBtn: {
    background: "#10b981",
    color: "#fff",
    border: "none",
    borderRadius: "50%",
    width: 48,
    height: 48,
    cursor: "pointer",
    boxShadow: "0 4px 12px rgba(16, 185, 129, 0.4)",
    fontWeight: "bold",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "transform 0.2s",
    fontSize: 16,
  },
  panel: {
    position: "absolute",
    bottom: 60,
    right: 0,
    width: 450,
    maxHeight: "80vh",
    background: "#0f172a",
    color: "#f8fafc",
    borderRadius: 8,
    padding: 16,
    overflowY: "auto",
    boxShadow:
      "0 20px 25px -5px rgba(0,0,0,0.5), 0 8px 10px -6px rgba(0,0,0,0.5)",
    border: "1px solid #334155",
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 12,
    borderBottom: "1px solid #1e293b",
  },
  storeBlock: {
    background: "#1e293b",
    borderRadius: 6,
    padding: 12,
    border: "1px solid #334155",
  },
  storeHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  title: { margin: 0, color: "#38bdf8", fontSize: 14, fontWeight: "bold" },

  // Badges e Status
  badgeGroup: { display: "flex", gap: 6, flexWrap: "wrap" },
  badge: {
    fontSize: 10,
    padding: "2px 6px",
    borderRadius: 4,
    textTransform: "uppercase",
    fontWeight: "bold",
  },
  badgeSuccess: {
    background: "rgba(16, 185, 129, 0.2)",
    color: "#34d399",
    border: "1px solid rgba(16, 185, 129, 0.2)",
  },
  badgeError: {
    background: "rgba(239, 68, 68, 0.2)",
    color: "#f87171",
    border: "1px solid rgba(239, 68, 68, 0.2)",
  },
  badgeWarn: {
    background: "rgba(245, 158, 11, 0.2)",
    color: "#fbbf24",
    border: "1px solid rgba(245, 158, 11, 0.2)",
  },
  badgeInfo: {
    background: "rgba(56, 189, 248, 0.2)",
    color: "#7dd3fc",
    border: "1px solid rgba(56, 189, 248, 0.2)",
  },

  // Controles (Time Travel)
  controls: {
    display: "flex",
    gap: 6,
    marginBottom: 12,
    background: "#0f172a",
    padding: 8,
    borderRadius: 6,
  },
  actionButton: {
    flex: 1,
    background: "#334155",
    color: "#e2e8f0",
    border: "1px solid #475569",
    padding: "6px 0",
    borderRadius: 4,
    cursor: "pointer",
    fontSize: 11,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    transition: "all 0.2s",
  },
  actionButtonDisabled: { opacity: 0.5, cursor: "not-allowed" },

  // Visualizadores de Código
  sectionTitle: {
    fontSize: 11,
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: 1,
    margin: "12px 0 4px 0",
    display: "block",
  },
  pre: {
    background: "#020617",
    padding: 10,
    borderRadius: 4,
    fontSize: 11,
    overflowX: "auto",
    border: "1px solid #1e293b",
    margin: 0,
  },
  errorBox: {
    background: "rgba(239, 68, 68, 0.05)",
    padding: 10,
    borderRadius: 4,
    fontSize: 11,
    border: "1px dashed #ef4444",
    color: "#fca5a5",
    margin: 0,
    overflowX: "auto",
  },
} as const;

// ==========================================
// 3. COMPONENTE DEVTOOLS
// ==========================================
export const BitFormDevTools = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [stores, setStores] = useState<Record<string, any>>({});

  useEffect(() => {
    const bitGlobal = globalThis.__BIT_FORM__;
    if (bitGlobal) {
      const initialStates: Record<string, any> = {};
      Object.entries(bitGlobal.stores).forEach(([id, store]) => {
        initialStates[id] = store.getState();
      });
      setStores(initialStates);

      const unsubscribe = bitGlobal.subscribe((storeId, newState) => {
        setStores((prev) => ({ ...prev, [storeId]: newState }));
      });
      return () => unsubscribe();
    }
  }, []);

  if (Object.keys(stores).length === 0) return null;

  return (
    <div style={styles.container}>
      {isOpen && (
        <div style={styles.panel}>
          <div style={styles.header}>
            <h2
              style={{
                margin: 0,
                fontSize: 16,
                color: "#f8fafc",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span style={{ fontSize: 20 }}>🛠</span> Bit-Form DevTools
            </h2>
            <span style={{ fontSize: 11, color: "#64748b" }}>v1.0.0</span>
          </div>

          {Object.entries(stores).map(([id, state]) => {
            const storeInstance = globalThis.__BIT_FORM__?.stores[id];
            const historyManager = storeInstance?.history;
            const historyArray = historyManager?.history || [];
            const currentIndex = historyManager?.historyIndex ?? -1;
            const currentStep = currentIndex + 1;
            const totalSteps = historyArray.length;

            const hasErrors = Object.keys(state.errors || {}).length > 0;

            return (
              <div key={id} style={styles.storeBlock}>
                <div style={styles.storeHeader}>
                  <h3 style={styles.title}>{id}</h3>
                  <div style={styles.badgeGroup}>
                    <span
                      style={{
                        ...styles.badge,
                        ...(state.isValid
                          ? styles.badgeSuccess
                          : styles.badgeError),
                      }}
                    >
                      {state.isValid ? "✓ Valid" : "✕ Invalid"}
                    </span>
                    {state.isDirty && (
                      <span style={{ ...styles.badge, ...styles.badgeWarn }}>
                        Dirty
                      </span>
                    )}
                    {state.isSubmitting && (
                      <span style={{ ...styles.badge, ...styles.badgeInfo }}>
                        ⏳ Submitting
                      </span>
                    )}
                  </div>
                </div>

                <span style={styles.sectionTitle}>
                  Time Travel ({currentStep}/{totalSteps})
                </span>

                {/* CONTROLES DE TIME TRAVEL */}
                <div style={styles.controls}>
                  <button
                    style={{
                      ...styles.actionButton,
                      ...(!storeInstance?.canUndo
                        ? styles.actionButtonDisabled
                        : {}),
                    }}
                    onClick={() => storeInstance?.undo()}
                    disabled={!storeInstance?.canUndo}
                  >
                    <span>↺</span> Undo
                  </button>
                  <button
                    style={{
                      ...styles.actionButton,
                      ...(!storeInstance?.canRedo
                        ? styles.actionButtonDisabled
                        : {}),
                    }}
                    onClick={() => storeInstance?.redo()}
                    disabled={!storeInstance?.canRedo}
                  >
                    <span>↻</span> Redo
                  </button>
                  <button
                    style={{
                      ...styles.actionButton,
                      color: "#fca5a5",
                      borderColor: "rgba(239,68,68,0.3)",
                    }}
                    onClick={() => storeInstance?.reset()}
                  >
                    <span>🗑</span> Reset
                  </button>
                </div>

                {/* PAINEL DE ERROS */}
                {hasErrors && (
                  <>
                    <span style={{ ...styles.sectionTitle, color: "#f87171" }}>
                      ⚠️ Validations Failing
                    </span>
                    <pre style={styles.errorBox}>
                      {JSON.stringify(state.errors, null, 2)}
                    </pre>
                  </>
                )}

                {/* PAINEL DE VALORES */}
                <span style={styles.sectionTitle}>Values</span>
                <pre style={styles.pre}>
                  {JSON.stringify(state.values, null, 2)}
                </pre>
              </div>
            );
          })}
        </div>
      )}

      {/* BOTÃO FLUTUANTE */}
      <button
        style={{
          ...styles.triggerBtn,
          transform: isOpen ? "scale(0.9)" : "scale(1)",
        }}
        onClick={() => setIsOpen(!isOpen)}
        title="Abrir DevTools"
      >
        {isOpen ? "✖" : "Bit"}
      </button>
    </div>
  );
};
