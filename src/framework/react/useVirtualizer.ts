import { useEffect, useMemo, useRef, useState } from "react";
import {
  createVirtualizer,
  type VirtualRange,
  type Virtualizer,
} from "../core/virtualization/virtualizer";

/**
 * React binding for the pure virtualizer. Scroll events are coalesced through
 * requestAnimationFrame, and re-renders only happen when the visible window
 * actually changes — scrolling inside the same window costs zero renders.
 */

export interface UseVirtualizerOptions {
  count: number;
  estimateSize: number | ((index: number) => number);
  overscan?: number;
  /** "vertical" reads scrollTop/clientHeight; "horizontal" the X equivalents. */
  axis?: "vertical" | "horizontal";
}

export interface VirtualizerHandle {
  range: VirtualRange;
  virtualizer: Virtualizer;
  scrollElementRef: (el: HTMLElement | null) => void;
  /** Measure an item's rendered size (dynamic heights). */
  measure(index: number, size: number): void;
  scrollToIndex(index: number, align?: "auto" | "start" | "center" | "end"): void;
}

export function useVirtualizer({
  count,
  estimateSize,
  overscan = 6,
  axis = "vertical",
}: UseVirtualizerOptions): VirtualizerHandle {
  const virtualizer = useMemo(
    () => createVirtualizer({ count, estimateSize, overscan }),
    [count, estimateSize, overscan],
  );

  const elementRef = useRef<HTMLElement | null>(null);
  const frame = useRef(0);
  const [range, setRange] = useState<VirtualRange>(() => virtualizer.range(0, 800));

  const readViewport = (el: HTMLElement) =>
    axis === "vertical"
      ? { offset: el.scrollTop, size: el.clientHeight }
      : { offset: el.scrollLeft, size: el.clientWidth };

  const update = () => {
    const el = elementRef.current;
    if (!el) return;
    const { offset, size } = readViewport(el);
    const next = virtualizer.range(offset, size);
    setRange((prev) =>
      prev.startIndex === next.startIndex &&
      prev.endIndex === next.endIndex &&
      prev.totalSize === next.totalSize
        ? prev
        : next,
    );
  };

  const updateRef = useRef(update);
  updateRef.current = update;

  useEffect(() => {
    updateRef.current();
  }, [virtualizer]);

  const scrollElementRef = (el: HTMLElement | null) => {
    if (elementRef.current === el) return;
    elementRef.current = el;
    if (el) updateRef.current();
  };

  useEffect(() => {
    const el = elementRef.current;
    if (!el) return;
    const onScroll = () => {
      cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(() => updateRef.current());
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    const resize = typeof ResizeObserver !== "undefined" ? new ResizeObserver(onScroll) : null;
    resize?.observe(el);
    return () => {
      el.removeEventListener("scroll", onScroll);
      resize?.disconnect();
      cancelAnimationFrame(frame.current);
    };
  }, [virtualizer]);

  return {
    range,
    virtualizer,
    scrollElementRef,
    measure(index, size) {
      if (virtualizer.measure(index, size)) updateRef.current();
    },
    scrollToIndex(index, align = "auto") {
      const el = elementRef.current;
      if (!el) return;
      const { offset, size } = readViewport(el);
      const target = virtualizer.scrollOffsetFor(index, size, offset, align);
      if (axis === "vertical") el.scrollTop = target;
      else el.scrollLeft = target;
      updateRef.current();
    },
  };
}
