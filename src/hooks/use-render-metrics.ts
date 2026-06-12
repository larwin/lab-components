import { useEffect, useRef, useState } from "react";

export interface RenderMetrics {
  /** Number of times the component has rendered since mount. */
  renderCount: number;
  /** Duration of the last commit, in milliseconds. */
  lastRenderMs: number;
  /** Mean render duration across all renders. */
  averageRenderMs: number;
}

/**
 * Tracks render count and approximate render duration for a component.
 *
 * Extension point: a future profiler engine can replace this with React's
 * <Profiler> onRender callback for true commit-phase timing.
 */
export function useRenderMetrics(): RenderMetrics {
  const renderCount = useRef(0);
  const startRef = useRef(typeof performance !== "undefined" ? performance.now() : Date.now());
  const durations = useRef<number[]>([]);
  const [, force] = useState(0);

  renderCount.current += 1;

  useEffect(() => {
    const end = typeof performance !== "undefined" ? performance.now() : Date.now();
    const dur = end - startRef.current;
    durations.current.push(dur);
    // Reset the clock for the next render.
    startRef.current = end;
  });

  // Expose a way for benchmarks to nudge a rerender without external state.
  void force;

  const list = durations.current;
  const last = list.length ? list[list.length - 1] : 0;
  const avg = list.length ? list.reduce((a, b) => a + b, 0) / list.length : 0;

  return {
    renderCount: renderCount.current,
    lastRenderMs: last,
    averageRenderMs: avg,
  };
}
