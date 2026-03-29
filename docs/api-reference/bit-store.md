# BitStore API

`BitStore` is the core engine of Bit-Form. For direct consumer usage, the recommended entrypoint is `createBitStore`, which returns the official store instance consumed by React, Vue and Angular integrations.

For explicit runtime-only imports, Bit-Form also exposes the dedicated subpath `@lehnihon/bit-form/core`.
The package root remains the recommended application entrypoint, but it no longer mirrors every adapter/runtime helper from the core subpath.

All framework bindings (`useBitForm`, `injectBitForm`, etc.) are thin adapters on top of the internal store engine.

```ts
import { createBitStore } from "@lehnihon/bit-form";

const store = createBitStore<MyFormValues>({
  initialValues: {
    name: "",
    email: "",
  },
  validation: {
    resolver: async (values) => {
      const errors: Record<string, string | undefined> = {};
      if (!values.email) errors.email = "Email is required";
      return errors;
    },
  },
});
```

Direct `BitStore` instantiation is considered internal and is not the recommended consumer path.
For applications and framework integrations, use `createBitStore` and the official subpath exports.

Framework adapters should prefer the segmented adapter contracts from `@lehnihon/bit-form/core`, such as `BitFormMetaBindingApi`, `BitFieldBindingApi`, `BitArrayBindingApi` and `BitFrameworkStoreApi`.

> Dev note (V5+): `BitStoreApi` uses the namespaced surface (`read`, `observe`, `write`, `feature`) as the official public contract. Flat methods are no longer part of the supported public API.

- **Type parameter**: `T` — the shape of `values`. Defaults to `any` if omitted.
- **Parameter**: `config?: BitConfig<T>` — see [Types Reference](./types.md) for all options.

`BitConfig.plugins` allows lifecycle plugins for observability of validation/submit/field-change events. See [Lifecycle Plugins](../features/plugins.md).

---

## Core State & Accessors

### `read.getState(): BitState<T>`

Returns the current state snapshot.

```ts
const state = store.read.getState();
// state.values, state.errors, state.isValid, etc.
```

