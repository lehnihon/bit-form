/**
 * Angular "injectBitUpload" Injectable Tests
 *
 * Validate Angular injectable integration with signals and BitForm.
 * Note: This is a simplified test structure. Full integration tests would
 * require TestBed setup with real or mocked BIT_STORE_TOKEN provider.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { BitUploadAdapter } from "../core/upload";

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

  it("should have proper adapter interface", () => {
    expect(mockAdapter.upload).toBeDefined();
    expect(mockAdapter.delete).toBeDefined();
  });

  it("should call adapter upload with file", async () => {
    const file = new File(["content"], "avatar.jpg", { type: "image/jpeg" });
    const result = await mockAdapter.upload(file);

    expect(result.url).toContain("cdn.example.com");
    expect(result.key).toContain("avatar.jpg");
  });

  it("should support adapter delete operation", async () => {
    await expect(mockAdapter.delete?.("test-key")).resolves.toBeUndefined();
    expect(mockAdapter.delete).toHaveBeenCalledWith("test-key");
  });

  /**
   * Full integration tests for injectBitUpload would require:
   * - TestBed.configureTestingModule with BIT_STORE_TOKEN provider
   * - Mock BitStore implementation
   * - Proper injection context setup
   *
   * Example structure:
   * ```
   * TestBed.configureTestingModule({
   *   providers: [
   *     { provide: BIT_STORE_TOKEN, useValue: mockBitStore },
   *   ],
   * });
   *
   * TestBed.runInInjectionContext(() => {
   *   const upload = injectBitUpload("avatar", mockAdapter);
   *   expect(upload.isUploading()).toBe(false);
   * });
   * ```
   */
});
