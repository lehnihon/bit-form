# Core Concepts

To truly master Bit-Form, it is important to understand how it works under the hood. Unlike many form libraries that are deeply tied to a specific framework's reactivity system (like React state or Vue refs), Bit-Form relies on an agnostic core engine called the `BitStore`.

## 🧠 The `BitStore`

The `BitStore` is a plain TypeScript class that acts as the single source of truth for your form. It manages the state, validations, formatting, and dependencies completely independently of the UI layer.

When you use framework-specific wrappers like `useBitForm` (React/Vue) or `injectBitForm` (Angular), they are simply subscribing to the `BitStore` and triggering re-renders only when necessary. This architecture is what makes Bit-Form incredibly performant and cross-compatible.

### V3 Runtime Architecture

In V3, `BitStore` acts mainly as an orchestrator/facade over specialized runtime modules:

- `subscription-engine`: handles `subscribe`, selector subscriptions, scoped path subscriptions and auto-tracked paths.
- `state-update-engine`: normalizes state updates (`changedPaths`, `valuesChanged`, computed apply).
- `effect-engine`: centralizes side effects (persist, plugin lifecycle hooks, bus dispatch).
- `store-bootstrap`: builds capabilities and initial state during store construction.
- `capability-registry`: resolves feature managers (`validation`, `lifecycle`, `history`, `arrays`, `scope`, `query`, `error`).

This separation reduces coupling inside `BitStore` and makes behavior easier to test in isolated units.

## 🧱 Shared Controllers (Framework-Agnostic)

Bit-Form now centralizes shared UI orchestration into framework-agnostic controllers:

- `form-controller`: submit/onSubmit/reset orchestration and server error normalization.
- `field-controller`: field subscription and mask parse/format orchestration.

Framework adapters (React/Vue/Angular) become thin bindings over these controllers, reducing duplicated behavior and drift across integrations.

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

When you call the `submit(onSuccess)` method, the `BitStore` executes a staged pipeline:

1. `submit:start` → marks `isSubmitting` and validates.
2. `submit:invalid` → marks touched fields and exits early when invalid.
3. `submit:prepare` → strips hidden fields and applies `transform`.
4. `submit:before-hooks` → runs plugin `beforeSubmit` hooks.
5. `submit:user-handler` → executes your callback.
6. `submit:after-hooks` → runs plugin `afterSubmit` hooks.
7. `finally` → always resets `isSubmitting`.

This explicit stage model makes behavior easier to reason about and safer to extend.

## 🧩 Managers and Engines

Bit-Form uses both specialized managers (domain behavior) and runtime engines (orchestration behavior):

- **Dependency Manager**: Evaluates `showIf` and `requiredIf` conditions.
- **Validation Manager**: Handles synchronous resolvers (Zod, Yup, Joi) and debounced asynchronous API validations.
- **History Manager**: Tracks state snapshots, enabling the Time-Travel (`undo` / `redo`) features.
- **Array Manager**: Exposes native methods to securely append, prepend, insert, remove, move, and swap items within array fields.
- **Computed Manager**: Reactively calculates derived field values on every state update.

---

With these concepts in mind, you are ready to tackle complex form scenarios. Next, check out how to integrate this core engine with your favorite framework in the **Framework Guides**.
