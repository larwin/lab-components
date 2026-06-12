import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Folder, File, Settings, Trash2, Copy, Download } from "lucide-react";
import { List, Tree, Menu, type TreeNode } from "@/framework";
import { PageHeader, Showcase } from "@/playground/components/primitives";

export const Route = createFileRoute("/collections")({
  head: () => ({
    meta: [
      { title: "Collections — Forge" },
      {
        name: "description",
        content: "List, tree and menu collection examples in the Forge playground.",
      },
    ],
  }),
  component: Collections,
});

const LIST_ITEMS = [
  { id: "1", label: "Behaviors engine", description: "press · hover · focus · drag" },
  { id: "2", label: "Intents engine", description: "declarative actions" },
  { id: "3", label: "Effects engine", description: "controlled side-effects" },
  { id: "4", label: "Collection engine", description: "items · selection · navigation" },
  { id: "5", label: "Virtualization engine", description: "windowed rendering", disabled: true },
];

const TREE_NODES: TreeNode[] = [
  {
    id: "src",
    label: "framework",
    icon: <Folder className="size-4" />,
    children: [
      {
        id: "components",
        label: "components",
        icon: <Folder className="size-4" />,
        children: [
          { id: "btn", label: "Button.tsx", icon: <File className="size-4" /> },
          { id: "list", label: "List.tsx", icon: <File className="size-4" /> },
          { id: "grid", label: "DataGrid/", icon: <Folder className="size-4" /> },
        ],
      },
      { id: "engines", label: "engines", icon: <Folder className="size-4" /> },
      { id: "collections", label: "collections", icon: <Folder className="size-4" /> },
    ],
  },
];

function Collections() {
  const [selected, setSelected] = useState("4");
  const [treeSel, setTreeSel] = useState("list");

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Collection engine"
        title="Collections"
        description="Lists, trees and menus reduce to the same primitives — items, selection and navigation. These reference implementations define the contracts a unified engine will adopt."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Showcase
          title="List"
          description="Single-select with roving keyboard navigation (↑ ↓ Home End)."
        >
          <List
            items={LIST_ITEMS}
            selectedId={selected}
            onSelect={setSelected}
            aria-label="Engines"
          />
        </Showcase>

        <Showcase title="Tree" description="Nested, expandable structure.">
          <Tree
            nodes={TREE_NODES}
            defaultExpanded={["src", "components"]}
            selectedId={treeSel}
            onSelect={setTreeSel}
          />
        </Showcase>
      </div>

      <Showcase title="Menu" description="Sectioned action menu with shortcuts.">
        <div className="flex justify-center py-2">
          <Menu
            sections={[
              {
                id: "edit",
                items: [
                  { id: "copy", label: "Copy", icon: <Copy />, shortcut: "⌘C" },
                  { id: "settings", label: "Settings", icon: <Settings />, shortcut: "⌘," },
                  { id: "export", label: "Export", icon: <Download />, shortcut: "⌘E" },
                ],
              },
              {
                id: "danger",
                items: [{ id: "delete", label: "Delete", icon: <Trash2 />, danger: true }],
              },
            ]}
          />
        </div>
      </Showcase>
    </div>
  );
}
