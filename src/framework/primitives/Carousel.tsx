import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  autoplayIntents,
  cancelAdvance,
  composeMachine,
  createVirtualizer,
  flipHorizontalStroke,
  navIntents,
  scheduleAdvance,
  type AutoplayableSlice,
  type Collection,
  type CollectionBehaviorConfig,
  type Key,
  type NavigableSlice,
} from "@/framework/core";
import {
  detectPlatform,
  resolveBinding,
  strokeFromEvent,
  useComposedMachine,
  useForgeEffects,
  useLiveRef,
} from "@/framework/react";
import { ToggleGroup } from "./ToggleGroup";
import {
  carouselBehaviors,
  carouselMountedRange,
  carouselPageCount,
  carouselPageIndex,
  carouselPageKey,
  carouselPagesCollection,
  carouselSettle,
  carouselSlideRange,
  loopDelta,
  normalizeLoopIndex,
} from "./carousel-core";

/**
 * Carousel — zero new track machine: [Focusable + Navigable(horizontal) +
 * Autoplayable] over a collection of pages. Logical focus via
 * aria-activedescendant (unmounted pages exist for the keyboard), `wrap` IS
 * the keyboard loop, the visual loop is pure modulo math, and drag-snap is
 * the 8b wheel geometry (`carouselSettle` → `wheelSettle`) run horizontally.
 *
 * Autoplay is the Toast timer pattern: the reducer emits
 * `schedule-advance`/`cancel-advance`, this shell owns the single timeout —
 * and suspends rotation on hover, on focus AND when the tab is hidden.
 * Long tracks stay cheap: only a window of pages is mounted (Fenwick
 * virtualizer when clamped, virtual modulo window when looping).
 */

export interface CarouselSlideDef {
  key: Key;
  content: ReactNode;
  /** Accessible name of the slide (defaults to its position). */
  label?: string;
}

export interface CarouselProps {
  slides: readonly CarouselSlideDef[];
  /** Slides shown (and advanced) per page. Default 1. */
  slidesPerPage?: number;
  /** Infinite loop — keyboard wrap + modulo rendering, no DOM cloning. */
  loop?: boolean;
  /** Enables rotation (and the mandatory play/pause control). */
  autoplay?: boolean;
  /** ms between automatic advances. Default 4000. */
  autoplayInterval?: number;
  /** Controlled page index. */
  index?: number;
  defaultIndex?: number;
  onIndexChange?: (page: number) => void;
  /** Mounted half-window, in pages. Default 1. */
  overscan?: number;
  showDots?: boolean;
  showArrows?: boolean;
  dir?: "ltr" | "rtl";
  /** Localized page label — SR announcements + dot labels. */
  pageLabel?: (page: number, pages: number) => string;
  /** Observability (demo: virtualization proof). */
  onMountedSlidesChange?: (mounted: number) => void;
  "aria-label": string;
  className?: string;
}

const defaultPageLabel = (page: number, pages: number) => `Page ${page + 1} sur ${pages}`;

