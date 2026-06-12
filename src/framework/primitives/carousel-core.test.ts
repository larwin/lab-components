// @vitest-environment node
// Wave 9b — pure carousel geometry: pagination math, the modulo loop (no DOM
// cloning), drag settle reusing the 8b wheel geometry, and the mounted
// window that keeps a 10k gallery at a handful of slides.
import { describe, expect, it } from "vitest";
import {
  carouselMountedRange,
  carouselPageCount,
  carouselPageIndex,
  carouselPageKey,
  carouselSettle,
  carouselSlideRange,
  loopDelta,
  normalizeLoopIndex,
} from "./carousel-core";

describe("carousel pagination math", () => {
  it("computes page count for any slides-per-page", () => {
    expect(carouselPageCount(12, 1)).toBe(12);
    expect(carouselPageCount(12, 3)).toBe(4);
    expect(carouselPageCount(13, 3)).toBe(5);
    expect(carouselPageCount(0, 3)).toBe(1);
  });

  it("maps a page to its slide range (last page may be partial)", () => {
    expect(carouselSlideRange(0, 3, 13)).toEqual({ start: 0, end: 3 });
    expect(carouselSlideRange(4, 3, 13)).toEqual({ start: 12, end: 13 });
  });

  it("round-trips page keys", () => {
    expect(carouselPageIndex(carouselPageKey(7))).toBe(7);
  });
});

describe("infinite loop — pure modulo, no DOM cloning", () => {
  it("normalizes any virtual index onto the ring", () => {
    expect(normalizeLoopIndex(5, 4)).toBe(1);
    expect(normalizeLoopIndex(-1, 4)).toBe(3);
    expect(normalizeLoopIndex(-9, 4)).toBe(3);
    expect(normalizeLoopIndex(3, 4)).toBe(3);
  });

  it("loopDelta takes the shortest signed path (the seam animates forward)", () => {
    expect(loopDelta(3, 0, 4)).toBe(1); // wrap forward, not -3
    expect(loopDelta(0, 3, 4)).toBe(-1); // wrap backward
    expect(loopDelta(0, 2, 4)).toBe(2); // half turn goes forward
    expect(loopDelta(1, 1, 4)).toBe(0);
  });
});

describe("drag settle — the 8b wheel geometry reused horizontally", () => {
  const W = 300; // page width px

  it("snaps to the nearest page on a slow release (clamped track)", () => {
    expect(carouselSettle(W * 1.4, 0, W, 5, false)).toEqual({ index: 1, offset: W });
    expect(carouselSettle(W * 1.6, 0, W, 5, false)).toEqual({ index: 2, offset: 2 * W });
  });

  it("inertia coasts past pages, clamped to the track ends", () => {
    const slow = carouselSettle(W * 1.1, 1, W, 5, false); // coast ≈ 167px → next page
    expect(slow.index).toBe(2);
    const fast = carouselSettle(W * 1.1, 3, W, 5, false); // coast = 1500px → past the end
    expect(fast.index).toBe(4); // clamped to the last page
    const back = carouselSettle(W * 1.1, -3, W, 5, false);
    expect(back.index).toBe(0);
  });

  it("loop: the same coast, unclamped — virtual indices cross the seam", () => {
    const forward = carouselSettle(W * 4.6, 0, W, 5, true);
    expect(forward.index).toBe(5); // virtual — normalizes to page 0
    expect(normalizeLoopIndex(forward.index, 5)).toBe(0);
    const backward = carouselSettle(-W * 0.6, 0, W, 5, true);
    expect(backward.index).toBe(-1); // normalizes to the last page
    expect(normalizeLoopIndex(backward.index, 5)).toBe(4);
  });
});

describe("mounted window — virtualization proof", () => {
  it("clamps to the track when not looping", () => {
    expect(carouselMountedRange(0, 100, 2, false)).toEqual([0, 1, 2]);
    expect(carouselMountedRange(99, 100, 2, false)).toEqual([97, 98, 99]);
    expect(carouselMountedRange(50, 100, 1, false)).toEqual([49, 50, 51]);
  });

  it("stays virtual when looping (the renderer normalizes per index)", () => {
    expect(carouselMountedRange(0, 5, 1, true)).toEqual([-1, 0, 1]);
    expect(carouselMountedRange(12, 5, 1, true)).toEqual([11, 12, 13]);
  });

  it("never mounts the same real page twice on a small loop", () => {
    const range = carouselMountedRange(2, 3, 5, true);
    const real = range.map((i) => normalizeLoopIndex(i, 3));
    expect(new Set(real).size).toBe(real.length);
  });
});
