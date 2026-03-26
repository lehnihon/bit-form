# Core Concepts

To truly master Bit-Form, it is important to understand how it works under the hood. Unlike many form libraries that are deeply tied to a specific framework's reactivity system (like React state or Vue refs), Bit-Form relies on an agnostic core engine called the `BitStore`.

## 🧠 The `BitStore`

The `BitStore` is a plain TypeScript class that acts as the single source of truth for your form. It manages the state, validations, formatting, and dependencies completely independently of the UI layer.

When you use framework-specific wrappers like `useBitForm` (React/Vue) or `injectBitForm` (Angular), they are simply subscribing to the `BitStore` and triggering re-renders only when necessary. This architecture is what makes Bit-Form incredibly performant and cross-compatible.

### V4 Runtime Architecture

In the current V4 runtime, `BitStore` is intentionally a thin facade over a dedicated runtime kernel and specialized modules:

- `subscription-engine`: handles `subscribe`, selector subscriptions and scoped path subscriptions with explicit paths.
- `state-update-engine`: normalizes state updates (`changedPaths`, `valuesChanged`, computed apply).
- `store-commit-engine`: centralizes operation routing + patch commit + batch flush semantics.
- `store-runtime-kernel`: owns effective state access, batching, commit flushing, effect notification and history snapshot persistence.
- `effect-engine`: centralizes side effects (persist, plugin lifecycle hooks, bus dispatch).
- `store-bootstrap`: builds capabilities and initial state during store construction. Capabilities are now composed as a plain object — no registry indirection.

This separation reduces coupling inside `BitStore`, keeps the public store facade smaller and makes behavior easier to test in isolated units.

### V5 Big-Bang (dev)

During the V5 development cycle, the core introduces two architectural shifts:

- **Dynamic baseline as single source of truth**: dirty tracking now always derives from runtime baseline state (the same source used by rebase/reset lifecycle). Array mutations no longer compare against static `config.initialValues`.
- **Framework adapter by capabilities/slices**: framework adapters are now assembled from `store.slices` capabilities (`read/observe/write/feature`) instead of a hardcoded method map.

`read` / `observe` / `write` / `feature` are now treated as the primary public contract. `store.slices` remains as a compatibility alias while migration is in progress.

This improves consistency after `rebase`, reduces adapter drift risk, and makes API evolution less error-prone.

Current internal folder layout in `src/core/store`:

- `contracts/`: shared type contracts (`types`, `public-types`, `bus-types`).
- `shared/`: cross-cutting runtime helpers (`config`, `pipeline`, `bus`).
- `engines/`: orchestration engines (`subscription`, `state-update`, `store-runtime-kernel`, `effect`).
- `managers/core/`: core domain managers (`computed`, `dirty`).
- `registry/`: field registry (`field-registry`) with dependency tracking + cached indexes.
- `managers/features/`: feature managers (`validation`, `lifecycle`, `history`, `array`, `scope`, `query`, `error`, `persist`, `plugin`).
- `orchestration/`: composition and capability wiring (`store-bootstrap`, `capabilities`, `capability-ports`, `create-store`). `capability-ports` exposes three focused factories (`createValidationPort`, `createLifecyclePort`, `createArrayPort`) instead of a single god-deps function.

Naming convention:

- Runtime classes keep semantic suffixes: `Manager`, `Engine`, `Registry`, `StorePort`.
- Internal instances use explicit names (for example `fieldRegistry`, `computedManager`, `dirtyManager`) instead of abbreviated suffixes.

## 🧱 Shared Controllers (Framework-Agnostic)

Bit-Form now centralizes shared UI orchestration into framework-agnostic controllers:

- `form-controller`: submit/onSubmit/reset orchestration and server error normalization.
- `field-controller`: field subscription and mask parse/format orchestration over `BitFieldBindingApi`.
- `bindings/form-meta`: normalized form meta snapshot/subscription reused by React, Vue and Angular.
- `bindings/array-controller`: stable array-key orchestration reused by React, Vue and Angular.
- `adapters/upload-kernel`: shared upload/remove side effects reused by React, Vue and Angular bindings.

Framework adapters (React/Vue/Angular) become thin bindings over these controllers, reducing duplicated behavior and drift across integrations.
`createFrameworkStoreAdapter()` now returns a real, memoized adapter object with the framework-safe surface, instead of exposing the raw store instance by cast.

## 🔒 Public vs Internal Boundaries

