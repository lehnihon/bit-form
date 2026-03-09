# File Uploads Integration

Bit-Form upload integration is now backend-first by default.

In most production systems, file upload should be handled by your backend (validation, auth, compliance, transformations), and Bit-Form should only orchestrate field state + submit blocking.

## What matters in Bit-Form

- `asyncValidate` can block submit/next while upload is pending.
- `useBitUpload` / `injectBitUpload` unify field value + upload state.
- progress, error and loading flags are centralized in form flow.

## Core contract

```typescript
type BitUploadFn = (
  file: File,
  context?: {
    onProgress?: (progress: {
      loaded: number;
      total: number;
      percentage: number;
    }) => void;
    [key: string]: any;
  },
) => Promise<{
  url: string;
  key: string;
  metadata?: Record<string, any>;
}>;
```

## React (backend-first)

```typescript
import { useBitUpload } from "bit-form/react";

const uploadAvatar = async (file: File, context?: any) => {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("/api/uploads/avatar", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) throw new Error("Upload failed");

  const data = await response.json();

  context?.onProgress?.({ loaded: 100, total: 100, percentage: 100 });

  return {
    url: data.url,
    key: data.key,
  };
};

const avatar = useBitUpload("profile.avatar", uploadAvatar, {
  deleteFile: async (key) => {
    await fetch("/api/uploads/avatar/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key }),
    });
  },
  uploadOptions: { folder: "avatars" },
});
```

## Vue (backend-first)

```typescript
import { useBitUpload } from "bit-form/vue";

const uploadAvatar = async (file: File, context?: any) => {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("/api/uploads/avatar", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) throw new Error("Upload failed");

  const data = await response.json();
  context?.onProgress?.({ loaded: 100, total: 100, percentage: 100 });

  return { url: data.url, key: data.key };
};

const avatar = useBitUpload("profile.avatar", uploadAvatar);
```

## Angular (backend-first)

```typescript
import { injectBitUpload } from "bit-form/angular";

const uploadAvatar = async (file: File, context?: any) => {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("/api/uploads/avatar", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) throw new Error("Upload failed");

  const data = await response.json();
  context?.onProgress?.({ loaded: 100, total: 100, percentage: 100 });

  return { url: data.url, key: data.key };
};

const avatar = injectBitUpload("profile.avatar", uploadAvatar);
```

## Submit blocking with asyncValidate

```typescript
import { createUploadValidator } from "bit-form";

const form = useBitForm({
  fields: {
    profile: {
      avatar: {
        validation: {
          asyncValidate: createUploadValidator({
            requiredMessage: "Avatar é obrigatório",
          }),
        },
      },
    },
  },
});
```

## Notes on progress

Progress callback only updates when your upload function emits it via `context.onProgress`.

With plain `fetch`, native progress events are limited. If you need granular progress, use a transport that emits upload progress and call `context.onProgress` manually.

## Migration summary

- keep: `createUploadValidator`, `performUpload`, `useBitUpload`/`injectBitUpload`.
- removed: cloud adapters and cloud-specific helper docs.
- new default: backend-first upload functions.
