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
  settleReactCommit,
} from "./_shared/scenarios";

const BULK_FIELDS = Number(process.env.BENCH_COMPARE_BULK_FIELDS ?? 600);
const ASYNC_ITERATIONS = Number(
  process.env.BENCH_COMPARE_ASYNC_ITERATIONS ?? 240,
);
const WARMUPS = Number(process.env.BENCH_COMPARE_WARMUPS ?? 8);
const SAMPLES = Number(process.env.BENCH_COMPARE_SAMPLES ?? 40);

const realisticBenchOptions = {
  warmups: WARMUPS,
  samples: SAMPLES,
  settleBeforeEach: settleReactCommit,
  settleAfterEach: settleReactCommit,
};

const TEST_TIMEOUT_MS = Number(
  process.env.BENCH_COMPARE_TEST_TIMEOUT_MS ?? 300_000,
);

describe("quality benchmark: bit-form vs react-hook-form/formik/tanstack", () => {
  it(
    "compares bulk update scenario with robust percentiles",
    async () => {
      const bitSample = await runMeasuredScenarioWithLifecycle(
        `bit-form bulk update (${BULK_FIELDS})`,
        {
          setup: () => createBitFormBulkHarness(BULK_FIELDS),
          run: (harness) => harness.run(),
          teardown: (harness) => harness.teardown?.(),
        },
        realisticBenchOptions,
      );

      const rhfSample = await runMeasuredScenarioWithLifecycle(
        `rhf bulk update (${BULK_FIELDS})`,
        {
          setup: () => createRhfBulkHarness(BULK_FIELDS),
          run: (harness) => harness.run(),
          teardown: (harness) => harness.teardown?.(),
        },
        realisticBenchOptions,
      );

      const formikSample = await runMeasuredScenarioWithLifecycle(
        `formik bulk update (${BULK_FIELDS})`,
        {
          setup: () => createFormikBulkHarness(BULK_FIELDS),
          run: (harness) => harness.run(),
          teardown: (harness) => harness.teardown?.(),
        },
        realisticBenchOptions,
      );

      const tanstackSample = await runMeasuredScenarioWithLifecycle(
        `tanstack bulk update (${BULK_FIELDS})`,
        {
          setup: () => createTanstackBulkHarness(BULK_FIELDS),
          run: (harness) => harness.run(),
          teardown: (harness) => harness.teardown?.(),
        },
        realisticBenchOptions,
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
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "compares async burst scenario with robust percentiles",
    async () => {
      const bitSample = await runMeasuredScenarioWithLifecycle(
        `bit-form async burst (${ASYNC_ITERATIONS})`,
        {
          setup: () => createBitFormAsyncBurstHarness(ASYNC_ITERATIONS),
          run: (harness) => harness.run(),
          teardown: (harness) => harness.teardown?.(),
        },
        realisticBenchOptions,
      );

      const rhfSample = await runMeasuredScenarioWithLifecycle(
        `rhf async burst (${ASYNC_ITERATIONS})`,
        {
          setup: () => createRhfAsyncBurstHarness(ASYNC_ITERATIONS),
          run: (harness) => harness.run(),
          teardown: (harness) => harness.teardown?.(),
        },
        realisticBenchOptions,
      );

      const formikSample = await runMeasuredScenarioWithLifecycle(
        `formik async burst (${ASYNC_ITERATIONS})`,
        {
          setup: () => createFormikAsyncBurstHarness(ASYNC_ITERATIONS),
          run: (harness) => harness.run(),
          teardown: (harness) => harness.teardown?.(),
        },
        realisticBenchOptions,
      );

      const tanstackSample = await runMeasuredScenarioWithLifecycle(
        `tanstack async burst (${ASYNC_ITERATIONS})`,
        {
          setup: () => createTanstackAsyncBurstHarness(ASYNC_ITERATIONS),
          run: (harness) => harness.run(),
          teardown: (harness) => harness.teardown?.(),
        },
        realisticBenchOptions,
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
      // bit-form deve ser significativamente mais rápido que RHF no async
      expect(ratioMedian).toBeLessThan(0.8);
      expect(ratioP95).toBeLessThan(0.9);
      // vs TanStack: cenário similar, limite generoso (dentro de 1.5x em qualquer direção)
      expect(ratioTanstackMedian).toBeLessThan(1.5);
      expect(ratioTanstackP95).toBeLessThan(1.5);
    },
    TEST_TIMEOUT_MS,
  );
});
