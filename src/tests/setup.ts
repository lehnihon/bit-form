import { vi, afterEach, beforeAll, afterAll } from "vitest";
import "@testing-library/jest-dom/vitest";
import "zone.js";
import "zone.js/testing";
import { getTestBed } from "@angular/core/testing";
import {
  BrowserTestingModule,
  platformBrowserTesting,
} from "@angular/platform-browser/testing";
import { cleanup } from "@testing-library/react";

const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

const shouldSilenceMessage = (message: string) =>
  message.includes("You called act(async () => ...) without await") ||
  message.includes("was not wrapped in act(...)") ||
  message.includes("components.json not found in project root");

beforeAll(() => {
  console.error = (...args: any[]) => {
    const message = args.map(String).join(" ");
    if (shouldSilenceMessage(message)) return;
    originalConsoleError(...args);
  };

  console.warn = (...args: any[]) => {
    const message = args.map(String).join(" ");
    if (shouldSilenceMessage(message)) return;
    originalConsoleWarn(...args);
  };
});

afterAll(() => {
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});

if (typeof window !== "undefined") {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

afterEach(() => {
  cleanup();
});

const testBed = getTestBed();
try {
  if (!testBed.platform) {
    testBed.initTestEnvironment(
      BrowserTestingModule,
      platformBrowserTesting(),
      {
        teardown: { destroyAfterEach: true },
      },
    );
  }
} catch (error) {}
