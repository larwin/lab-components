/**
 * Performance measurement utilities.
 *
 * These are intentionally tiny and dependency-free so they can be used inside
 * benchmarks, the Debug page, and future virtualization/grid engines without
 * pulling in heavy tooling.
 *
 * Extension point: a future "profiler engine" can wrap `measure` / `Timer`
 * to stream samples into a structured store.
 */

export interface TimingSample {
  label: string;
  /** Duration in milliseconds. */
  duration: number;
  timestamp: number;
}

const now = (): number => (typeof performance !== "undefined" ? performance.now() : Date.now());

/** Measure the synchronous execution time of `fn`. */
export function measure<T>(label: string, fn: () => T): { result: T; sample: TimingSample } {
  const start = now();
  const result = fn();
  const duration = now() - start;
  return { result, sample: { label, duration, timestamp: Date.now() } };
}

/** A reusable stopwatch for manual start/stop timing. */
export class Timer {
  private startedAt: number | null = null;
  constructor(public readonly label: string) {}

  start(): this {
    this.startedAt = now();
    return this;
  }

  stop(): TimingSample {
    const duration = this.startedAt === null ? 0 : now() - this.startedAt;
    this.startedAt = null;
    return { label: this.label, duration, timestamp: Date.now() };
  }
}

/** Format a millisecond duration into a compact human string. */
export function formatDuration(ms: number): string {
  if (ms < 1) return `${(ms * 1000).toFixed(0)}µs`;
  if (ms < 1000) return `${ms.toFixed(2)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

/** Standard dataset sizes used across the playground's performance areas. */
export const DATASET_SIZES = [100, 1_000, 10_000] as const;
export type DatasetSize = (typeof DATASET_SIZES)[number];
