# Complete Upload Integration Example

This example demonstrates a complete form with file upload integration across React, Angular, and Vue.

## React Example

```typescript
import React, { useState } from 'react';
import { useBitForm, useBitField, useBitUpload } from 'bit-form';
import { createS3Adapter, createUploadValidator } from 'bit-form';

const s3Adapter = createS3Adapter({
  region: 'us-east-1',
  bucket: 'my-app-uploads',
  presignedUrlEndpoint: 'https://api.example.com/s3-presigned',
  publicUrlBase: 'https://cdn.example.com',
});

export function UserProfileForm() {
  const form = useBitForm({
    fields: {
      profile: {
        name: { validation: { required: 'Name is required' } },
        email: { validation: { required: 'Email is required' } },
        avatar: {
          validation: {
            asyncValidate: createUploadValidator(),
          },
        },
        bio: {},
      },
    },
  });

  const nameField = useBitField(form, 'profile.name');
  const emailField = useBitField(form, 'profile.email');
  const {
    value: avatar,
    error: avatarError,
    isValidating: avatarValidating,
    isUploading: avatarUploading,
    uploadProgress: avatarProgress,
    uploadError: avatarUploadError,
    handleUploadFile: uploadAvatar,
    handleRemoveFile: removeAvatar,
  } = useBitUpload(form, 'profile.avatar', s3Adapter);

  const bioField = useBitField(form, 'profile.bio');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await form.submit();

    if (result.isValid) {
      console.log('Form data:', result.data);
      // Send to backend
      await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result.data),
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-medium">Name</label>
        <input
          type="text"
          value={nameField.value}
          onChange={(e) => nameField.setValue(e.target.value)}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded"
        />
        {nameField.error && (
          <p className="mt-1 text-sm text-red-600">{nameField.error}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium">Email</label>
        <input
          type="email"
          value={emailField.value}
          onChange={(e) => emailField.setValue(e.target.value)}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded"
        />
        {emailField.error && (
          <p className="mt-1 text-sm text-red-600">{emailField.error}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium">Avatar</label>
        <div className="mt-2">
          {avatar ? (
            <div className="space-y-3">
              <img
                src={avatar}
                alt="Avatar preview"
                className="h-32 w-32 object-cover rounded"
              />
              <button
                type="button"
                onClick={removeAvatar}
                disabled={avatarUploading || avatarValidating}
                className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
              >
                Remove
              </button>
            </div>
          ) : (
            <label className="block w-full px-4 py-8 border-2 border-dashed border-gray-300 rounded cursor-pointer hover:border-gray-400">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => uploadAvatar(e.target.files?.[0]!)}
                disabled={avatarUploading || avatarValidating}
                className="hidden"
              />
              <div className="text-center">
                <svg
                  className="mx-auto h-12 w-12 text-gray-400"
                  stroke="currentColor"
                  fill="none"
                  viewBox="0 0 48 48"
                >
                  <path
                    d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M12 28l-3.172-3.172a4 4 0 00-5.656 0L2 28"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <p className="mt-2 text-sm text-gray-600">
                  Click to upload or drag and drop
                </p>
              </div>
            </label>
          )}

          {avatarUploading && (
            <div className="mt-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium">Uploading...</span>
                <span className="text-sm text-gray-600">
                  {avatarProgress.percentage}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all"
                  style={{ width: `${avatarProgress.percentage}%` }}
                />
              </div>
            </div>
          )}

          {avatarUploadError && (
            <p className="mt-2 text-sm text-red-600">
              Upload failed: {avatarUploadError.message}
            </p>
          )}

          {avatarValidating && (
            <p className="mt-2 text-sm text-blue-600">Validating upload...</p>
          )}

          {avatarError && (
            <p className="mt-2 text-sm text-red-600">{avatarError}</p>
          )}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium">Bio</label>
        <textarea
          value={bioField.value}
          onChange={(e) => bioField.setValue(e.target.value)}
          rows={4}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded"
        />
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={form.isSubmitting || avatarValidating || avatarUploading}
          className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {form.isSubmitting ? 'Submitting...' : 'Save Profile'}
        </button>
        <button
          type="button"
          onClick={() => form.reset()}
          className="px-6 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400"
        >
          Reset
        </button>
      </div>
    </form>
  );
}
```

## Angular Example

