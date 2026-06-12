import { memo, useId, useMemo, useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  createCollection,
  composeMachine,
  expandable,
  expandIntents,
  focusable,
  focusIntents,
  navigable,
  navIntents,
  selectable,
  selectIntents,
  type Collection,
  type CollectionBehaviorConfig,
  type CollectionSourceNode,
  type ExpandableSlice,
  type Key,
  type NavigableSlice,
  type SelectableSlice,
  type SelectionMode,
} from "@/framework/core";
import {
  createItemRegistry,
  useComposedMachine,
  useForgeEffects,
  useKeymap,
  useLiveRef,
} from "@/framework/react";

/**
 * TreeView — hierarchy on the same collection engine as Listbox.
 * Adding the Expandable behavior to the composition is the *entire* difference
 * in logic; everything else (navigation, selection, typeahead) is shared.
 * Implements the WAI-ARIA tree pattern with aria-activedescendant.
 */

export interface TreeSourceNode<T> extends CollectionSourceNode<T> {
  children?: TreeSourceNode<T>[];
}

export interface TreeViewProps<T> {
  nodes: readonly TreeSourceNode<T>[];
  defaultExpandedKeys?: readonly Key[];
  selectionMode?: SelectionMode;
  selectionFollowsFocus?: boolean;
  locale?: string;
  onSelectionChange?: (selectedKeys: ReadonlySet<Key>) => void;
  onExpandedChange?: (expandedKeys: ReadonlySet<Key>) => void;
  renderItem?: (args: {
    node: { key: Key; value: T };
    selected: boolean;
    focused: boolean;
    expanded: boolean;
  }) => ReactNode;
  className?: string;
  "aria-label": string;
}

const domId = (base: string, key: Key) => `${base}-${key.replace(/[^a-zA-Z0-9_-]/g, "_")}`;

const treeBehaviors = [focusable, navigable, expandable, selectable] as const;

export function TreeView<T>(props: TreeViewProps<T>) {
  const { nodes, selectionMode = "single", className, renderItem } = props;

  const baseId = useId();
  const collection = useMemo(() => createCollection(nodes), [nodes]);
  const live = useLiveRef({ collection, props });
  const [registry] = useState(createItemRegistry);

  const { state, dispatch, store, composed } = useComposedMachine(() => {
    const config: CollectionBehaviorConfig & { defaultExpandedKeys?: readonly Key[] } = {
      getCollection: () => live.current.collection as Collection<unknown>,
      defaultExpandedKeys: props.defaultExpandedKeys,
      get selectionMode() {
        return live.current.props.selectionMode ?? "single";
      },
      get selectionFollowsFocus() {
        return live.current.props.selectionFollowsFocus;
      },
      get locale() {
        return live.current.props.locale;
      },
    };
    return composeMachine("tree", treeBehaviors, config);
  });

  const nav = state.navigable as NavigableSlice;
  const selection = state.selectable as SelectableSlice;
  const expansion = state.expandable as ExpandableSlice;
  const visibleKeys = collection.visibleKeys(expansion.expandedKeys);

  useForgeEffects(store, {
    registry,
    events: {
      selectionChange: (detail) =>
        live.current.props.onSelectionChange?.(
          (detail as { selectedKeys: ReadonlySet<Key> }).selectedKeys,
        ),
      expandedChange: (detail) =>
        live.current.props.onExpandedChange?.(
          (detail as { expandedKeys: ReadonlySet<Key> }).expandedKeys,
        ),
    },
  });

  const onKeyDown = useKeymap(() => composed.keymap(store.getState()), dispatch);

  const [handlers] = useState(() => ({
    onRowPointerDown: (key: Key, e: React.PointerEvent) => {
      dispatch(navIntents.move({ key }, "pointer"));
      dispatch(
        selectIntents.select(
          { key, toggle: e.ctrlKey || e.metaKey, extend: e.shiftKey },
          "pointer",
        ),
      );
    },
    onChevronPointerDown: (key: Key, e: React.PointerEvent) => {
      e.stopPropagation();
      dispatch(navIntents.move({ key }, "pointer"));
      dispatch(expandIntents.toggle({ key }, "pointer"));
    },
  }));

  return (
    <ul
      role="tree"
      id={baseId}
      tabIndex={0}
      aria-label={props["aria-label"]}
      aria-activedescendant={nav.focusedKey !== null ? domId(baseId, nav.focusedKey) : undefined}
      {...composed.aria(state)}
      onKeyDown={onKeyDown}
      onFocus={() => dispatch(focusIntents.focus({}, "keyboard"))}
      onBlur={() => dispatch(focusIntents.blur(undefined))}
      className={cn(
        "flex flex-col gap-0.5 rounded-lg border border-border bg-surface p-1 outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      {visibleKeys.map((key) => {
        const node = collection.getNode(key)!;
        const expanded = expansion.expandedKeys.has(key);
        return (
          <TreeRow
            key={key}
            itemKey={key}
            id={domId(baseId, key)}
            refCallback={registry.register(key)}
            label={
              renderItem
                ? renderItem({
                    node: { key, value: node.value },
                    selected: selection.selectedKeys.has(key),
                    focused: nav.focusedKey === key,
                    expanded,
                  })
                : node.textValue
            }
            depth={node.depth}
            hasChildren={node.hasChildren}
            setSize={
              node.parentKey === null
                ? collection.rootKeys.length
                : collection.getNode(node.parentKey)!.childKeys.length
            }
            posInSet={node.indexInParent + 1}
            expanded={node.hasChildren ? expanded : undefined}
            selected={selection.selectedKeys.has(key)}
            focused={nav.focusedKey === key}
            disabled={node.disabled}
            onRowPointerDown={handlers.onRowPointerDown}
            onChevronPointerDown={handlers.onChevronPointerDown}
          />
        );
      })}
    </ul>
  );
}

