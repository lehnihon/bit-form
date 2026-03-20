<div align="center">
  <img src="logo.png" alt="Bit-Form" width="280" />
</div>

<p align="center">
  <i>Made with ❤️ by <a href="https://github.com/lehnihon">lehnihon</a> & contributors</i>
</p>

<p align="center">
  <a href="https://github.com/lehnihon/bit-form/actions/workflows/ci.yml">
    <img src="https://img.shields.io/github/actions/workflow/status/lehnihon/bit-form/ci.yml?branch=main&label=tests&style=flat-square" alt="tests" />
  </a>
  <a href="https://github.com/lehnihon/bit-form/actions/workflows/ci.yml">
    <img src="https://img.shields.io/github/actions/workflow/status/lehnihon/bit-form/ci.yml?branch=main&label=build&style=flat-square" alt="build" />
  </a>
  <a href="https://www.npmjs.com/package/@lehnihon/bit-form">
    <img src="https://img.shields.io/npm/v/@lehnihon/bit-form?style=flat-square" alt="npm version" />
  </a>
  <a href="https://www.npmjs.com/package/@lehnihon/bit-form">
    <img src="https://img.shields.io/npm/dm/@lehnihon/bit-form?style=flat-square" alt="npm downloads" />
  </a>
  <a href="https://github.com/lehnihon/bit-form/stargazers">
    <img src="https://img.shields.io/github/stars/lehnihon/bit-form?style=flat-square" alt="stars" />
  </a>
  <a href="https://github.com/lehnihon/bit-form/network/members">
    <img src="https://img.shields.io/github/forks/lehnihon/bit-form?style=flat-square" alt="forks" />
  </a>
  <a href="https://github.com/lehnihon/bit-form/issues">
    <img src="https://img.shields.io/github/issues/lehnihon/bit-form?style=flat-square" alt="issues" />
  </a>
  <a href="https://github.com/lehnihon/bit-form/blob/main/LICENSE">
    <img src="https://img.shields.io/npm/l/@lehnihon/bit-form?style=flat-square" alt="license" />
  </a>
  <img src="https://img.shields.io/badge/TypeScript-007ACC?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Vitest-6E9F18?style=flat-square&logo=vitest&logoColor=white" alt="Vitest" />
</p>

---

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
- **Draft Persistence:** Optional draft persistence with autosave, manual restore, manual clear, and custom storage adapters (Web `localStorage`, React Native `AsyncStorage`, or your own adapter).
- **Lifecycle Plugins:** Plugin system for lifecycle observability (`beforeValidate`, `afterValidate`, `beforeSubmit`, `afterSubmit`, `onFieldChange`, `onError`).
- **Time-Travel DevTools:** Full history support with Undo/Redo capabilities and a Remote Inspector CLI via WebSocket.

## 🏎 Performance & Comparison

Bit-Form was built to solve the "heavy form" problem. While most libraries re-render the entire form or require complex memoization to handle dynamic masks and deep validations, Bit-Form uses a subscription-based model that updates only the specific field being touched.

### Comparison Table

#### React Ecosystem

| Feature                     | **Bit-Form** | React Hook Form |  Formik   | TanStack Form |
| :-------------------------- | :----------: | :-------------: | :-------: | :-----------: |
| **Framework Agnostic**      |    ✅ Yes    |      ❌ No      |   ❌ No   |    ✅ Yes     |
| **Built-in Masking**        | ✅ Advanced  |      ❌ No      |   ❌ No   |     ❌ No     |
| **Re-renders**              |  ⚡ Minimal  |   ⚡ Minimal    |  🐢 High  |  ⚡ Minimal   |
| **Conditional Logic**       |  ✅ Native   |    ⚠️ Manual    | ⚠️ Manual |   ✅ Native   |
| **Time-Travel (Undo/Redo)** |  ✅ Native   |      ❌ No      |   ❌ No   |     ❌ No     |
| **Remote DevTools**         |    ✅ Yes    |      ❌ No      |   ❌ No   |     ❌ No     |
| **Computed Fields**         |  ✅ Native   |      ❌ No      |   ❌ No   |   ⚠️ Manual   |

#### Vue Ecosystem

| Feature                     | **Bit-Form** | VeeValidate |  FormKit   |
| :-------------------------- | :----------: | :---------: | :--------: |
| **Framework Agnostic**      |    ✅ Yes    |    ❌ No    |   ❌ No    |
| **Built-in Masking**        | ✅ Advanced  |    ❌ No    | ⚠️ Plugins |
| **Re-renders**              |  ⚡ Minimal  | ⚡ Minimal  | ⚡ Minimal |
| **Conditional Logic**       |  ✅ Native   |  ⚠️ Manual  | ✅ Native  |
| **Time-Travel (Undo/Redo)** |  ✅ Native   |    ❌ No    |   ❌ No    |
| **Remote DevTools**         |    ✅ Yes    |    ❌ No    |   ❌ No    |
| **Computed Fields**         |  ✅ Native   |    ❌ No    | ⚠️ Manual  |

