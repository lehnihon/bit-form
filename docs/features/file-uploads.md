# File Uploads (Backend-First)

Bit-Form upload is backend-first and minimal.

- Use `useBitUpload` / `injectBitUpload`.
- Upload state is integrated with global field validation (`isValidating` + field `error`).
- No upload-specific UI state is required in the hook contract.

## Core contract

```typescript
interface BitUploadResult<
  TMetadata extends Record<string, unknown> = Record<string, unknown>,
> {
  url: string;
  key: string;
  metadata?: TMetadata;
}

type BitUploadFn<
  TMetadata extends Record<string, unknown> = Record<string, unknown>,
> = (file: File) => Promise<BitUploadResult<TMetadata>>;
```

## React

```typescript
import { useBitUpload } from "@lehnihon/bit-form/react";

const uploadAvatar = async (file: File) => {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("/api/uploads/avatar", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) throw new Error("Upload failed");

  const data = await response.json();
  return { url: data.url, key: data.key };
};

const avatar = useBitUpload("profile.avatar", uploadAvatar, async (key) => {
  await fetch("/api/uploads/avatar/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key }),
  });
});

await avatar.upload(file);
await avatar.remove();
```

## Vue

```typescript
import { useBitUpload } from "@lehnihon/bit-form/vue";

const avatar = useBitUpload("profile.avatar", uploadAvatar);

await avatar.upload(file);
await avatar.remove();
```

## Angular

```typescript
import { injectBitUpload } from "@lehnihon/bit-form/angular";

avatar = injectBitUpload("profile.avatar", uploadAvatar);

await this.avatar.upload(file);
await this.avatar.remove();
```

## Upload Strategies

### Upload on selection (recommended for media-heavy forms)

- Start upload immediately when user selects a file.
- Persist only resulting URL/key in form state.
- Keeps submit payload small and deterministic.

### Upload on submit

- Keep files in local component state.
- Upload inside submit handler.
- Useful when upload depends on final form context.

## Progress and Retry Pattern

The upload hook contract is intentionally minimal and transport-agnostic. For progress UI, manage progress in local component state around your uploader function.

```tsx
import { useState } from "react";
import { useBitUpload } from "@lehnihon/bit-form/react";

export function AvatarUploader() {
  const [progress, setProgress] = useState(0);

  const avatar = useBitUpload("profile.avatar", async (file) => {
    // Replace with your HTTP client and progress callback support.
    // This example simulates progress checkpoints.
    setProgress(10);
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/uploads/avatar", {
      method: "POST",
      body: formData,
    });
    setProgress(80);

    if (!response.ok) throw new Error("Upload failed");

    const data = await response.json();
    setProgress(100);

    return { url: data.url, key: data.key };
  });

  const uploadWithRetry = async (file: File) => {
    try {
      await avatar.upload(file);
    } catch {
      // One retry example. Replace with your retry policy.
      await avatar.upload(file);
    }
  };

  return (
    <div>
      <input
        type="file"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void uploadWithRetry(file);
        }}
      />
      <progress value={progress} max={100} />
      {avatar.error && <p>{avatar.error}</p>}
    </div>
  );
}
```

## Common Mistakes

| Wrong                                               | Correct                                                       | Why                                  |
| --------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------ |
| Keeping provider SDK logic inside UI component tree | Keep uploader function backend-first and isolated             | Improves testability and portability |
| Ignoring failed removals                            | Provide `deleteUpload` callback when backend requires cleanup | Avoids orphan files                  |
| Submitting raw `File` unexpectedly                  | Persist URL/key contract in state                             | Keeps API payload stable             |

## Related

- [Upload Integration Example](../examples/upload-integration-example.md)
- [Troubleshooting](../guides/troubleshooting.md)
