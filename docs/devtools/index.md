# DevTools

Bit-Form provides two ways to inspect and debug your form state in real time:

| Mode                                                    | Description                                                                                                                                   |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **[Floating Panel](./floating-panel.md)**               | A collapsible panel injected into your app. Best for web development.                                                                         |
| **[CLI & Remote Dashboard](./cli-remote-dashboard.md)** | Run `bit-form devtools` to start a WebSocket server and open a dashboard in the browser. Best for React Native or debugging multiple devices. |

## Configuration

Both modes use the `devTools` option in your `BitStore` config:

```tsx
const store = createBitStore({
  initialValues: { email: "" },
  devTools: true, // Floating panel (local)
  // or
  devTools: { mode: "remote" }, // CLI dashboard, default ws://localhost:3000
  devTools: { mode: "remote", url: "ws://localhost:3333" }, // Custom URL
});
```

- **`devTools: true`** → Enables the floating panel (local mode).
- **`devTools: { mode: "local" }`** → Same as above.
- **`devTools: { mode: "remote", url?: string }`** → Connects to the CLI server. Default URL: `ws://localhost:3000`.

For production, disable DevTools so they are tree-shaken from the bundle:

```tsx
devTools: process.env.NODE_ENV !== "production";
```
