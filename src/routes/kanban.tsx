import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { KanbanBoard, type KanbanColumnDef } from "@/framework/primitives";
import type { DragMoveDetail, Key } from "@/framework/core";
import { getOrders } from "@/fixtures";
import type { Order } from "@/fixtures/types";
import { formatCurrency } from "@/shared/utils/format";
import { MetricCard, PageHeader, Showcase } from "@/playground/components/primitives";

export const Route = createFileRoute("/kanban")({
  head: () => ({
    meta: [
      { title: "Kanban — Forge" },
      {
        name: "description",
        content:
          "Drag & drop on a pure machine: pointer and keyboard converge on the same intents, with screen-reader announcements.",
      },
    ],
  }),
  component: KanbanPage,
});

const COLUMNS: KanbanColumnDef[] = [
  { key: "processing", title: "Processing", accent: "bg-warning" },
  { key: "paid", title: "Paid", accent: "bg-success" },
  { key: "refunded", title: "Refunded", accent: "bg-destructive" },
  { key: "cancelled", title: "Cancelled", accent: "bg-muted-foreground" },
];

function KanbanPage() {
  const orders = useMemo(() => getOrders(20), []);
  const orderById = useMemo(() => new Map(orders.map((o) => [o.id as Key, o])), [orders]);

  // The board is plain controlled state: column → ordered keys.
  const [board, setBoard] = useState<Map<string, Key[]>>(() => {
    const initial = new Map<string, Key[]>(COLUMNS.map((c) => [c.key, []]));
    for (const order of orders) initial.get(order.status)?.push(order.id);
    return initial;
  });
  const [moves, setMoves] = useState(0);
  const [lastMove, setLastMove] = useState<DragMoveDetail | null>(null);

  const items = useMemo(() => {
    const out: { order: Order; column: string }[] = [];
    for (const [column, keys] of board) {
      for (const key of keys) {
        const order = orderById.get(key);
        if (order) out.push({ order, column });
      }
    }
    return out;
  }, [board, orderById]);

  const onMove = (move: DragMoveDetail) => {
    setBoard((prev) => {
      const next = new Map(prev);
      const from = [...(next.get(move.fromZone) ?? [])];
      const removedAt = from.indexOf(move.key);
      if (removedAt === -1) return prev;
      from.splice(removedAt, 1);
      next.set(move.fromZone, from);
      const to = move.fromZone === move.toZone ? from : [...(next.get(move.toZone) ?? [])];
      // Target indices address the rendered list (dragged card included):
      // account for the removal when moving down inside the same column.
      const insertAt =
        move.fromZone === move.toZone && move.toIndex > removedAt ? move.toIndex - 1 : move.toIndex;
      to.splice(Math.min(insertAt, to.length), 0, move.key);
      next.set(move.toZone, to);
      return next;
    });
    setMoves((m) => m + 1);
    setLastMove(move);
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Next-gen engine"
        title="Kanban"
        description="Drag & drop is one pure machine: drag/start → drag/over → drag/drop. The pointer path hit-tests columns into the same intents the keyboard path produces — focus a card, press Space to pick it up, move with the arrows (← → between columns, ↑ ↓ within), Space to drop, Escape to cancel. Every phase is announced to screen readers by the machine itself. Watch the intents flow in /engine."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Cards" value={orders.length} accent />
        <MetricCard label="Moves" value={moves} />
        <MetricCard
          label="Last move"
          value={
            lastMove ? (
              <span className="text-base">
                {String(lastMove.key)} → {lastMove.toZone}
              </span>
            ) : (
              "—"
            )
          }
        />
        <MetricCard label="Input" value="pointer + keyboard" />
      </div>

      <Showcase
        title="Orders pipeline"
        description="The board never mutates data: drops emit a move event with from/to coordinates, and this page applies it to its own state (controlled, like everything else)."
      >
        <KanbanBoard
          aria-label="Orders by status"
          columns={COLUMNS}
          items={items}
          getKey={({ order }) => order.id}
          getColumn={({ column }) => column}
          getCardLabel={({ order }) => `Order ${order.reference}`}
          onMove={onMove}
          renderCard={({ order }) => (
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs text-muted-foreground">{order.reference}</span>
                <span className="font-medium tabular-nums">{formatCurrency(order.total)}</span>
              </div>
              <span className="truncate">{order.customer}</span>
              <span className="text-xs text-muted-foreground">
                {order.items} item{order.items > 1 ? "s" : ""} · {order.channel}
              </span>
            </div>
          )}
        />
      </Showcase>
    </div>
  );
}
