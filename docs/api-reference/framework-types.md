# Framework-Specific Types

Bit-Form provides framework adapters for React, Vue, Angular, and React-Native. Each framework exposes hook/composable results with types specific to that framework's reactivity model.

All framework types are **publicly exported** via their respective sub-packages.

---

## React (`@lehnihon/bit-form/react`)

Location: `src/react/types.ts`

### `UseBitFieldMeta`

Metadata for a field in React (plain values).

```ts
interface UseBitFieldMeta {
  error: string | undefined;
  touched: boolean;
  invalid: boolean;
  isValidating: boolean;
  isDirty: boolean;
  isHidden: boolean;
  isRequired: boolean;
  hasError: boolean;
}
```

### `UseBitFieldBindProps`

Props helper for binding to native HTML inputs.

```ts
interface UseBitFieldBindProps {
  value: string;
  onChange: (e: any) => void;
  onBlur: () => void;
}
```

### `UseBitFieldResult<TForm, P>`

Return type of `useBitField()` hook.

```ts
interface UseBitFieldResult<
  TForm extends object = any,
  P extends BitPath<TForm> = BitPath<TForm>,
> {
  value: BitPathValue<TForm, P>;
  displayValue: string;
  setValue: (val: any) => void;
  setBlur: () => void;
  onChange: (e: any) => void;
  onBlur: () => void;
  props: UseBitFieldBindProps;
  meta: UseBitFieldMeta;
}
```

### `UseBitStepsResult`

Return type of `useBitSteps()` hook for multi-step form navigation.

```ts
interface UseBitStepsResult {
  step: number;
  stepIndex: number;
  scope: string;
  next: () => Promise<boolean>;
  prev: () => void;
  goTo: (step: number) => void;
  isFirst: boolean;
  isLast: boolean;
  status: ScopeStatus;
  errors: Record<string, string>;
  isValid: boolean;
  isDirty: boolean;
  validate: () => Promise<ValidateScopeResult>;
  getErrors: () => Record<string, string>;
}
```

### `UseBitUploadResult`

Return type of `useBitUpload()` hook for file uploads.

```ts
interface UseBitUploadResult {
  value: string | File | null;
  setValue: (value: string | File | null) => void;
  error?: string;
  isValidating: boolean;
  upload: (file: File | null | undefined) => Promise<void>;
  remove: () => Promise<void>;
}
```

### `UseBitHistoryResult`

Return type of `useBitHistory()` hook for undo/redo.

```ts
interface UseBitHistoryResult {
  canUndo: boolean;
  canRedo: boolean;
  historyIndex: number;
  historySize: number;
  undo: () => void;
  redo: () => void;
}
```

### `UseBitPersistResult`

Return type of `useBitPersist()` hook for draft persistence actions.

```ts
interface UseBitPersistResult {
  restore: () => Promise<boolean>;
  save: () => Promise<void>;
  clear: () => Promise<void>;
  meta: {
    isSaving: boolean;
    isRestoring: boolean;
    error: Error | null;
  };
}
```

---

## Vue 3 (`@lehnihon/bit-form/vue`)

Location: `src/vue/types.ts`

### `UseBitFieldVueMeta`

Metadata for a field in Vue (Vue Readonly references).

```ts
interface UseBitFieldVueMeta {
  error: Readonly<any>;
  touched: Readonly<any>;
  invalid: Readonly<any>;
  isValidating: Readonly<any>;
  isDirty: Readonly<any>;
  isHidden: Readonly<any>;
  isRequired: Readonly<any>;
  hasError: Readonly<any>;
}
```

### `UseBitFieldVueResult<TValue>`

Return type of `useBitField()` composable (Vue reactivity with ComputedRef).

```ts
interface UseBitFieldVueResult<TValue = any> {
  value: Readonly<any>;
  displayValue: Readonly<any>;
  modelValue: any;
  setValue: (val: any) => void;
  setBlur: () => void;
  onInput: (val: any) => void;
  onBlur: () => void;
  meta: UseBitFieldVueMeta;
}
```

