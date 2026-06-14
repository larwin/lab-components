import { useEffect } from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import {
  createPaginationMachine,
  pageCountOf,
  paginationIntents,
  paginationRange,
  type PaginationState,
} from "@/framework/core";
import { useForgeEffects, useLiveRef, useMachine } from "@/framework/react";

/**
 * Pagination — the pure pagination machine rendered as a nav of buttons. The
 * ellipsis window (`paginationRange`) is core math; the shell maps numbers to
 * buttons and marks the current one with `aria-current="page"`. The total is
 * a live config getter — when the data shrinks, the next intent re-clamps.
 */

export interface PaginationProps {
  total: number;
  page?: number;
  defaultPage?: number;
  pageSize?: number;
  onPageChange?: (page: number, pageSize: number) => void;
  /** Pages shown around the current one / at each edge. */
  siblings?: number;
  boundaries?: number;
  /** Show first/last jump buttons. */
  showEdges?: boolean;
  className?: string;
  "aria-label"?: string;
}

export function Pagination({
  total,
  page,
  defaultPage,
  pageSize = 20,
  onPageChange,
  siblings = 1,
  boundaries = 1,
  showEdges = false,
  className,
  ...rest
}: PaginationProps) {
  const live = useLiveRef({ total, onPageChange });

  const { state, dispatch, store } = useMachine(() =>
    createPaginationMachine({
      getTotal: () => live.current.total,
      defaultPage: page ?? defaultPage,
      defaultPageSize: pageSize,
    }),
  );

  const current = (state as PaginationState).page;
  const pageCount = pageCountOf(total, (state as PaginationState).pageSize);

  useEffect(() => {
    if (page !== undefined && page !== current) {
      dispatch(paginationIntents.goTo({ page }, "program"));
    }
  }, [page, current, dispatch]);

  useForgeEffects(store, {
    events: {
      pageChange: (detail) => {
        const { page: p, pageSize: s } = detail as { page: number; pageSize: number };
        live.current.onPageChange?.(p, s);
      },
    },
  });

  const items = paginationRange(current, pageCount, siblings, boundaries);

  const navButton = (
    label: string,
    icon: React.ReactNode,
    intent: () => void,
    disabled: boolean,
  ) => (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={intent}
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-md border border-border text-sm transition-colors outline-none",
        "hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:pointer-events-none disabled:opacity-40",
      )}
    >
      {icon}
    </button>
  );

  return (
    <nav aria-label={rest["aria-label"] ?? "Pagination"} className={className}>
      <ul className="flex items-center gap-1">
        {showEdges && (
          <li>
            {navButton(
              "Première page",
              <ChevronsLeft className="size-4" />,
              () => dispatch(paginationIntents.first(undefined, "pointer")),
              current === 1,
            )}
          </li>
        )}
        <li>
          {navButton(
            "Page précédente",
            <ChevronLeft className="size-4" />,
            () => dispatch(paginationIntents.previous(undefined, "pointer")),
            current === 1,
          )}
        </li>
        {items.map((item, index) =>
          item === "ellipsis" ? (
            <li key={`e-${index}`} aria-hidden className="px-1 text-sm text-muted-foreground">
              …
            </li>
          ) : (
            <li key={item}>
              <button
                type="button"
                aria-label={`Page ${item}`}
                aria-current={item === current ? "page" : undefined}
                onClick={() => dispatch(paginationIntents.goTo({ page: item }, "pointer"))}
                className={cn(
                  "inline-flex size-8 items-center justify-center rounded-md text-sm tabular-nums transition-colors outline-none",
                  "focus-visible:ring-2 focus-visible:ring-ring",
                  item === current
                    ? "bg-primary font-semibold text-primary-foreground"
                    : "border border-border hover:bg-muted",
                )}
              >
                {item}
              </button>
            </li>
          ),
        )}
        <li>
          {navButton(
            "Page suivante",
            <ChevronRight className="size-4" />,
            () => dispatch(paginationIntents.next(undefined, "pointer")),
            current === pageCount,
          )}
        </li>
        {showEdges && (
          <li>
            {navButton(
              "Dernière page",
              <ChevronsRight className="size-4" />,
              () => dispatch(paginationIntents.last(undefined, "pointer")),
              current === pageCount,
            )}
          </li>
        )}
      </ul>
    </nav>
  );
}
