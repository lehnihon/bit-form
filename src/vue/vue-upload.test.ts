/**
 * Vue "useBitUpload" Composable Tests
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { defineComponent, nextTick } from "vue";
import { mount } from "@vue/test-utils";
import { useBitUpload, type UseBitUploadResult } from "./use-bit-upload";
import type { BitUploadFn } from "../core/upload";
import { BitStore } from "../core/store";
import { BIT_STORE_KEY } from "./context";

describe("useBitUpload (Vue)", () => {
  let mockUpload: ReturnType<typeof vi.fn> & BitUploadFn;
  let mockDelete: ReturnType<typeof vi.fn>;
  let store: BitStore<any>;

  const mountUpload = (
    factory: () => UseBitUploadResult,
  ): { upload: UseBitUploadResult; wrapper: ReturnType<typeof mount> } => {
    let upload!: UseBitUploadResult;

    const TestComponent = defineComponent({
      setup() {
        upload = factory();
        return {};
      },
      template: "<div></div>",
    });

    const wrapper = mount(TestComponent, {
      global: { provide: { [BIT_STORE_KEY as any]: store } },
    });

    return { upload, wrapper };
  };

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

  it("should initialize with default state", () => {
    const { upload } = mountUpload(() => useBitUpload("avatar", mockUpload));

    expect(upload.value.value).toBeUndefined();
    expect(upload.isUploading.value).toBe(false);
    expect(upload.uploadProgress.value).toEqual({
      loaded: 0,
      total: 0,
      percentage: 0,
    });
    expect(upload.uploadError.value).toBeNull();
    expect(upload.uploadKey.value).toBeNull();
  });

  it("should upload file and set field value", async () => {
    const { upload } = mountUpload(() => useBitUpload("avatar", mockUpload));
    const file = new File(["content"], "avatar.jpg", { type: "image/jpeg" });

    await upload.handleUploadFile(file);
    await nextTick();

    expect(mockUpload).toHaveBeenCalledWith(file, expect.objectContaining({}));
    expect(upload.value.value).toBe(
      "https://cdn.example.com/uploads/avatar.jpg",
    );
    expect(upload.uploadKey.value).toBe("uploads/avatar.jpg");
  });

  it("should handle upload errors", async () => {
    mockUpload = vi.fn(async () => {
      throw new Error("Network error");
    }) as any;

    const { upload } = mountUpload(() => useBitUpload("avatar", mockUpload));
    const file = new File(["content"], "avatar.jpg", { type: "image/jpeg" });

    await upload.handleUploadFile(file).catch(() => {
      // Expected
    });
    await nextTick();

    expect(upload.uploadError.value).toContain("Network");
    expect(store.getState().errors.avatar).toContain("Network");
    expect(upload.value.value).toBeUndefined();
  });

  it("should remove uploaded file", async () => {
    const { upload } = mountUpload(() =>
      useBitUpload("avatar", mockUpload, { deleteFile: mockDelete }),
    );

    const file = new File(["content"], "avatar.jpg", { type: "image/jpeg" });
    await upload.handleUploadFile(file);
    await nextTick();

    await upload.handleRemoveFile();
    await nextTick();

    expect(mockDelete).toHaveBeenCalledWith("uploads/avatar.jpg");
    expect(upload.value.value).toBeNull();
    expect(upload.uploadKey.value).toBeNull();
  });

  it("should clear local state without deleteFile", async () => {
    const { upload } = mountUpload(() => useBitUpload("avatar", mockUpload));

    const file = new File(["content"], "avatar.jpg", { type: "image/jpeg" });
    await upload.handleUploadFile(file);
    await nextTick();

    await upload.handleRemoveFile();
    await nextTick();

    expect(upload.value.value).toBeNull();
  });

  it("should pass custom options to upload function", async () => {
    const { upload } = mountUpload(() =>
      useBitUpload("avatar", mockUpload, {
        uploadOptions: { folder: "avatars" },
      }),
    );

    const file = new File(["content"], "avatar.jpg", { type: "image/jpeg" });
    await upload.handleUploadFile(file);
    await nextTick();

    expect(mockUpload).toHaveBeenCalledWith(
      file,
      expect.objectContaining({ folder: "avatars" }),
    );
  });

  it("should set isUploading ref during upload", async () => {
    let uploadPromiseResolve: any;
    mockUpload = vi.fn(
      () =>
        new Promise((resolve) => {
          uploadPromiseResolve = resolve;
        }),
    ) as any;

    const { upload } = mountUpload(() => useBitUpload("avatar", mockUpload));
    const file = new File(["content"], "avatar.jpg", { type: "image/jpeg" });

    const uploadPromise = upload.handleUploadFile(file);
    expect(upload.isUploading.value).toBe(true);

    await vi.waitFor(() => {
      expect(typeof uploadPromiseResolve).toBe("function");
    });

    uploadPromiseResolve({
      url: "https://cdn.example.com/file.jpg",
      key: "file.jpg",
    });

    await uploadPromise;
    await nextTick();

    expect(upload.isUploading.value).toBe(false);
  });

  it("should support setValue method for field", async () => {
    const { upload } = mountUpload(() => useBitUpload("avatar", mockUpload));

    upload.setValue("https://external-cdn.com/avatar.jpg");
    await nextTick();

    expect(upload.value.value).toBe("https://external-cdn.com/avatar.jpg");
  });

  it("should expose error from field", () => {
    const { upload } = mountUpload(() => useBitUpload("avatar", mockUpload));
    expect(upload.error).toBeDefined();
  });

  it("should expose isValidating from field", () => {
    const { upload } = mountUpload(() => useBitUpload("avatar", mockUpload));
    expect(typeof upload.isValidating.value).toBe("boolean");
  });
});
