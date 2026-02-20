# TypeScript Reference

Bit-Form is written in TypeScript and exports comprehensive types to ensure maximum type safety across your forms.

## `BitConfig<T>`

The primary configuration object passed when creating a new `BitStore`.

```typescript
interface BitConfig<T = Record<string, any>> {
  // Required
  initialValues: T;

  // Optional Validation
  resolver?: (
    values: T,
  ) => Record<string, string> | Promise<Record<string, string>>;
  validationDelay?: number; // Default: 0

  // Optional Global Settings
  enableHistory?: boolean; // Default: false
  historyLimit?: number; // Default: 15
  enableRemoteDevTools?: boolean; // Default: false
  devToolsUrl?: string;

  // Optional Computations & Field Configs
  computed?: Record<string, (values: T) => any>;
  fields?: Record<string, BitFieldConfig<T>>;
}
```

## `BitState<T>`

The object representing the exact current state of the store.

```typescript
interface BitState<T> {
  values: T;
  errors: Record<string, string>;
  touched: Record<string, boolean>;
  isValid: boolean;
  isDirty: boolean;
  isSubmitting: boolean;
  isValidating: Record<string, boolean>;
}
```

## `BitFieldConfig<T>`

The configuration object for individual fields, used in `registerConfig` or the `fields` property of `BitConfig`.

```typescript
interface BitFieldConfig<T> {
  // Formatting & Masks
  mask?: string | BitMaskPattern | ReturnType<typeof createCurrencyMask>;
  transform?: (value: any) => any; // Applied before submission

  // Dependencies & Conditional Logic
  dependsOn?: string[]; // Array of field paths to watch
  showIf?: (values: T) => boolean;
  requiredIf?: (values: T) => boolean;

  // Asynchronous Validation
  asyncValidate?: (value: any, allValues: T) => Promise<string | null>;
  asyncValidateDelay?: number; // Default: 300
}
```
