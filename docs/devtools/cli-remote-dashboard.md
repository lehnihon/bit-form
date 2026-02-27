# CLI & Remote Dashboard

For debugging forms on mobile (React Native) or multiple devices, Bit-Form provides a CLI that starts a WebSocket server and a web dashboard. Your app connects to it and streams state updates in real time.

## 1. Start the CLI

```bash
npx bit-form devtools
```

By default the server runs on port `3000`. Open the URL shown (e.g. `http://localhost:3000`) in your browser.

Custom port:

```bash
npx bit-form devtools --port 3333
# or
npx bit-form devtools -p 3333
```

## 2. Connect Your Store

Configure your `BitStore` to use remote mode:

```tsx
import { BitStore } from "bit-form";

const store = new BitStore({
  initialValues: { username: "", password: "" },
  devTools: { mode: "remote" },  // Uses ws://localhost:3000 by default
});

// Custom URL (e.g. if you changed the port):
const storeCustom = new BitStore({
  initialValues: { username: "" },
  devTools: { mode: "remote", url: "ws://localhost:3333" },
});
```

## 3. Dashboard Features

- **Live state tree**: `values`, `errors`, `touched`
- **Action timeline**: Field updates, blur, validation, submit
- **Time-travel**: Undo/Redo when `history: { enabled: true }` is set
- **Payload preview**: Data that would be sent on submit (including transforms, hidden fields stripped)
