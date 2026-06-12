import { useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TreeNode {
  id: string;
  label: ReactNode;
  icon?: ReactNode;
  children?: TreeNode[];
}

export interface TreeProps {
  nodes: TreeNode[];
  defaultExpanded?: string[];
  selectedId?: string;
  onSelect?: (id: string) => void;
  className?: string;
}

/**
 * Tree — a nested, expandable collection.
 *
 * Expansion state is local for now. Extension point: lift this into a shared
 * collection engine that can drive Tree, Menu and List from one state model.
 */
export function Tree({ nodes, defaultExpanded = [], selectedId, onSelect, className }: TreeProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(defaultExpanded));

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const renderNode = (node: TreeNode, depth: number): ReactNode => {
    const hasChildren = !!node.children?.length;
    const isOpen = expanded.has(node.id);
    const selected = node.id === selectedId;
    return (
      <li key={node.id} role="treeitem" aria-expanded={hasChildren ? isOpen : undefined}>
        <div
          className={cn(
            "flex cursor-pointer items-center gap-1.5 rounded-md py-1.5 pr-2 text-sm transition-colors hover:bg-muted",
            selected && "bg-accent text-accent-foreground",
          )}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => {
            if (hasChildren) toggle(node.id);
            onSelect?.(node.id);
          }}
        >
          <ChevronRight
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform",
              hasChildren ? (isOpen ? "rotate-90" : "") : "opacity-0",
            )}
          />
          {node.icon && <span className="text-muted-foreground">{node.icon}</span>}
          <span className="truncate">{node.label}</span>
        </div>
        {hasChildren && isOpen && (
          <ul role="group">{node.children!.map((c) => renderNode(c, depth + 1))}</ul>
        )}
      </li>
    );
  };

  return (
    <ul role="tree" className={cn("flex flex-col", className)}>
      {nodes.map((n) => renderNode(n, 0))}
    </ul>
  );
}
