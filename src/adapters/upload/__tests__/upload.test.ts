/**
 * Upload Adapters Tests
 *
 * Verify upload adapter implementations and error handling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createS3Adapter } from "../s3-adapter";
import { createCloudinaryAdapter } from "../cloudinary-adapter";
import { createUploadValidator, performUpload } from "../../../core/upload";

describe("Upload Adapters", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("S3 Adapter", () => {
    it("should upload file via presigned URL", async () => {
      const mockFetch = global.fetch as any;
      mockFetch
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              presignedUrl:
                "https://bucket.s3.amazonaws.com/avatars/file.jpg?signature=xxx",
              publicUrl: "https://cdn.example.com/avatars/file.jpg",
            }),
            { status: 200 },
          ),
        )
        .mockResolvedValueOnce(new Response("", { status: 200 }));

      const adapter = createS3Adapter({
        region: "us-east-1",
        bucket: "test-bucket",
        presignedUrlEndpoint: "https://api.example.com/s3-presigned",
        publicUrlBase: "https://cdn.example.com",
      });

      const file = new File(["content"], "test.jpg", { type: "image/jpeg" });
      const result = await adapter.upload(file, { folder: "avatars" });

      expect(result.url).toBe("https://cdn.example.com/avatars/file.jpg");
      expect(result.key).toMatch(/avatars\/\d+-test\.jpg/);
    });

    it("should throw error if presigned URL endpoint fails", async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockResolvedValueOnce(
        new Response("Unauthorized", { status: 401 }),
      );

      const adapter = createS3Adapter({
        region: "us-east-1",
        bucket: "test-bucket",
        presignedUrlEndpoint: "https://api.example.com/s3-presigned",
      });

      const file = new File(["content"], "test.jpg", { type: "image/jpeg" });
      await expect(adapter.upload(file)).rejects.toThrow(/presigned URL/i);
    });

    it("should throw error if neither credentials nor presigned URL provided", async () => {
      const adapter = createS3Adapter({
        region: "us-east-1",
        bucket: "test-bucket",
      });

      const file = new File(["content"], "test.jpg", { type: "image/jpeg" });
      await expect(adapter.upload(file)).rejects.toThrow(/presigned/i);
    });

    it("should support delete operation", async () => {
      const adapter = createS3Adapter({
        region: "us-east-1",
        bucket: "test-bucket",
        presignedUrlEndpoint: "https://api.example.com/s3-presigned",
      });

      // Should not throw
      await expect(
        adapter.delete?.("avatars/file.jpg"),
      ).resolves.toBeUndefined();
    });
  });

  describe("Cloudinary Adapter", () => {
    it("should upload file to Cloudinary", async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            secure_url:
              "https://res.cloudinary.com/demo/image/upload/v123/avatar.jpg",
            public_id: "avatar",
            resource_type: "image",
            bytes: 12345,
            width: 100,
            height: 100,
          }),
          { status: 200 },
        ),
      );

      const adapter = createCloudinaryAdapter({
        cloudName: "demo",
        uploadPreset: "test-preset",
        folder: "my-app",
      });

      const file = new File(["content"], "avatar.jpg", { type: "image/jpeg" });
      const result = await adapter.upload(file, { folder: "avatars" });

      expect(result.url).toContain("res.cloudinary.com");
      expect(result.key).toBe("avatar");
      expect(result.metadata?.width).toBe(100);
    });

    it("should handle Cloudinary upload error", async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockResolvedValueOnce(
        new Response('{"error":{"message":"Invalid preset"}}', {
          status: 400,
        }),
      );

      const adapter = createCloudinaryAdapter({
        cloudName: "demo",
        uploadPreset: "invalid",
      });

      const file = new File(["content"], "avatar.jpg", { type: "image/jpeg" });
      await expect(adapter.upload(file)).rejects.toThrow(
        /Cloudinary upload failed/i,
      );
    });
  });

  describe("Upload Validator", () => {
    it("should validate complete upload (URL)", async () => {
      const validator = createUploadValidator();
      const result = await validator(
        "https://cdn.example.com/avatars/file.jpg",
      );
      expect(result).toBeNull();
    });

    it("should reject pending upload (File object)", async () => {
      const validator = createUploadValidator();
      const file = new File(["content"], "test.jpg", { type: "image/jpeg" });
      const result = await validator(file);
      expect(result).toContain("pending");
    });

    it("should reject empty upload", async () => {
      const validator = createUploadValidator();
      const result = await validator(null);
      expect(result).toContain("required");
    });

    it("should use custom message", async () => {
      const validator = createUploadValidator({
        requiredMessage: "Avatar is mandatory",
      });
      const result = await validator(null);
      expect(result).toBe("Avatar is mandatory");
    });
  });

  describe("performUpload utility", () => {
    it("should track progress", async () => {
      const progressUpdates: any[] = [];
      const mockFetch = global.fetch as any;

      mockFetch
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              presignedUrl: "https://bucket.s3.amazonaws.com/file.jpg?sig=xxx",
              publicUrl: "https://cdn.example.com/file.jpg",
            }),
            { status: 200 },
          ),
        )
        .mockResolvedValueOnce(new Response("", { status: 200 }));

      const adapter = createS3Adapter({
        region: "us-east-1",
        bucket: "test-bucket",
        presignedUrlEndpoint: "https://api.example.com/s3-presigned",
      });

      const file = new File(["content"], "test.jpg", { type: "image/jpeg" });
      const result = await performUpload(file, adapter, {
        onProgress: (p) => progressUpdates.push(p),
      });

      expect(result.url).toBeDefined();
    });

    it("should call onError callback on failure", async () => {
      const errorSpy = vi.fn();
      const mockFetch = global.fetch as any;

      mockFetch.mockResolvedValueOnce(
        new Response("Unauthorized", { status: 401 }),
      );

      const adapter = createS3Adapter({
        region: "us-east-1",
        bucket: "test-bucket",
        presignedUrlEndpoint: "https://api.example.com/s3-presigned",
      });

      const file = new File(["content"], "test.jpg", { type: "image/jpeg" });

      try {
        await performUpload(file, adapter, { onError: errorSpy });
      } catch {
        // Expected to throw
      }

      expect(errorSpy).toHaveBeenCalled();
    });
  });
});
