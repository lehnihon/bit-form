# Draft Persistence

Bit-Form supports optional local draft persistence through `persist` config.

This is useful for:

- long forms where users may leave and come back later,
- flaky connections,
- mobile flows where accidental app close can happen.

---

## How it works

- Persistence is **opt-in** (`enabled: false` by default).
- Autosave runs only when `values` change (debounced).
- Restore is **manual** via `restorePersisted()` / `useBitPersist().restore()`.
- You can persist full `values` or only `dirtyValues`.

---

## Store Configuration

```ts
import { createBitStore } from "@lehnihon/bit-form";

const store = createBitStore({
  name: "checkout",
  initialValues: {
    email: "",
    document: "",
  },
  persist: {
    enabled: true,
    autoSave: true,
    debounceMs: 300,
    mode: "values", // or "dirtyValues"
  },
});
```

### Persist options

- `enabled?: boolean`
- `key?: string`
- `storage?: BitPersistStorageAdapter`
- `autoSave?: boolean`
- `debounceMs?: number`
- `mode?: "values" | "dirtyValues"`
- `serialize?: (payload: unknown) => string`
- `deserialize?: (raw: string) => Partial<T>`
- `onError?: (error: unknown) => void`

### Defaults

- `enabled: false`
- `autoSave: true`
- `debounceMs: 300`
- `mode: "values"`
- `serialize: JSON.stringify`
- `deserialize: JSON.parse`
- key:
  - `bit-form:${name}:draft` when `name` exists
  - `bit-form:draft` otherwise

When `storage` is not provided and `localStorage` is available, Bit-Form uses `localStorage` automatically.

---

## Public methods (store facade)

```ts
await store.forceSave();
const restored = await store.restorePersisted();
await store.clearPersisted();
```

- `forceSave()` saves immediately (ignores debounce)
- `restorePersisted()` returns `true` if there was saved data and restore was applied
- `clearPersisted()` removes stored draft data

---

## React / Vue / Angular / React Native

### React

```ts
const persist = useBitPersist();
await persist.save();
await persist.restore();
await persist.clear();
persist.meta.isSaving;
persist.meta.isRestoring;
persist.meta.error;
```

### Vue

```ts
const persist = useBitPersist();
await persist.save();
await persist.restore();
await persist.clear();
persist.meta.isSaving.value;
persist.meta.isRestoring.value;
persist.meta.error.value;
```

### Angular

```ts
const persist = injectBitPersist();
await persist.save();
await persist.restore();
await persist.clear();
persist.meta.isSaving();
persist.meta.isRestoring();
persist.meta.error();
```

### React Native

```ts
import { useBitPersist } from "@lehnihon/bit-form/react-native";
```

Same API as React; use a storage adapter compatible with AsyncStorage.

---

## Storage adapter example (AsyncStorage)

```ts
import AsyncStorage from "@react-native-async-storage/async-storage";

const store = createBitStore({
  initialValues: { email: "" },
  persist: {
    enabled: true,
    key: "my-form-draft",
    storage: {
      getItem: (key) => AsyncStorage.getItem(key),
      setItem: (key, value) => AsyncStorage.setItem(key, value),
      removeItem: (key) => AsyncStorage.removeItem(key),
    },
  },
});
```
