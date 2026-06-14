import { useId, useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import {
  collectionFromArray,
  composeMachine,
  createSearchCollator,
  dismissable,
  dismissIntents,
  focusable,
  navigable,
  navIntents,
  searchable,
  searchIntents,
  selectable,
  selectIntents,
  type Collection,
  type CollectionBehaviorConfig,
  type DismissableSlice,
  type DismissReason,
  type Key,
  type NavigableSlice,
  type SearchableSlice,
  type SelectableSlice,
} from "@/framework/core";
import {
  createItemRegistry,
  Overlay,
  useComposedMachine,
  useForgeEffects,
  useKeymap,
  useLiveRef,
} from "@/framework/react";

/**
 * ComboBox — Focusable + Searchable + Navigable + Selectable + Dismissable.
 *
 * The query lives *in the machine* (journaled, replayable); the host derives a
 * filtered collection from it and feeds it back through `getCollection()`, so
 * navigation/selection transparently operate on the filtered universe. The
 * text input keeps DOM focus the whole time — options are addressed via
 * aria-activedescendant (combobox ARIA pattern).
 */

export interface ComboBoxProps<T> {
  items: readonly T[];
  getKey: (item: T, index: number) => Key;
  getTextValue: (item: T) => string;
  isDisabled?: (item: T) => boolean;
  onSelectionChange?: (key: Key | null, item: T | null) => void;
  placeholder?: string;
  locale?: string;
  className?: string;
  "aria-label": string;
}

const domId = (base: string, key: Key) => `${base}-${key.replace(/[^a-zA-Z0-9_-]/g, "_")}`;

const comboBehaviors = [focusable, searchable, navigable, selectable, dismissable] as const;

export function ComboBox<T>(props: ComboBoxProps<T>) {
  const { items, getKey, getTextValue, isDisabled, placeholder, locale = "en", className } = props;

  const baseId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const [registry] = useState(createItemRegistry);
  const [inputValue, setInputValue] = useState("");

  const fullCollection = useMemo(
    () => collectionFromArray(items, { getKey, getTextValue, isDisabled }),
    [items, getKey, getTextValue, isDisabled],
  );

  const live = useLiveRef({ props, filtered: fullCollection });

  const { state, dispatch, store, composed } = useComposedMachine(() => {
    const config: CollectionBehaviorConfig = {
      getCollection: () => live.current.filtered as Collection<unknown>,
      selectionMode: "single",
      wrap: true,
      get locale() {
        return live.current.props.locale;
      },
    };
    return composeMachine("combobox", comboBehaviors, config);
  });

  const nav = state.navigable as NavigableSlice;
  const selection = state.selectable as SelectableSlice;
  const open = (state.dismissable as DismissableSlice).open;
  const query = (state.searchable as SearchableSlice).query;

  // Derive the filtered collection from the machine's query (culture-aware
  // prefix + substring match), then publish it for the config getter.
  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return fullCollection;
    const collator = createSearchCollator(locale);
    const matches = (text: string): boolean => {
      if (text.length < q.length) return false;
      for (let i = 0; i + q.length <= text.length; i++) {
        if (collator.compare(text.slice(i, i + q.length), q) === 0) return true;
      }
      return false;
    };
    return collectionFromArray(
      items.filter((item) => matches(getTextValue(item))),
      { getKey, getTextValue, isDisabled },
    );
  }, [query, fullCollection, items, getKey, getTextValue, isDisabled, locale]);
  live.current.filtered = filtered;

  const visibleKeys = filtered.visibleKeys();
  const selectedKey = [...selection.selectedKeys][0] ?? null;

  useForgeEffects(store, {
    registry,
    events: {
      selectionChange: (detail) => {
        const key = [...(detail as { selectedKeys: ReadonlySet<Key> }).selectedKeys][0] ?? null;
        const node = key !== null ? live.current.filtered.getNode(key) : null;
        setInputValue(node ? node.textValue : "");
        dispatch(searchIntents.clear(undefined, "program"));
        dispatch(dismissIntents.close({ reason: "select" }, "program"));
        props.onSelectionChange?.(key, (node?.value as T) ?? null);
      },
    },
  });

  // The input owns text editing: exclude the typeahead binding, keep
  // navigation/selection/dismiss keys.
  const onKeyDown = useKeymap(
    () =>
      composed
        .keymap(store.getState())
        .filter((b) => b.keys !== "@printable" && b.keys !== "Space"),
    dispatch,
  );

  return (
    <div ref={anchorRef} className={cn("relative w-64", className)}>
      <input
        ref={inputRef}
        id={baseId}
        type="text"
        role="combobox"
        aria-label={props["aria-label"]}
        aria-expanded={open}
        aria-controls={open ? `${baseId}-listbox` : undefined}
        aria-activedescendant={
          open && nav.focusedKey !== null ? domId(baseId, nav.focusedKey) : undefined
        }
        aria-autocomplete="list"
        autoComplete="off"
        placeholder={placeholder}
        value={inputValue}
        onChange={(e) => {
          setInputValue(e.target.value);
          dispatch(searchIntents.setQuery({ query: e.target.value }, "keyboard"));
          dispatch(dismissIntents.open(undefined, "keyboard"));
          dispatch(navIntents.first(undefined, "keyboard"));
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && !open) {
            e.preventDefault();
            dispatch(dismissIntents.open(undefined, "keyboard"));
            dispatch(navIntents.first(undefined, "keyboard"));
            return;
          }
          onKeyDown(e);
        }}
        onBlur={() => {
          // Re-sync the visible text with the actual selection.
          const node = selectedKey !== null ? fullCollection.getNode(selectedKey) : null;
          setInputValue(node?.textValue ?? "");
        }}
        className="h-9 w-full rounded-md border border-border bg-surface px-3 pr-9 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label="Toggle options"
        onClick={() => {
          inputRef.current?.focus();
          if (open) {
            dispatch(dismissIntents.close(undefined, "pointer"));
          } else {
            dispatch(dismissIntents.open(undefined, "pointer"));
            dispatch(navIntents.first(undefined, "pointer"));
          }
        }}
        className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-muted-foreground hover:text-foreground"
      >
        <ChevronsUpDown className="size-4" />
      </button>

      <Overlay
        open={open}
        onDismiss={(reason: DismissReason) => dispatch(dismissIntents.close({ reason }, "program"))}
        anchorRef={anchorRef}
        placement="bottom-start"
        offset={4}
        matchAnchorWidth
        restoreFocus={false}
      >
        <ul
          id={`${baseId}-listbox`}
          role="listbox"
          aria-label={props["aria-label"]}
          className="max-h-72 overflow-auto rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-lg"
        >
          {visibleKeys.length === 0 && (
            <li className="px-3 py-2 text-sm text-muted-foreground">No results.</li>
          )}
          {visibleKeys.map((key) => {
            const node = filtered.getNode(key)!;
            const focused = nav.focusedKey === key;
            const selected = selection.selectedKeys.has(key);
            return (
              <li
                key={key}
                id={domId(baseId, key)}
                ref={registry.register(key)}
                role="option"
                aria-selected={selected}
                aria-disabled={node.disabled || undefined}
                data-focused={focused || undefined}
                onPointerEnter={() =>
                  !node.disabled && dispatch(navIntents.move({ key }, "pointer"))
                }
                onPointerDown={(e) => {
                  e.preventDefault(); // keep DOM focus on the input
                  if (!node.disabled) dispatch(selectIntents.select({ key }, "pointer"));
                }}
                className={cn(
                  "flex cursor-default items-center gap-2 rounded-md px-2.5 py-1.5 text-sm",
                  focused && "bg-accent text-accent-foreground",
                  node.disabled && "opacity-50",
                )}
              >
                <Check className={cn("size-4", selected ? "opacity-100" : "opacity-0")} />
                <span className="truncate">{node.textValue}</span>
              </li>
            );
          })}
        </ul>
      </Overlay>
    </div>
  );
}
