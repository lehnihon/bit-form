/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createServerMock,
  listenMock,
  existsSyncMock,
  readFileSyncMock,
  attachDevToolsRelayMock,
  getDevToolsDashboardHtmlMock,
} = vi.hoisted(() => ({
  createServerMock: vi.fn(),
  listenMock: vi.fn(),
  existsSyncMock: vi.fn(),
  readFileSyncMock: vi.fn(),
  attachDevToolsRelayMock: vi.fn(),
  getDevToolsDashboardHtmlMock: vi.fn(() => "<html>dashboard</html>"),
}));

let requestHandler: ((req: { url?: string }, res: any) => void) | undefined;

vi.mock("node:http", () => ({
  default: {
    createServer: createServerMock,
  },
}));

vi.mock("node:fs", () => ({
  default: {
    existsSync: existsSyncMock,
    readFileSync: readFileSyncMock,
  },
}));

vi.mock("../../cli/devtools-relay", () => ({
  attachDevToolsRelay: attachDevToolsRelayMock,
}));

vi.mock("../../cli/devtools-dashboard", () => ({
  getDevToolsDashboardHtml: getDevToolsDashboardHtmlMock,
}));

import { startDevServer } from "../../cli/server";

function createMockResponse() {
  return {
    writeHead: vi.fn(),
    end: vi.fn(),
  };
}

describe("startDevServer static /dist", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requestHandler = undefined;

    createServerMock.mockImplementation((handler: typeof requestHandler) => {
      requestHandler = handler;
      return {
        listen: listenMock,
      };
    });
  });

  it("serve arquivo dentro de dist", () => {
    existsSyncMock.mockReturnValue(true);
    readFileSyncMock.mockReturnValue(Buffer.from("console.log('ok')"));

    startDevServer(3001);

    const res = createMockResponse();
    requestHandler?.({ url: "/dist/app.js" }, res);

    expect(existsSyncMock).toHaveBeenCalledTimes(1);
    expect(readFileSyncMock).toHaveBeenCalledTimes(1);
    expect(res.writeHead).toHaveBeenCalledWith(200, {
      "Content-Type": "application/javascript",
    });
  });

  it("bloqueia path traversal com ../", () => {
    startDevServer(3001);

    const res = createMockResponse();
    requestHandler?.({ url: "/dist/../../package.json" }, res);

    expect(res.writeHead).toHaveBeenCalledWith(403);
    expect(res.end).toHaveBeenCalledWith("Forbidden");
    expect(existsSyncMock).not.toHaveBeenCalled();
    expect(readFileSyncMock).not.toHaveBeenCalled();
  });

  it("bloqueia path traversal URL-encoded", () => {
    startDevServer(3001);

    const res = createMockResponse();
    requestHandler?.({ url: "/dist/%2e%2e/%2e%2e/package.json" }, res);

    expect(res.writeHead).toHaveBeenCalledWith(403);
    expect(res.end).toHaveBeenCalledWith("Forbidden");
    expect(existsSyncMock).not.toHaveBeenCalled();
    expect(readFileSyncMock).not.toHaveBeenCalled();
  });
});
