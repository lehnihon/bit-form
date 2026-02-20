# History & Time Travel

Ever wanted to give your users a `Ctrl+Z` (Undo) and `Ctrl+Y` (Redo) experience inside a complex form? Bit-Form includes a native History Manager that tracks snapshots of your state.

## Enabling History

By default, history tracking is disabled for maximum performance. You can enable it when instantiating the store:

```tsx
const store = new BitStore({
  initialValues: { documentText: "" },
  enableHistory: true, // Turns on the Time-Travel machine
});
```

## How it works

Every time a user finishes interacting with a field (specifically, when `blurField` is triggered), Bit-Form takes a deep clone snapshot of the current values and saves it to the history stack (up to a default limit of 15 steps).

## Using Undo / Redo

The store exposes properties and methods to interact with the history stack. These are also available in `useBitForm`.

```tsx
import { useBitForm } from "bit-form/react";

export function FormToolbar() {
  const { undo, redo, canUndo, canRedo } = useBitForm();

  return (
    <div className="toolbar">
      <button onClick={() => undo()} disabled={!canUndo}>
        ↺ Undo
      </button>
      <button onClick={() => redo()} disabled={!canRedo}>
        ↻ Redo
      </button>
    </div>
  );
}
```

When you trigger `undo()`, Bit-Form replaces the current form values with the previous snapshot and automatically re-runs validation to ensure the UI stays consistent.

_Note: For debugging your history stack visually, check out the **DevTools** documentation!_