#### Angular Ecosystem

| Feature                     | **Bit-Form** | Angular Reactive Forms | ngx-formly |
| :-------------------------- | :----------: | :--------------------: | :--------: |
| **Framework Agnostic**      |    ✅ Yes    |         ❌ No          |   ❌ No    |
| **Built-in Masking**        | ✅ Advanced  |         ❌ No          |   ❌ No    |
| **Re-renders**              |  ⚡ Minimal  |       ⚡ Minimal       | ⚡ Minimal |
| **Conditional Logic**       |  ✅ Native   |       ⚠️ Manual        | ✅ Native  |
| **Time-Travel (Undo/Redo)** |  ✅ Native   |         ❌ No          |   ❌ No    |
| **Remote DevTools**         |    ✅ Yes    |         ❌ No          |   ❌ No    |
| **Computed Fields**         |  ✅ Native   |       ⚠️ Manual        | ⚠️ Manual  |

### Benchmark Results

Below are **measured results** from the quality benchmarks currently in this repository. These numbers are not estimated or extrapolated.

- Source tests:
  - `quality/bench/rhf-compare.test.ts`
  - `quality/bench/perf.test.ts`
  - `quality/e2e/tests/benchmark-compare.spec.ts`
- Reproduce with:
  - `npm run test:bench:compare`
  - `npm run test:bench:compare:browser`
  - `npm run test:bench:compare:browser:prod`
  - `npm run test:bench`

#### React benchmark methodology

The comparison now uses a more realistic and stricter setup:

- same validation semantics across Bit-Form, React Hook Form, Formik, and TanStack Form
- validation is triggered once at the end of each measured cycle
- React commit stabilization before and after each sample
- larger load (`600` fields for bulk, `240` iterations for async burst)
- browser confirmation with Playwright in both dev and production preview modes

#### React benchmark (Bit-Form vs RHF/Formik/TanStack)

Snapshot measured on **20/03/2026**:

| Scenario (lower is better) | Bit-Form (median / p95) | RHF (median / p95) | Formik (median / p95) | TanStack (median / p95) |
| :------------------------- | :---------------------- | :----------------- | :-------------------- | :---------------------- |
| Bulk update (600 fields)   | **11.86ms / 120.45ms**  | 505.17ms / 563.37ms | 249.84ms / 720ms     | 1979.36ms / 2881.91ms   |
| Async burst (240 updates)  | 15.24ms / 17.74ms       | 68.35ms / 80.04ms   | 23.42ms / 27.53ms    | **13.77ms / 17.91ms**   |

Bit-Form ratio (`bit-form / competitor`) from the same snapshot:

- Bulk (median / p95):
  - vs RHF: **0.02 / 0.21**
  - vs Formik: **0.05 / 0.17**
  - vs TanStack: **0.01 / 0.04**
- Async burst (median / p95):
  - vs RHF: **0.22 / 0.22**
  - vs Formik: **0.65 / 0.64**
  - vs TanStack: **1.11 / 0.99**

In practice, this means:

- Bit-Form remains substantially faster than RHF and Formik in bulk-update workloads.
- In the async burst scenario, Bit-Form and TanStack Form are in the same performance band.
- The benchmark is intentionally conservative now, because it measures after React settles instead of stopping too early.

#### Internal performance baseline (Bit-Form)

Latest baseline from `quality/bench/perf.test.ts`:

- 300 field updates: ~20ms
- 1000 field updates in transaction + history: ~45ms
- 400 scoped subscribers: ~9ms
- Async validation burst: ~16ms
- Computed chain fanout (50): ~60ms
- Subscription notify fanout (200): ~15ms

> **Note:** benchmark values vary by machine, Node version, and CI load. Thresholds are calibrated from measured data with CI headroom and are validated in `quality/bench`.

### Why Bit-Form?

1.  **Store-Level Masking:** Bit-Form applies masks in the store layer, which helps keep UI updates localized and predictable in complex forms.
2.  **Logic Portability:** You can share the same `BitStore` logic (validation, masks, conditional rules, history) across React, Vue, Angular, and React Native bindings.
3.  **Predictable State:** With history, scoped subscriptions, and explicit lifecycle hooks, Bit-Form is a strong fit for multi-step and high-complexity forms where debuggability matters as much as raw speed.

## 📦 Installation

```bash
npm install @lehnihon/bit-form
```

## 📚 Documentation

The complete documentation is available in the `/docs` folder. Explore the guides below to get started:

### 🚀 Getting Started

