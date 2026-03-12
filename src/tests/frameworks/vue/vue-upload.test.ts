import { describe, it, expect, vi, beforeEach } from "vitest";
import { defineComponent, nextTick } from "vue";
import { mount } from "@vue/test-utils";
import { useBitUpload, type UseBitUploadResult } from "bit-form/vue";
import type { BitUploadFn } from "../../../core/upload";
import { BitStore } from "../../../core/store";
import { BIT_STORE_KEY } from "../../../vue/context";

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
    expect(upload.error.value).toBeUndefined();
    expect(upload.isValidating.value).toBe(false);
  });

  it("should upload file and set field value", async () => {
    const { upload } = mountUpload(() => useBitUpload("avatar", mockUpload));
    const file = new File(["content"], "avatar.jpg", { type: "image/jpeg" });

    await upload.upload(file);
    await nextTick();

    expect(mockUpload).toHaveBeenCalledWith(file);
    expect(upload.value.value).toBe(
      "https://cdn.example.com/uploads/avatar.jpg",
    );
  });

  it("should handle upload errors in field error", async () => {
    mockUpload = vi.fn(async () => {
      throw new Error("Network error");
    }) as any;

    const { upload } = mountUpload(() => useBitUpload("avatar", mockUpload));
    const file = new File(["content"], "avatar.jpg", { type: "image/jpeg" });

    await upload.upload(file);
    await nextTick();

    expect(upload.error.value).toBeUndefined();
    expect(store.getState().errors.avatar).toContain("Network");
    expect(upload.value.value).toBeUndefined();
  });

  it("should remove uploaded file", async () => {
    const { upload } = mountUpload(() =>
      useBitUpload("avatar", mockUpload, mockDelete),
    );

    const file = new File(["content"], "avatar.jpg", { type: "image/jpeg" });
    await upload.upload(file);
    await nextTick();

    await upload.remove();
    await nextTick();

    expect(mockDelete).toHaveBeenCalledWith("uploads/avatar.jpg");
    expect(upload.value.value).toBeNull();
  });

  it("should clear state without deleteFile", async () => {
    const { upload } = mountUpload(() => useBitUpload("avatar", mockUpload));

    const file = new File(["content"], "avatar.jpg", { type: "image/jpeg" });
    await upload.upload(file);
    await nextTick();

    await upload.remove();
    await nextTick();

    expect(upload.value.value).toBeNull();
  });

  it("should set isValidating during pending upload", async () => {
    let uploadPromiseResolve: any;
    mockUpload = vi.fn(
      () =>
        new Promise((resolve) => {
          uploadPromiseResolve = resolve;
        }),
    ) as any;

    const { upload } = mountUpload(() => useBitUpload("avatar", mockUpload));
    const file = new File(["content"], "avatar.jpg", { type: "image/jpeg" });

    const uploadPromise = upload.upload(file);
    expect(upload.isValidating.value).toBe(true);

    await vi.waitFor(() => {
      expect(typeof uploadPromiseResolve).toBe("function");
    });

    uploadPromiseResolve({
      url: "https://cdn.example.com/file.jpg",
      key: "file.jpg",
    });

    await uploadPromise;
    await nextTick();

    expect(upload.isValidating.value).toBe(false);
  });

  it("should support setValue method for field", async () => {
    const { upload } = mountUpload(() => useBitUpload("avatar", mockUpload));

    upload.setValue("https://external-cdn.com/avatar.jpg");
    await nextTick();

    expect(upload.value.value).toBe("https://external-cdn.com/avatar.jpg");
  });
});
