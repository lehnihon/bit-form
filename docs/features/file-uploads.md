# File Uploads (Backend-First)

Bit-Form upload is backend-first and minimal.

- Use `useBitUpload` / `injectBitUpload`.
- Upload state is integrated with global field validation (`isValidating` + field `error`).
- No upload-specific UI state is required in the hook contract.

## Core contract

```typescript
type BitUploadFn = (
  file: File,
  context?: Record<string, any>,
) => Promise<{
  url: string;
  key: string;
  metadata?: Record<string, any>;
}>;
```

## React

```typescript
import { useBitUpload } from "bit-form/react";

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
import { useBitUpload } from "bit-form/vue";

const avatar = useBitUpload("profile.avatar", uploadAvatar);

await avatar.upload(file);
await avatar.remove();
```

## Angular

```typescript
import { injectBitUpload } from "bit-form/angular";

avatar = injectBitUpload("profile.avatar", uploadAvatar);

await this.avatar.upload(file);
await this.avatar.remove();
```

## About `createUploadValidator`

`createUploadValidator` is still available for custom/manual flows without upload hooks.
For regular framework usage, prefer `useBitUpload` / `injectBitUpload`.
