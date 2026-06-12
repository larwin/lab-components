import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { Select } from "@/framework";
import { getProducts } from "@/fixtures";
import { DATASET_SIZES, formatDuration, measure } from "@/utils/perf";
import { formatCurrency, formatNumber } from "@/utils/format";
import {
  PageHeader,
  Showcase,
  Field,
  MetricCard,
  StatusPill,
} from "@/playground/components/primitives";

export const Route = createFileRoute("/virtualization")({
  head: () => ({
    meta: [
      { title: "Virtualization — Forge" },
      {
        name: "description",
        content: "Windowed rendering of large datasets with live performance metrics.",
      },
    ],
  }),
  component: Virtualization,
});

const ROW_HEIGHT = 44;
const OVERSCAN = 6;

function Virtualization() {
  const [size, setSize] = useState(10_000);
  const [scrollTop, setScrollTop] = useState(0);
  const viewportRef = useRef<HTMLDivElement>(null);
  const viewportHeight = 420;

  const { data, genMs } = useMemo(() => {
    const { result, sample } = measure("generate", () => getProducts(size));
    return { data: result, genMs: sample.duration };
  }, [size]);

  const total = data.length;
  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const visibleCount = Math.ceil(viewportHeight / ROW_HEIGHT) + OVERSCAN * 2;
  const endIndex = Math.min(total, startIndex + visibleCount);
  const visible = data.slice(startIndex, endIndex);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Performance"
        title="Virtualization"
        description="Only the rows in view are mounted. Scroll 10,000 rows smoothly while the DOM holds a few dozen nodes. This is the reference for the future virtualization engine."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Dataset" value={formatNumber(total)} unit="rows" accent />
        <MetricCard label="Mounted" value={visible.length} unit="nodes" />
        <MetricCard label="Generated" value={formatDuration(genMs)} />
        <MetricCard
          label="DOM saved"
          value={`${Math.round((1 - visible.length / total) * 100)}%`}
        />
      </div>

      <Showcase title="Windowed list" description="Absolute-positioned rows over a spacer.">
        <div className="mb-4 max-w-xs">
          <Field label="Dataset size">
            <Select
              value={String(size)}
              onChange={(e) => {
                setSize(Number(e.target.value));
                setScrollTop(0);
                if (viewportRef.current) viewportRef.current.scrollTop = 0;
              }}
              options={DATASET_SIZES.map((s) => ({
                label: `${formatNumber(s)} rows`,
                value: String(s),
              }))}
            />
          </Field>
        </div>

        <div
          ref={viewportRef}
          onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
          className="overflow-auto rounded-lg border border-border bg-surface"
          style={{ height: viewportHeight }}
        >
          <div style={{ height: total * ROW_HEIGHT, position: "relative" }}>
            {visible.map((p, i) => {
              const index = startIndex + i;
              return (
                <div
                  key={p.id}
                  className="absolute flex w-full items-center gap-4 border-b border-border px-4 text-sm"
                  style={{ top: index * ROW_HEIGHT, height: ROW_HEIGHT }}
                >
                  <span className="w-16 font-mono text-xs text-muted-foreground">{index}</span>
                  <span className="flex-1 truncate font-medium">{p.name}</span>
                  <span className="w-28 font-mono text-xs text-muted-foreground">{p.sku}</span>
                  <span className="w-24 text-right tabular-nums">{formatCurrency(p.price)}</span>
                  <span className="w-24 text-right">
                    <StatusPill status={p.status} />
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </Showcase>
    </div>
  );
}
