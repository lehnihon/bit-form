# History & Time Travel

Ever wanted to give your users a `Ctrl+Z` (Undo) and `Ctrl+Y` (Redo) experience inside a complex form? Bit-Form includes a native History Manager that tracks snapshots of your state.

## Enabling History

By default, history tracking is disabled for maximum performance. You can enable it when instantiating the store:

```tsx
const store = new BitStore({
  initialValues: { documentText: "" },
  history: { enabled: true }, // Turns on the Time-Travel machine
});
```

## How it works

Every time a user finishes interacting with a field (specifically, when `blurField` is triggered), Bit-Form takes a deep clone snapshot of the current values and saves it to the history stack. You can configure the limit:

```tsx
const store = new BitStore({
  initialValues: { documentText: "" },
  history: { enabled: true, limit: 30 }, // Default limit is 15
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

When you trigger `undo()`, Bit-Form replaces the current form values with the previous snapshot and automatically re-runs validation to ensure the UI stays consistent.

_Note: For debugging your history stack visually, check out the **DevTools** documentation!_
