import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Select } from "@/framework";
import { mountCanvasGrid, type CanvasColumn } from "@/framework/canvas";
import { getProducts } from "@/fixtures";
import type { Product } from "@/fixtures/types";
import { formatCurrency, formatNumber } from "@/utils/format";
import { Field, MetricCard, PageHeader, Showcase } from "@/playground/components/primitives";

export const Route = createFileRoute("/canvas-grid")({
  head: () => ({
    meta: [
      { title: "Canvas Grid — Forge" },
      {
        name: "description",
        content:
          "The second renderer adapter: the same pure grid machine and virtualizer painted on canvas, no React in the render path.",
      },
    ],
  }),
  component: CanvasGridPage,
});

const SIZES = [100_000, 250_000, 500_000, 1_000_000];

const COLUMNS: CanvasColumn<Product>[] = [
  { id: "id", header: "ID", width: 110, getText: (p) => p.id },
  { id: "name", header: "Product", width: 220, getText: (p) => p.name },
  { id: "category", header: "Category", width: 120, getText: (p) => p.category },
  { id: "sku", header: "SKU", width: 130, sortable: false, getText: (p) => p.sku },
  {
    id: "price",
    header: "Price",
    width: 110,
    align: "right",
    getText: (p) => formatCurrency(p.price),
  },
  {
    id: "stock",
    header: "Stock",
    width: 100,
    align: "right",
    getText: (p) => formatNumber(p.stock),
  },
  {
    id: "rating",
    header: "Rating",
    width: 90,
    align: "right",
    getText: (p) => p.rating.toFixed(1),
  },
  { id: "status", header: "Status", width: 110, getText: (p) => p.status },
];

function CanvasGridPage() {
  const [size, setSize] = useState(500_000);
  const [paintStats, setPaintStats] = useState({ ms: 0, rowsPainted: 0, totalRows: 0 });
  const [selectedCount, setSelectedCount] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const data = useMemo(() => getProducts(size), [size]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    // React's entire contribution to this grid is the <div> below. Machines,
    // virtualizer, sorting, keymap and painting are all framework-free.
    const grid = mountCanvasGrid<Product>({
      container,
      columns: COLUMNS,
      getRows: () => data,
      getRowKey: (p) => p.id,
      onPaint: (stats) => setPaintStats(stats),
      onSelectionChange: setSelectedCount,
    });
    return () => grid.destroy();
  }, [data]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Next-gen engine"
        title="Canvas Grid"
        description="The final proof of the core/adapter boundary: this grid contains zero React in its render path — one <div> is mounted, then the same pure grid machine, Fenwick virtualizer, culture-aware sort and declarative keymap that power the React DataGrid drive an immediate-mode canvas painter (enforced by an architecture test: no React import in core/ or canvas/). Click headers to sort (Shift for multi-sort), click cells, then drive with the keyboard: arrows, Home/End, Ctrl+Home/End, PageUp/Down, Space, Shift+Arrow, Ctrl+A."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Dataset" value={formatNumber(paintStats.totalRows)} unit="rows" accent />
        <MetricCard label="Painted" value={paintStats.rowsPainted} unit="rows / frame" />
        <MetricCard label="Paint time" value={paintStats.ms.toFixed(1)} unit="ms / frame" />
        <MetricCard label="Selected" value={formatNumber(selectedCount)} unit="rows" />
      </div>

      <Showcase
        title="One million rows, one canvas"
        description="Sorting re-runs the pure sort core and repaints; scrolling repaints only the visible window. The React DevTools will show exactly one component here."
      >
        <div className="mb-4 max-w-xs">
          <Field label="Dataset size">
            <Select
              value={String(size)}
              onChange={(e) => setSize(Number(e.target.value))}
              options={SIZES.map((s) => ({ label: `${formatNumber(s)} rows`, value: String(s) }))}
            />
          </Field>
        </div>
        <div
          ref={containerRef}
          role="grid"
          aria-label="Products (canvas renderer)"
          aria-rowcount={paintStats.totalRows}
          className="h-[540px] rounded-lg border border-border bg-surface outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </Showcase>
    </div>
  );
}
