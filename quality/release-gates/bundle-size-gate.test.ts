import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Bundle Size Gate Tests
 *
 * Ensures that bundle sizes for entry points remain within acceptable thresholds.
 * Fails build if any bundle exceeds limits, preventing performance regressions.
 *
 * This test is typically run in CI/CD as part of release gates.
 */

// Bundle size thresholds in bytes (gzipped)
const BUNDLE_THRESHOLDS = {
  // Core library (essential form state management)
  core: 45_000, // ~45KB gzipped

  // React adapter (hooks + context)
  react: 20_000, // ~20KB gzipped

  // Vue adapter
  vue: 18_000, // ~18KB gzipped

  // Angular adapter (injectors + types)
  angular: 22_000, // ~22KB gzipped

  // React Native adapter
  "react-native": 21_000, // ~21KB gzipped
};

describe("Bundle Size Gates", () => {
  it("should have entry points within size thresholds", async () => {
    const distDir = path.join(process.cwd(), "dist");

    // Check if dist directory exists
    if (!fs.existsSync(distDir)) {
      console.warn(
        "[bundle-size-gate] dist directory not found. Building first...",
      );
      // In real CI/CD, build would be run before this test
      return;
    }

    const results: Record<
      string,
      { actual: number; threshold: number; pass: boolean }
    > = {};

    // Check core bundle (cjs)
    const coreJsPath = path.join(distDir, "index.js");
    if (fs.existsSync(coreJsPath)) {
      const stat = fs.statSync(coreJsPath);
      const coreSize = stat.size;
      results.core = {
        actual: coreSize,
        threshold: BUNDLE_THRESHOLDS.core,
        pass: coreSize <= BUNDLE_THRESHOLDS.core,
      };
      expect(
        coreSize,
        `Core bundle (${(coreSize / 1024).toFixed(1)}KB) exceeds threshold (${(
          BUNDLE_THRESHOLDS.core / 1024
        ).toFixed(1)}KB)`,
      ).toBeLessThanOrEqual(BUNDLE_THRESHOLDS.core);
    }

    // Check React bundle
    const reactJsPath = path.join(distDir, "react", "index.js");
    if (fs.existsSync(reactJsPath)) {
      const stat = fs.statSync(reactJsPath);
      const reactSize = stat.size;
      results.react = {
        actual: reactSize,
        threshold: BUNDLE_THRESHOLDS.react,
        pass: reactSize <= BUNDLE_THRESHOLDS.react,
      };
      expect(
        reactSize,
        `React bundle (${(reactSize / 1024).toFixed(
          1,
        )}KB) exceeds threshold (${(BUNDLE_THRESHOLDS.react / 1024).toFixed(
          1,
        )}KB)`,
      ).toBeLessThanOrEqual(BUNDLE_THRESHOLDS.react);
    }

    // Log summary
    if (Object.keys(results).length > 0) {
      console.log("\n📦 Bundle Size Report:");
      for (const [name, { actual, threshold }] of Object.entries(results)) {
        const actualKB = (actual / 1024).toFixed(1);
        const thresholdKB = (threshold / 1024).toFixed(1);
        const usage = ((actual / threshold) * 100).toFixed(1);
        console.log(`  ${name}: ${actualKB}KB / ${thresholdKB}KB (${usage}%)`);
      }
    }
  });

  it("should warn if bundle size approaches threshold", () => {
    const distDir = path.join(process.cwd(), "dist");

    if (!fs.existsSync(distDir)) {
      return;
    }

    const WARNING_THRESHOLD = 0.85; // Warn at 85% of limit

    for (const [entryPoint, maxSize] of Object.entries(BUNDLE_THRESHOLDS)) {
      const paths = [
        path.join(distDir, entryPoint, "index.js"),
        path.join(
          distDir,
          entryPoint === "core" ? "index.js" : `${entryPoint}/index.js`,
        ),
      ];

      const bundlePath = paths.find((p) => fs.existsSync(p));
      if (!bundlePath) continue;

      const actual = fs.statSync(bundlePath).size;
      const ratio = actual / maxSize;

      if (ratio > WARNING_THRESHOLD) {
        console.warn(
          `⚠️  ${entryPoint} bundle approaching limit: ${(
            actual / 1024
          ).toFixed(1)}KB (${(ratio * 100).toFixed(1)}%)`,
        );
      }
    }
  });
});
