// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { createBitReactBindings } from "bit-form/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createBitStore as createBitStoreRuntime } from "../../../core";
import type { BitUploadFn } from "../../../core/types/upload";

function createBitStore<T extends object = Record<string, unknown>>(
  config?: any,
) {
  return createBitStoreRuntime<T>(config) as any;
}

describe("useBitUpload (React)", () => {
  let mockUpload: ReturnType<typeof vi.fn> & BitUploadFn;
  let mockDelete: ReturnType<typeof vi.fn>;
  let store: ReturnType<typeof createBitStore<any>>;

  beforeEach(() => {
    store = createBitStore({
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

  it("should initialize with empty state", () => {
    const bit = createBitReactBindings<any>(store);
    const { result } = renderHook(() => bit.useBitUpload("avatar", mockUpload));

    expect(result.current.value).toBeUndefined();
    expect(result.current.error).toBeUndefined();
    expect(result.current.isValidating).toBe(false);
  });

  it("should upload file and set field value", async () => {
    const bit = createBitReactBindings<any>(store);
    const { result } = renderHook(() => bit.useBitUpload("avatar", mockUpload));

    const file = new File(["content"], "avatar.jpg", { type: "image/jpeg" });

    await act(() => result.current.upload(file));

    expect(mockUpload).toHaveBeenCalledWith(file);
    expect(result.current.value).toBe(
      "https://cdn.example.com/uploads/avatar.jpg",
    );
  });

  it("should set field error on upload failure", async () => {
    mockUpload = vi.fn(async () => {
      throw new Error("Network error");
    }) as any;

    const bit = createBitReactBindings<any>(store);
    const { result } = renderHook(() => bit.useBitUpload("avatar", mockUpload));
    const file = new File(["content"], "avatar.jpg", { type: "image/jpeg" });

    await act(() => result.current.upload(file));

    expect(store.read.getState().errors.avatar).toContain("Network");
    expect(result.current.error).toBeUndefined();
    expect(result.current.value).toBeUndefined();
  });

  it("should remove uploaded file and call deleteFile", async () => {
    const bit = createBitReactBindings<any>(store);
    const { result } = renderHook(() =>
      bit.useBitUpload("avatar", mockUpload, mockDelete),
    );

    const file = new File(["content"], "avatar.jpg", { type: "image/jpeg" });
    await act(() => result.current.upload(file));

    await act(() => result.current.remove());

    expect(mockDelete).toHaveBeenCalledWith("uploads/avatar.jpg");
    expect(result.current.value).toBeNull();
  });

  it("should clear field value without deleteFile", async () => {
    const bit = createBitReactBindings<any>(store);
    const { result } = renderHook(() => bit.useBitUpload("avatar", mockUpload));

    const file = new File(["content"], "avatar.jpg", { type: "image/jpeg" });
    await act(() => result.current.upload(file));

    await act(() => result.current.remove());

    expect(result.current.value).toBeNull();
  });

  it("should keep isValidating true while upload is pending", async () => {
    let uploadPromiseResolve: any;
    mockUpload = vi.fn(
      () =>
        new Promise((resolve) => {
          uploadPromiseResolve = resolve;
        }),
    ) as any;

    const bit = createBitReactBindings<any>(store);
    const { result } = renderHook(() => bit.useBitUpload("avatar", mockUpload));
    const file = new File(["content"], "avatar.jpg", { type: "image/jpeg" });

    let uploadPromise: Promise<void>;
    act(() => {
      uploadPromise = result.current.upload(file);
    });

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
      expect(result.current.isValidating).toBe(false);
    });
  });

  it("should support setValue method for field", () => {
    const bit = createBitReactBindings<any>(store);
    const { result } = renderHook(() => bit.useBitUpload("avatar", mockUpload));

    act(() => {
      result.current.setValue("https://external-cdn.com/avatar.jpg");
    });

    expect(result.current.value).toBe("https://external-cdn.com/avatar.jpg");
  });
});
