import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Boxes,
  Layers,
  Gauge,
  Accessibility,
  Table2,
  Cpu,
} from "lucide-react";
import { PageHeader, Showcase, CodeBlock } from "@/playground/components/primitives";
import { ENGINES } from "@/framework/engines";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Forge — Component Framework Lab" },
      {
        name: "description",
        content:
          "Forge is a developer playground and clean architecture foundation for building a next-generation React component framework.",
      },
    ],
  }),
  component: Home,
});

const PILLARS = [
  {
    icon: Layers,
    title: "Clean architecture",
    body: "Components, collections, engines and the grid are isolated so each can evolve independently.",
  },
  {
    icon: Table2,
    title: "Collection-first",
    body: "Lists, trees, menus and the data grid are treated as one family of collection problems.",
  },
  {
    icon: Gauge,
    title: "Performance ready",
    body: "Seeded datasets up to 10,000 rows and reusable timing utilities for real benchmarks.",
  },
  {
    icon: Accessibility,
    title: "Accessible by default",
    body: "Keyboard navigation, focus management and ARIA wiring baked into the primitives.",
  },
];

const TREE = `src/
├─ routes/            playground pages (file-based)
├─ playground/        navigation, showcase UI, controls
├─ framework/
│  ├─ components/     Button · Input · List · Tree · Menu · DataGrid …
│  ├─ collections/   unified collection engine (experimental)
│  ├─ engines/       behaviors · intents · effects · virtualization …
│  └─ index.ts       public entry point
├─ fixtures/         seeded users / products / orders datasets
├─ hooks/            render metrics · event log
├─ themes/           theme provider + design tokens
├─ utils/            perf timing · formatting
└─ docs/             architecture · roadmap`;

function Home() {
  return (
    <div className="space-y-12">
      <section className="relative overflow-hidden rounded-2xl border border-border bg-card p-10 bg-grid">
        <div className="relative max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 font-mono text-xs text-muted-foreground">
            <span className="size-1.5 rounded-full bg-success" />
            v0.1 · architecture foundation
          </span>
          <h1 className="mt-5 font-sans text-5xl font-bold tracking-tight">
            The <span className="text-gradient-brand">Forge</span> component lab
          </h1>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            A developer playground and clean-room architecture for a
            next-generation React component framework. This is the foundation —
            structured so future work can grow it into a complete, production-grade
            library.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              to="/components"
              className="inline-flex items-center gap-2 rounded-md [background-image:var(--gradient-brand)] px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
            >
              Browse components <ArrowRight className="size-4" />
            </Link>
            <Link
              to="/data-grid"
              className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-muted"
            >
              <Table2 className="size-4" /> Explore the Data Grid
            </Link>
          </div>
        </div>
        <Boxes className="pointer-events-none absolute -top-8 -right-8 size-64 text-primary/5" />
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PILLARS.map((p) => (
          <div key={p.title} className="rounded-xl border border-border bg-card p-5">
            <div className="flex size-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
              <p.icon className="size-5" />
            </div>
            <h3 className="mt-4 font-sans text-sm font-semibold">{p.title}</h3>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{p.body}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Showcase
          title="Project structure"
          description="A clear separation of concerns from day one."
        >
          <CodeBlock label="tree" code={TREE} />
        </Showcase>

        <Showcase
          title="Engine roadmap"
          description="Reserved extension points future agents can implement cleanly."
        >
          <ul className="flex flex-col gap-2">
            {ENGINES.map((e) => (
              <li
                key={e.id}
                className="flex items-start gap-3 rounded-lg border border-border bg-surface p-3"
              >
                <Cpu className="mt-0.5 size-4 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{e.name}</span>
                    <span
                      className={
                        "rounded-full px-1.5 py-0.5 font-mono text-[10px] uppercase " +
                        (e.status === "experimental"
                          ? "bg-warning/15 text-warning"
                          : "bg-muted text-muted-foreground")
                      }
                    >
                      {e.status}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{e.summary}</p>
                </div>
              </li>
            ))}
          </ul>
        </Showcase>
      </section>
    </div>
  );
}
