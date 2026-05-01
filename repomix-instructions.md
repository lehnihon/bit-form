# AI Analysis Instructions for bit-form

## Key Interpretation Hints

- `BitStore` is the central reactive atom — all framework adapters subscribe to it
- Validation is async-first; `isValidating`, `isValid`, and field-level errors are separate concerns
- `BitField` has a state machine: `pristine → dirty → touched`
- Masks are applied at input normalization layer, before validation

## Test Structure (not covered in docs)

- `src/tests/core/` — unit tests for core logic
- `src/tests/frameworks/` — integration tests per framework adapter
- `src/tests/integration/` — cross-feature integration tests
- `quality/bench/` — performance benchmarks and RHF comparison
- `quality/release-gates/` — bundle size and observability gates

## Known Risk Areas

### Async Validation (`isValidating` stuck)

- `cancelFieldAsync()` in `validation-manager.ts` aborts the controller but never calls `updateFieldValidating(path, false)`
- Affected callers: `validate(scopeFields)`, `clear()`, `beginExternalValidation()`
- Race: if job is mid-execution when abort happens, the `finally` block skips cleanup because `controller.signal.aborted === true`
- Confirmed bug also in `async-validation-scheduler.ts`: `cancel()` does not call `setFieldValidating(false)`

### Async Validation Scheduler

- `abortControllers.delete(path)` in `runJob` finally runs without checking if the stored controller is still the current one — fix: guard with `if (map.get(path) === job.controller)`
- Same pattern in `validation-stages.ts` `clearAbortController(path)` finally

### Computed Fields (`computed-manager.ts`)

- `entry.compute(nextValues)` has no try/catch — exceptions propagate up to `dispatch`/`setValues`
- Downstream dependents of a failed computed run with stale input (fixed: `failedPaths` Set to skip dependents)

### History (`history-manager.ts`)

- `saveSnapshot` truncated redo stack before validating the patch — no-op after undo destroyed future history (fixed)
- `applyHistoryState` (undo/redo) did not cancel in-flight validations before applying snapshot — stale errors could surface (fixed)
- Debounce risk: initial snapshot can remain pending, leaving `historySize=0 / historyIndex=-1`; mitigation: `flushPendingHistorySnapshot()` after init

### Persistence

- `forceStorePersistedSave` / `clearStorePersisted` async ops must finalize in `finally` to avoid `isSaving` stuck or stale `persist.error`
- `getDefaultStorage` in `persist-manager.ts`: `localStorage` getter throws `SecurityError` in Safari Private (fixed: try/catch)
- `deepMerge` on restore of a persisted cyclic graph needs a visited-map guard to avoid infinite recursion

### Masks / Prefix Cleanup

- `unregisterPrefix` must not remove static entries from `config.fields` — array hook unmount can wipe wildcard masks
- Especially dangerous in React StrictMode (double mount/unmount); fix: filter static paths via `hasStaticConfigPath`
- Static prefix cleanup when field is cleared has edge cases with leftover characters

### Normalization Pipeline (`value-derivation-pipeline.ts`)

- All normalizers run over the same snapshot; a downstream normalizer with `normalizeDependsOn` may read a dependency that hasn't been normalized yet in the same round — writes stale value

### Submit (`submit-lifecycle-manager.ts`)

- `applyTransformDerivations` called without `onError`; transform exceptions are swallowed silently, submit continues as `submitted` with raw (untransformed) payload and `onUnhandledError` is never called

### Recursive Utilities (cyclic value safety)

- `cloneValue`, `collectDirtyPaths`, `createHistoryPatch` can throw or stack-overflow on cyclic structures
- `structuredClone` throws for non-cloneable values (e.g. functions) — needs fallback in `cloneValue`
- `setValues` with `{ partial: true }` and cyclic payload: `collectChangedUpdates` needs a visited-set guard
- Anti-cycle guards should track active recursion path, not a global `WeakSet` (shared references cause false positives)
