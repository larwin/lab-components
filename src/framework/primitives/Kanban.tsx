import { memo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/shared/lib/utils";
import {
  createDragMachine,
  dragIntents,
  type DragMoveDetail,
  type DragState,
  type Key,
} from "@/framework/core";
import { useForgeEffects, useLiveRef, useMachine } from "@/framework/react";

/**
 * KanbanBoard — columns of cards on the pure drag machine.
 *
 * Pointer and keyboard converge on the same intents:
 *  - pointer: press a card, move past a small threshold → drag/start; a ghost
 *    follows the pointer while document.elementFromPoint hit-tests columns and
 *    card midlines into drag/over; release → drag/drop.
 *  - keyboard: Space picks the focused card up, arrows move the target
 *    (← → between columns, ↑ ↓ within), Space drops, Escape cancels — with
 *    screen-reader announcements emitted by the machine itself.
 *
 * The board never mutates data: `onMove` receives from/to coordinates and the
 * caller updates its state (controlled, like everything else in Forge).
 */

export interface KanbanColumnDef {
  key: string;
  title: string;
  accent?: string;
}

export interface KanbanProps<T> {
  columns: KanbanColumnDef[];
  items: readonly T[];
  getKey: (item: T) => Key;
  getColumn: (item: T) => string;
  onMove: (move: DragMoveDetail) => void;
  renderCard?: (item: T) => ReactNode;
  getCardLabel?: (item: T) => string;
  className?: string;
  "aria-label": string;
}

const DRAG_THRESHOLD = 5;

export function KanbanBoard<T>(props: KanbanProps<T>) {
  const { columns, items, getKey, getColumn, renderCard, className } = props;

  const byColumn = new Map<string, T[]>(columns.map((c) => [c.key, []]));
  for (const item of items) byColumn.get(getColumn(item))?.push(item);

  const live = useLiveRef({ props, byColumn });
  const boardRef = useRef<HTMLDivElement | null>(null);
  const [ghost, setGhost] = useState<{ x: number; y: number } | null>(null);

  const { state, dispatch, store } = useMachine(() =>
    createDragMachine({
      getZones: () => live.current.props.columns.map((c) => c.key),
      getZoneSize: (zone) => live.current.byColumn.get(zone)?.length ?? 0,
      getItemLabel: (key) => {
        const item = live.current.props.items.find((i) => live.current.props.getKey(i) === key);
        return item !== undefined
          ? (live.current.props.getCardLabel?.(item) ?? String(key))
          : String(key);
      },
      getZoneLabel: (zone) => live.current.props.columns.find((c) => c.key === zone)?.title ?? zone,
    }),
  );

  useForgeEffects(store, {
    events: {
      move: (detail) => live.current.props.onMove(detail as DragMoveDetail),
    },
  });

  /* ---- pointer DnD: threshold start, elementFromPoint hit-testing ---- */
  const [pointerHandlers] = useState(() => {
    let pending: { zone: string; key: Key; index: number; x: number; y: number } | null = null;

    const hitTest = (x: number, y: number) => {
      const el = document.elementFromPoint(x, y);
      const columnEl = el?.closest<HTMLElement>("[data-kanban-zone]");
      if (!columnEl) return null;
      const zone = columnEl.dataset.kanbanZone!;
      const cards = [...columnEl.querySelectorAll<HTMLElement>("[data-kanban-card]")];
      let index = cards.length;
      for (let i = 0; i < cards.length; i++) {
        const rect = cards[i].getBoundingClientRect();
        if (y < rect.top + rect.height / 2) {
          index = i;
          break;
        }
      }
      return { zone, index };
    };

    const onMove = (e: PointerEvent) => {
      if (pending) {
        if (Math.hypot(e.clientX - pending.x, e.clientY - pending.y) < DRAG_THRESHOLD) return;
        dispatch(
          dragIntents.start(
            { zone: pending.zone, key: pending.key, index: pending.index },
            "pointer",
          ),
        );
        pending = null;
      }
      setGhost({ x: e.clientX, y: e.clientY });
      const over = hitTest(e.clientX, e.clientY);
      if (over) dispatch(dragIntents.over(over, "pointer"));
      else dispatch(dragIntents.leave(undefined, "pointer"));
    };

    const onUp = () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      pending = null;
      setGhost(null);
      dispatch(dragIntents.drop(undefined, "pointer"));
    };

    return {
      onCardPointerDown: (zone: string, key: Key, index: number, e: React.PointerEvent) => {
        if (e.button !== 0) return;
        pending = { zone, key, index, x: e.clientX, y: e.clientY };
        document.addEventListener("pointermove", onMove);
        document.addEventListener("pointerup", onUp);
      },
    };
  });

  /* ---- keyboard DnD on the focused card ---- */
  const onCardKeyDown = (zone: string, key: Key, index: number, e: React.KeyboardEvent) => {
    const dragging = store.getState().active !== null;
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      if (!dragging) dispatch(dragIntents.start({ zone, key, index }, "keyboard"));
      else dispatch(dragIntents.drop(undefined, "keyboard"));
      return;
    }
    if (!dragging) return;
    const deltas: Record<string, { dZone?: number; dIndex?: number }> = {
      ArrowLeft: { dZone: -1 },
      ArrowRight: { dZone: 1 },
      ArrowUp: { dIndex: -1 },
      ArrowDown: { dIndex: 1 },
    };
    if (deltas[e.key]) {
      e.preventDefault();
      dispatch(dragIntents.moveTarget(deltas[e.key], "keyboard"));
    } else if (e.key === "Escape") {
      e.preventDefault();
      dispatch(dragIntents.cancel(undefined, "keyboard"));
    }
  };

  const draggedKey = state.active?.key ?? null;
  const draggedItem = draggedKey !== null ? items.find((i) => getKey(i) === draggedKey) : undefined;

  return (
    <div
      ref={boardRef}
      role="application"
      aria-label={props["aria-label"]}
      className={cn("flex items-start gap-4 overflow-x-auto pb-2", className)}
    >
      {columns.map((column) => {
        const cards = byColumn.get(column.key) ?? [];
        return (
          <KanbanColumn
            key={column.key}
            column={column}
            count={cards.length}
            dropIndex={
              state.active !== null && state.over?.zone === column.key ? state.over.index : null
            }
          >
            {cards.map((item, index) => {
              const key = getKey(item);
              return (
                <KanbanCard
                  key={key}
                  itemKey={key}
                  zone={column.key}
                  index={index}
                  dragging={draggedKey === key}
                  dropBefore={
                    state.active !== null &&
                    state.over?.zone === column.key &&
                    state.over.index === index
                  }
                  onPointerDown={pointerHandlers.onCardPointerDown}
                  onKeyDown={onCardKeyDown}
                >
                  {renderCard ? renderCard(item) : String(key)}
                </KanbanCard>
              );
            })}
          </KanbanColumn>
        );
      })}

      {ghost && draggedItem !== undefined && (
        <div
          aria-hidden
          style={{
            position: "fixed",
            left: ghost.x + 8,
            top: ghost.y + 8,
            zIndex: 100,
            pointerEvents: "none",
          }}
          className="w-56 rotate-2 rounded-lg border border-border bg-card p-3 text-sm shadow-xl opacity-90"
        >
          {renderCard ? renderCard(draggedItem) : String(draggedKey)}
        </div>
      )}
    </div>
  );
}

