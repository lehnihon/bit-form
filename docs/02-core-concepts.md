# Core Concepts

To truly master Bit-Form, it is important to understand how it works under the hood. Unlike many form libraries that are deeply tied to a specific framework's reactivity system (like React state or Vue refs), Bit-Form relies on an agnostic core engine called the `BitStore`.

## 🧠 The `BitStore`

The `BitStore` is a plain TypeScript class that acts as the single source of truth for your form. It manages the state, validations, formatting, and dependencies completely independently of the UI layer.

When you use framework-specific wrappers like `useBitForm` (React/Vue) or `injectBitForm` (Angular), they are simply subscribing to the `BitStore` and triggering re-renders only when necessary. This architecture is what makes Bit-Form incredibly performant and cross-compatible.

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

## 🔄 The Form Lifecycle

Understanding the lifecycle of a field within the `BitStore` will help you predict how your form behaves.

### 1. Initialization

When you instantiate a `BitStore`, you provide the `initialValues`. The store applies any initial `computed` logic and creates the base snapshot of the state.

### 2. Registration

As your UI renders, fields are "registered" into the store (automatically handled by `useBitField` or similar hooks). This is when Bit-Form evaluates if a field should be hidden or required based on its `dependsOn` configuration.

### 3. Interaction (Update & Blur)

- **`setField(path, value)`**: When a user types, the store updates the value, recalculates computed fields, evaluates conditional dependencies (showing/hiding other fields), and triggers validations if configured.
- **`blurField(path)`**: When an input loses focus, the store marks it as `touched` in the state and usually triggers the validation step for that specific field.

### 4. Submission

When you call the `submit(onSuccess)` method, the `BitStore` performs a sequence of critical actions:

1. Cancels any pending asynchronous validations.
2. Sets `isSubmitting` to `true`.
3. Runs a full validation across all registered fields.
4. **Data Cleanup**: If the form is valid, it completely removes values belonging to fields that are currently _hidden_ (due to conditional logic).
5. **Data Transformation**: It applies any `transform` functions you defined in the config (e.g., converting a masked currency string like `"R$ 1.500,00"` into a float `1500.00`).
6. Finally, it executes your `onSuccess` callback with the clean, transformed payload.
7. Sets `isSubmitting` to `false`.

## 🧩 The Managers

To keep the `BitStore` clean and modular, its logic is divided into specialized managers:

- **Dependency Manager**: Evaluates `showIf` and `requiredIf` conditions.
- **Validation Manager**: Handles synchronous resolvers (Zod, Yup, Joi) and debounced asynchronous API validations.
- **History Manager**: Tracks state snapshots, enabling the Time-Travel (`undo` / `redo`) features.
- **Array Manager**: Exposes native methods to securely append, prepend, insert, remove, move, and swap items within array fields.
- **Computed Manager**: Reactively calculates derived field values on every state update.

---

With these concepts in mind, you are ready to tackle complex form scenarios. Next, check out how to integrate this core engine with your favorite framework in the **Framework Guides**.
