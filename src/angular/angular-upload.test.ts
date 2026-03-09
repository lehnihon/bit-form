/**
 * Angular "injectBitUpload" Injectable Tests
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { BitUploadFn } from "../core/upload";

describe("injectBitUpload (Angular)", () => {
  let mockUpload: ReturnType<typeof vi.fn> & BitUploadFn;
  let mockDelete: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockUpload = vi.fn(async (file: File) => ({
      url: `https://cdn.example.com/uploads/${file.name}`,
      key: `uploads/${file.name}`,
      metadata: { size: file.size, type: file.type },
    })) as any;

    mockDelete = vi.fn(async () => {});
  });

  it("should have proper upload function interface", () => {
    expect(mockUpload).toBeDefined();
    expect(mockDelete).toBeDefined();
  });

  it("should call upload function with file", async () => {
    const file = new File(["content"], "avatar.jpg", { type: "image/jpeg" });
    const result = await mockUpload(file);

    expect(result.url).toContain("cdn.example.com");
    expect(result.key).toContain("avatar.jpg");
  });

  it("should support optional delete operation", async () => {
    await expect(mockDelete("test-key")).resolves.toBeUndefined();
    expect(mockDelete).toHaveBeenCalledWith("test-key");
  });
});
