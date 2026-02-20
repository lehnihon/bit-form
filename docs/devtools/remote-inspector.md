# Remote Inspector CLI

Debugging forms on mobile devices (React Native) or complex remote environments can be painful. `console.log` often isn't enough to track down rapid state changes, validations, and conditional logic.

To solve this, Bit-Form ships with a powerful Remote Inspector powered by WebSockets.

## 1. Start the CLI Server

Bit-Form includes a CLI command that spins up a local WebSocket server and a beautiful web dashboard to monitor your forms in real-time.

Run the following command in your terminal:

```bash
npx bit-form devtools
```

By default, this will start the server on port `3000` and output a URL for you to open the dashboard in your browser (e.g., `http://localhost:3000`).

You can customize the port if needed:

```bash
npx bit-form devtools --port 3333
```

## 2. Connect Your Store

Once the CLI is running, you need to tell your `BitStore` to broadcast its state to the DevTools server.

Update your store configuration by enabling `remoteDevtools` and (optionally) providing the server URL:

```tsx
import { BitStore } from "bit-form";

const store = new BitStore({
  initialValues: { username: "", password: "" },
  enableRemoteDevTools: true,
  devTools: {
    mode: "remote",
    url: "http://localhost:3000",
  },
});
```

If you omit the url property, Bit-Form will automatically fallback to ws://localhost:3000

## 3. What You Can Do

Open the URL provided by the CLI in your browser. From the dashboard, you can:

- **Live State Tree**: View the exact current `values`, `errors`, and `touched` states of your form.
- **Action Logs**: See a timeline of events (e.g., `FIELD_UPDATE`, `BLUR`, `VALIDATION_START`, `SUBMIT`).
- **Time-Travel**: If `enableHistory` is active, you can trigger `undo` and `redo` directly from the web dashboard and watch your app UI update instantly.
- **Payload Preview**: See exactly what data will be sent to your API upon a successful submission, including stripped hidden fields.
