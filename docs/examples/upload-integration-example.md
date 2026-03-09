# Complete Upload Integration Example (Backend-First)

This example demonstrates a complete form with backend-first file upload integration across React, Angular, and Vue.

## React Example

```typescript
import React from "react";
import { useBitForm, useBitField, createUploadValidator } from "bit-form";
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

  return { url: data.url, key: data.key };
};

export function UserProfileForm() {
  const form = useBitForm({
    fields: {
      profile: {
        name: { validation: { required: "Name is required" } },
        avatar: {
          validation: {
            asyncValidate: createUploadValidator(),
          },
        },
      },
    },
  });

  const name = useBitField("profile.name");
  const avatar = useBitUpload("profile.avatar", uploadAvatar, {
    deleteFile: async (key) => {
      await fetch("/api/uploads/avatar/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
    },
  });

  return (
    <form>
      <input value={name.value} onChange={(e) => name.setValue(e.target.value)} />
      <input type="file" onChange={(e) => avatar.handleUploadFile(e.target.files?.[0])} />
      {avatar.isUploading && <p>Uploading {avatar.uploadProgress.percentage}%</p>}
      {avatar.uploadError && <p>{avatar.uploadError}</p>}
    </form>
  );
}
```

## Angular Example

```typescript
import { Component } from "@angular/core";
import { injectBitForm, createUploadValidator } from "bit-form";
import { injectBitUpload } from "bit-form/angular";

@Component({
  selector: "app-user-profile",
  template: `
    <input type="file" (change)="upload($event)" [disabled]="avatar.isUploading()" />
    @if (avatar.isUploading()) {
      <p>Uploading {{ avatar.uploadProgress().percentage }}%</p>
    }
    @if (avatar.uploadError()) {
      <p>{{ avatar.uploadError() }}</p>
    }
  `,
})
export class UserProfileComponent {
  form = injectBitForm({
    fields: {
      profile: {
        avatar: {
          validation: { asyncValidate: createUploadValidator() },
        },
      },
    },
  });

  avatar = injectBitUpload("profile.avatar", async (file, context) => {
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
  });

  upload(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) this.avatar.handleUploadFile(file);
  }
}
```

## Vue Example

```typescript
<script setup lang="ts">
import { useBitForm, createUploadValidator } from "bit-form";
import { useBitUpload } from "bit-form/vue";

const form = useBitForm({
  fields: {
    profile: {
      avatar: {
        validation: {
          asyncValidate: createUploadValidator(),
        },
      },
    },
  },
});

const avatar = useBitUpload("profile.avatar", async (file, context) => {
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
});
</script>
```

## Why backend-first

- central security and validation policy
- simpler audit/compliance
- avoids provider-specific coupling in UI layer
- easier long-term maintenance
