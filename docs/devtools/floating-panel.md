# Floating Panel (Local Mode)

A collapsible panel injected directly into your app. It appears as a floating button in the bottom-right corner and opens to show real-time form state. Ideal for web development (React, Vue, Angular).

## Usage

Enable it by setting `devTools: true` or `devTools: { mode: "local" }`:

```tsx
import { createBitStore } from "@lehnihon/bit-form";

const store = createBitStore({
  initialValues: { email: "", theme: "dark" },
  history: { enabled: true },
  devTools: process.env.NODE_ENV !== "production",
});
```

## Features

- **State inspector**: JSON tree of `values`, `errors`, and `touched`
- **Validation status**: Which fields fail validation and their messages
- **History controls**: Undo/Redo buttons when `history: { enabled: true }` is set

## Production Safety

DevTools use dynamic imports. When you conditionally enable them (e.g. `process.env.NODE_ENV !== "production"`), bundlers will tree-shake the code. The panel logic is **not** included in production builds.