function KanbanColumn({
  column,
  count,
  dropIndex,
  children,
}: {
  column: KanbanColumnDef;
  count: number;
  dropIndex: number | null;
  children: ReactNode;
}) {
  return (
    <section
      data-kanban-zone={column.key}
      aria-label={`${column.title} (${count})`}
      className={cn(
        "flex w-64 shrink-0 flex-col rounded-xl border border-border bg-muted/40 transition-colors",
        dropIndex !== null && "border-primary/50 bg-primary/5",
      )}
    >
      <header className="flex items-center gap-2 px-3 py-2.5">
        {column.accent && <span className={cn("size-2 rounded-full", column.accent)} />}
        <h3 className="text-sm font-semibold">{column.title}</h3>
        <span className="ml-auto rounded-full bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
          {count}
        </span>
      </header>
      <div className="flex min-h-16 flex-col gap-2 px-2 pb-2">{children}</div>
    </section>
  );
}

interface KanbanCardProps {
  itemKey: Key;
  zone: string;
  index: number;
  dragging: boolean;
  /** A drop is targeted just before this card. */
  dropBefore: boolean;
  onPointerDown: (zone: string, key: Key, index: number, e: React.PointerEvent) => void;
  onKeyDown: (zone: string, key: Key, index: number, e: React.KeyboardEvent) => void;
  children: ReactNode;
  style?: CSSProperties;
}

const KanbanCard = memo(function KanbanCard({
  itemKey,
  zone,
  index,
  dragging,
  dropBefore,
  onPointerDown,
  onKeyDown,
  children,
}: KanbanCardProps) {
  return (
    <div
      data-kanban-card
      role="button"
      tabIndex={0}
      aria-roledescription="draggable card"
      aria-pressed={dragging}
      onPointerDown={(e) => onPointerDown(zone, itemKey, index, e)}
      onKeyDown={(e) => onKeyDown(zone, itemKey, index, e)}
      className={cn(
        "cursor-grab touch-none rounded-lg border border-border bg-card p-3 text-sm shadow-sm transition-[box-shadow,opacity] outline-none select-none",
        "hover:shadow focus-visible:ring-2 focus-visible:ring-ring",
        dragging && "opacity-40 ring-2 ring-primary",
        dropBefore && "border-t-2 border-t-primary",
      )}
    >
      {children}
    </div>
  );
});