- `src/core/index.ts` is the public core entrypoint for runtime and adapter contracts.
- The core surface is also segmented by intent: `@lehnihon/bit-form/core/store`, `@lehnihon/bit-form/core/bindings`, `@lehnihon/bit-form/core/status`, `@lehnihon/bit-form/core/utils`.
- The package root (`@lehnihon/bit-form`) is now a curated application entrypoint and should not be treated as a mirror of the entire core surface.
- `BitStore` is intentionally internal and exposed to consumers through the `createBitStore()` facade.
- Devtools and framework bindings should prefer `BitStoreApi`, `BitFrameworkStoreApi` and stable core helpers exported by `@lehnihon/bit-form/core`, instead of importing concrete store internals.

This keeps the public API centered on `createBitStore()` while preserving an explicit core subpath for framework and integration code.

## 📊 Form State (`BitState`)

At any given moment, the `BitStore` holds a comprehensive state object. You can access these properties via the hooks/composables provided by your framework of choice.

Here are the key properties of the form state:

- **`values`**: An object containing the current values of all form fields.
- **`errors`**: A record of validation errors. If a field is valid, its key won't exist here.
- **`touched`**: A record keeping track of which fields the user has interacted with (usually updated on field blur).
- **`isValid`**: A boolean that returns `true` if the `errors` object is entirely empty.
- **`isDirty`**: A boolean that returns `true` if the current `values` deeply differ from the `initialValues` provided when the store was created.
- **`isSubmitting`**: A boolean indicating if the form is currently processing the `submit` callback.
- **`isValidating`**: A record indicating which specific fields are currently undergoing asynchronous validation.
- **`persist`**: Runtime persistence metadata (`isSaving`, `isRestoring`, `error`) used by persistence adapters.

## 🔄 The Form Lifecycle

Understanding the lifecycle of a field within the `BitStore` will help you predict how your form behaves.

### 1. Initialization

When you instantiate a `BitStore`, you provide the `initialValues`. The store validates computed dependency graphs eagerly, applies any initial `computed` logic and creates the base history baseline for the state.

### 2. Registration

As your UI renders, fields are "registered" into the store (automatically handled by `useBitField` or similar hooks). This is when Bit-Form evaluates if a field should be hidden or required based on its `dependsOn` configuration. Scope observers also react to fields dynamically entering or leaving a scope.

### 3. Interaction (Update & Blur)

- **`setField(path, value)`**: When a user types, the store updates the value, applies runtime `normalize` rules, recalculates computed fields, evaluates conditional dependencies (showing/hiding other fields, recalculating `requiredIf` dependents), and triggers validations if configured.
- **`blurField(path)`**: When an input loses focus, the store marks it as `touched` in the state and usually triggers the validation step for that specific field.

### 4. Submission

When you call the `submit(onSuccess)` method, the `BitStore` executes a staged pipeline:

1. `submit:start` → marks `isSubmitting` and validates.
2. `submit:invalid` → marks touched fields and exits early when invalid.
3. `submit:prepare` → strips hidden fields and applies `transform` to the outbound payload.
4. `submit:before-hooks` → runs plugin `beforeSubmit` hooks.
5. `submit:user-handler` → executes your callback.
6. `submit:after-hooks` → runs plugin `afterSubmit` hooks.
7. `finally` → always resets `isSubmitting`.

This explicit stage model makes behavior easier to reason about and safer to extend.

## 🧩 Managers and Engines

Bit-Form uses both specialized managers (domain behavior) and runtime engines (orchestration behavior):

- **Dependency Manager**: Evaluates `showIf` and `requiredIf` conditions.
- **Validation Manager**: Handles synchronous resolvers (Zod, Yup, Joi) and debounced asynchronous API validations.
- **History Manager**: Tracks incremental patches between states, enabling `undo` / `redo` with lower memory pressure.
- **Array Manager**: Exposes native methods to securely append, prepend, insert, remove, move, swap, replace and clear items within array fields.
- **Computed Manager**: Reactively calculates derived field values from explicit `computedDependsOn` declarations.
- **Normalization pipeline**: Post-batch normalization is now path-driven. Use `normalizeDependsOn` when a field normalizer depends on other paths.

`rebase` now resets the history baseline instead of appending another undo step over the previous baseline.

`subscription-engine` now uses path-prefix indexing for scoped subscriptions, reducing notification overhead in large forms.

Dedicated metadata subscriptions are also available for framework bindings and external observers:

- `subscribeFormMeta()` for `isValid`, `isDirty`, `isSubmitting`
- `subscribePersistMeta()` for persistence runtime metadata
- `subscribeHistoryMeta()` for undo/redo metadata
- `subscribeScopeStatus()` for per-scope status snapshots

---

With these concepts in mind, you are ready to tackle complex form scenarios. Next, check out how to integrate this core engine with your favorite framework in the **Framework Guides**.