See [`BitState<T>` in the types reference](./types.md#bitstatet) for the full structure.

### `read.config: BitFrameworkConfig<T>`

Returns the resolved configuration, including normalized defaults and `initialValues`.

```ts
const config = store.read.config;
console.log(config.initialValues);
```

### Derived flags

These read-only getters mirror common flags from `BitState`:

- **`store.read.isValid: boolean`** — `true` when there are no validation errors.
- **`store.read.isSubmitting: boolean`** — `true` while a submission is in progress.
- **`store.read.isDirty: boolean`** — `true` if any field differs from `initialValues`.

They are equivalent to reading `read.getState().isValid`, `read.getState().isSubmitting`, and `read.getState().isDirty`.

---

## Subscriptions & Watching

### `observe.subscribe(listener: () => void): () => void`

Registers a listener that is called on every state update. Returns an unsubscribe function.

```ts
const unsubscribe = store.observe.subscribe(() => {
  const state = store.read.getState();
  console.log("Values changed:", state.values);
});

// Later
unsubscribe();
```

### `observe.subscribePath<P extends BitPath<T>>(path: P, callback: (value: BitPathValue<T, P>) => void): () => void`

Subscribes to changes for a specific field path. The callback is only called when the value at that path actually changes (deep comparison).

```ts
const stopWatching = store.observe.subscribePath(
  "user.address.city",
  (city) => {
    console.log("City changed:", city);
  },
);
```

Use this for side-effects like analytics, autosave, or cross-form coordination.

### `observe.subscribeFieldState<P extends BitPath<T>>(path: P, listener: (state: BitFieldState<T, BitPathValue<T, P>>) => void): () => void`

Subscribes to the full reactive snapshot of a single field (`value`, `error`, `touched`, `isHidden`, `isRequired`, `isDirty`, `isValidating`).

- Optimized for framework field bindings.
- Internally path-scoped and with structural equality to avoid unnecessary re-renders.
- Reacts to dependency-driven metadata changes too, including `showIf` and `requiredIf` transitions.

```ts
const unsubscribe = store.observe.subscribeFieldState("email", (field) => {
  console.log(field.value, field.error, field.isValidating);
});
```

### `observe.subscribeFormMeta(listener: (meta: { isValid: boolean; isDirty: boolean; isSubmitting: boolean }) => void): () => void`

Subscribes to form-level metadata updates only (`isValid`, `isDirty`, `isSubmitting`).

```ts
const unsubscribe = store.observe.subscribeFormMeta((meta) => {
  console.log(meta.isValid, meta.isDirty, meta.isSubmitting);
});
```

### `observe.subscribePersistMeta(listener: (meta: BitPersistMetadata) => void): () => void`

Subscribes only to persistence metadata updates (`isSaving`, `isRestoring`, `error`).

```ts
const unsubscribe = store.observe.subscribePersistMeta((meta) => {
  console.log(meta.isSaving, meta.isRestoring, meta.error);
});
```

### `observe.subscribeHistoryMeta(listener: (meta: BitHistoryMetadata) => void): () => void`

Subscribes to undo/redo metadata updates (`canUndo`, `canRedo`, `historyIndex`, `historySize`).

```ts
const unsubscribe = store.observe.subscribeHistoryMeta((meta) => {
  console.log(meta.canUndo, meta.canRedo, meta.historyIndex);
});
```

### `observe.subscribeScopeStatus(scopeName: string, listener: (status: ScopeStatus) => void): () => void`

Subscribes to the aggregated status of a configured scope/step.

- Scope subscriptions stay consistent even when fields are registered into or removed from the scope after the subscription starts.

```ts
const unsubscribe = store.observe.subscribeScopeStatus("shipping", (status) => {
  console.log(status.hasErrors, status.isDirty, status.errors);
});
```

> Note: `subscribeSelector` supports two explicit modes:
>
> - `mode: "scoped"` (default): requires `paths` and is optimized for performance.
> - `mode: "tracked"`: tracks accessed paths automatically.
>
> Example:
>
> ```ts
> store.observe.subscribeSelector((state) => state.values.user.name, listener, {
>   mode: "scoped",
>   paths: ["user.name"],
> });
>
> store.observe.subscribeSelector(
>   (state) =>
>     state.values.mode === "name" ? state.values.user.name : state.values.city,
>   listener,
>   { mode: "tracked" },
> );
> ```

---

## Draft Persistence

Bit-Form exposes manual draft persistence actions on the public store facade.

### `feature.forceSave(): Promise<void>`

Saves the current persist payload immediately.

```ts
await store.feature.forceSave();
```

### `feature.restorePersisted(): Promise<boolean>`

Attempts to read saved payload and apply it to current state.

- Returns `true` when a payload existed and was restored.
- Returns `false` when there is no payload, persist is disabled, or restore fails.
- Restored payloads are deep-merged with the current baseline, so partial nested drafts do not erase sibling keys.

```ts
const restored = await store.feature.restorePersisted();
if (restored) {
  console.log("Draft restored");
}
```

### `feature.clearPersisted(): Promise<void>`

Removes persisted payload from storage.

```ts
await store.feature.clearPersisted();
```

See [Draft Persistence feature guide](../features/persistence.md) for full configuration details.

### `read.getPersistMetadata(): BitPersistMetadata`

Returns the latest persistence metadata snapshot from core state.

```ts
const meta = store.read.getPersistMetadata();
console.log(meta.isSaving, meta.isRestoring, meta.error);
```

### `read.getDirtyValues(): Partial<T>`

Returns an object containing only the fields that have changed from their initial values.

- For nested objects, returns a partial structure maintaining the hierarchy.
- For arrays, returns the entire array if any element changed.
- Returns an empty object `{}` if no fields are dirty.

```ts
// Initial: { name: "Leo", age: 30, city: "Tokyo" }
store.write.setField("name", "Leandro");
store.write.setField("age", 31);

const dirty = store.read.getDirtyValues();
// { name: "Leandro", age: 31 }
```

Useful for PATCH requests that only send modified fields:

```ts
const dirtyValues = store.read.getDirtyValues();
if (Object.keys(dirtyValues).length > 0) {
  await api.patch(`/users/${id}`, dirtyValues);
}
```

---

## Field & Value Management

### `write.setField(path: string, value: any): void`

Updates a single field value by path.

- Applies computed fields.
- Evaluates dependencies (`showIf`, `requiredIf`).
- Triggers validation lifecycle (depending on your `resolver` & async validation configuration).

```ts
store.write.setField("email", "john@example.com");
```

### `write.setValues(values, options?): void`

Sets multiple values with three modes:

- Default (`setValues(nextValues)`): replace current values, keeping current baseline.
- Partial (`setValues(partial, { partial: true })`): deep-merge into current values.
- Rebase (`setValues(nextValues, { rebase: true })`): replace values, reset dirty baseline and restart history from the new baseline.

After `rebase`, all dirty calculations (including array operations like `pushItem`, `removeItem`, `swapItems`) are evaluated against the new runtime baseline.

```ts
store.write.setValues({ name: "John", email: "john@example.com" });

store.write.setValues(
  {
    profile: { city: "Osaka" },
  },
  { partial: true },
);

store.write.setValues(
  { name: "John", email: "john@example.com" },
  { rebase: true },
);
```

### `write.blurField(path: string): void`

Signals that a field has been blurred (lost focus).

- Marks the field as `touched`.
- Triggers validation for that field.

```ts
store.write.blurField("email");
```

### `write.reset(): void`

Resets the form to `initialValues` and clears errors, touched state and dirty flags (through the lifecycle manager).

```ts
store.write.reset();
```

---

## Validation & Errors

### `write.validate(options?: { scope?: string; scopeFields?: string[] }): Promise<boolean>`

Runs validation for the configured resolver and returns whether the form is valid.

- **`scope`**: name of a scope inferred from `fields[path].scope` (e.g. a wizard step).
- **`scopeFields`**: explicit list of field paths to validate.

```ts
const isValid = await store.write.validate();
const stepValid = await store.write.validate({ scope: "shipping" });
```

### `write.setError(path: string, message: string | undefined): void`

Manually sets (or clears) a single field error.

```ts
store.write.setError("email", "Email already taken");
store.write.setError("email", undefined); // clear
```

### `write.setErrors(errors: BitErrors<T>): void`

Merges a partial set of errors into the current error map.

```ts
store.write.setErrors({
  email: "Invalid email",
  name: "Name is required",
});
```

### `write.setServerErrors(serverErrors: Record<string, string | string[]>): void`

Helper for mapping server-side validation responses into the internal error structure.

- For array values, only the **first** message is used.
- Automatically marks the form as invalid.

```ts
store.write.setServerErrors({
  email: ["Email already taken"],
  "address.zip": "Invalid ZIP code",
});
```

### `read.isFieldValidating(path: string): boolean`

Returns `true` if the given field is currently running an asynchronous validation.

```ts
if (store.read.isFieldValidating("email")) {
  // show a loading indicator for the email field
}
```

---

## Dependencies & Visibility

These methods let you query the dependency manager directly.

### `read.isHidden(path: string): boolean`

Returns `true` if the field is currently hidden due to its `showIf` condition.

```ts
if (store.read.isHidden("company.name")) {
  // do not render that field
}
```

### `read.isRequired(path: string): boolean`

Returns `true` if the field is currently required due to `requiredIf` or other config.

```ts
const required = store.read.isRequired("company.taxId");
```

### Field configuration: `fields` vs `registerField`

There are two ways to configure field behavior (e.g. `showIf`, `requiredIf`, `asyncValidate`):

| Approach                      | When to use                                                                                                                         |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **`fields`** (in `BitConfig`) | Form structure is known at store creation. Register all fields upfront in one place.                                                |
| **`registerField`**           | Fields are dynamic (array items, lazy-loaded) or config comes from components. Used internally by `useBitField` / `injectBitField`. |

**Example with `fields` (declarative, at construction):**

```ts
const store = createBitStore({
  initialValues: { documentType: "CPF", documentNumber: "" },
  fields: {
    documentNumber: {
      conditional: {
        dependsOn: ["documentType"],
        showIf: (values) => values.documentType === "CNPJ",
        requiredIf: (values) => values.documentType === "CNPJ",
      },
    },
  },
});
```

**Example with `registerField` (imperative, at runtime):**

```ts
store.feature.registerField("company.taxId", {
  conditional: {
    dependsOn: ["company.country"],
    showIf: (values) => values.company?.country === "BR",
  },
});
```

### `feature.registerField(path: string, config: BitFieldDefinition<T>): void`

Registers or updates the configuration for a single field path after the store has been created. Ideal for dynamic fields or when passing config from a component.

```ts
store.feature.registerField("company.taxId", {
  conditional: {
    dependsOn: ["company.country"],
    showIf: (values) => values.company?.country === "BR",
  },
});
```

### `feature.unregisterField(path: string): void`

Unregisters a single field from the dependency manager and removes its `errors` and `touched` entries from the state.

```ts
store.feature.unregisterField("company.name");
```

---

## Arrays & Field Lists

Array operations delegate to the internal `BitArrayManager` and keep errors/touched state in sync.

All methods receive a **path to an array field** plus indices/values.

- `feature.pushItem(path: string, value: any): void`
- `feature.prependItem(path: string, value: any): void`
- `feature.insertItem(path: string, index: number, value: any): void`
- `feature.removeItem(path: string, index: number): void`
- `feature.swapItems(path: string, indexA: number, indexB: number): void`
- `feature.moveItem(path: string, fromIndex: number, toIndex: number): void`

```ts
store.feature.pushItem("items", { name: "", price: 0 });
store.feature.removeItem("items", 2);
store.feature.moveItem("items", 0, 1);
```

---

## History & Time‑Travel

History is enabled by setting `history: { enabled: true }` in the `BitConfig`. Snapshots are now transaction/batch-aware by default: value mutations in the same batch are consolidated into one history entry.

When using `transaction(...)`, history snapshots are batch-aware: multiple mutations inside the same transaction produce a single history entry.

### `feature.canUndo: boolean` / `feature.canRedo: boolean`

Flags indicating whether there is a previous or next snapshot to navigate to.

```ts
if (store.feature.canUndo) {
  store.feature.undo();
}
```

### `feature.undo(): void`

Restores the previous snapshot of `values` and re-runs validation.

### `feature.redo(): void`

Restores the next snapshot of `values` and re-runs validation.

```ts
store.feature.undo();
store.feature.redo();
```

---

## Framework Binding Contract

Framework adapters (React/Vue/Angular) are typed against `BitFrameworkStoreApi<T>`, a stable contract derived from the store API.

- It includes field/form subscriptions (`subscribeFieldState`, `subscribeFormMeta`, `subscribePath`, `subscribeSelector`).
- It includes field mutations and feature operations used by adapters (arrays/history/persist/scopes).
- `createBitStore()` returns an implementation compatible with this contract.

---

## Multi‑Step Flows & Scopes

### `read.getScopeStatus(scopeName: string): { hasErrors: boolean; isDirty: boolean; errors: Record<string, string> }`

Returns a summary of the state of a scope (typically a wizard step) based on fields mapped with `scope`.

```ts
const shippingStatus = store.read.getScopeStatus("shipping");

if (shippingStatus.hasErrors) {
  // show a badge on the step
}
```

### `read.isFieldDirty(path: string): boolean`

Checks whether a single field differs from its initial value.

```ts
if (store.read.isFieldDirty("address.zip")) {
  // enable a "Reset field" button
}
```

---

## Submission Lifecycle

### `write.submit(onSuccess: (values: T, dirtyValues?: Partial<T>) => void | Promise<void>): Promise<BitSubmitResult>`

Runs the full submission lifecycle through the internal `BitLifecycleManager`:

1. Cancels any pending validations.
2. Marks `isSubmitting` as `true`.
3. Runs full validation.
4. Strips values for hidden fields.
5. Applies any `transform` functions from the config.
6. Calls `onSuccess(cleanValues, dirtyValues)`.
7. Marks `isSubmitting` as `false`.

The callback receives two parameters:

- **`values`**: The full form values after transforms/hidden cleanup.
- **`dirtyValues`** (optional): A partial object containing only changed fields (calculated after transforms).

```ts
// Using dirtyValues for PATCH
const onSubmit = store.write.submit(async (values, dirtyValues) => {
  if (dirtyValues && Object.keys(dirtyValues).length > 0) {
    await api.patch(`/users/${id}`, dirtyValues);
  }
});

// Or ignore dirtyValues if not needed
const onSubmit = store.write.submit(async (values) => {
  await api.post("/users", values);
});
```

In frameworks, the `useBitForm` hook wraps this to automatically prevent the default submit event.

The returned result follows:

- `{"status":"submitted"}`
- `{"status":"invalid"}`
- `{"status":"failed","error": unknown}`
- `{"status":"blocked","reason":"isSubmitting"|"validating"}`

---

## Cleanup

### `feature.cleanup(): void`

Disposes the store completely:

- Clears all subscription listeners.
- Cancels any pending validations.
- Removes the store from the internal `bitBus` registry (used by DevTools).

Call this when a store is no longer needed (e.g. when unmounting a long-lived custom instance).

```ts
store.feature.cleanup();
```

---

## Capability Namespaces API

`store` expõe quatro **capability namespaces** de primeira classe. Use-os quando você quiser passar um handle restrito para um componente, serviço ou adapter, sem entregar o store completo.

```ts
const { read, observe, write, feature } = store;
```

| Namespace | Purpose                                                                                |
| --------- | -------------------------------------------------------------------------------------- |
| `read`    | Synchronous reads — `getState`, `getFieldState`, `isValid`, `getDirtyValues`, etc.     |
| `observe` | Reactive subscriptions — `subscribe`, `subscribeFieldState`, `subscribeSelector`, etc. |
| `write`   | Mutations — `setField`, `setValues`, `validate`, `submit`, `reset`, etc.               |
| `feature` | Advanced capabilities — array ops, history (`undo`/`redo`), persist, `cleanup`.        |

### `read`

Implements `BitStoreReadSliceApi<T>`. Includes all synchronous read operations and derived flags (`isValid`, `isSubmitting`, `isDirty`).

```ts
// Pass only read access to a analytics reporter
function trackErrors(read: BitStoreReadSliceApi<MyForm>) {
  return read.getScopeErrors("checkout");
}

trackErrors(store.read);
```

### `observe`

Implements `BitStoreObserveSliceApi<T>`. Includes all subscription methods and `getState` for snapshot reads inside listeners.

```ts
// Pass only observe access to a debug panel
function mountDebugPanel(observe: BitStoreObserveSliceApi<MyForm>) {
  return observe.subscribe(() => {
    console.log(observe.getState().values);
  });
}

mountDebugPanel(store.observe);
```

### `write`

Implements `BitStoreWriteSliceApi<T>`. Includes all mutation methods for field updates, validation, and form submission.

```ts
// Encapsulate write access in an action creator
function createFormActions(write: BitStoreWriteSliceApi<MyForm>) {
  return {
    setName: (name: string) => write.setField("name", name),
    submit: (handler: (v: MyForm) => Promise<void>) => write.submit(handler),
  };
}
```

### `feature`

Implements `BitStoreFeatureApi<T>`. Exposes array operations, history (`undo` / `redo`), persist helpers, field registration, and `cleanup`.

```ts
// Array operations
store.feature.pushItem("items", { id: uuid(), label: "" });
store.feature.undo();

// Lifecycle
store.feature.cleanup();
```

> **Tip:** TypeScript narrows the type of each namespace to its exact interface. Prefer passing namespaces over the full store when the consumer only needs a subset of capabilities.
