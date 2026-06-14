import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, X } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import {
  collectionFromArray,
  composeMachine,
  createSearchCollator,
  dismissIntents,
  navIntents,
  resolveBinding,
  searchIntents,
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
  strokeFromEvent,
  useComposedMachine,
  useForgeEffects,
  useKeymap,
  useLiveRef,
} from "@/framework/react";
import {
  TAGS_INPUT_KEY,
  chipKeyAfterRemoval,
  chipRemovalBindings,
  tagsFieldBindings,
  tagsPickerBehaviors,
  tagsRowBehaviors,
  tagsRowCollection,
} from "./tags-core";

/**
 * TagsInput / MultiSelect — two pure machines cooperating (see tags-core):
 * the ComboBox machine in multiple mode (chips are just the selection) and a
 * horizontal Navigable over the chips + an input sentinel. Backspace on an
 * empty field walks to the last chip, ← → travel the chips, ArrowRight past
 * the last chip lands back in the input — all declarative bindings; the row's
 * `scrollToItem` effect is reinterpreted as DOM focus (chips are real
 * buttons, Accordion-style).
 */

export interface TagsInputProps<T> {
  items: readonly T[];
  getKey: (item: T, index: number) => Key;
  getTextValue: (item: T) => string;
  isDisabled?: (item: T) => boolean;
  value?: readonly Key[];
  defaultValue?: readonly Key[];
  onValueChange?: (keys: Key[], items: T[]) => void;
  placeholder?: string;
  locale?: string;
  className?: string;
  "aria-label": string;
}

const domId = (base: string, key: Key) => `${base}-${key.replace(/[^a-zA-Z0-9_-]/g, "_")}`;

