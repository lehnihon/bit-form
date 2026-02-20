# BitStore API

The `BitStore` is the core engine of Bit-Form. It is a framework-agnostic class responsible for managing state, validations, dependencies, and formatting.

## Constructor

```typescript
import { BitStore } from "bit-form";

const store = new BitStore(config);
```

### Parameters

- **`config`** (`BitConfig`): The configuration object for the store. See the [Types Reference](./types.md) for detailed properties like `initialValues`, `resolver`, and `enableHistory`.

## Properties

### `state`

Returns the current reactive state of the form.

- **Returns**: `BitState<T>`
- **Properties**:
  - `values`: The current form data.
  - `errors`: Record of validation errors by field path.
  - `touched`: Record of boolean values indicating if a field has been interacted with.
  - `isValid`: Boolean, true if `errors` is empty.
  - `isDirty`: Boolean, true if `values` deeply differ from `initialValues`.
  - `isSubmitting`: Boolean, true while the `submit` callback is executing.
  - `isValidating`: Record of boolean values indicating pending asynchronous validations.

## Methods

### State Management

#### `setField(path: string, value: any): void`

Updates a specific field's value. Triggers computed fields and dependency checks automatically.

#### `blurField(path: string): void`

Marks a field as touched and triggers its synchronous and asynchronous validation pipelines. Also captures a history snapshot if `enableHistory` is active.

#### `reset(): void`

Resets the form state entirely back to the `initialValues` provided during instantiation. Clears all errors and history stacks.

### Form Submission

#### `submit(onSuccess: (values: T) => void | Promise<void>)`

Creates a wrapper function that handles the form submission lifecycle.

- **Behavior**: Prevents default event behavior, runs full validation, strips hidden fields, applies transformations, and handles the `isSubmitting` state automatically.

### Configuration

#### `registerConfig(path: string, config: BitFieldConfig): void`

Dynamically registers or updates the configuration for a specific field path (e.g., adding masks, `showIf` logic, or `asyncValidate` functions after the store is created).

### Array Operations

Native methods to safely mutate array fields and automatically realign validation errors.

- `pushItem(path: string, value: any): void`
- `prependItem(path: string, value: any): void`
- `insertItem(path: string, index: number, value: any): void`
- `removeItem(path: string, index: number): void`
- `moveItem(path: string, fromIndex: number, toIndex: number): void`
- `swapItems(path: string, indexA: number, indexB: number): void`

### History (Time-Travel)

Available only if `enableHistory: true` is set in the constructor.

- `undo(): void`: Reverts to the previous state snapshot.
- `redo(): void`: Moves forward to the next state snapshot.
