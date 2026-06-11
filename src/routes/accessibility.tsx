import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button, List } from "@/framework";
import { PageHeader, Showcase } from "@/playground/components/primitives";

export const Route = createFileRoute("/accessibility")({
  head: () => ({
    meta: [
      { title: "Accessibility — Forge" },
      { name: "description", content: "Keyboard navigation, focus management and ARIA examples." },
    ],
  }),
  component: A11y,
});

const ITEMS = Array.from({ length: 6 }, (_, i) => ({
  id: String(i),
  label: `Option ${i + 1}`,
  description: "Use arrow keys to move focus",
}));

function A11y() {
  const [selected, setSelected] = useState("0");

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Platform"
        title="Accessibility"
        description="Primitives ship with keyboard support, visible focus and correct ARIA roles. The future accessibility engine will centralize focus traps and keyboard maps."
      />

      <Showcase title="Keyboard navigation" description="Tab into the list, then use ↑ ↓ Home End.">
        <div className="mb-4 flex flex-wrap gap-2 text-xs">
          <span className="kbd">Tab</span>
          <span className="kbd">↑</span>
          <span className="kbd">↓</span>
          <span className="kbd">Home</span>
          <span className="kbd">End</span>
        </div>
        <div className="max-w-sm">
          <List items={ITEMS} selectedId={selected} onSelect={setSelected} aria-label="Options" />
        </div>
      </Showcase>

      <div className="grid gap-6 lg:grid-cols-2">
        <Showcase title="Focus handling" description="All interactive elements show a visible focus ring.">
          <div className="flex flex-wrap gap-3">
            <Button variant="primary">Focus me</Button>
            <Button variant="outline">And me</Button>
            <Button variant="ghost">Then me</Button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Focus rings use the <code className="font-mono">--ring</code> token and stay
            visible only for keyboard users (<code className="font-mono">:focus-visible</code>).
          </p>
        </Showcase>

        <Showcase title="ARIA roles" description="Semantic roles are applied automatically.">
          <ul className="flex flex-col gap-2 font-mono text-xs">
            <li className="rounded-md border border-border bg-surface p-2">List → role="listbox" / option</li>
            <li className="rounded-md border border-border bg-surface p-2">Tree → role="tree" / treeitem</li>
            <li className="rounded-md border border-border bg-surface p-2">Menu → role="menu" / menuitem</li>
            <li className="rounded-md border border-border bg-surface p-2">RadioGroup → role="radiogroup"</li>
          </ul>
        </Showcase>
      </div>
    </div>
  );
}
