/**
 * React "useBitUpload" Hook Tests
 *
 * Validate React hook integration with BitForm and upload adapters.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useBitUpload } from "../../../../../src/react/use-bit-upload";
import type { BitUploadAdapter } from "../../../../../src/core/upload";

describe("useBitUpload (React)", () => {
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

  it("should initialize with empty state", async () => {
    const { result } = renderHook(() => useBitUpload("avatar", mockAdapter));

    expect(result.current.value).toBeUndefined();
    expect(result.current.isUploading).toBe(false);
    expect(result.current.uploadProgress).toEqual({ loaded: 0, total: 0 });
    expect(result.current.uploadError).toBeNull();
  });

  it("should upload file and set field value", async () => {
    const { result } = renderHook(() => useBitUpload("avatar", mockAdapter));

    const file = new File(["content"], "avatar.jpg", { type: "image/jpeg" });

    await act(async () => {
      await result.current.handleUploadFile(file);
    });

    expect(mockAdapter.upload).toHaveBeenCalledWith(
      file,
      expect.objectContaining({}),
    );
    expect(result.current.value).toBe(
      "https://cdn.example.com/uploads/avatar.jpg",
    );
    expect(result.current.uploadKey).toBe("uploads/avatar.jpg");
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

    const { result } = renderHook(() => useBitUpload("avatar", mockAdapter));
    const file = new File(["content"], "avatar.jpg", { type: "image/jpeg" });

    await act(async () => {
      await result.current.handleUploadFile(file);
    });

    await waitFor(() => {
      expect(result.current.uploadProgress.percentage).toBe(100);
    });
  });

  it("should handle upload errors", async () => {
    mockAdapter.upload = vi.fn(async () => {
      throw new Error("Network error");
    });

    const { result } = renderHook(() => useBitUpload("avatar", mockAdapter));
    const file = new File(["content"], "avatar.jpg", { type: "image/jpeg" });

    await act(async () => {
      try {
        await result.current.handleUploadFile(file);
      } catch {
        // Expected
      }
    });

    expect(result.current.uploadError).not.toBeNull();
    expect(result.current.uploadError?.message).toContain("Network");
    expect(result.current.value).toBeUndefined();
  });

  it("should remove uploaded file", async () => {
    const { result } = renderHook(() => useBitUpload("avatar", mockAdapter));

    // First, upload
    const file = new File(["content"], "avatar.jpg", { type: "image/jpeg" });
    await act(async () => {
      await result.current.handleUploadFile(file);
    });

    expect(result.current.value).toBeDefined();
    expect(result.current.uploadKey).toBeDefined();

    // Then, remove
    await act(async () => {
      await result.current.handleRemoveFile();
    });

    expect(mockAdapter.delete).toHaveBeenCalledWith("uploads/avatar.jpg");
    expect(result.current.value).toBeUndefined();
    expect(result.current.uploadKey).toBeNull();
  });

  it("should not allow delete if adapter doesn't support it", async () => {
    const adapterWithoutDelete = {
      upload: mockAdapter.upload,
    };

    const { result } = renderHook(() =>
      useBitUpload("avatar", adapterWithoutDelete as any),
    );

    const file = new File(["content"], "avatar.jpg", { type: "image/jpeg" });
    await act(async () => {
      await result.current.handleUploadFile(file);
    });

    await act(async () => {
      await result.current.handleRemoveFile();
    });

    // Should still clear local state even if adapter doesn't support delete
    expect(result.current.value).toBeUndefined();
  });

  it("should pass custom options to adapter", async () => {
    const { result } = renderHook(() =>
      useBitUpload("avatar", mockAdapter, { folder: "avatars" }),
    );

    const file = new File(["content"], "avatar.jpg", { type: "image/jpeg" });

    await act(async () => {
      await result.current.handleUploadFile(file);
    });

    expect(mockAdapter.upload).toHaveBeenCalledWith(
      file,
      expect.objectContaining({ folder: "avatars" }),
    );
  });

  it("should set isUploading flag during upload", async () => {
    let uploadPromiseResolve: any;
    mockAdapter.upload = vi.fn(
      () =>
        new Promise((resolve) => {
          uploadPromiseResolve = resolve;
        }),
    );

    const { result } = renderHook(() => useBitUpload("avatar", mockAdapter));
    const file = new File(["content"], "avatar.jpg", { type: "image/jpeg" });

    const uploadPromise = act(async () => {
      return result.current.handleUploadFile(file);
    });

    await waitFor(() => {
      expect(result.current.isUploading).toBe(true);
    });

    act(() => {
      uploadPromiseResolve({
        url: "https://cdn.example.com/file.jpg",
        key: "file.jpg",
      });
    });

    await uploadPromise;

    await waitFor(() => {
      expect(result.current.isUploading).toBe(false);
    });
  });

  it("should support setValue method for field", async () => {
    const { result } = renderHook(() => useBitUpload("avatar", mockAdapter));

    await act(async () => {
      result.current.setValue("https://external-cdn.com/avatar.jpg");
    });

    expect(result.current.value).toBe("https://external-cdn.com/avatar.jpg");
  });

  it("should reset upload state on new upload", async () => {
    const { result } = renderHook(() => useBitUpload("avatar", mockAdapter));

    const file1 = new File(["content"], "avatar1.jpg", { type: "image/jpeg" });
    await act(async () => {
      await result.current.handleUploadFile(file1);
    });

    expect(result.current.uploadError).toBeNull();

    // Simulate error on second upload
    mockAdapter.upload = vi.fn(async () => {
      throw new Error("Upload failed");
    });

    const file2 = new File(["content"], "avatar2.jpg", { type: "image/jpeg" });
    await act(async () => {
      try {
        await result.current.handleUploadFile(file2);
      } catch {
        // Expected
      }
    });

    expect(result.current.uploadError).not.toBeNull();
  });
});
