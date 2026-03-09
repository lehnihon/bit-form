/**
 * Angular "injectBitUpload" Injectable Tests
 *
 * Validate Angular injectable integration with signals and BitForm.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { runInInjectionContext, createInjector } from "@angular/core/testing";
import { injectBitUpload } from "../../../../../src/angular/inject-bit-upload";
import type { BitUploadAdapter } from "../../../../../src/core/upload";

describe("injectBitUpload (Angular)", () => {
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

  it("should initialize upload signals with default state", () => {
    runInInjectionContext(createInjector([]), () => {
      const upload = injectBitUpload("avatar", mockAdapter);

      expect(upload.isUploading()).toBe(false);
      expect(upload.uploadProgress()).toEqual({ loaded: 0, total: 0 });
      expect(upload.uploadError()).toBeNull();
      expect(upload.uploadKey()).toBeNull();
    });
  });

  it("should upload file and update signals", async () => {
    runInInjectionContext(createInjector([]), () => {
      const upload = injectBitUpload("avatar", mockAdapter);
      const file = new File(["content"], "avatar.jpg", { type: "image/jpeg" });

      upload.handleUploadFile(file).then(() => {
        expect(mockAdapter.upload).toHaveBeenCalledWith(
          file,
          expect.objectContaining({}),
        );
      });
    });
  });

  it("should track upload progress with signal", async () => {
    let progressCallback: any;
    mockAdapter.upload = vi.fn(async (file: File, opts: any) => {
      progressCallback = opts.onProgress;
      progressCallback({ loaded: 50, total: 100 });
      return {
        url: "https://cdn.example.com/file.jpg",
        key: "file.jpg",
      };
    });

    runInInjectionContext(createInjector([]), () => {
      const upload = injectBitUpload("avatar", mockAdapter);
      const file = new File(["content"], "avatar.jpg", { type: "image/jpeg" });

      upload.handleUploadFile(file).then(() => {
        const progress = upload.uploadProgress();
        expect(progress.loaded).toBeGreaterThan(0);
      });
    });
  });

  it("should handle upload errors", async () => {
    mockAdapter.upload = vi.fn(async () => {
      throw new Error("Network error");
    });

    runInInjectionContext(createInjector([]), () => {
      const upload = injectBitUpload("avatar", mockAdapter);
      const file = new File(["content"], "avatar.jpg", { type: "image/jpeg" });

      upload.handleUploadFile(file).catch(() => {
        expect(upload.uploadError()).not.toBeNull();
        expect(upload.uploadError()?.message).toContain("Network");
      });
    });
  });

  it("should remove uploaded file with signal update", async () => {
    runInInjectionContext(createInjector([]), () => {
      const upload = injectBitUpload("avatar", mockAdapter);
      const file = new File(["content"], "avatar.jpg", { type: "image/jpeg" });

      upload.handleUploadFile(file).then(async () => {
        expect(upload.uploadKey()).toBeDefined();

        await upload.handleRemoveFile();

        expect(mockAdapter.delete).toHaveBeenCalledWith("uploads/avatar.jpg");
        expect(upload.uploadKey()).toBeNull();
      });
    });
  });

  it("should expose field signals (value, error, isValidating)", () => {
    runInInjectionContext(createInjector([]), () => {
      const upload = injectBitUpload("avatar", mockAdapter);

      // Field signals
      expect(typeof upload.value).toBe("function"); // Signal getter
      expect(typeof upload.error).toBe("function");
      expect(typeof upload.isValidating).toBe("function");

      // Upload signals
      expect(typeof upload.isUploading).toBe("function");
      expect(typeof upload.uploadProgress).toBe("function");
      expect(typeof upload.uploadError).toBe("function");
      expect(typeof upload.uploadKey).toBe("function");
    });
  });

  it("should allow custom options", () => {
    runInInjectionContext(createInjector([]), () => {
      const upload = injectBitUpload("avatar", mockAdapter, {
        folder: "avatars",
      });
      const file = new File(["content"], "avatar.jpg", { type: "image/jpeg" });

      upload.handleUploadFile(file).then(() => {
        expect(mockAdapter.upload).toHaveBeenCalledWith(
          file,
          expect.objectContaining({ folder: "avatars" }),
        );
      });
    });
  });

  it("should set isUploading signal during upload", async () => {
    let uploadPromiseResolve: any;
    mockAdapter.upload = vi.fn(
      () =>
        new Promise((resolve) => {
          uploadPromiseResolve = resolve;
        }),
    );

    runInInjectionContext(createInjector([]), () => {
      const upload = injectBitUpload("avatar", mockAdapter);
      const file = new File(["content"], "avatar.jpg", { type: "image/jpeg" });

      const uploadPromise = upload.handleUploadFile(file);

      expect(upload.isUploading()).toBe(true);

      uploadPromiseResolve({
        url: "https://cdn.example.com/file.jpg",
        key: "file.jpg",
      });

      uploadPromise.then(() => {
        expect(upload.isUploading()).toBe(false);
      });
    });
  });

  it("should support setValue method from field", () => {
    runInInjectionContext(createInjector([]), () => {
      const upload = injectBitUpload("avatar", mockAdapter);

      upload.setValue("https://external-cdn.com/avatar.jpg");

      expect(upload.value()).toBe("https://external-cdn.com/avatar.jpg");
    });
  });

  it("should compute percentage from progress signal", async () => {
    let progressCallback: any;
    mockAdapter.upload = vi.fn(async (file: File, opts: any) => {
      progressCallback = opts.onProgress;
      progressCallback({ loaded: 75, total: 100 });
      return {
        url: "https://cdn.example.com/file.jpg",
        key: "file.jpg",
      };
    });

    runInInjectionContext(createInjector([]), () => {
      const upload = injectBitUpload("avatar", mockAdapter);
      const file = new File(["content"], "avatar.jpg", { type: "image/jpeg" });

      upload.handleUploadFile(file).then(() => {
        const progress = upload.uploadProgress();
        expect(progress.percentage).toBe(75);
      });
    });
  });

  it("should not throw if adapter doesn't support delete", async () => {
    const adapterWithoutDelete = {
      upload: mockAdapter.upload,
    };

    runInInjectionContext(createInjector([]), () => {
      const upload = injectBitUpload("avatar", adapterWithoutDelete as any);
      const file = new File(["content"], "avatar.jpg", { type: "image/jpeg" });

      upload.handleUploadFile(file).then(async () => {
        expect(upload.uploadKey()).toBeDefined();

        await expect(upload.handleRemoveFile()).resolves.not.toThrow();

        expect(upload.uploadKey()).toBeNull();
      });
    });
  });
});
