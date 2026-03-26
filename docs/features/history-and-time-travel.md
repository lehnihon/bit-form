# History & Time Travel

Ever wanted to give your users a `Ctrl+Z` (Undo) and `Ctrl+Y` (Redo) experience inside a complex form? Bit-Form includes a native History Manager that tracks incremental patches between states.

## Enabling History

By default, history tracking is disabled for maximum performance. You can enable it when instantiating the store:

```tsx
const store = createBitStore({
  initialValues: { documentText: "" },
  history: { enabled: true }, // Turns on the Time-Travel machine
});
```

## How it works

Bit-Form registra histórico por checkpoint transacional: quando há mutação de `values`, o runtime consolida as mudanças do batch/transaction atual em um único patch incremental. Isso reduz ruído no stack e melhora custo em fluxos com múltiplas mutações encadeadas. Você pode configurar o limite:

```tsx
const store = createBitStore({
  initialValues: { documentText: "" },
  history: { enabled: true, limit: 30 }, // Default limit is 50
});
```

## Using Undo / Redo

History is exposed through dedicated hooks:

- React: `useBitHistory()`
- Vue: `useBitHistory()`
- Angular: `injectBitHistory()`

```tsx
import { useBitHistory } from "@lehnihon/bit-form/react";

export function FormToolbar() {
  const history = useBitHistory();

  return (
    <div className="toolbar">
      <button onClick={history.undo} disabled={!history.canUndo}>
        ↺ Undo
      </button>
      <button onClick={history.redo} disabled={!history.canRedo}>
        ↻ Redo
      </button>
    </div>
  );
}
```

The history hook also exposes `historyIndex` and `historySize` for UI/toolbars.

When you trigger `undo()`, Bit-Form reconstructs the previous form values from the stored patches and automatically re-runs validation to ensure the UI stays consistent.

_Note: For debugging your history stack visually, check out the **DevTools** documentation!_