```typescript
import { Component } from "@angular/core";
import {
  injectBitForm,
  injectBitField,
  injectBitUpload,
  createCloudinaryAdapter,
  createUploadValidator,
} from "bit-form";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";

@Component({
  selector: "app-user-profile",
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <form (ngSubmit)="handleSubmit()" class="space-y-6">
      <!-- Name Field -->
      <div>
        <label class="block text-sm font-medium">Name</label>
        <input
          type="text"
          [(ngModel)]="name.value()"
          (change)="name.setValue(name.value())"
          class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded"
        />
        @if (name.error()) {
          <p class="mt-1 text-sm text-red-600">{{ name.error() }}</p>
        }
      </div>

      <!-- Email Field -->
      <div>
        <label class="block text-sm font-medium">Email</label>
        <input
          type="email"
          [(ngModel)]="email.value()"
          (change)="email.setValue(email.value())"
          class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded"
        />
        @if (email.error()) {
          <p class="mt-1 text-sm text-red-600">{{ email.error() }}</p>
        }
      </div>

      <!-- Avatar Upload -->
      <div>
        <label class="block text-sm font-medium">Avatar</label>
        <div class="mt-2">
          @if (avatar.value()) {
            <div class="space-y-3">
              <img
                [src]="avatar.value()"
                alt="Avatar preview"
                class="h-32 w-32 object-cover rounded"
              />
              <button
                type="button"
                (click)="avatar.handleRemoveFile()"
                [disabled]="avatar.isUploading() || avatar.isValidating()"
                class="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
              >
                Remove
              </button>
            </div>
          } @else {
            <label
              class="block w-full px-4 py-8 border-2 border-dashed border-gray-300 rounded cursor-pointer hover:border-gray-400"
            >
              <input
                type="file"
                accept="image/*"
                (change)="handleFileSelect($event)"
                [disabled]="avatar.isUploading() || avatar.isValidating()"
                class="hidden"
              />
              <div class="text-center">
                <p class="mt-2 text-sm text-gray-600">
                  Click to upload or drag and drop
                </p>
              </div>
            </label>
          }

          @if (avatar.isUploading()) {
            <div class="mt-3">
              <div class="flex items-center justify-between mb-1">
                <span class="text-sm font-medium">Uploading...</span>
                <span class="text-sm text-gray-600">
                  {{ avatar.uploadProgress().percentage }}%
                </span>
              </div>
              <div class="w-full bg-gray-200 rounded-full h-2">
                <div
                  class="bg-blue-600 h-2 rounded-full transition-all"
                  [style.width.%]="avatar.uploadProgress().percentage"
                />
              </div>
            </div>
          }

          @if (avatar.uploadError()) {
            <p class="mt-2 text-sm text-red-600">
              Upload failed: {{ avatar.uploadError()?.message }}
            </p>
          }

          @if (avatar.isValidating()) {
            <p class="mt-2 text-sm text-blue-600">Validating upload...</p>
          }

          @if (avatar.error()) {
            <p class="mt-2 text-sm text-red-600">{{ avatar.error() }}</p>
          }
        </div>
      </div>

      <!-- Bio Field -->
      <div>
        <label class="block text-sm font-medium">Bio</label>
        <textarea
          [(ngModel)]="bio.value()"
          (change)="bio.setValue(bio.value())"
          rows="4"
          class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded"
        />
      </div>

      <!-- Actions -->
      <div class="flex gap-3">
        <button
          type="submit"
          [disabled]="
            form.isSubmitting() || avatar.isValidating() || avatar.isUploading()
          "
          class="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {{ form.isSubmitting() ? "Submitting..." : "Save Profile" }}
        </button>
        <button
          type="button"
          (click)="form.reset()"
          class="px-6 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400"
        >
          Reset
        </button>
      </div>
    </form>
  `,
})
export class UserProfileComponent {
  cloudinaryAdapter = createCloudinaryAdapter({
    cloudName: "my-cloud",
    uploadPreset: "profile-upload",
    folder: "avatars",
  });

  form = injectBitForm({
    fields: {
      profile: {
        name: { validation: { required: "Name is required" } },
        email: { validation: { required: "Email is required" } },
        avatar: {
          validation: {
            asyncValidate: createUploadValidator(),
          },
        },
        bio: {},
      },
    },
  });

  name = injectBitField(this.form, "profile.name");
  email = injectBitField(this.form, "profile.email");
  avatar = injectBitUpload(this.form, "profile.avatar", this.cloudinaryAdapter);
  bio = injectBitField(this.form, "profile.bio");

  handleFileSelect(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      this.avatar.handleUploadFile(file);
    }
  }

  async handleSubmit() {
    const result = await this.form.submit();

    if (result.isValid) {
      console.log("Form data:", result.data);
      // Send to backend
      await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result.data),
      });
    }
  }
}
```

## Vue Example

```vue
<script setup lang="ts">
import { computed } from "vue";
import { useBitForm, useBitField, useBitUpload } from "bit-form";
import { createS3Adapter, createUploadValidator } from "bit-form";

const s3Adapter = createS3Adapter({
  region: "us-east-1",
  bucket: "my-app-uploads",
  presignedUrlEndpoint: "https://api.example.com/s3-presigned",
  publicUrlBase: "https://cdn.example.com",
});

const form = useBitForm({
  fields: {
    profile: {
      name: { validation: { required: "Name is required" } },
      email: { validation: { required: "Email is required" } },
      avatar: {
        validation: {
          asyncValidate: createUploadValidator(),
        },
      },
      bio: {},
    },
  },
});

