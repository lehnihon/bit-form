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

Bit-Form records history using incremental patches. In addition to transaction/batch consolidation, history snapshots are debounced by default to reduce noise during rapid typing.

- `history.debounceMs` defaults to `300`.
- Multiple value changes inside the debounce window are coalesced into one history snapshot.
- Multiple mutations inside the same `transaction()` are still consolidated into one snapshot.

You can configure both capacity and debounce behavior:

```tsx
const store = createBitStore({
  initialValues: { documentText: "" },
  history: {
    enabled: true,
    limit: 30, // default: 50
    debounceMs: 150, // default: 300
  },
});
```

Set `debounceMs: 0` to disable debounce and record snapshots immediately on each write.

## Safety Flush

To avoid losing the last pending snapshot, Bit-Form flushes pending history entries before timeline-sensitive operations.

Pending snapshots are flushed before:

- `undo()`
- `redo()`
- `reset()`
- `submit()`
- persisted value application
- store cleanup/destroy

Additionally, `blurField()` flushes pending history so typical field-edit flows commit a snapshot as the user leaves the field.

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
