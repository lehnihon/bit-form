/**
 * Vue "useBitUpload" Composable Tests
 *
 * Validate Vue 3 composable integration with BitForm and upload adapters.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { ref } from "vue";
import { useBitUpload } from "./use-bit-upload";
import type { BitUploadAdapter } from "../core/upload";

describe("useBitUpload (Vue)", () => {
  let mockAdapter: BitUploadAdapter;

  beforeEach(() => {
    mockAdapter = {
      upload: vi.fn(async (file: File) => ({
        url: `https://cdn.example.com/uploads/${file.name}`,
        key: `uploads/${file.name}`,
        metadata: { size: file.size, type: file.type },
      })),
      delete: vi.fn(async () => {}),
    };
  });

  it("should initialize with default state", () => {
    const { value, isUploading, uploadProgress, uploadError, uploadKey } =
      useBitUpload("avatar", mockAdapter);

    expect(value.value).toBeUndefined();
    expect(isUploading.value).toBe(false);
    expect(uploadProgress.value).toEqual({ loaded: 0, total: 0 });
    expect(uploadError.value).toBeNull();
    expect(uploadKey.value).toBeNull();
  });

  it("should upload file and set field value", async () => {
    const { handleUploadFile, value, uploadKey } = useBitUpload(
      "avatar",
      mockAdapter,
    );

    const file = new File(["content"], "avatar.jpg", { type: "image/jpeg" });

    await handleUploadFile(file);

    expect(mockAdapter.upload).toHaveBeenCalledWith(
      file,
      expect.objectContaining({}),
    );
    expect(value.value).toBe("https://cdn.example.com/uploads/avatar.jpg");
    expect(uploadKey.value).toBe("uploads/avatar.jpg");
  });

  it("should track upload progress", async () => {
    let progressCallback: any;
    mockAdapter.upload = vi.fn(async (file: File, opts: any) => {
      progressCallback = opts.onProgress;
      progressCallback({ loaded: 50, total: 100 });
      progressCallback({ loaded: 100, total: 100 });
      return {
        url: "https://cdn.example.com/file.jpg",
        key: "file.jpg",
      };
    });

    const { handleUploadFile, uploadProgress } = useBitUpload(
      "avatar",
      mockAdapter,
    );
    const file = new File(["content"], "avatar.jpg", { type: "image/jpeg" });

    await handleUploadFile(file);

    expect(uploadProgress.value?.percentage).toBe(100);
  });

  it("should handle upload errors", async () => {
    mockAdapter.upload = vi.fn(async () => {
      throw new Error("Network error");
    });

    const { handleUploadFile, uploadError, value } = useBitUpload(
      "avatar",
      mockAdapter,
    );
    const file = new File(["content"], "avatar.jpg", { type: "image/jpeg" });

    await handleUploadFile(file).catch(() => {
      // Expected
    });

    expect(uploadError.value).not.toBeNull();
    expect(uploadError.value).toContain("Network");
    expect(value.value).toBeUndefined();
  });

  it("should remove uploaded file", async () => {
    const { handleUploadFile, handleRemoveFile, value, uploadKey } =
      useBitUpload("avatar", mockAdapter);

    const file = new File(["content"], "avatar.jpg", { type: "image/jpeg" });
    await handleUploadFile(file);

    expect(value.value).toBeDefined();
    expect(uploadKey.value).toBeDefined();

    await handleRemoveFile();

    expect(mockAdapter.delete).toHaveBeenCalledWith("uploads/avatar.jpg");
    expect(value.value).toBeUndefined();
    expect(uploadKey.value).toBeNull();
  });

  it("should not throw if adapter doesn't support delete", async () => {
    const adapterWithoutDelete = {
      upload: mockAdapter.upload,
    };

    const { handleUploadFile, handleRemoveFile, value } = useBitUpload(
      "avatar",
      adapterWithoutDelete as any,
    );

    const file = new File(["content"], "avatar.jpg", { type: "image/jpeg" });
    await handleUploadFile(file);

    await handleRemoveFile();

    expect(value.value).toBeUndefined();
  });

  it("should pass custom options to adapter", async () => {
    const { handleUploadFile } = useBitUpload("avatar", mockAdapter, {
      uploadOptions: { folder: "avatars" },
    });

    const file = new File(["content"], "avatar.jpg", { type: "image/jpeg" });
    await handleUploadFile(file);

    expect(mockAdapter.upload).toHaveBeenCalledWith(
      file,
      expect.objectContaining({ folder: "avatars" }),
    );
  });

  it("should set isUploading ref during upload", async () => {
    let uploadPromiseResolve: any;
    mockAdapter.upload = vi.fn(
      () =>
        new Promise((resolve) => {
          uploadPromiseResolve = resolve;
        }),
    ) as any;

    const { handleUploadFile, isUploading } = useBitUpload(
      "avatar",
      mockAdapter,
    );
    const file = new File(["content"], "avatar.jpg", { type: "image/jpeg" });

    const uploadPromise = handleUploadFile(file);

    expect(isUploading.value).toBe(true);

    uploadPromiseResolve({
      url: "https://cdn.example.com/file.jpg",
      key: "file.jpg",
    });

    await uploadPromise;

    expect(isUploading.value).toBe(false);
  });

  it("should support setValue method for field", async () => {
    const { setValue, value } = useBitUpload("avatar", mockAdapter);

    await setValue("https://external-cdn.com/avatar.jpg");

    expect(value.value).toBe("https://external-cdn.com/avatar.jpg");
  });

  it("should expose error from field", async () => {
    const { error } = useBitUpload("avatar", mockAdapter);

    // should be computed ref
    expect(typeof error.value === "string" || error.value === null).toBe(true);
  });

  it("should expose isValidating from field", () => {
    const { isValidating } = useBitUpload("avatar", mockAdapter);

    // should be computed ref
    expect(typeof isValidating.value === "boolean").toBe(true);
  });

  it("should reset upload state on new upload", async () => {
    const { handleUploadFile, uploadError } = useBitUpload(
      "avatar",
      mockAdapter,
    );

    const file1 = new File(["content"], "avatar1.jpg", { type: "image/jpeg" });
    await handleUploadFile(file1);

    expect(uploadError.value).toBeNull();

    // Simulate error on second upload
    mockAdapter.upload = vi.fn(async () => {
      throw new Error("Upload failed");
    });

    const file2 = new File(["content"], "avatar2.jpg", { type: "image/jpeg" });
    await handleUploadFile(file2).catch(() => {
      // Expected
    });

    expect(uploadError.value).not.toBeNull();
  });

  it("should compute percentage from progress ref", async () => {
    let progressCallback: any;
    mockAdapter.upload = vi.fn(async (file: File, opts: any) => {
      progressCallback = opts.onProgress;
      progressCallback({ loaded: 75, total: 100 });
      return {
        url: "https://cdn.example.com/file.jpg",
        key: "file.jpg",
      };
    });

    const { handleUploadFile, uploadProgress } = useBitUpload(
      "avatar",
      mockAdapter,
    );
    const file = new File(["content"], "avatar.jpg", { type: "image/jpeg" });

    await handleUploadFile(file);

    expect(uploadProgress.value?.percentage).toBe(75);
  });
});
