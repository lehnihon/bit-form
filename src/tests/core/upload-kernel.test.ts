import { describe, expect, it, vi } from "vitest";
import { createUploadHandler } from "../../core/adapters/upload-kernel";

function makeCallbacks() {
  return {
    setLoading: vi.fn(),
    setError: vi.fn(),
    setValue: vi.fn(),
    getUploadKey: vi.fn().mockReturnValue(null),
    setUploadKey: vi.fn(),
  };
}

describe("createUploadHandler", () => {
  it("commits upload result when only one upload is in flight", async () => {
    const uploadFn = vi.fn().mockResolvedValue({
      url: "https://cdn.example.com/file.jpg",
      key: "uploads/file.jpg",
    });
    const callbacks = makeCallbacks();
    const handler = createUploadHandler("avatar", uploadFn as any, callbacks);

    await handler(new File(["a"], "file.jpg"));

    expect(callbacks.setValue).toHaveBeenCalledWith(
      "https://cdn.example.com/file.jpg",
    );
    expect(callbacks.setUploadKey).toHaveBeenCalledWith("uploads/file.jpg");
    expect(callbacks.setLoading).toHaveBeenLastCalledWith(false);
  });

  it("descarta resultado stale quando segundo upload resolve antes do primeiro (race condition)", async () => {
    let resolveFirst!: (r: { url: string; key: string }) => void;
    let resolveSecond!: (r: { url: string; key: string }) => void;

    const uploadFn = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<{ url: string; key: string }>((res) => {
            resolveFirst = res;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise<{ url: string; key: string }>((res) => {
            resolveSecond = res;
          }),
      );

    const callbacks = makeCallbacks();
    const handler = createUploadHandler("avatar", uploadFn as any, callbacks);

    // Dispara dois uploads em sequência sem aguardar o primeiro
    const first = handler(new File(["a"], "first.jpg"));
    const second = handler(new File(["b"], "second.jpg"));

    // Segundo upload resolve antes do primeiro
    resolveSecond({ url: "https://cdn.example.com/second.jpg", key: "second" });
    await second;

    // Primeiro upload resolve depois (resultado stale)
    resolveFirst({ url: "https://cdn.example.com/first.jpg", key: "first" });
    await first;

    // Somente o resultado do segundo upload deve ter sido commitado
    expect(callbacks.setValue).toHaveBeenCalledTimes(1);
    expect(callbacks.setValue).toHaveBeenCalledWith(
      "https://cdn.example.com/second.jpg",
    );
    expect(callbacks.setUploadKey).toHaveBeenCalledTimes(1);
    expect(callbacks.setUploadKey).toHaveBeenCalledWith("second");
  });

  it("seta loading=false somente para o upload mais recente quando o stale completa depois", async () => {
    let resolveFirst!: (r: { url: string; key: string }) => void;
    let resolveSecond!: (r: { url: string; key: string }) => void;

    const uploadFn = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<{ url: string; key: string }>((res) => {
            resolveFirst = res;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise<{ url: string; key: string }>((res) => {
            resolveSecond = res;
          }),
      );

    const callbacks = makeCallbacks();
    const handler = createUploadHandler("avatar", uploadFn as any, callbacks);

    const first = handler(new File(["a"], "first.jpg"));
    const second = handler(new File(["b"], "second.jpg"));

    resolveSecond({ url: "https://cdn.example.com/second.jpg", key: "second" });
    await second;

    resolveFirst({ url: "https://cdn.example.com/first.jpg", key: "first" });
    await first;

    // setLoading(false) deve ter sido chamado exatamente uma vez (pelo segundo)
    const loadingCalls = callbacks.setLoading.mock.calls;
    const falseCount = loadingCalls.filter(([v]) => v === false).length;
    expect(falseCount).toBe(1);
  });

  describe("Error Resilience", () => {
    it("should complete upload despite callback errors and reset loading state", async () => {
      const failingCallback = vi.fn(() => {
        throw new Error("Callback error");
      });

      const setLoading = vi.fn().mockImplementation(failingCallback);
      const setError = vi.fn();
      const setValue = vi.fn();
      const setUploadKey = vi.fn();
      const getUploadKey = vi.fn(() => null);

      const uploadFn = vi.fn(async () => ({
        url: "https://example.com/file.jpg",
        key: "file-key-123",
      }));

      const handler = createUploadHandler("avatar", uploadFn, {
        setLoading,
        setError,
        setValue,
        setUploadKey,
        getUploadKey,
      });

      const file = new File(["content"], "test.jpg", { type: "image/jpeg" });

      await handler(file);

      expect(setLoading).toHaveBeenCalledWith(true);
      expect(setLoading).toHaveBeenCalledWith(false);
      expect(setValue).toHaveBeenCalledWith("https://example.com/file.jpg");
    });

    it("should not leave isLoading true when callbacks throw on success path", async () => {
      let callCount = 0;
      const setLoading = vi.fn((..._args) => {
        callCount++;
        if (callCount === 1) {
          throw new Error("setLoading error on start");
        }
      });
      const setError = vi.fn();
      const setValue = vi.fn(() => {
        throw new Error("setValue callback error");
      });
      const setUploadKey = vi.fn();
      const getUploadKey = vi.fn(() => null);

      const uploadFn = vi.fn(async () => ({
        url: "https://example.com/file.jpg",
        key: "file-key-123",
      }));

      const handler = createUploadHandler("photo", uploadFn, {
        setLoading,
        setError,
        setValue,
        setUploadKey,
        getUploadKey,
      });

      const file = new File(["content"], "photo.jpg");

      await handler(file);

      expect(setLoading).toHaveBeenCalledTimes(2);
      expect(setLoading).toHaveBeenLastCalledWith(false);
    });

    it("should handle concurrent upload callbacks without state leakage", async () => {
      const setLoading = vi.fn();
      const setError = vi.fn();
      const setValue = vi.fn();
      const setUploadKey = vi.fn();
      const getUploadKey = vi.fn(() => null);

      const uploadFn = vi.fn(async () => ({
        url: "https://example.com/file.jpg",
        key: "file-key-123",
      }));

      const handler = createUploadHandler("file", uploadFn, {
        setLoading,
        setError,
        setValue,
        setUploadKey,
        getUploadKey,
      });

      const file1 = new File(["1"], "file1.jpg");
      const file2 = new File(["2"], "file2.jpg");

      const [result1, result2] = await Promise.all([
        handler(file1),
        handler(file2),
      ]);

      expect(setLoading).toHaveBeenCalledWith(false);
      expect(result1).toBeUndefined();
      expect(result2).toBeUndefined();
    });

    it("should reset loading even when error callback throws", async () => {
      const setLoading = vi.fn();
      const setError = vi.fn(() => {
        throw new Error("setError failed");
      });
      const setValue = vi.fn();
      const setUploadKey = vi.fn();
      const getUploadKey = vi.fn(() => null);

      const uploadFn = vi.fn(async () => {
        throw new Error("Upload failed");
      });

      const handler = createUploadHandler("avatar", uploadFn, {
        setLoading,
        setError,
        setValue,
        setUploadKey,
        getUploadKey,
      });

      const file = new File(["content"], "avatar.jpg");

      await handler(file);

      expect(setLoading).toHaveBeenCalledWith(true);
      expect(setLoading).toHaveBeenLastCalledWith(false);
    });
  });
});
