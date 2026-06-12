import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button, Checkbox, Input } from "@/framework";
import { useEventLog, type LogEntry } from "@/hooks/use-event-log";
import { useRenderMetrics } from "@/hooks/use-render-metrics";
import { formatDuration } from "@/utils/perf";
import { PageHeader, Showcase, MetricCard } from "@/playground/components/primitives";

export const Route = createFileRoute("/debug")({
  head: () => ({
    meta: [
      { title: "Debug — Forge" },
      { name: "description", content: "State inspection, event logging and render diagnostics." },
    ],
  }),
  component: Debug,
});

const LEVEL_COLOR: Record<LogEntry["level"], string> = {
  info: "text-muted-foreground",
  event: "text-primary",
  warn: "text-warning",
  error: "text-destructive",
};

function Debug() {
  const { entries, log, clear } = useEventLog();
  const metrics = useRenderMetrics();
  const [count, setCount] = useState(0);
  const [name, setName] = useState("forge");
  const [flag, setFlag] = useState(false);

  const state = { count, name, flag };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Diagnostics"
        title="Debug"
        description="State inspection, event logs and render metrics. The future effects engine will pipe controlled side-effects through a logger of this exact shape."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Render count" value={metrics.renderCount} accent />
        <MetricCard label="Last render" value={formatDuration(metrics.lastRenderMs)} />
        <MetricCard label="Avg render" value={formatDuration(metrics.averageRenderMs)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Showcase title="State inspector" description="Live component state as JSON.">
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <Button
              size="sm"
              onClick={() => {
                setCount((c) => c + 1);
                log("event", "increment", { count: count + 1 });
              }}
            >
              Increment
            </Button>
            <Input
              className="max-w-40"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                log("info", "name changed", e.target.value);
              }}
            />
            <Checkbox
              label="flag"
              checked={flag}
              onChange={(e) => {
                setFlag(e.target.checked);
                log("event", "toggle flag", e.target.checked);
              }}
            />
          </div>
          <pre className="overflow-x-auto rounded-lg border border-border bg-surface p-4 font-mono text-xs">
            {JSON.stringify(state, null, 2)}
          </pre>
        </Showcase>

        <Showcase title="Event log" description="Most recent first.">
          <div className="mb-3 flex gap-2">
            <Button size="sm" variant="outline" onClick={() => log("warn", "manual warning")}>
              Log warning
            </Button>
            <Button size="sm" variant="ghost" onClick={clear}>
              Clear
            </Button>
          </div>
          <div className="h-64 overflow-y-auto rounded-lg border border-border bg-surface p-3 font-mono text-xs">
            {entries.length === 0 ? (
              <p className="text-muted-foreground">No events yet — interact with the inspector.</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {entries.map((e) => (
                  <li key={e.id} className="flex gap-2">
                    <span className="text-muted-foreground">
                      {new Date(e.timestamp).toLocaleTimeString()}
                    </span>
                    <span className={LEVEL_COLOR[e.level]}>[{e.level}]</span>
                    <span className="flex-1">{e.message}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Showcase>
      </div>
    </div>
  );
}