### `UseBitStepsResult` (Vue)

Return type of `useBitSteps()` composable with Vue reactivity.

```ts
interface UseBitStepsResult {
  step: ComputedRef<number>;
  stepIndex: Ref<number>;
  scope: ComputedRef<string>;
  next: () => Promise<boolean>;
  prev: () => void;
  goTo: (step: number) => void;
  isFirst: ComputedRef<boolean>;
  isLast: ComputedRef<boolean>;
  status: Ref<ScopeStatus>;
  errors: ComputedRef<Record<string, string>>;
  isValid: ComputedRef<boolean>;
  isDirty: ComputedRef<boolean>;
  validate: () => Promise<ValidateScopeResult>;
  getErrors: () => Record<string, string>;
}
```

### `UseBitUploadResult` (Vue)

```ts
interface UseBitUploadResult {
  value: ComputedRef<string | File | null>;
  setValue: (value: string | File | null) => void;
  error: ComputedRef<string | undefined>;
  isValidating: ComputedRef<boolean>;
  upload: (file: File | null | undefined) => Promise<void>;
  remove: () => Promise<void>;
}
```

### `UseBitHistoryResult` (Vue)

```ts
interface UseBitHistoryResult {
  canUndo: Readonly<any>;
  canRedo: Readonly<any>;
  historyIndex: Readonly<any>;
  historySize: Readonly<any>;
  undo: () => void;
  redo: () => void;
}
```

### `UseBitPersistResult` (Vue)

```ts
interface UseBitPersistResult {
  restore: () => Promise<boolean>;
  save: () => Promise<void>;
  clear: () => Promise<void>;
  meta: {
    isSaving: Ref<boolean>;
    isRestoring: Ref<boolean>;
    error: Ref<Error | null>;
  };
}
```

---

## Angular (`@lehnihon/bit-form/angular`)

Location: `src/angular/types.ts`

### `InjectBitFieldMeta`

Metadata for a field in Angular (Signal getters).

```ts
interface InjectBitFieldMeta {
  error: () => string | undefined;
  touched: () => boolean;
  invalid: () => boolean;
  isDirty: () => boolean;
  isValidating: () => boolean;
  isHidden: () => boolean;
  isRequired: () => boolean;
  hasError: () => boolean;
}
```

### `InjectBitFieldResult<TForm, P>`

Return type of `injectBitField()` (Angular Signals).

```ts
interface InjectBitFieldResult<
  TForm extends object = any,
  P extends BitPath<TForm> = BitPath<TForm>,
> {
  value: () => BitPathValue<TForm, P>;
  displayValue: () => string;
  setValue: (val: any) => void;
  setBlur: () => void;
  update: (e: any) => void;
  meta: InjectBitFieldMeta;
}
```

### `InjectBitStepsResult`

Return type of `injectBitSteps()` (Angular Signals/Computed).

```ts
interface InjectBitStepsResult {
  step: ReturnType<typeof import("@angular/core").computed<number>>;
  stepIndex: ReturnType<typeof import("@angular/core").signal<number>>;
  scope: ReturnType<typeof import("@angular/core").computed<string>>;
  next: () => Promise<boolean>;
  prev: () => void;
  goTo: (step: number) => void;
  isFirst: ReturnType<typeof import("@angular/core").computed<boolean>>;
  isLast: ReturnType<typeof import("@angular/core").computed<boolean>>;
  status: ReturnType<typeof import("@angular/core").signal<ScopeStatus>>;
  errors: ReturnType<
    typeof import("@angular/core").computed<Record<string, string>>
  >;
  isValid: ReturnType<typeof import("@angular/core").computed<boolean>>;
  isDirty: ReturnType<typeof import("@angular/core").computed<boolean>>;
  validate: () => Promise<ValidateScopeResult>;
  getErrors: () => Record<string, string>;
}
```

