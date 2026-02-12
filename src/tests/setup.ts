import { vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import "zone.js";
import "zone.js/testing";
import { getTestBed } from "@angular/core/testing";
import {
  BrowserTestingModule,
  platformBrowserTesting,
} from "@angular/platform-browser/testing";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
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
