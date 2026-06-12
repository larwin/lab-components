import {
  autoplayable,
  collectionFromArray,
  focusable,
  navigable,
  wheelSettle,
  type Collection,
  type Key,
} from "@/framework/core";

/**
 * Carousel recipe — zero new machine for the track: the carousel is
 * [Focusable + Navigable(horizontal) + Autoplayable] over a collection of
 * PAGES (logical focus via aria-activedescendant: pages beyond the mounted
 * window still exist for the keyboard). `wrap: true` IS the infinite loop on
 * the keyboard side; the visual loop is pure modulo math below — no DOM
 * cloning. Drag-snap reuses the 8b wheel geometry unchanged (wheelSettle:
 * offset + velocity → settled index) — horizontal instead of vertical, same
 * function; the loop variant only removes the clamp and normalizes modulo.
 */

export const carouselBehaviors = [focusable, navigable, autoplayable] as const;

export const carouselPageKey = (index: number): Key => `page-${index}`;
export const carouselPageIndex = (key: Key): number => Number.parseInt(key.slice(5), 10);

/** Number of pages for `slideCount` slides shown `perPage` at a time. */
export function carouselPageCount(slideCount: number, perPage: number): number {
  return Math.max(1, Math.ceil(slideCount / Math.max(1, perPage)));
}

/** The slide index range [start, end) rendered by page `page`. */
export function carouselSlideRange(
  page: number,
  perPage: number,
  slideCount: number,
): { start: number; end: number } {
  const start = page * perPage;
  return { start, end: Math.min(slideCount, start + perPage) };
}

export function carouselPagesCollection(pageCount: number): Collection<number> {
  const pages = Array.from({ length: pageCount }, (_, i) => i);
  return collectionFromArray(pages, {
    getKey: (page) => carouselPageKey(page),
    getTextValue: (page) => String(page + 1),
  });
}

/** Map any virtual (unbounded) page index onto a real one — the infinite loop. */
export function normalizeLoopIndex(index: number, count: number): number {
  if (count <= 0) return 0;
  return ((index % count) + count) % count;
}

/**
 * Shortest signed modular path from `from` to `to` on a ring of `count`
 * pages, in (-count/2, count/2]. The shell adds it to its continuous virtual
 * index so a wrap (page n-1 → 0) animates FORWARD instead of rewinding.
 */
export function loopDelta(from: number, to: number, count: number): number {
  if (count <= 0) return 0;
  const raw = normalizeLoopIndex(to - from, count);
  return raw > count / 2 ? raw - count : raw;
}

/**
 * Where a released drag settles. Non-loop: the untouched 8b `wheelSettle`
 * (inertia v²/2a then snap, clamped to the track). Loop: the same coast,
 * unclamped — the result is a *virtual* index, `normalizeLoopIndex` maps it
 * onto a real page.
 */
export function carouselSettle(
  offset: number,
  velocity: number,
  pageWidth: number,
  pageCount: number,
  loop: boolean,
  deceleration = 0.003,
): { index: number; offset: number } {
  if (!loop) return wheelSettle(offset, velocity, pageWidth, pageCount, deceleration);
  const coast = Math.sign(velocity) * ((velocity * velocity) / (2 * Math.max(1e-6, deceleration)));
  const index = Math.round((offset + coast) / Math.max(1e-6, pageWidth));
  return { index, offset: index * pageWidth };
}

/**
 * Virtual page indices to keep mounted around the current position.
 * Non-loop windows clamp to the track; loop windows stay virtual (the
 * renderer normalizes per index). This is what keeps a 10k-slide gallery at
 * a handful of mounted slides.
 */
export function carouselMountedRange(
  virtualIndex: number,
  pageCount: number,
  overscan: number,
  loop: boolean,
): number[] {
  const span = Math.min(overscan, loop ? Math.floor((pageCount - 1) / 2) : pageCount);
  const start = virtualIndex - span;
  const end = virtualIndex + span;
  const indices: number[] = [];
  for (let i = start; i <= end; i++) {
    if (!loop && (i < 0 || i >= pageCount)) continue;
    indices.push(i);
  }
  return indices;
}
