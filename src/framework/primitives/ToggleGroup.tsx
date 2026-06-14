import { useEffect, useId, useMemo, useState, type ReactNode } from "react";
import { cn } from "@/shared/lib/utils";
import {
  collectionFromArray,
  composeMachine,
  focusable,
  focusIntents,
  navigable,
  navIntents,
  selectable,
  selectIntents,
  type Collection,
  type CollectionBehaviorConfig,
  type Key,
  type NavigableSlice,
  type SelectableSlice,
} from "@/framework/core";
import {
  createItemRegistry,
  useComposedMachine,
  useForgeEffects,
  useKeymap,
  useLiveRef,
} from "@/framework/react";

/**
 * ToggleGroup — pressable buttons over the collection engine. Arrows move
 * logical focus (one tab stop), Space/Enter/click toggle; `toggleOnSelect`
 * lets single mode deselect the active item like a filter chip.
 */

export interface ToggleGroupItemDef {
  key: Key;
  label?: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
  "aria-label"?: string;
}

export interface ToggleGroupProps {
  items: readonly ToggleGroupItemDef[];
  mode?: "single" | "multiple";
  /** Controlled selection (a set of keys, even in single mode). */
  value?: readonly Key[];
  defaultValue?: readonly Key[];
  onValueChange?: (value: Key[]) => void;
  disabled?: boolean;
  className?: string;
  "aria-label": string;
}

const toggleGroupBehaviors = [focusable, navigable, selectable] as const;

const sameKeys = (a: ReadonlySet<Key>, b: readonly Key[]) =>
  a.size === b.length && b.every((k) => a.has(k));

export function ToggleGroup({
  items,
  mode = "single",
  value,
  defaultValue,
  onValueChange,
  disabled = false,
  className,
  ...rest
}: ToggleGroupProps) {
  const baseId = useId();

  const collection = useMemo(
    () =>
      collectionFromArray(items as ToggleGroupItemDef[], {
        getKey: (item) => item.key,
        getTextValue: (item) => (typeof item.label === "string" ? item.label : String(item.key)),
        isDisabled: (item) => item.disabled === true,
      }),
    [items],
  );

  const live = useLiveRef({ collection, onValueChange, mode });
  const [registry] = useState(createItemRegistry);

  const { state, dispatch, store, composed } = useComposedMachine(() => {
    const config: CollectionBehaviorConfig = {
      getCollection: () => live.current.collection as Collection<unknown>,
      get selectionMode() {
        return live.current.mode;
      },
      toggleOnSelect: true,
      wrap: true,
      orientation: "horizontal",
      defaultSelectedKeys: value ?? defaultValue,
    };
    return composeMachine("togglegroup", toggleGroupBehaviors, config);
  });

  const nav = state.navigable as NavigableSlice;
  const selection = state.selectable as SelectableSlice;

  // Controlled mode: re-align the machine when the prop diverges.
  useEffect(() => {
    if (value === undefined || sameKeys(selection.selectedKeys, value)) return;
    dispatch(selectIntents.clear(undefined, "program"));
    for (const key of value) dispatch(selectIntents.select({ key, toggle: true }, "program"));
  }, [value, selection.selectedKeys, dispatch]);

  useForgeEffects(store, {
    registry,
    events: {
      selectionChange: (detail) => {
        const keys = (detail as { selectedKeys: ReadonlySet<Key> }).selectedKeys;
        live.current.onValueChange?.([...keys]);
      },
    },
  });

  const onKeyDown = useKeymap(() => composed.keymap(store.getState()), dispatch);

  const domId = (key: Key) => `${baseId}-${key.replace(/[^a-zA-Z0-9_-]/g, "_")}`;

  return (
    <div
      role="toolbar"
      aria-label={rest["aria-label"]}
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? undefined : 0}
      aria-activedescendant={nav.focusedKey !== null ? domId(nav.focusedKey) : undefined}
      onKeyDown={disabled ? undefined : onKeyDown}
      onFocus={() => {
        dispatch(focusIntents.focus({}, "keyboard"));
        if (nav.focusedKey === null) dispatch(navIntents.first(undefined, "keyboard"));
      }}
      onBlur={() => dispatch(focusIntents.blur(undefined))}
      className={cn(
        "inline-flex gap-1 rounded-lg border border-border bg-surface p-1 outline-none",
        "focus-visible:ring-2 focus-visible:ring-ring",
        disabled && "pointer-events-none opacity-50",
        className,
      )}
    >
      {items.map((item) => {
        const pressed = selection.selectedKeys.has(item.key);
        const focused = nav.focusedKey === item.key;
        return (
          <div
            key={item.key}
            id={domId(item.key)}
            ref={registry.register(item.key)}
            role="button"
            aria-pressed={pressed}
            aria-disabled={item.disabled || undefined}
            aria-label={item["aria-label"]}
            onPointerDown={() => {
              if (item.disabled) return;
              dispatch(navIntents.move({ key: item.key }, "pointer"));
              dispatch(selectIntents.select({ key: item.key, toggle: true }, "pointer"));
            }}
            className={cn(
              "inline-flex h-7 cursor-default items-center gap-1.5 rounded-md px-2.5 text-sm font-medium transition-colors",
              focused && "ring-2 ring-ring ring-inset",
              pressed ? "bg-accent text-accent-foreground" : "hover:bg-muted",
              item.disabled && "opacity-50",
            )}
          >
            {item.icon}
            {item.label}
          </div>
        );
      })}
    </div>
  );
}
