import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { DataGrid, Select, type GridColumn } from "@/framework/primitives";
import { getProducts } from "@/fixtures";
import type { Product } from "@/fixtures/types";
import { formatCurrency, formatNumber } from "@/shared/utils/format";
import { formatDuration, measure } from "@/shared/utils/perf";
import {
  Field,
  MetricCard,
  PageHeader,
  Showcase,
  StatusPill,
} from "@/playground/components/primitives";

export const Route = createFileRoute("/grid-next")({
  head: () => ({
    meta: [
      { title: "DataGrid Next — Forge" },
      {
        name: "description",
        content:
          "Next-generation data grid: pure grid machine, Fenwick virtualization, spreadsheet keyboard navigation, multi-sort.",
      },
    ],
  }),
  component: GridNextPage,
});

const SIZES = [10_000, 50_000, 100_000, 250_000, 500_000];

const COLUMNS: GridColumn<Product>[] = [
  { id: "id", header: "ID", accessor: (p) => p.id, width: 110, sortable: true },
  { id: "name", header: "Product", accessor: (p) => p.name, sortable: true, editable: true },
  { id: "category", header: "Category", accessor: (p) => p.category, width: 110, sortable: true },
  { id: "sku", header: "SKU", accessor: (p) => p.sku, width: 120 },
  {
    id: "price",
    header: "Price",
    accessor: (p) => p.price,
    width: 110,
    align: "right",
    sortable: true,
    editable: true,
    aggregate: "avg",
    cell: (p) => formatCurrency(p.price),
  },
  {
    id: "stock",
    header: "Stock",
    accessor: (p) => p.stock,
    width: 90,
    align: "right",
    sortable: true,
    editable: true,
    aggregate: "sum",
    cell: (p) => formatNumber(p.stock),
  },
  {
    id: "status",
    header: "Status",
    accessor: (p) => p.status,
    width: 110,
    sortable: true,
    cell: (p) => <StatusPill status={p.status} />,
  },
];

function GridNextPage() {
  const [size, setSize] = useState(100_000);
  const [filterText, setFilterText] = useState("");
  const [visibleRows, setVisibleRows] = useState(0);
  const [selectedCount, setSelectedCount] = useState(0);
  const [groupByKey, setGroupByKey] = useState("none");
  const [patches, setPatches] = useState<Map<string, Partial<Product>>>(new Map());

  const GROUPINGS: Record<string, readonly string[]> = {
    none: [],
    category: ["category"],
    status: ["status"],
    "category-status": ["category", "status"],
  };

  const { data: generated, genMs } = useMemo(() => {
    const { result, sample } = measure("generate", () => getProducts(size));
    return { data: result, genMs: sample.duration };
  }, [size]);

  // Inline edits live as a patch map over the immutable generated dataset.
  const data = useMemo(
    () =>
      patches.size === 0
        ? generated
        : generated.map((p) => (patches.has(p.id) ? { ...p, ...patches.get(p.id) } : p)),
    [generated, patches],
  );

  const onCellEdit = (rowKey: string, columnId: string, value: string) => {
    setPatches((prev) => {
      const next = new Map(prev);
      const patch: Partial<Product> = { ...next.get(rowKey) };
      if (columnId === "price") {
        const parsed = Number(value.replace(",", "."));
        if (Number.isNaN(parsed)) return prev;
        patch.price = parsed;
      } else if (columnId === "stock") {
        const parsed = Number(value);
        if (!Number.isInteger(parsed) || parsed < 0) return prev;
        patch.stock = parsed;
      } else if (columnId === "name") {
        if (value.trim() === "") return prev;
        patch.name = value.trim();
      }
      next.set(rowKey, patch);
      return next;
    });
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Next-gen engine"
        title="DataGrid"
        description="A specialization of the collection engine: pure grid machine (cursor, selection, multi-sort, inline editing, clipboard, column model), culture-aware sorting, diacritic-insensitive filtering, and Fenwick-tree virtualization. Keyboard: arrows, Home/End, Ctrl+Home/End, PageUp/Down, Space to select, Shift+Arrow ranges, Shift+Click header for multi-sort. Edit Product/Price/Stock with F2, Enter, double-click or just type (Enter commits ↓, Tab →, Escape cancels); Ctrl+C copies selected rows as TSV, paste a TSV block onto the cursor. Columns: drag the header edge to resize, drag a header to reorder, hover a header for the pin button — pinned columns stay sticky under horizontal scroll."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Dataset" value={formatNumber(data.length)} unit="rows" accent />
        <MetricCard label="After filter" value={formatNumber(visibleRows)} unit="rows" />
        <MetricCard label="Generated in" value={formatDuration(genMs)} />
        <MetricCard label="Edited" value={formatNumber(patches.size)} unit="rows" />
      </div>

      <Showcase
        title="500k-rows capable"
        description="The DOM only ever holds the visible window. Sorting half a million rows stays a pure, measurable function."
      >
        <div className="mb-4 flex flex-wrap items-end gap-4">
          <Field label="Dataset size">
            <Select
              aria-label="Dataset size"
              value={String(size)}
              onValueChange={(v) => setSize(Number(v))}
              options={SIZES.map((s) => ({ key: String(s), label: `${formatNumber(s)} rows` }))}
            />
          </Field>
          <Field label="Global filter" hint="Diacritic-insensitive, all columns">
            <input
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="Try 'quantum' or 'aud'…"
              className="h-9 w-64 rounded-md border border-border bg-surface px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </Field>
          <Field label="Group by" hint="Headers show ⌀ price and Σ stock">
            <Select
              aria-label="Group by"
              value={groupByKey}
              onValueChange={(v) => setGroupByKey(v ?? "none")}
              options={[
                { key: "none", label: "No grouping" },
                { key: "category", label: "Category" },
                { key: "status", label: "Status" },
                { key: "category-status", label: "Category → Status" },
              ]}
            />
          </Field>
        </div>

        <DataGrid
          aria-label="Products"
          data={data}
          columns={COLUMNS}
          getRowId={(p) => p.id}
          filterText={filterText}
          selectionMode="multiple"
          height={520}
          groupBy={GROUPINGS[groupByKey]}
          onSelectionChange={(keys) => setSelectedCount(keys.size)}
          onVisibleRowsChange={setVisibleRows}
          onCellEdit={onCellEdit}
        />
        <p className="mt-3 text-xs text-muted-foreground">
          {selectedCount > 0
            ? `${formatNumber(selectedCount)} row(s) selected — Ctrl+C to copy as TSV.`
            : "Select rows with Space / Shift+Arrow, then Ctrl+C to copy them as TSV."}
        </p>
      </Showcase>
    </div>
  );
}