### `InjectBitUploadResult`

```ts
interface InjectBitUploadResult {
  value: Signal<string | File | null>;
  setValue: (value: string | File | null) => void;
  error: Signal<string | undefined>;
  isValidating: Signal<boolean>;
  upload: (file: File | null | undefined) => Promise<void>;
  remove: () => Promise<void>;
}
```

### `InjectBitHistoryResult`

```ts
interface InjectBitHistoryResult {
  canUndo: ReturnType<typeof import("@angular/core").computed<boolean>>;
  canRedo: ReturnType<typeof import("@angular/core").computed<boolean>>;
  historyIndex: ReturnType<typeof import("@angular/core").computed<number>>;
  historySize: ReturnType<typeof import("@angular/core").computed<number>>;
  undo: () => void;
  redo: () => void;
}
```

### `InjectBitPersistResult`

```ts
interface InjectBitPersistResult {
  restore: () => Promise<boolean>;
  save: () => Promise<void>;
  clear: () => Promise<void>;
  meta: {
    isSaving: Signal<boolean>;
    isRestoring: Signal<boolean>;
    error: Signal<Error | null>;
  };
}
```

---

## React Native (`@lehnihon/bit-form/react-native`)

Location: `src/react-native/types.ts`

### `UseBitFieldNativeMeta`

Metadata for a field in React Native (plain values).

```ts
interface UseBitFieldNativeMeta {
  error: string | undefined;
  touched: boolean;
  invalid: boolean;
  isValidating: boolean;
  isDirty: boolean;
  isHidden: boolean;
  isRequired: boolean;
  hasError: boolean;
}
```

### `UseBitFieldNativeBindProps`

Props helper for binding to React Native input components.

```ts
interface UseBitFieldNativeBindProps {
  value: string;
  onChangeText: (value: string) => void;
  onBlur: () => void;
}
```

### `UseBitFieldNativeResult<TForm, P>`

Return type of `useBitField()` hook (React-Native field binding).

```ts
interface UseBitFieldNativeResult<
  TForm extends object = any,
  P extends BitPath<TForm> = BitPath<TForm>,
> {
  value: BitPathValue<TForm, P>;
  displayValue: string;
  setValue: (val: any) => void;
  setBlur: () => void;
  onChangeText: (text: string) => void;
  onBlur: () => void;
  meta: UseBitFieldNativeMeta;
  props: UseBitFieldNativeBindProps;
}
```

React Native also re-exports `useBitPersist` and `UseBitPersistResult` with the same contract as React.

---

## Type Organization Summary

| Category           | Location                           | Public? | Purpose                                                          |
| ------------------ | ---------------------------------- | ------- | ---------------------------------------------------------------- |
| Core domain types  | `src/core/store/types.ts`          | ✅      | Form state structure, configuration                              |
| Core public API    | `src/core/store/public-types.ts`   | ✅      | `BitStoreApi` (public facade) + `BitStoreHooksApi` (integration) |
| Core adapters      | `src/core/store/internal-types.ts` | ❌      | Internal: `BitStoreAdapter`, `BitValidationAdapter`              |
| Bus / global       | `src/core/store/bus-types.ts`      | ❌      | Internal: `BitFormGlobal`, `BitBus`                              |
| React hooks        | `src/react/types.ts`               | ✅      | Framework wrapper types                                          |
| Vue composables    | `src/vue/types.ts`                 | ✅      | Framework wrapper types                                          |
| Angular injectors  | `src/angular/types.ts`             | ✅      | Framework wrapper types                                          |
| React-Native hooks | `src/react-native/types.ts`        | ✅      | Framework wrapper types                                          |

**Key principle**: Framework types wrap the base contracts with framework-specific reactivity (Vue `ComputedRef`, Angular `Signal`, React plain values).