const nameField = useBitField(form, "profile.name");
const emailField = useBitField(form, "profile.email");
const {
  value: avatar,
  error: avatarError,
  isValidating: avatarValidating,
  isUploading: avatarUploading,
  uploadProgress: avatarProgress,
  uploadError: avatarUploadError,
  handleUploadFile: uploadAvatar,
  handleRemoveFile: removeAvatar,
} = useBitUpload(form, "profile.avatar", s3Adapter);

const bioField = useBitField(form, "profile.bio");

const isDisabled = computed(
  () =>
    form.isSubmitting.value || avatarValidating.value || avatarUploading.value,
);

const handleFileSelect = (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (file) {
    uploadAvatar(file);
  }
};

const handleSubmit = async (e: Event) => {
  e.preventDefault();
  const result = await form.submit();

  if (result.isValid) {
    console.log("Form data:", result.data);
    // Send to backend
    await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(result.data),
    });
  }
};
</script>

<template>
  <form @submit="handleSubmit" class="space-y-6">
    <!-- Name Field -->
    <div>
      <label class="block text-sm font-medium">Name</label>
      <input
        type="text"
        v-model="nameField.value"
        class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded"
      />
      <p v-if="nameField.error" class="mt-1 text-sm text-red-600">
        {{ nameField.error }}
      </p>
    </div>

    <!-- Email Field -->
    <div>
      <label class="block text-sm font-medium">Email</label>
      <input
        type="email"
        v-model="emailField.value"
        class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded"
      />
      <p v-if="emailField.error" class="mt-1 text-sm text-red-600">
        {{ emailField.error }}
      </p>
    </div>

    <!-- Avatar Upload -->
    <div>
      <label class="block text-sm font-medium">Avatar</label>
      <div class="mt-2">
        <div v-if="avatar">
          <div class="space-y-3">
            <img
              :src="avatar"
              alt="Avatar preview"
              class="h-32 w-32 object-cover rounded"
            />
            <button
              type="button"
              @click="removeAvatar"
              :disabled="isDisabled"
              class="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
            >
              Remove
            </button>
          </div>
        </div>
        <label
          v-else
          class="block w-full px-4 py-8 border-2 border-dashed border-gray-300 rounded cursor-pointer hover:border-gray-400"
        >
          <input
            type="file"
            accept="image/*"
            @change="handleFileSelect"
            :disabled="isDisabled"
            class="hidden"
          />
          <div class="text-center">
            <p class="mt-2 text-sm text-gray-600">
              Click to upload or drag and drop
            </p>
          </div>
        </label>

        <div v-if="avatarUploading" class="mt-3">
          <div class="flex items-center justify-between mb-1">
            <span class="text-sm font-medium">Uploading...</span>
            <span class="text-sm text-gray-600">
              {{ avatarProgress.percentage }}%
            </span>
          </div>
          <div class="w-full bg-gray-200 rounded-full h-2">
            <div
              class="bg-blue-600 h-2 rounded-full transition-all"
              :style="{ width: `${avatarProgress.percentage}%` }"
            />
          </div>
        </div>

        <p v-if="avatarUploadError" class="mt-2 text-sm text-red-600">
          Upload failed: {{ avatarUploadError.message }}
        </p>

        <p v-if="avatarValidating" class="mt-2 text-sm text-blue-600">
          Validating upload...
        </p>

        <p v-if="avatarError" class="mt-2 text-sm text-red-600">
          {{ avatarError }}
        </p>
      </div>
    </div>

    <!-- Bio Field -->
    <div>
      <label class="block text-sm font-medium">Bio</label>
      <textarea
        v-model="bioField.value"
        rows="4"
        class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded"
      />
    </div>

    <!-- Actions -->
    <div class="flex gap-3">
      <button
        type="submit"
        :disabled="isDisabled"
        class="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {{ form.isSubmitting ? "Submitting..." : "Save Profile" }}
      </button>
      <button
        type="button"
        @click="form.reset"
        class="px-6 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400"
      >
        Reset
      </button>
    </div>
  </form>
</template>
```

## Key Features Demonstrated

1. **File Upload Integration**: Each framework shows file selection and upload handling
2. **Progress Tracking**: Real-time progress bar with percentage display
3. **Error Handling**: Display upload errors and validation errors
4. **State Management**: Track uploading, validating, and error states
5. **Form Integration**: Submit is blocked while uploads are pending (via asyncValidate)
6. **File Removal**: Option to remove uploaded files with cleanup
7. **Validation**: Every framework properly validates and blocks submit when needed

## Testing the Examples

1. Update `presignedUrlEndpoint` or Cloudinary `cloudName` with your actual credentials
2. Ensure your backend generates presigned URLs for S3 uploads
3. Configure CORS on your storage provider
4. Test with various file sizes to validate progress tracking
5. Test network interruption to validate error handling