interface TreeRowProps {
  itemKey: Key;
  id: string;
  refCallback: (el: HTMLElement | null) => void;
  label: ReactNode;
  depth: number;
  hasChildren: boolean;
  setSize: number;
  posInSet: number;
  expanded: boolean | undefined;
  selected: boolean;
  focused: boolean;
  disabled: boolean;
  onRowPointerDown: (key: Key, e: React.PointerEvent) => void;
  onChevronPointerDown: (key: Key, e: React.PointerEvent) => void;
}

const TreeRow = memo(function TreeRow({
  itemKey,
  id,
  refCallback,
  label,
  depth,
  hasChildren,
  setSize,
  posInSet,
  expanded,
  selected,
  focused,
  disabled,
  onRowPointerDown,
  onChevronPointerDown,
}: TreeRowProps) {
  return (
    <li
      id={id}
      ref={refCallback}
      role="treeitem"
      aria-level={depth + 1}
      aria-setsize={setSize}
      aria-posinset={posInSet}
      aria-expanded={expanded}
      aria-selected={selected}
      aria-disabled={disabled || undefined}
      data-focused={focused || undefined}
      onPointerDown={disabled ? undefined : (e) => onRowPointerDown(itemKey, e)}
      style={{ paddingInlineStart: `${depth * 16 + 4}px` }}
      className={cn(
        "flex cursor-default items-center gap-1.5 rounded-md py-1.5 pr-2 text-sm transition-colors",
        focused && "ring-2 ring-ring ring-inset",
        selected ? "bg-accent text-accent-foreground" : "hover:bg-muted",
        disabled && "opacity-50",
      )}
    >
      <span
        onPointerDown={hasChildren ? (e) => onChevronPointerDown(itemKey, e) : undefined}
        className="flex size-5 shrink-0 items-center justify-center"
      >
        <ChevronRight
          className={cn(
            "size-4 text-muted-foreground transition-transform",
            hasChildren ? (expanded ? "rotate-90" : "") : "opacity-0",
          )}
        />
      </span>
      <span className="truncate">{label}</span>
    </li>
  );
});
