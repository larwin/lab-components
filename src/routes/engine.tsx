import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Pause, Play, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { inspect, type TransitionRecord } from "@/framework/core";
import { ShortcutProvider } from "@/framework/react";
import { Button, Listbox, TreeView } from "@/framework/primitives";
import { PageHeader, Showcase } from "@/playground/components/primitives";

export const Route = createFileRoute("/engine")({
  head: () => ({
    meta: [
      { title: "Engine Inspector — Forge" },
      {
        name: "description",
        content: "Live view of intents, state transitions and declarative effects.",
      },
    ],
  }),
  component: EnginePage,
});

/* Every machine broadcasts to the global inspector bus — this page is a
 * Redux-DevTools-style window over whatever you interact with below. */

const SOURCE_STYLES: Record<string, string> = {
  keyboard: "bg-primary/15 text-primary",
  pointer: "bg-success/15 text-success",
  shortcut: "bg-warning/15 text-warning",
  program: "bg-muted text-muted-foreground",
};

const stringify = (value: unknown): string =>
  JSON.stringify(value, (_key, v: unknown) => (v instanceof Set ? [...v] : v)) ?? "";

const FRUITS = [
  "Apple",
  "Apricot",
  "Banana",
  "Blueberry",
  "Cherry",
  "Fig",
  "Grape",
  "Kiwi",
  "Lemon",
  "Mango",
  "Orange",
  "Peach",
  "Pear",
  "Plum",
  "Raspberry",
];

const FILE_TREE = [
  {
    key: "src",
    value: "src",
    children: [
      {
        key: "core",
        value: "core",
        children: [
          { key: "runtime.ts", value: "runtime.ts" },
          { key: "behaviors.ts", value: "behaviors.ts" },
        ],
      },
      { key: "react", value: "react", children: [{ key: "adapter.ts", value: "adapter.ts" }] },
      { key: "index.ts", value: "index.ts" },
    ],
  },
  { key: "docs", value: "docs", children: [{ key: "rfc.md", value: "rfc-001.md" }] },
  { key: "package.json", value: "package.json" },
];

function EnginePage() {
  const [records, setRecords] = useState<TransitionRecord[]>([]);
  const [paused, setPaused] = useState(false);
  const [pressCount, setPressCount] = useState(0);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(
    () =>
      inspect((record) => {
        if (pausedRef.current) return;
        setRecords((prev) => [...prev.slice(-79), record]);
      }),
    [],
  );

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight });
  }, [records]);

  return (
    <ShortcutProvider>
      <div className="space-y-8">
        <PageHeader
          eyebrow="Next-gen engine"
          title="Engine Inspector"
          description="Every component below is a pure machine: Intent → Reducer → State → Effects. Interact with anything and watch the exact transitions flow through the runtime — keyboard, pointer and global shortcuts all converge on the same intents."
        />

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-6">
            <Showcase
              title="Button = Focusable + Pressable"
              description="Press it, or hit the global shortcut without focusing it — the journal shows the source of each activation."
            >
              <div className="flex items-center gap-4">
                <Button
                  variant="primary"
                  shortcut="Mod+j"
                  onPress={() => setPressCount((c) => c + 1)}
                >
                  Run action
                </Button>
                <span className="text-sm text-muted-foreground tabular-nums">
                  pressed {pressCount}×
                </span>
              </div>
            </Showcase>

            <Showcase
              title="Listbox = Focusable + Navigable + Selectable"
              description="Arrows, Home/End, PageUp/Down, Shift+Arrow ranges, Ctrl/Cmd+A, type to search ('ra' → Raspberry). Focus stays on the host: items are addressed via aria-activedescendant."
            >
              <Listbox
                aria-label="Fruits"
                items={FRUITS}
                getKey={(s) => s}
                getTextValue={(s) => s}
                selectionMode="multiple"
                height={240}
                className="overflow-auto"
              />
            </Showcase>

            <Showcase
              title="Tree = Listbox + Expandable"
              description="Same engine, one extra behavior. ArrowRight expands then dives; ArrowLeft climbs then collapses — the WAI-ARIA tree pattern, implemented once in the core."
            >
              <TreeView
                aria-label="Project files"
                nodes={FILE_TREE}
                defaultExpandedKeys={["src"]}
                selectionFollowsFocus
              />
            </Showcase>
          </div>

          <Showcase
            title="Transition journal"
            description="Live feed from the global inspector bus — intents in, effects out."
            contentClassName="p-0"
            className="lg:sticky lg:top-6 self-start"
          >
            <div className="flex items-center gap-2 border-b border-border px-3 py-2">
              <button
                type="button"
                onClick={() => setPaused((p) => !p)}
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
              >
                {paused ? <Play className="size-3" /> : <Pause className="size-3" />}
                {paused ? "Resume" : "Pause"}
              </button>
              <button
                type="button"
                onClick={() => setRecords([])}
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
              >
                <Trash2 className="size-3" />
                Clear
              </button>
              <span className="ml-auto font-mono text-xs text-muted-foreground">
                {records.length} transitions
              </span>
            </div>
            <div ref={feedRef} className="h-[560px] overflow-auto font-mono text-xs">
              {records.length === 0 && (
                <p className="p-6 text-center text-muted-foreground">
                  Interact with the components to see intents flowing.
                </p>
              )}
              {records.map((record) => (
                <div key={record.seq} className="border-b border-border/50 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">#{record.seq}</span>
                    <span className="font-semibold text-foreground">{record.intent.type}</span>
                    <span
                      className={cn(
                        "rounded-full px-1.5 py-0.5 text-[10px]",
                        SOURCE_STYLES[record.intent.source] ?? SOURCE_STYLES.program,
                      )}
                    >
                      {record.intent.source}
                    </span>
                    <span className="ml-auto text-[10px] text-muted-foreground">
                      {record.storeId}
                    </span>
                  </div>
                  {record.intent.payload !== undefined && (
                    <div className="mt-1 truncate text-muted-foreground">
                      payload {stringify(record.intent.payload)}
                    </div>
                  )}
                  {record.effects.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {record.effects.map((effect, i) => (
                        <span
                          key={i}
                          className="rounded bg-accent/60 px-1.5 py-0.5 text-[10px] text-accent-foreground"
                          title={stringify(effect.payload)}
                        >
                          → {effect.type}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Showcase>
        </div>
      </div>
    </ShortcutProvider>
  );
}