export function TagsInput<T>(props: TagsInputProps<T>) {
  const {
    items,
    getKey,
    getTextValue,
    isDisabled,
    value,
    defaultValue,
    placeholder,
    locale = "en",
    className,
  } = props;

  const baseId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const [registry] = useState(createItemRegistry);
  const [rowRegistry] = useState(createItemRegistry);
  const syncing = useRef(false);

  const fullCollection = useMemo(
    () => collectionFromArray(items, { getKey, getTextValue, isDisabled }),
    [items, getKey, getTextValue, isDisabled],
  );

  const live = useLiveRef({
    props,
    filtered: fullCollection,
    row: tagsRowCollection([], () => ""),
    chips: [] as Key[],
  });

  /* ── picker machine: ComboBox in multiple mode ──────────────────────── */
  const picker = useComposedMachine(() => {
    const config: CollectionBehaviorConfig = {
      getCollection: () => live.current.filtered as Collection<unknown>,
      selectionMode: "multiple",
      toggleOnSelect: true,
      wrap: true,
      defaultSelectedKeys: (value ?? defaultValue ?? []) as string[],
      get locale() {
        return live.current.props.locale;
      },
    };
    return composeMachine("tags-picker", tagsPickerBehaviors, config);
  });

  const nav = picker.state.navigable as NavigableSlice;
  const selection = picker.state.selectable as SelectableSlice;
  const open = (picker.state.dismissable as DismissableSlice).open;
  const query = (picker.state.searchable as SearchableSlice).query;

  const chips = useMemo(() => [...selection.selectedKeys], [selection.selectedKeys]);
  live.current.chips = chips;

  /* ── row machine: horizontal Navigable over chips + the input sentinel ─ */
  const row = useComposedMachine(() => {
    const config: CollectionBehaviorConfig = {
      getCollection: () => live.current.row as Collection<unknown>,
      orientation: "horizontal",
      wrap: false,
    };
    return composeMachine("tags-row", tagsRowBehaviors, config);
  });

  const rowCollection = useMemo(
    () => tagsRowCollection(chips, (key) => fullCollection.getNode(key)?.textValue ?? String(key)),
    [chips, fullCollection],
  );
  live.current.row = rowCollection;

  /* ── filtered options from the machine's query (ComboBox pattern) ───── */
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

  /* ── controlled selection sync (program intents, events muted) ──────── */
  useEffect(() => {
    if (value === undefined) return;
    const current = [...selection.selectedKeys];
    if (value.length === current.length && value.every((k, i) => current[i] === k)) return;
    syncing.current = true;
    picker.dispatch(selectIntents.clear(undefined, "program"));
    for (const key of value) {
      picker.dispatch(selectIntents.select({ key, toggle: true }, "program"));
    }
    syncing.current = false;
  }, [value, selection.selectedKeys, picker]);

  useForgeEffects(picker.store, {
    registry,
    events: {
      selectionChange: (detail) => {
        if (syncing.current) return;
        const keys = [...(detail as { selectedKeys: ReadonlySet<Key> }).selectedKeys];
        picker.dispatch(searchIntents.clear(undefined, "program"));
        live.current.props.onValueChange?.(
          keys,
          keys
            .map((k) => fullCollection.getNode(k)?.value as T | undefined)
            .filter((v): v is T => v !== undefined),
        );
      },
    },
  });

  /* The row's scrollToItem is "focus that chip" (or the input sentinel). */
  const focusRowKey = (key: Key) => {
    if (key === TAGS_INPUT_KEY) inputRef.current?.focus();
    else rowRegistry.get(key)?.focus();
  };
  useForgeEffects(row.store, {
    events: {},
    overrides: {
      "dom/scroll-to-item": (effect) => focusRowKey((effect.payload as { key: Key }).key),
    },
  });

  /* ── keymaps ────────────────────────────────────────────────────────── */
  const pickerOnKeyDown = useKeymap(
    () =>
      picker.composed
        .keymap(picker.store.getState())
        .filter((b) => b.keys !== "@printable" && b.keys !== "Space"),
    picker.dispatch,
  );
  const rowOnKeyDown = useKeymap(() => row.composed.keymap(row.store.getState()), row.dispatch);

  const onInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.defaultPrevented) return;
    // 1. Chip-row bindings (Backspace/ArrowLeft on an empty field).
    const field = resolveBinding(
      tagsFieldBindings({ query, chipCount: chips.length }),
      strokeFromEvent(e),
    );
    if (field) {
      if (field.binding.preventDefault !== false) e.preventDefault();
      row.dispatch(field.intent);
      return;
    }
    // 2. Closed popup: arrows open it; everything else stays native.
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        picker.dispatch(dismissIntents.open(undefined, "keyboard"));
        picker.dispatch(navIntents.first(undefined, "keyboard"));
      }
      return;
    }
    // 3. Open popup: the picker keymap (navigation/selection/Escape).
    pickerOnKeyDown(e);
  };

  const removeChip = (key: Key, source: "keyboard" | "pointer") => {
    const next = chipKeyAfterRemoval(live.current.chips, key);
    picker.dispatch(selectIntents.select({ key, toggle: true }, source));
    if (source === "keyboard") {
      focusRowKey(next);
      row.dispatch(navIntents.move({ key: next }, "program"));
    } else {
      inputRef.current?.focus();
    }
  };

  const onChipKeyDown = (key: Key) => (e: React.KeyboardEvent) => {
    if (e.defaultPrevented) return;
    const removal = resolveBinding(chipRemovalBindings(key), strokeFromEvent(e));
    if (removal) {
      e.preventDefault();
      removeChip(key, "keyboard");
      return;
    }
    rowOnKeyDown(e);
  };

  const visibleKeys = filtered.visibleKeys();

  return (
    <div ref={anchorRef} className={cn("w-80", className)}>
      <div
        className={cn(
          "flex min-h-9 w-full flex-wrap items-center gap-1 rounded-md border border-border bg-surface px-1.5 py-1",
          "focus-within:ring-2 focus-within:ring-ring",
        )}
        onPointerDown={(e) => {
          if (e.target === e.currentTarget) {
            e.preventDefault();
            inputRef.current?.focus();
          }
        }}
      >
        {chips.map((key) => {
          const text = fullCollection.getNode(key)?.textValue ?? String(key);
          const focused = (row.state.navigable as NavigableSlice).focusedKey === key;
          return (
            <button
              key={key}
              type="button"
              tabIndex={-1}
              ref={rowRegistry.register(key)}
              aria-label={`${text} — retirer`}
              data-focused={focused || undefined}
              onFocus={() => row.dispatch(navIntents.move({ key }, "pointer"))}
              onKeyDown={onChipKeyDown(key)}
              className={cn(
                "inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-xs font-medium outline-none",
                "focus-visible:ring-2 focus-visible:ring-ring",
              )}
            >
              {text}
              <X
                aria-hidden
                className="size-3 text-muted-foreground hover:text-foreground"
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  removeChip(key, "pointer");
                }}
              />
            </button>
          );
        })}
        <input
          ref={(el) => {
            inputRef.current = el;
            rowRegistry.register(TAGS_INPUT_KEY)(el);
          }}
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
          placeholder={chips.length === 0 ? placeholder : undefined}
          value={query}
          onChange={(e) => {
            picker.dispatch(searchIntents.setQuery({ query: e.target.value }, "keyboard"));
            picker.dispatch(dismissIntents.open(undefined, "keyboard"));
            picker.dispatch(navIntents.first(undefined, "keyboard"));
          }}
          onKeyDown={onInputKeyDown}
          onFocus={() => row.dispatch(navIntents.move({ key: TAGS_INPUT_KEY }, "program"))}
          className="h-6 min-w-16 flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>

      <Overlay
        open={open}
        onDismiss={(reason: DismissReason) =>
          picker.dispatch(dismissIntents.close({ reason }, "program"))
        }
        anchorRef={anchorRef}
        placement="bottom-start"
        offset={4}
        matchAnchorWidth
        restoreFocus={false}
      >
        <ul
          id={`${baseId}-listbox`}
          role="listbox"
          aria-multiselectable
          aria-label={props["aria-label"]}
          className="max-h-72 overflow-auto rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-lg"
        >
          {visibleKeys.length === 0 && (
            <li className="px-3 py-2 text-sm text-muted-foreground">Aucun résultat.</li>
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
                  !node.disabled && picker.dispatch(navIntents.move({ key }, "pointer"))
                }
                onPointerDown={(e) => {
                  e.preventDefault(); // keep DOM focus on the input
                  if (!node.disabled) {
                    picker.dispatch(selectIntents.select({ key, toggle: true }, "pointer"));
                  }
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
