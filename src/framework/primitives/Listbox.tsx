import { memo, useId, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  collectionFromArray,
  composeMachine,
  focusable,
  focusIntents,
  navigable,
  navIntents,
  selectable,
  selectIntents,
  scrollToItem,
  type Collection,
  type CollectionBehaviorConfig,
  type CollectionNode,
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
  useVirtualizer,
} from "@/framework/react";

/**
 * Listbox — the reference primitive for the collection engine.
 *
 * All logic lives in the pure core: [Focusable + Navigable + Selectable]
 * composed into one machine. This file only renders state and forwards DOM
 * events as intents. Keyboard focus uses aria-activedescendant (the host keeps
 * DOM focus), which is what lets navigation work over *virtualized* items that
 * are not mounted.
 */

export interface ListboxProps<T> {
  items: readonly T[];
  getKey: (item: T, index: number) => Key;
  getTextValue?: (item: T) => string;
  isDisabled?: (item: T) => boolean;
  selectionMode?: SelectionMode;
  selectionFollowsFocus?: boolean;
  wrap?: boolean;
  locale?: string;
  onSelectionChange?: (selectedKeys: ReadonlySet<Key>) => void;
  /** Slot: full control over option content. */
  renderItem?: (args: {
    node: CollectionNode<T>;
    selected: boolean;
    focused: boolean;
  }) => ReactNode;
  /** Virtualize when item count is large. */
  virtualized?: boolean;
  itemHeight?: number;
  height?: number;
  className?: string;
  "aria-label": string;
}

const domId = (base: string, key: Key) => `${base}-${key.replace(/[^a-zA-Z0-9_-]/g, "_")}`;

const listboxBehaviors = [focusable, navigable, selectable] as const;

export function Listbox<T>(props: ListboxProps<T>) {
  const {
    items,
    getKey,
    getTextValue,
    isDisabled,
    selectionMode = "single",
    virtualized = false,
    itemHeight = 36,
    height,
    className,
    renderItem,
  } = props;

  const baseId = useId();
  const collection = useMemo(
    () => collectionFromArray(items, { getKey, getTextValue, isDisabled }),
    [items, getKey, getTextValue, isDisabled],
  );

  const live = useLiveRef({ collection, props });
  const [registry] = useState(createItemRegistry);

  const { state, dispatch, store, composed } = useComposedMachine(() => {
    const config: CollectionBehaviorConfig = {
      getCollection: () => live.current.collection as Collection<unknown>,
      get selectionMode() {
        return live.current.props.selectionMode ?? "single";
      },
      get selectionFollowsFocus() {
        return live.current.props.selectionFollowsFocus;
      },
      get wrap() {
        return live.current.props.wrap;
      },
      get locale() {
        return live.current.props.locale;
      },
    };
    return composeMachine("listbox", listboxBehaviors, config);
  });

  const nav = state.navigable as NavigableSlice;
  const selection = state.selectable as SelectableSlice;
  const visibleKeys = collection.visibleKeys();

  const virtualizer = useVirtualizer({
    count: virtualized ? visibleKeys.length : 0,
    estimateSize: itemHeight,
  });

  useForgeEffects(store, {
    registry,
    events: {
      selectionChange: (detail) =>
        live.current.props.onSelectionChange?.(
          (detail as { selectedKeys: ReadonlySet<Key> }).selectedKeys,
        ),
    },
    overrides: virtualized
      ? {
          [scrollToItem.type]: (effect) => {
            const key = (effect.payload as { key: Key }).key;
            const index = live.current.collection.visibleKeys().indexOf(key);
            if (index >= 0) virtualizer.scrollToIndex(index);
          },
        }
      : undefined,
  });

  const onKeyDown = useKeymap(() => composed.keymap(store.getState()), dispatch);

  const [onItemPointerDown] = useState(() => (key: Key, e: React.PointerEvent) => {
    dispatch(navIntents.move({ key }, "pointer"));
    dispatch(
      selectIntents.select({ key, toggle: e.ctrlKey || e.metaKey, extend: e.shiftKey }, "pointer"),
    );
  });

  const renderOption = (key: Key, style?: CSSProperties) => {
    const node = collection.getNode(key)!;
    return (
      <ListboxOption
        key={key}
        itemKey={key}
        id={domId(baseId, key)}
        refCallback={registry.register(key)}
        label={renderItem ? null : node.textValue}
        custom={renderItem?.({
          node,
          selected: selection.selectedKeys.has(key),
          focused: nav.focusedKey === key,
        })}
        selected={selection.selectedKeys.has(key)}
        focused={nav.focusedKey === key}
        disabled={node.disabled}
        style={style}
        onItemPointerDown={onItemPointerDown}
      />
    );
  };

  const hostProps = {
    role: "listbox",
    id: baseId,
    tabIndex: 0,
    "aria-label": props["aria-label"],
    "aria-activedescendant": nav.focusedKey !== null ? domId(baseId, nav.focusedKey) : undefined,
    ...composed.aria(state),
    onKeyDown,
    onFocus: () => dispatch(focusIntents.focus({}, "keyboard")),
    onBlur: () => dispatch(focusIntents.blur(undefined)),
  };

  if (virtualized) {
    return (
      <div
        {...hostProps}
        ref={virtualizer.scrollElementRef}
        className={cn(
          "overflow-auto rounded-lg border border-border bg-surface outline-none focus-visible:ring-2 focus-visible:ring-ring",
          className,
        )}
        style={{ height: height ?? 320 }}
      >
        <div style={{ height: virtualizer.range.totalSize, position: "relative" }}>
          {virtualizer.range.items.map((item) =>
            renderOption(visibleKeys[item.index], {
              position: "absolute",
              top: 0,
              transform: `translateY(${item.start}px)`,
              height: item.size,
              left: 0,
              right: 0,
            }),
          )}
        </div>
      </div>
    );
  }

  return (
    <ul
      {...hostProps}
      className={cn(
        "flex flex-col gap-0.5 rounded-lg border border-border bg-surface p-1 outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
      style={height ? { height, overflow: "auto" } : undefined}
    >
      {visibleKeys.map((key) => renderOption(key))}
    </ul>
  );
}

interface ListboxOptionProps {
  itemKey: Key;
  id: string;
  refCallback: (el: HTMLElement | null) => void;
  label: ReactNode;
  custom: ReactNode;
  selected: boolean;
  focused: boolean;
  disabled: boolean;
  style?: CSSProperties;
  onItemPointerDown: (key: Key, e: React.PointerEvent) => void;
}

/** Memoized so navigating/selecting re-renders only the affected options. */
const ListboxOption = memo(function ListboxOption({
  itemKey,
  id,
  refCallback,
  label,
  custom,
  selected,
  focused,
  disabled,
  style,
  onItemPointerDown,
}: ListboxOptionProps) {
  return (
    <li
      id={id}
      ref={refCallback}
      role="option"
      aria-selected={selected}
      aria-disabled={disabled || undefined}
      data-focused={focused || undefined}
      style={style}
      onPointerDown={disabled ? undefined : (e) => onItemPointerDown(itemKey, e)}
      className={cn(
        "flex cursor-default items-center rounded-md px-3 py-2 text-sm transition-colors",
        focused && "ring-2 ring-ring ring-inset",
        selected ? "bg-accent text-accent-foreground" : "hover:bg-muted",
        disabled && "opacity-50",
      )}
    >
      {custom ?? <span className="truncate">{label}</span>}
    </li>
  );
});
