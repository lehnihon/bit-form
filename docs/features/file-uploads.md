# File Uploads Integration

Bit-Form provides a comprehensive file upload integration system that seamlessly integrates with the validation engine. This guide shows you how to implement file uploads to various cloud storage providers.

## Key Concepts

### Upload Adapters

Adapters are factory functions that implement the `BitUploadAdapter` interface:

```typescript
interface BitUploadAdapter {
  upload(file: File, options?: BitUploadOptions): Promise<BitUploadResult>;
  delete?(key: string): Promise<void>;
}
```

Each adapter handles the communication with a specific storage provider (AWS S3, Cloudinary, Azure Blob Storage, etc.).

### AsyncValidate Integration

File uploads integrate with the `asyncValidate` feature to ensure uploads complete before form submission. This provides:

- **Automatic blocking**: Submit/next steps are blocked while uploads are pending
- **User feedback**: Display upload progress and status
- **Error handling**: Handle upload failures gracefully
- **Optional deletion**: Remove uploaded files if the user cancels the form

## Available Adapters

### AWS S3 Adapter

Upload files to AWS S3 using presigned URLs:

```typescript
import { createS3Adapter } from "bit-form";

const s3Adapter = createS3Adapter({
  region: "us-east-1",
  bucket: "my-bucket",
  presignedUrlEndpoint: "https://api.example.com/s3-presigned",
  publicUrlBase: "https://cdn.example.com",
});
```

**Configuration:**

- `region`: AWS region
- `bucket`: S3 bucket name
- `presignedUrlEndpoint`: Your backend endpoint that returns presigned URLs
- `publicUrlBase`: Base URL for public access to uploaded files (optional)

**How it works:**

1. Frontend requests presigned URL from your backend
2. Backend generates presigned URL using AWS SDK
3. Frontend uploads file directly to S3 using presigned URL
4. Retrieved URL is stored in the form field

### Cloudinary Adapter

Upload files to Cloudinary with automatic optimization:

```typescript
import { createCloudinaryAdapter } from "bit-form";

const cloudinaryAdapter = createCloudinaryAdapter({
  cloudName: "your-cloud-name",
  uploadPreset: "my-preset",
  folder: "my-app",
});
```

**Configuration:**

- `cloudName`: Your Cloudinary cloud name
- `uploadPreset`: Unsigned upload preset (for browser uploads)
- `folder`: Optional folder path in your Cloudinary account

**Benefits:**

- No backend required for unsigned uploads
- Automatic image optimization
- CDN delivery
- Support for image transformations

### Azure Blob Storage Adapter

Upload files to Microsoft Azure Blob Storage:

```typescript
import { createAzureBlobAdapter } from "bit-form";

const azureAdapter = createAzureBlobAdapter({
  accountName: "myaccount",
  containerName: "uploads",
  accountKey: "your-account-key",
  // or use Shared Access Signature (SAS)
  sasToken: "sv=2021-06-08&ss=b&srt=sco...",
});
```

**Configuration:**

- `accountName`: Azure storage account name
- `containerName`: Blob container name
- `accountKey` or `sasToken`: Authentication credentials

## Framework Integration

### React

```typescript
import { useBitUpload } from 'bit-form';
import { createS3Adapter } from 'bit-form';

function AvatarUpload() {
  const adapter = createS3Adapter({
    region: 'us-east-1',
    bucket: 'avatars',
    presignedUrlEndpoint: 'https://api.example.com/s3-presigned',
  });

  const {
    value,
    error,
    isUploading,
    uploadProgress,
    uploadError,
    handleUploadFile,
    handleRemoveFile,
  } = useBitUpload('profile.avatar', adapter);

  return (
    <div>
      <input
        type="file"
        onChange={(e) => handleUploadFile(e.target.files?.[0]!)}
        disabled={isUploading}
      />

      {isUploading && (
        <div>
          Uploading: {uploadProgress.percentage}%
        </div>
      )}

      {uploadError && (
        <div className="error">{uploadError.message}</div>
      )}

      {value && (
        <div>
          <img src={value} alt="Avatar" />
          <button onClick={handleRemoveFile}>Remove</button>
        </div>
      )}

      {error && <div className="error">{error}</div>}
    </div>
  );
}
```

### Angular

```typescript
import { Component } from '@angular/core';
import { injectBitUpload } from 'bit-form';
import { createCloudinaryAdapter } from 'bit-form';

@Component({
  selector: 'app-avatar-upload',
  template: `
    <div>
      <input
        type="file"
        (change)="upload($event)"
        [disabled]="isUploading()"
      />

      @if (isUploading()) {
        <div>Uploading: {{ uploadProgress().percentage }}%</div>
      }

      @if (uploadError()) {
        <div class="error">{{ uploadError()?.message }}</div>
      }

      @if (value()) {
        <div>
          <img [src]="value()" />
          <button (click)="handleRemoveFile()">Remove</button>
        </div>
      }

      @if (error()) {
        <div class="error">{{ error() }}</div>
      }
    </div>
  `,
})
export class AvatarUploadComponent {
  adapter = createCloudinaryAdapter({
    cloudName: 'your-cloud',
    uploadPreset: 'my-preset',
  });

  {
    value,
    error,
    isUploading,
    uploadProgress,
    uploadError,
    handleUploadFile,
    handleRemoveFile,
  } = injectBitUpload('profile.avatar', this.adapter);

  upload(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      this.handleUploadFile(file);
    }
  }
}
```

