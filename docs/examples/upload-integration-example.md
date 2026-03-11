# Complete Upload Integration Example (Backend-First)

This example demonstrates upload integration using the simplified hook API.

## React Example

```typescript
import React from "react";
import { useBitForm, useBitField } from "bit-form";
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

export function UserProfileForm() {
  const form = useBitForm({
    initialValues: {
      profile: { name: "", avatar: null },
    },
  });

  const name = useBitField("profile.name");
  const avatar = useBitUpload(
    "profile.avatar",
    uploadAvatar,
    async (key) => {
      await fetch("/api/uploads/avatar/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
    },
  );

  return (
    <form>
      <input value={name.value ?? ""} onChange={(e) => name.setValue(e.target.value)} />
      <input type="file" onChange={(e) => avatar.upload(e.target.files?.[0])} />
      {avatar.isValidating && <p>Uploading...</p>}
      {avatar.error && <p>{avatar.error}</p>}
    </form>
  );
}
```

## Angular Example

```typescript
import { Component } from "@angular/core";
import { injectBitForm } from "bit-form";
import { injectBitUpload } from "bit-form/angular";

@Component({
  selector: "app-user-profile",
  template: `
    <input
      type="file"
      (change)="onFileChange($event)"
      [disabled]="avatar.isValidating()"
    />
    @if (avatar.isValidating()) {
      <p>Uploading...</p>
    }
    @if (avatar.error()) {
      <p>{{ avatar.error() }}</p>
    }
  `,
})
export class UserProfileComponent {
  form = injectBitForm({
    initialValues: {
      profile: { avatar: null },
    },
  });

  avatar = injectBitUpload("profile.avatar", async (file) => {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/uploads/avatar", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) throw new Error("Upload failed");

    const data = await response.json();
    return { url: data.url, key: data.key };
  });

  async onFileChange(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    await this.avatar.upload(file);
  }
}
```

## Vue Example

```typescript
<script setup lang="ts">
import { useBitForm } from "bit-form";
import { useBitUpload } from "bit-form/vue";

const form = useBitForm({
  initialValues: {
    profile: { avatar: null },
  },
});

const avatar = useBitUpload("profile.avatar", async (file) => {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("/api/uploads/avatar", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) throw new Error("Upload failed");

  const data = await response.json();
  return { url: data.url, key: data.key };
});

const onFileChange = async (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  await avatar.upload(file);
};
</script>
```

## Why backend-first

- central security and validation policy
- simpler audit/compliance
- avoids provider-specific coupling in UI layer
- easier long-term maintenance