export function Carousel({
  slides,
  slidesPerPage = 1,
  loop = false,
  autoplay = false,
  autoplayInterval = 4000,
  index,
  defaultIndex = 0,
  onIndexChange,
  overscan = 1,
  showDots = true,
  showArrows = true,
  dir = "ltr",
  pageLabel = defaultPageLabel,
  onMountedSlidesChange,
  className,
  ...rest
}: CarouselProps) {
  const baseId = useId();
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [platform] = useState(detectPlatform);

  const pageCount = carouselPageCount(slides.length, slidesPerPage);
  const collection = useMemo(() => carouselPagesCollection(pageCount), [pageCount]);

  const live = useLiveRef({
    collection,
    loop,
    autoplayInterval,
    pageLabel,
    pageCount,
    onIndexChange,
    onMountedSlidesChange,
    dir,
  });

  const { state, dispatch, store, composed } = useComposedMachine(() => {
    const config: CollectionBehaviorConfig & {
      interval: number;
      itemAnnouncement: (i: number, n: number) => string;
    } = {
      getCollection: () => live.current.collection as Collection<unknown>,
      orientation: "horizontal",
      get wrap() {
        return live.current.loop;
      },
      get interval() {
        return live.current.autoplayInterval;
      },
      itemAnnouncement: (i, n) => live.current.pageLabel(i, n),
    };
    return composeMachine("carousel", carouselBehaviors, config);
  });

  const nav = state.navigable as NavigableSlice;
  const auto = state.autoplayable as AutoplayableSlice;
  const currentPage = nav.focusedKey !== null ? carouselPageIndex(nav.focusedKey) : defaultIndex;

  /* ---- the single rotation timer (Toast pattern) ---- */
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dispatchLive = useLiveRef({ dispatch });

  useForgeEffects(store, {
    events: {
      pageChange: (detail) => {
        live.current.onIndexChange?.((detail as { index: number }).index);
      },
    },
    overrides: {
      [scheduleAdvance.type]: (effect) => {
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(
          () => {
            timerRef.current = null;
            dispatchLive.current.dispatch(navIntents.next(undefined, "program"));
          },
          (effect.payload as { delayMs: number }).delayMs,
        );
      },
      [cancelAdvance.type]: () => {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
      },
    },
  });

  // Unmount is a stopping path too.
  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  /* ---- mount: position, then start rotating ---- */
  useEffect(() => {
    dispatch(navIntents.move({ key: carouselPageKey(index ?? defaultIndex) }, "program"));
    if (autoplay) dispatch(autoplayIntents.play(undefined, "program"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Controlled page index: silent program sync.
  useEffect(() => {
    if (index === undefined || index === currentPage) return;
    const clamped = Math.min(pageCount - 1, Math.max(0, index));
    dispatch(navIntents.move({ key: carouselPageKey(clamped) }, "program"));
  }, [index, currentPage, pageCount, dispatch]);

  // The hidden tab suspends rotation (and must resume after).
  useEffect(() => {
    const onVisibility = () => {
      dispatch(
        document.hidden
          ? autoplayIntents.suspend({ reason: "hidden" }, "program")
          : autoplayIntents.resume({ reason: "hidden" }, "program"),
      );
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [dispatch]);

  /* ---- geometry: viewport width = page width ---- */
  const [pageWidth, setPageWidth] = useState(0);
  useEffect(() => {
    const el = viewportRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setPageWidth(el.clientWidth));
    observer.observe(el);
    setPageWidth(el.clientWidth);
    return () => observer.disconnect();
  }, []);

  /* ---- continuous virtual index: the seam animates forward ---- */
  const [virtualPage, setVirtualPage] = useState(index ?? defaultIndex);
  useEffect(() => {
    setVirtualPage((v) => {
      if (!live.current.loop) return currentPage;
      const norm = normalizeLoopIndex(v, pageCount);
      return norm === currentPage ? v : v + loopDelta(norm, currentPage, pageCount);
    });
  }, [currentPage, pageCount, live]);

  /* ---- drag ---- */
  const drag = useRef<{
    pointerId: number;
    startX: number;
    lastX: number;
    lastT: number;
    velocity: number;
  } | null>(null);
  const [dragDelta, setDragDelta] = useState<number | null>(null);

  const forwardSign = dir === "rtl" ? -1 : 1;
  const baseOffset = virtualPage * pageWidth;
  const offset = baseOffset + (dragDelta ?? 0);

  const onPointerDown = (e: React.PointerEvent) => {
    if (!e.isPrimary || pageWidth === 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      lastX: e.clientX,
      lastT: e.timeStamp,
      velocity: 0,
    };
    setDragDelta(0);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.pointerId) return;
    const delta = (d.startX - e.clientX) * forwardSign;
    const dt = e.timeStamp - d.lastT;
    if (dt > 0) {
      d.velocity = ((d.lastX - e.clientX) * forwardSign) / dt;
      d.lastX = e.clientX;
      d.lastT = e.timeStamp;
    }
    setDragDelta(delta);
  };

  const onPointerEnd = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.pointerId) return;
    drag.current = null;
    const delta = (d.startX - e.clientX) * forwardSign;
    const settle = carouselSettle(baseOffset + delta, d.velocity, pageWidth, pageCount, loop);
    setDragDelta(null);
    setVirtualPage(settle.index);
    const real = loop ? normalizeLoopIndex(settle.index, pageCount) : settle.index;
    if (real !== currentPage) {
      dispatch(navIntents.move({ key: carouselPageKey(real) }, "pointer"));
    }
  };

  /* ---- keyboard (strokes flipped in RTL) ---- */
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.defaultPrevented) return;
    const resolved = resolveBinding(
      composed.keymap(store.getState()),
      flipHorizontalStroke(strokeFromEvent(e), live.current.dir),
      platform,
    );
    if (!resolved) return;
    if (resolved.binding.preventDefault !== false) e.preventDefault();
    dispatch(resolved.intent);
  };

  /* ---- mounted window (virtualization) ---- */
  const mountedPages = useMemo(() => {
    if (pageWidth === 0) return [currentPage];
    if (loop) return carouselMountedRange(virtualPage, pageCount, overscan, true);
    const virtualizer = createVirtualizer({
      count: pageCount,
      estimateSize: pageWidth,
      overscan,
    });
    const range = virtualizer.range(offset, pageWidth);
    const indices: number[] = [];
    for (let i = range.startIndex; i <= range.endIndex; i++) indices.push(i);
    return indices;
  }, [pageWidth, loop, virtualPage, pageCount, overscan, offset, currentPage]);

  const mountedSlideCount = mountedPages.reduce((sum, page) => {
    const real = loop ? normalizeLoopIndex(page, pageCount) : page;
    const { start, end } = carouselSlideRange(real, slidesPerPage, slides.length);
    return sum + (end - start);
  }, 0);
  useEffect(() => {
    live.current.onMountedSlidesChange?.(mountedSlideCount);
  }, [mountedSlideCount, live]);

  const pageDomId = (page: number) => `${baseId}-page-${page}`;
  const atStart = !loop && currentPage === 0;
  const atEnd = !loop && currentPage === pageCount - 1;

  const arrowClass = cn(
    "inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-surface transition-colors outline-none",
    "hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
  );

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label={rest["aria-label"]}
      dir={dir}
      onPointerEnter={() => dispatch(autoplayIntents.suspend({ reason: "hover" }, "pointer"))}
      onPointerLeave={() => dispatch(autoplayIntents.resume({ reason: "hover" }, "pointer"))}
      onFocus={() => dispatch(autoplayIntents.suspend({ reason: "focus" }, "keyboard"))}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          dispatch(autoplayIntents.resume({ reason: "focus" }, "keyboard"));
        }
      }}
      className={cn("flex flex-col gap-3", className)}
    >
      <div className="flex items-center gap-2">
        {autoplay && (
          <button
            type="button"
            aria-label={auto.playing ? "Suspendre la rotation" : "Lancer la rotation"}
            onClick={() => dispatch(autoplayIntents.toggle(undefined, "pointer"))}
            className={arrowClass}
          >
            {auto.playing ? <Pause className="size-4" /> : <Play className="size-4" />}
          </button>
        )}
        {showArrows && (
          <button
            type="button"
            aria-label="Page précédente"
            aria-disabled={atStart || undefined}
            onClick={() => !atStart && dispatch(navIntents.previous(undefined, "pointer"))}
            className={cn(arrowClass, atStart && "opacity-40")}
          >
            <ChevronLeft className="size-4 rtl:rotate-180" />
          </button>
        )}
        {showArrows && (
          <button
            type="button"
            aria-label="Page suivante"
            aria-disabled={atEnd || undefined}
            onClick={() => !atEnd && dispatch(navIntents.next(undefined, "pointer"))}
            className={cn(arrowClass, atEnd && "opacity-40")}
          >
            <ChevronRight className="size-4 rtl:rotate-180" />
          </button>
        )}
      </div>

      <div
        ref={viewportRef}
        tabIndex={0}
        aria-activedescendant={pageDomId(currentPage)}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        className={cn(
          "relative touch-pan-y overflow-hidden rounded-xl border border-border bg-surface outline-none select-none",
          "focus-visible:ring-2 focus-visible:ring-ring",
          dragDelta !== null ? "cursor-grabbing" : "cursor-grab",
        )}
      >
        <div
          className="relative h-full"
          style={{
            transform: `translateX(${(dir === "rtl" ? offset : -offset).toFixed(2)}px)`,
            transition:
              dragDelta !== null ? "none" : "transform 320ms cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        >
          {pageWidth > 0 &&
            mountedPages.map((page) => {
              const real = loop ? normalizeLoopIndex(page, pageCount) : page;
              const { start, end } = carouselSlideRange(real, slidesPerPage, slides.length);
              const pageSlides = slides.slice(start, end);
              return (
                <div
                  key={page}
                  id={pageDomId(real)}
                  role="group"
                  aria-roledescription="slide"
                  aria-label={pageLabel(real, pageCount)}
                  aria-hidden={real !== currentPage || undefined}
                  data-carousel-page
                  className="absolute top-0 flex h-full"
                  style={
                    dir === "rtl"
                      ? { width: pageWidth, right: page * pageWidth }
                      : { width: pageWidth, left: page * pageWidth }
                  }
                >
                  {pageSlides.map((slide) => (
                    <div
                      key={slide.key}
                      aria-label={slide.label}
                      className="h-full min-w-0 p-1.5"
                      style={{ width: pageWidth / slidesPerPage }}
                    >
                      {slide.content}
                    </div>
                  ))}
                </div>
              );
            })}
        </div>
        {/* The track is transform-positioned: give the viewport its height. */}
        <div className="pointer-events-none invisible flex" aria-hidden>
          {slides.slice(0, slidesPerPage).map((slide) => (
            <div key={slide.key} className="min-w-0 flex-1 p-1.5">
              {slide.content}
            </div>
          ))}
        </div>
      </div>

      {showDots && (
        <ToggleGroup
          mode="single"
          aria-label="Pagination du carrousel"
          items={Array.from({ length: pageCount }, (_, i) => ({
            key: carouselPageKey(i),
            "aria-label": pageLabel(i, pageCount),
            icon: <span className="block size-1.5 rounded-full bg-current" />,
          }))}
          value={[carouselPageKey(currentPage)]}
          onValueChange={(value) => {
            const key = value[0];
            if (key !== undefined) dispatch(navIntents.move({ key }, "pointer"));
          }}
          className="self-center"
        />
      )}
    </div>
  );
}
