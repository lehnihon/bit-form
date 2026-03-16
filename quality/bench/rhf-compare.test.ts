import { describe, expect, it } from "vitest";
import { formatSampleSummary, runMeasuredScenario } from "./_shared/stats";
import {
  runBitFormAsyncBurst,
  runBitFormBulkUpdate,
  runRhfAsyncBurst,
  runRhfBulkUpdate,
} from "./_shared/scenarios";

describe("quality benchmark: bit-form vs react-hook-form", () => {
  it("compares bulk update scenario with robust percentiles", async () => {
    const bitSample = await runMeasuredScenario(
      "bit-form bulk update (300)",
      () => runBitFormBulkUpdate(300),
      { warmups: 5, samples: 30 },
    );

    const rhfSample = await runMeasuredScenario(
      "rhf bulk update (300)",
      () => runRhfBulkUpdate(300),
      { warmups: 5, samples: 30 },
    );

    const ratioMedian = bitSample.medianMs / rhfSample.medianMs;
    const ratioP95 = bitSample.p95Ms / rhfSample.p95Ms;

    console.table([
      formatSampleSummary(bitSample),
      formatSampleSummary(rhfSample),
      {
        scenario: "ratio bit/rhf",
        medianMs: Number(ratioMedian.toFixed(2)),
        p95Ms: Number(ratioP95.toFixed(2)),
        minMs: 0,
        maxMs: 0,
      },
    ]);

    expect(Number.isFinite(ratioMedian)).toBe(true);
    expect(Number.isFinite(ratioP95)).toBe(true);
    expect(bitSample.medianMs).toBeGreaterThanOrEqual(0);
    expect(rhfSample.medianMs).toBeGreaterThanOrEqual(0);
  });

  it("compares async burst scenario with robust percentiles", async () => {
    const bitSample = await runMeasuredScenario(
      "bit-form async burst (120)",
      () => runBitFormAsyncBurst(120),
      { warmups: 5, samples: 25 },
    );

    const rhfSample = await runMeasuredScenario(
      "rhf async burst (120)",
      () => runRhfAsyncBurst(120),
      { warmups: 5, samples: 25 },
    );

    const ratioMedian = bitSample.medianMs / rhfSample.medianMs;
    const ratioP95 = bitSample.p95Ms / rhfSample.p95Ms;

    console.table([
      formatSampleSummary(bitSample),
      formatSampleSummary(rhfSample),
      {
        scenario: "ratio bit/rhf",
        medianMs: Number(ratioMedian.toFixed(2)),
        p95Ms: Number(ratioP95.toFixed(2)),
        minMs: 0,
        maxMs: 0,
      },
    ]);

    expect(Number.isFinite(ratioMedian)).toBe(true);
    expect(Number.isFinite(ratioP95)).toBe(true);
    expect(bitSample.p95Ms).toBeGreaterThanOrEqual(0);
    expect(rhfSample.p95Ms).toBeGreaterThanOrEqual(0);
  });
});
