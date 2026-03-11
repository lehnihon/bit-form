/**
 * React "useBitUpload" Hook Tests
 */

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useBitUpload } from "./use-bit-upload";
import type { BitUploadFn } from "../core/upload";
import { BitFormProvider } from "./context";
import { BitStore } from "../core/store";

describe("useBitUpload (React)", () => {
  let mockUpload: ReturnType<typeof vi.fn> & BitUploadFn;
  let mockDelete: ReturnType<typeof vi.fn>;
  let store: BitStore<any>;

  const wrapper = ({ children, testStore }: any) => (
    <BitFormProvider store={testStore}>{children}</BitFormProvider>
  );

  beforeEach(() => {
    store = new BitStore({
      initialValues: { avatar: undefined },
      validation: { delay: 0 },
    });

    mockUpload = vi.fn(async (file: File) => ({
      url: `https://cdn.example.com/uploads/${file.name}`,
      key: `uploads/${file.name}`,
      metadata: { size: file.size, type: file.type },
    })) as any;

    mockDelete = vi.fn(async () => {});
  });

  it("should initialize with empty state", async () => {
    const { result } = renderHook(() => useBitUpload("avatar", mockUpload), {
      wrapper: (props) => wrapper({ ...props, testStore: store }),
    });

    expect(result.current.value).toBeUndefined();
    expect(result.current.isUploading).toBe(false);
    expect(result.current.uploadProgress).toEqual({
      loaded: 0,
      total: 0,
      percentage: 0,
    });
    expect(result.current.uploadError).toBeNull();
  });

  it("should upload file and set field value", async () => {
    const { result } = renderHook(() => useBitUpload("avatar", mockUpload), {
      wrapper: (props) => wrapper({ ...props, testStore: store }),
    });

    const file = new File(["content"], "avatar.jpg", { type: "image/jpeg" });

    await act(() => result.current.handleUploadFile(file));

    expect(mockUpload).toHaveBeenCalledWith(file, expect.objectContaining({}));
    expect(result.current.value).toBe(
      "https://cdn.example.com/uploads/avatar.jpg",
    );
    expect(result.current.uploadKey).toBe("uploads/avatar.jpg");
  });

  it("should track upload progress", async () => {
    mockUpload = vi.fn(async () => {
      return {
        url: "https://cdn.example.com/file.jpg",
        key: "file.jpg",
      };
    }) as any;

    const { result } = renderHook(() => useBitUpload("avatar", mockUpload), {
      wrapper: (props) => wrapper({ ...props, testStore: store }),
    });
    const file = new File(["content"], "avatar.jpg", { type: "image/jpeg" });

    await act(() => result.current.handleUploadFile(file));

    await waitFor(() => {
      expect(result.current.uploadProgress.percentage).toBe(0);
    });
  });

  it("should handle upload errors", async () => {
    mockUpload = vi.fn(async () => {
      throw new Error("Network error");
    }) as any;

    const { result } = renderHook(() => useBitUpload("avatar", mockUpload), {
      wrapper: (props) => wrapper({ ...props, testStore: store }),
    });
    const file = new File(["content"], "avatar.jpg", { type: "image/jpeg" });

    await act(() =>
      result.current.handleUploadFile(file).catch(() => {
        // Expected
      }),
    );

    expect(result.current.uploadError).not.toBeNull();
    expect(result.current.uploadError).toContain("Network");
    expect(store.getState().errors.avatar).toContain("Network");
    expect(result.current.value).toBeUndefined();
  });

  it("should remove uploaded file", async () => {
    const { result } = renderHook(
      () => useBitUpload("avatar", mockUpload, { deleteFile: mockDelete }),
      {
        wrapper: (props) => wrapper({ ...props, testStore: store }),
      },
    );

    const file = new File(["content"], "avatar.jpg", { type: "image/jpeg" });
    await act(() => result.current.handleUploadFile(file));

    expect(result.current.value).toBeDefined();
    expect(result.current.uploadKey).toBeDefined();

    await act(() => result.current.handleRemoveFile());

    expect(mockDelete).toHaveBeenCalledWith("uploads/avatar.jpg");
    expect(result.current.value).toBeNull();
    expect(result.current.uploadKey).toBeNull();
  });

  it("should clear local state without deleteFile", async () => {
    const { result } = renderHook(() => useBitUpload("avatar", mockUpload), {
      wrapper: (props) => wrapper({ ...props, testStore: store }),
    });

    const file = new File(["content"], "avatar.jpg", { type: "image/jpeg" });
    await act(() => result.current.handleUploadFile(file));

    await act(() => result.current.handleRemoveFile());

    expect(result.current.value).toBeNull();
  });

  it("should pass custom options to upload function", async () => {
    const { result } = renderHook(
      () =>
        useBitUpload("avatar", mockUpload, {
          uploadOptions: { folder: "avatars" },
        }),
      {
        wrapper: (props) => wrapper({ ...props, testStore: store }),
      },
    );

    const file = new File(["content"], "avatar.jpg", { type: "image/jpeg" });

    await act(() => result.current.handleUploadFile(file));

    expect(mockUpload).toHaveBeenCalledWith(
      file,
      expect.objectContaining({ folder: "avatars" }),
    );
  });

  it("should set isUploading flag during upload", async () => {
    let uploadPromiseResolve: any;
    mockUpload = vi.fn(
      () =>
        new Promise((resolve) => {
          uploadPromiseResolve = resolve;
        }),
    ) as any;

    const { result } = renderHook(() => useBitUpload("avatar", mockUpload), {
      wrapper: (props) => wrapper({ ...props, testStore: store }),
    });
    const file = new File(["content"], "avatar.jpg", { type: "image/jpeg" });

    let uploadPromise: Promise<void>;
    act(() => {
      uploadPromise = result.current.handleUploadFile(file);
    });

    expect(result.current.isUploading).toBe(true);
    expect(result.current.isValidating).toBe(true);

    await waitFor(() => {
      expect(typeof uploadPromiseResolve).toBe("function");
    });

    await act(() => {
      uploadPromiseResolve({
        url: "https://cdn.example.com/file.jpg",
        key: "file.jpg",
      });
      return uploadPromise!;
    });

    await waitFor(() => {
      expect(result.current.isUploading).toBe(false);
      expect(result.current.isValidating).toBe(false);
    });
  });

  it("should support setValue method for field", async () => {
    const { result } = renderHook(() => useBitUpload("avatar", mockUpload), {
      wrapper: (props) => wrapper({ ...props, testStore: store }),
    });

    act(() => {
      result.current.setValue("https://external-cdn.com/avatar.jpg");
    });

    expect(result.current.value).toBe("https://external-cdn.com/avatar.jpg");
  });

  it("should reset upload state on new upload", async () => {
    const { result } = renderHook(() => useBitUpload("avatar", mockUpload), {
      wrapper: (props) => wrapper({ ...props, testStore: store }),
    });

    const file1 = new File(["content"], "avatar1.jpg", { type: "image/jpeg" });
    await act(() => result.current.handleUploadFile(file1));

    expect(result.current.uploadError).toBeNull();

    mockUpload.mockImplementation(async () => {
      throw new Error("Upload failed");
    });

    const file2 = new File(["content"], "avatar2.jpg", { type: "image/jpeg" });
    await act(() =>
      result.current.handleUploadFile(file2).catch(() => {
        // Expected
      }),
    );

    expect(result.current.uploadError).not.toBeNull();
  });
});
