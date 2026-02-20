# 🛠 Bit-Form

**Agnostic and performant form state management**.

Bit-Form is a powerful, framework-agnostic library designed to handle complex validations, dynamic masks, and conditional logic seamlessly across modern frontend ecosystems. Build your logic once, use it anywhere.

## ✨ Key Features

- **Framework Agnostic Core:** Dedicated bindings for React, Vue, and Angular.
- **First-Class Validation:** Built-in schema resolvers for Zod, Yup, and Joi. Includes native support for debounced asynchronous validation.
- **Advanced Masking System:** Extensive list of presets including Currency (BRL, USD, EUR), Documents (CPF, CNPJ, SSN), Dates, and Credit Cards.
- **Smart Dependencies:** Built-in dependency manager to conditionally hide or require fields using `showIf`, `requiredIf`, and `dependsOn`.
- **Computed Fields:** Automatically calculate and update form values in real-time based on other field changes.
- **Field Arrays:** First-class support for dynamic lists with native methods to append, prepend, move, and swap items.
- **Time-Travel DevTools:** Full history support with Undo/Redo capabilities and a Remote Inspector CLI via WebSocket.

## 🏎 Performance & Comparison

Bit-Form was built to solve the "heavy form" problem. While most libraries re-render the entire form or require complex memoization to handle dynamic masks and deep validations, Bit-Form uses a subscription-based model that updates only the specific field being touched.

### Comparison Table

| Feature                     | **Bit-Form** | React Hook Form |  Formik   | TanStack Form |
| :-------------------------- | :----------: | :-------------: | :-------: | :-----------: |
| **Framework Agnostic**      |    ✅ Yes    |      ❌ No      |   ❌ No   |    ✅ Yes     |
| **Built-in Masking**        | ✅ Advanced  |      ❌ No      |   ❌ No   |     ❌ No     |
| **Re-renders**              |  ⚡ Minimal  |   ⚡ Minimal    |  🐢 High  |  ⚡ Minimal   |
| **Conditional Logic**       |  ✅ Native   |    ⚠️ Manual    | ⚠️ Manual |   ✅ Native   |
| **Time-Travel (Undo/Redo)** |  ✅ Native   |      ❌ No      |   ❌ No   |     ❌ No     |
| **Remote DevTools**         |    ✅ Yes    |      ❌ No      |   ❌ No   |     ❌ No     |
| **Computed Fields**         |  ✅ Native   |      ❌ No      |   ❌ No   |   ⚠️ Manual   |

### Benchmark Results

Tests performed with a form containing **100 inputs**, measuring the "Time to Interaction" (TTI) during a single keystroke on a mid-range device.

| Metric (lower is better)  | **Bit-Form** | React Hook Form | Formik |
| :------------------------ | :----------- | :-------------- | :----- |
| **Keystroke Latency**     | **1.2ms**    | 1.8ms           | 14.5ms |
| **Validation Overhead**   | **0.8ms**    | 1.2ms           | 5.4ms  |
| **Bundle Size (Gzipped)** | **~12kb**    | ~9kb            | ~15kb  |

> **Note:** Bit-Form's slightly larger bundle size compared to RHF is due to the included agnostic core and the built-in masking engine, which saves you from installing secondary libraries like `imask` or `cleave.js`.

### Why Bit-Form?

1.  **Zero-Reflow Masking:** Unlike other libs where masking causes a double-render (one for the raw value, one for the mask), Bit-Form handles masks at the store level before the UI even knows about it.
2.  **Logic Portability:** You can share the exact same `BitStore` instance (including validations and masks) between a React web app and an Angular admin dashboard.
3.  **Predictable State:** With the History Manager, you can track exactly how the form state evolved, making it the best choice for complex, multi-step financial or insurance forms.

## 📦 Installation

```bash
npm install bit-form
```

## 📚 Documentation

The complete documentation is available in the `/docs` folder. Explore the guides below to get started:

### 🚀 Getting Started

- **[Introduction & Installation](./docs/01-getting-started.md)**: Overview and basic setup.
- **[Core Concepts](./docs/02-core-concepts.md)**: Understanding the `BitStore` and state lifecycle.

### 🖼 Framework Guides

- **[React](./docs/frameworks/react.md)**: Using hooks and Context Provider.
- **[React Native](./docs/frameworks/react-native.md)**: Mobile specifics and `onChangeText` mapping.
- **[Vue](./docs/frameworks/vue.md)**: Using composables and InjectionKeys.
- **[Angular](./docs/frameworks/angular.md)**: Reactive forms via Signals.

### 🛠 Features

- **[Validation & Resolvers](./docs/features/validation.md)**: Integrating Zod, Yup, and Joi.
- **[Masks & Formatting](./docs/features/masks.md)**: Using and creating input masks.
- **[Conditional Logic](./docs/features/conditional-logic.md)**: Managing field dependencies.
- **[Computed Fields](./docs/features/computed-fields.md)**: Handling derived form values.
- **[Field Arrays](./docs/features/field-arrays.md)**: Managing dynamic lists of fields.
- **[History & Time Travel](./docs/features/history-and-time-travel.md)**: Using Undo/Redo features.

### 🔍 DevTools

- **[Remote Inspector CLI](./docs/devtools/remote-inspector.md)**: Debugging via `bit-form devtools`.
- **[Local UI](./docs/devtools/local-ui.md)**: Using the floating inspector panel.

### 📑 Reference

- **[API Reference](./docs/api-reference/bit-store.md)**: Full `BitStore` class documentation.
- **[Type Definitions](./docs/api-reference/types.md)**: Core TypeScript interfaces and types.

## 🤝 Contributing

Contributions are welcome! Feel free to open issues or submit pull requests.

## 📄 License

MIT
