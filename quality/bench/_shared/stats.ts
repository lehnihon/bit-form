export interface BenchmarkSample {
  name: string;
  valuesMs: number[];
  medianMs: number;
  p95Ms: number;
  minMs: number;
  maxMs: number;
}

export interface BenchmarkOptions {
  warmups?: number;
  samples?: number;
}

export function percentile(values: number[], target: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((target / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
}

export function median(values: number[]): number {
  return percentile(values, 50);
}

export async function runMeasuredScenario(
  name: string,
  fn: () => void | Promise<void>,
  options: BenchmarkOptions = {},
): Promise<BenchmarkSample> {
  const warmups = options.warmups ?? 5;
  const samples = options.samples ?? 30;

  for (let index = 0; index < warmups; index++) {
    await fn();
  }

  const valuesMs: number[] = [];

  for (let index = 0; index < samples; index++) {
    const start = performance.now();
    await fn();
    valuesMs.push(performance.now() - start);
  }

  return {
    name,
    valuesMs,
    medianMs: median(valuesMs),
    p95Ms: percentile(valuesMs, 95),
    minMs: Math.min(...valuesMs),
    maxMs: Math.max(...valuesMs),
  };
}

export function formatSampleSummary(sample: BenchmarkSample) {
  return {
    scenario: sample.name,
    medianMs: Number(sample.medianMs.toFixed(2)),
    p95Ms: Number(sample.p95Ms.toFixed(2)),
    minMs: Number(sample.minMs.toFixed(2)),
    maxMs: Number(sample.maxMs.toFixed(2)),
  };
}
