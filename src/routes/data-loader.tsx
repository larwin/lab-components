import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw, XCircle } from "lucide-react";
import { arraySource } from "@/framework/core";
import { useDataSource } from "@/framework/react";
import { Button, DataGrid, type GridColumn } from "@/framework/primitives";
import { getProducts } from "@/playground/fixtures";
import type { Product } from "@/playground/fixtures/types";
import { formatCurrency, formatNumber } from "@/shared/utils/format";
import { Field, MetricCard, PageHeader, Showcase, StatusPill } from "@/components/primitives";

export const Route = createFileRoute("/data-loader")({
  head: () => ({
    meta: [
      { title: "Data Loader — Forge" },
      {
        name: "description",
        content:
          "Async data as a pure machine: server-side sort/filter, cursor pagination, infinite scroll, race-proof responses and request cancellation.",
      },
    ],
  }),
  component: DataLoaderPage,
});

const DATASET_SIZE = 200_000;
const PAGE_SIZE = 200;

const COLUMNS: GridColumn<Product>[] = [
  { id: "id", header: "ID", accessor: (p) => p.id, width: 110, sortable: true },
  { id: "name", header: "Product", accessor: (p) => p.name, sortable: true },
  { id: "category", header: "Category", accessor: (p) => p.category, width: 110, sortable: true },
  {
    id: "price",
    header: "Price",
    accessor: (p) => p.price,
    width: 110,
    align: "right",
    sortable: true,
    cell: (p) => formatCurrency(p.price),
  },
  {
    id: "stock",
    header: "Stock",
    accessor: (p) => p.stock,
    width: 90,
    align: "right",
    sortable: true,
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

function DataLoaderPage() {
  const [filterInput, setFilterInput] = useState("");

  // A "server": in-memory rows behind the DataSource contract, with real
  // latency. Swapping this for fetch('/api/products?...') changes one line.
  const source = useMemo(
    () =>
      arraySource(getProducts(DATASET_SIZE), {
        filterFields: ["id", "name", "category", "price", "stock", "status"],
        accessor: (row, field) => (row as unknown as Record<string, unknown>)[field],
        latency: () => 250 + Math.random() * 400,
      }),
    [],
  );

  const loader = useDataSource(source, { pageSize: PAGE_SIZE });
  const { state, refresh } = loader;
  const loading = state.status === "loading";

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Next-gen engine"
        title="Data Loader"
        description="Async data is a pure machine: every request is an effect with a sequence number, every response an intent. Stale responses are dropped by the reducer (races are impossible by construction), and starting a new query aborts the in-flight request. Type fast in the filter and watch the cancel counter."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Loaded"
          value={formatNumber(state.items.length)}
          unit={state.total !== null ? `of ${formatNumber(state.total)}` : "rows"}
          accent
        />
        <MetricCard
          label="Status"
          value={
            <span className="inline-flex items-center gap-2">
              {(loading || state.status === "loadingMore") && (
                <Loader2 className="size-4 animate-spin text-primary" />
              )}
              {state.status}
            </span>
          }
        />
        <MetricCard label="Page size" value={PAGE_SIZE} unit="rows / request" />
        <MetricCard label="Aborted requests" value={loader.abortedCount} unit="cancelled" />
      </div>

      <Showcase
        title="Server-side everything, infinite scroll"
        description="Sorting a column resets and refetches from the server (sort specs are serialized into the query). Scrolling near the end loads the next page. The grid does zero local sorting/filtering in this mode (clientQuery=false)."
      >
        <div className="mb-4 flex flex-wrap items-end gap-4">
          <Field
            label="Server filter"
            hint="Debounce-free on purpose — each keystroke cancels the previous request"
          >
            <input
              value={filterInput}
              onChange={(e) => {
                setFilterInput(e.target.value);
                loader.setFilter(e.target.value);
              }}
              placeholder="Try 'quantum'…"
              className="h-9 w-64 rounded-md border border-border bg-surface px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </Field>
          <Button onPress={() => loader.refresh()}>
            <RefreshCw className="size-4" />
            Refresh
          </Button>
          <Button onPress={() => loader.cancel()} disabled={state.inflightSeq === null}>
            <XCircle className="size-4" />
            Cancel request
          </Button>
        </div>

        {state.status === "error" ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-6 text-sm">
            <p className="font-medium text-destructive">Loading failed: {state.error}</p>
            <Button className="mt-3" onPress={() => loader.refresh()}>
              Retry
            </Button>
          </div>
        ) : (
          <DataGrid
            aria-label="Products (server mode)"
            data={state.items}
            columns={COLUMNS}
            getRowId={(p) => p.id}
            clientQuery={false}
            onSortChange={(sort) => loader.setSort(sort)}
            onApproachEnd={() => loader.loadMore()}
            selectionMode="multiple"
            height={480}
          />
        )}

        <p className="mt-3 text-xs text-muted-foreground">
          {state.status === "loadingMore" && "Loading next page…"}
          {state.status === "ready" && !state.hasMore && "All rows loaded."}
          {state.status === "ready" &&
            state.hasMore &&
            `Scroll to the bottom to load the next ${formatNumber(PAGE_SIZE)} rows.`}
          {loading && "Loading…"}
        </p>
      </Showcase>
    </div>
  );
}