### Vue

```typescript
<script setup lang="ts">
import { useBitUpload } from 'bit-form';
import { createS3Adapter } from 'bit-form';

const adapter = createS3Adapter({
  region: 'us-east-1',
  bucket: 'avatars',
  presignedUrlEndpoint: 'https://api.example.com/s3-presigned',
});

const {
  value,
  error,
  isUploading,
  uploadProgress,
  uploadError,
  handleUploadFile,
  handleRemoveFile,
} = useBitUpload('profile.avatar', adapter);

const handleFileChange = (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (file) {
    handleUploadFile(file);
  }
};
</script>

<template>
  <div>
    <input
      type="file"
      @change="handleFileChange"
      :disabled="isUploading"
    />

    <div v-if="isUploading">
      Uploading: {{ uploadProgress.percentage }}%
    </div>

    <div v-if="uploadError" class="error">
      {{ uploadError.message }}
    </div>

    <div v-if="value">
      <img :src="value" alt="Avatar" />
      <button @click="handleRemoveFile">Remove</button>
    </div>

    <div v-if="error" class="error">
      {{ error }}
    </div>
  </div>
</template>
```

## Form Submission Flow

The upload integration works seamlessly with form submission:

```typescript
const form = useBitForm({
  fields: {
    profile: {
      avatar: {
        // asyncValidate validates that upload is complete
        // Blocks submit if upload is still pending
        validation: {
          asyncValidate: createUploadValidator(),
        },
      },
    },
  },
});

// Submit is automatically blocked while uploads are pending
form.submit(); // Waits for upload to complete
```

## Progress Tracking

Get real-time progress updates during uploads:

```typescript
const { uploadProgress } = useBitUpload("avatar", adapter, {
  onProgress: (progress) => {
    console.log(
      `${progress.percentage}% - ${progress.loaded}/${progress.total} bytes`,
    );
  },
});
```

## Error Handling

Handle upload failures gracefully:

```typescript
const { uploadError, handleUploadFile } = useBitUpload("avatar", adapter);

const upload = async (file: File) => {
  try {
    await handleUploadFile(file);
  } catch (error) {
    console.error("Upload failed:", uploadError.value?.message);
  }
};
```

## Custom Adapters

Create custom adapters for other storage providers:

```typescript
import type { BitUploadAdapter } from "bit-form";

export const createMyCustomAdapter = (): BitUploadAdapter => {
  return {
    async upload(file, options) {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", options?.folder || "uploads");

      const response = await fetch("https://api.example.com/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        url: data.secureUrl,
        key: data.fileKey,
        metadata: data,
      };
    },

    async delete(key) {
      await fetch("https://api.example.com/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
    },
  };
};
```

## Backend Integration (S3 Example)

If using the S3 adapter with presigned URLs, your backend needs to generate presigned URLs:

```typescript
// Your backend (Node.js example with AWS SDK)
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

app.post("/api/s3-presigned", async (req, res) => {
  const s3 = new S3Client({ region: "us-east-1" });
  const command = new PutObjectCommand({
    Bucket: "my-bucket",
    Key: `avatars/${Date.now()}-${req.body.filename}`,
    ContentType: req.body.contentType,
  });

  const url = await getSignedUrl(s3, command, { expiresIn: 3600 });
  res.json({
    presignedUrl: url,
    publicUrl: `https://cdn.example.com/avatars/${Date.now()}-${req.body.filename}`,
  });
});
```

## Best Practices

1. **Always validate file type and size on the client**

   ```typescript
   if (file.size > 5 * 1024 * 1024) {
     setError("File too large");
     return;
   }
   ```

2. **Show progress to users** - Long uploads should display progress bars

3. **Handle network failures gracefully** - Provide retry mechanisms

4. **Use CORS properly** - Configure S3 bucket CORS for direct uploads

5. **Cleanup on form cancel** - Delete uploaded files if user doesn't submit

6. **Validate on the backend** - Don't trust client-side validation alone

## Troubleshooting

### Upload fails with CORS error

- Configure CORS on your storage provider
- For S3, ensure bucket policy allows PUT from your domain
- For Cloudinary, verify upload preset is unsigned and has no restrictions

### Progress callback not firing

- Some adapters may not support progress tracking
- Cloudinary and Azure Blob adapters have limited progress support
- S3 with presigned URLs provides progress via XMLHttpRequest

### File URL not accessible after upload

- Verify the file is public in storage
- Check CDN configuration and cache settings
- Ensure publicUrlBase is correctly configured

### AsyncValidate not blocking submit

- Ensure `createUploadValidator()` is added to field validation
- Check that `hasValidationsInProgress()` returns true during upload
- Verify field path matches the uploaded field
