import { describe, expect, it } from "vitest";
import {
  formatSampleSummary,
  runMeasuredScenarioWithLifecycle,
} from "./_shared/stats";
import {
  createBitFormAsyncBurstHarness,
  createBitFormBulkHarness,
  createFormikAsyncBurstHarness,
  createFormikBulkHarness,
  createRhfAsyncBurstHarness,
  createRhfBulkHarness,
  createTanstackAsyncBurstHarness,
  createTanstackBulkHarness,
} from "./_shared/scenarios";

describe("quality benchmark: bit-form vs react-hook-form/formik/tanstack", () => {
  it("compares bulk update scenario with robust percentiles", async () => {
    const bitSample = await runMeasuredScenarioWithLifecycle(
      "bit-form bulk update (300)",
      {
        setup: () => createBitFormBulkHarness(300),
        run: (harness) => harness.run(),
        teardown: (harness) => harness.teardown?.(),
      },
      { warmups: 5, samples: 30 },
    );

    const rhfSample = await runMeasuredScenarioWithLifecycle(
      "rhf bulk update (300)",
      {
        setup: () => createRhfBulkHarness(300),
        run: (harness) => harness.run(),
        teardown: (harness) => harness.teardown?.(),
      },
      { warmups: 5, samples: 30 },
    );

    const formikSample = await runMeasuredScenarioWithLifecycle(
      "formik bulk update (300)",
      {
        setup: () => createFormikBulkHarness(300),
        run: (harness) => harness.run(),
        teardown: (harness) => harness.teardown?.(),
      },
      { warmups: 5, samples: 30 },
    );

    const tanstackSample = await runMeasuredScenarioWithLifecycle(
      "tanstack bulk update (300)",
      {
        setup: () => createTanstackBulkHarness(300),
        run: (harness) => harness.run(),
        teardown: (harness) => harness.teardown?.(),
      },
      { warmups: 5, samples: 30 },
    );

    const ratioMedian = bitSample.medianMs / rhfSample.medianMs;
    const ratioP95 = bitSample.p95Ms / rhfSample.p95Ms;
    const ratioFormikMedian = bitSample.medianMs / formikSample.medianMs;
    const ratioFormikP95 = bitSample.p95Ms / formikSample.p95Ms;
    const ratioTanstackMedian = bitSample.medianMs / tanstackSample.medianMs;
    const ratioTanstackP95 = bitSample.p95Ms / tanstackSample.p95Ms;

    console.table([
      formatSampleSummary(bitSample),
      formatSampleSummary(rhfSample),
      formatSampleSummary(formikSample),
      formatSampleSummary(tanstackSample),
      {
        scenario: "ratio bit/rhf",
        medianMs: Number(ratioMedian.toFixed(2)),
        p95Ms: Number(ratioP95.toFixed(2)),
        minMs: 0,
        maxMs: 0,
      },
      {
        scenario: "ratio bit/formik",
        medianMs: Number(ratioFormikMedian.toFixed(2)),
        p95Ms: Number(ratioFormikP95.toFixed(2)),
        minMs: 0,
        maxMs: 0,
      },
      {
        scenario: "ratio bit/tanstack",
        medianMs: Number(ratioTanstackMedian.toFixed(2)),
        p95Ms: Number(ratioTanstackP95.toFixed(2)),
        minMs: 0,
        maxMs: 0,
      },
    ]);

    expect(Number.isFinite(ratioMedian)).toBe(true);
    expect(Number.isFinite(ratioP95)).toBe(true);
    expect(Number.isFinite(ratioFormikMedian)).toBe(true);
    expect(Number.isFinite(ratioFormikP95)).toBe(true);
    expect(Number.isFinite(ratioTanstackMedian)).toBe(true);
    expect(Number.isFinite(ratioTanstackP95)).toBe(true);
    expect(bitSample.medianMs).toBeGreaterThanOrEqual(0);
    expect(rhfSample.medianMs).toBeGreaterThanOrEqual(0);
    expect(formikSample.medianMs).toBeGreaterThanOrEqual(0);
    expect(tanstackSample.medianMs).toBeGreaterThanOrEqual(0);
    expect(ratioMedian).toBeLessThan(0.5);
    expect(ratioP95).toBeLessThan(0.6);
  });

  it("compares async burst scenario with robust percentiles", async () => {
    const bitSample = await runMeasuredScenarioWithLifecycle(
      "bit-form async burst (120)",
      {
        setup: () => createBitFormAsyncBurstHarness(120),
        run: (harness) => harness.run(),
        teardown: (harness) => harness.teardown?.(),
      },
      { warmups: 5, samples: 25 },
    );

    const rhfSample = await runMeasuredScenarioWithLifecycle(
      "rhf async burst (120)",
      {
        setup: () => createRhfAsyncBurstHarness(120),
        run: (harness) => harness.run(),
        teardown: (harness) => harness.teardown?.(),
      },
      { warmups: 5, samples: 25 },
    );

    const formikSample = await runMeasuredScenarioWithLifecycle(
      "formik async burst (120)",
      {
        setup: () => createFormikAsyncBurstHarness(120),
        run: (harness) => harness.run(),
        teardown: (harness) => harness.teardown?.(),
      },
      { warmups: 5, samples: 25 },
    );

    const tanstackSample = await runMeasuredScenarioWithLifecycle(
      "tanstack async burst (120)",
      {
        setup: () => createTanstackAsyncBurstHarness(120),
        run: (harness) => harness.run(),
        teardown: (harness) => harness.teardown?.(),
      },
      { warmups: 5, samples: 25 },
    );

    const ratioMedian = bitSample.medianMs / rhfSample.medianMs;
    const ratioP95 = bitSample.p95Ms / rhfSample.p95Ms;
    const ratioFormikMedian = bitSample.medianMs / formikSample.medianMs;
    const ratioFormikP95 = bitSample.p95Ms / formikSample.p95Ms;
    const ratioTanstackMedian = bitSample.medianMs / tanstackSample.medianMs;
    const ratioTanstackP95 = bitSample.p95Ms / tanstackSample.p95Ms;

    console.table([
      formatSampleSummary(bitSample),
      formatSampleSummary(rhfSample),
      formatSampleSummary(formikSample),
      formatSampleSummary(tanstackSample),
      {
        scenario: "ratio bit/rhf",
        medianMs: Number(ratioMedian.toFixed(2)),
        p95Ms: Number(ratioP95.toFixed(2)),
        minMs: 0,
        maxMs: 0,
      },
      {
        scenario: "ratio bit/formik",
        medianMs: Number(ratioFormikMedian.toFixed(2)),
        p95Ms: Number(ratioFormikP95.toFixed(2)),
        minMs: 0,
        maxMs: 0,
      },
      {
        scenario: "ratio bit/tanstack",
        medianMs: Number(ratioTanstackMedian.toFixed(2)),
        p95Ms: Number(ratioTanstackP95.toFixed(2)),
        minMs: 0,
        maxMs: 0,
      },
    ]);

    expect(Number.isFinite(ratioMedian)).toBe(true);
    expect(Number.isFinite(ratioP95)).toBe(true);
    expect(Number.isFinite(ratioFormikMedian)).toBe(true);
    expect(Number.isFinite(ratioFormikP95)).toBe(true);
    expect(Number.isFinite(ratioTanstackMedian)).toBe(true);
    expect(Number.isFinite(ratioTanstackP95)).toBe(true);
    expect(bitSample.p95Ms).toBeGreaterThanOrEqual(0);
    expect(rhfSample.p95Ms).toBeGreaterThanOrEqual(0);
    expect(formikSample.p95Ms).toBeGreaterThanOrEqual(0);
    expect(tanstackSample.p95Ms).toBeGreaterThanOrEqual(0);
    expect(ratioMedian).toBeLessThan(0.8);
    expect(ratioP95).toBeLessThan(0.9);
  });
});
