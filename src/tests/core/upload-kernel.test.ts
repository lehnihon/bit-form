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
});
