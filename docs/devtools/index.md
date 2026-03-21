# DevTools

Bit-Form provides two ways to inspect and debug your form state in real time:

| Mode                                                    | Description                                                                                                                                   |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **[Floating Panel](./floating-panel.md)**               | A collapsible panel injected into your app. Best for web development.                                                                         |
| **[CLI & Remote Dashboard](./cli-remote-dashboard.md)** | Run `bit-form devtools` to start a WebSocket server and open a dashboard in the browser. Best for React Native or debugging multiple devices. |

## Configuration

Both modes now use the external `createDevToolsPlugin()` helper from the devtools package. The store keeps the `devTools` option as declarative config, but the runtime wiring is no longer auto-injected by core:

```tsx
import { createBitStore } from "@lehnihon/bit-form";
import { createDevToolsPlugin } from "@lehnihon/bit-form/devtools";

const store = createBitStore({
  initialValues: { email: "" },
  devTools: true, // Floating panel (local)
  plugins: [createDevToolsPlugin()],
});

const remoteStore = createBitStore({
  initialValues: { email: "" },
  devTools: { mode: "remote", url: "ws://localhost:3333" },
  plugins: [createDevToolsPlugin()],
});
```

- **`devTools: true`** → Enables the floating panel (local mode).
- **`devTools: { mode: "local" }`** → Same as above.
- **`devTools: { mode: "remote", url?: string }`** → Connects to the CLI server. Default URL: `ws://localhost:3000`.

For production, disable DevTools so they are tree-shaken from the bundle:

```tsx
devTools: process.env.NODE_ENV !== "production";
```

## Runtime behavior

- DevTools are initialized lazily (dynamic import) only when `createDevToolsPlugin()` is installed and `devTools` is enabled.
- They run as an external lifecycle plugin, keeping the core runtime free from direct DevTools imports.
- `store.cleanup()` always tears down devtools connections/panels.