- **[Introduction & Installation](./docs/01-getting-started.md)**: Overview and basic setup.
- **[Core Concepts](./docs/02-core-concepts.md)**: Understanding the `BitStore` and state lifecycle.

### 🖼 Framework Guides

- **[React](./docs/frameworks/react.md)**: Using hooks and Context Provider.
- **[Next.js](./docs/frameworks/next.md)**: Using Bit-Form in App Router/Pages Router with client boundaries (`"use client"`).
- **[React + shadcn/ui](./docs/frameworks/react-shadcn.md)**: Generate form wrappers with `bit-form add shadcn` (Input, Textarea, Select, Checkbox, Switch, RadioGroup).
- **[React Native](./docs/frameworks/react-native.md)**: Mobile specifics and `onChangeText` mapping.
- **[Vue](./docs/frameworks/vue.md)**: Using composables and InjectionKeys.
- **[Angular](./docs/frameworks/angular.md)**: Reactive forms via Signals.

### 🛠 Features

- **[Validation & Resolvers](./docs/features/validation.md)**: Integrating Zod, Yup, and Joi.
- **[Masks & Formatting](./docs/features/masks.md)**: Using and creating input masks.
- **[Conditional Logic](./docs/features/conditional-logic.md)**: Managing field dependencies.
- **[Computed Fields](./docs/features/computed-fields.md)**: Handling derived form values.
- **[Field Arrays](./docs/features/field-arrays.md)**: Managing dynamic lists of fields.
- **[Draft Persistence](./docs/features/persistence.md)**: Save, restore, and clear local drafts with `useBitPersist`/`injectBitPersist` and store-level `persist` config.
- **[Lifecycle Plugins](./docs/features/plugins.md)**: Add plugins to observe validation/submit/field-change events with fail-open behavior.
- **[File Uploads](./docs/features/file-uploads.md)**: Backend-first upload integration with `useBitUpload` and `injectBitUpload`.
- **[Scopes](./docs/features/scopes.md)**: Per-step validation and status for wizard forms (`useBitScope`, `injectBitScope`).
- **[History & Time Travel](./docs/features/history-and-time-travel.md)**: Using Undo/Redo features.

### 📖 Guides & Examples

- **[When to Use What](./docs/guides/when-to-use-what.md)**: Quick reference for resolver vs asyncValidate vs setServerErrors, computed vs transform, and conditional fields.
- **[Complete Form Example](./docs/examples/complete-form-example.md)**: End-to-end example with masks, asyncValidate, conditional logic, scopes, history, and DevTools.
- **[Upload Integration Example](./docs/examples/upload-integration-example.md)**: Backend-first upload example using `useBitUpload`/`injectBitUpload`.
- **[Server Errors](./docs/examples/server-errors.md)**: Client validation (resolver/asyncValidate) vs API 422 handling (setServerErrors, onSubmit).

### 🔍 DevTools & CLI

- **[DevTools Overview](./docs/devtools/index.md)**: Configuration (`devTools: true` or `{ mode: "remote" }`).
- **[Floating Panel](./docs/devtools/floating-panel.md)**: In-app inspector (local mode).
- **[CLI & Remote Dashboard](./docs/devtools/cli-remote-dashboard.md)**: `bit-form devtools` + WebSocket for React Native / remote debugging.
- **CLI `add`**: Generate Bit-Form + shadcn/ui wrappers with `bit-form add shadcn [input|textarea|select|checkbox|switch|radio-group]` — see [React + shadcn](./docs/frameworks/react-shadcn.md).

### 📑 Reference

- **[API Reference](./docs/api-reference/bit-store.md)**: Full `BitStore` class documentation.
- **[Type Definitions](./docs/api-reference/types.md)**: Core TypeScript interfaces and types.

## ⚠️ Breaking Changes (dev branch)

This branch currently allows breaking changes while architecture/performance work is in progress.

- **History default limit changed** from `15` to `50` (`history.limit`).
- **Selector subscriptions no longer rely on deep value diff inference** when no `paths` are provided internally; updates are now path-driven for predictable performance.
- **New `subscribeTracked`** was added to auto-track selector dependencies and re-track when selector branches change.
- **`resolveBitStoreForHooks` now uses symbol branding** instead of duck-typing checks.
- **SSR/Edge support improved** with injectable bus instances (`createBitBus`, `config.bus`, `initDevTools({ bus })`).

### Migration quick notes

- If you relied on implicit broad selector notifications, prefer explicit `paths` or use `subscribeTracked`.
- If you need old history density, set `history: { limit: 15 }` explicitly.
- In SSR/Edge runtimes, create one bus per request scope and inject it into the store and DevTools.

## 🤝 Contributing

Contributions are welcome! Feel free to open issues or submit pull requests.

## 📄 License

MIT
