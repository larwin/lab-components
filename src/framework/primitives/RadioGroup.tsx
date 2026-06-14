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
import { fieldControlProps, useFieldContext } from "./Field";

/**
 * RadioGroup — the collection engine in single-select, selection-follows-focus
 * mode: arrows move focus AND check the radio, exactly the WAI-ARIA radiogroup
 * pattern. Focus is logical (aria-activedescendant on the group), so the same
 * machine that drives a 500k-row grid drives four radio buttons.
 */

export interface RadioItemDef {
  key: Key;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
}

export interface RadioGroupProps {
  items: readonly RadioItemDef[];
  value?: Key | null;
  defaultValue?: Key;
  onValueChange?: (value: Key | null) => void;
  /** Arrow axis. Radios answer to all four arrows by default (APG). */
  orientation?: "horizontal" | "vertical" | "both";
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}

const radioBehaviors = [focusable, navigable, selectable] as const;

export function RadioGroup({
  items,
  value,
  defaultValue,
  onValueChange,
  orientation = "both",
  disabled = false,
  className,
  ...rest
}: RadioGroupProps) {
  const baseId = useId();
  const field = useFieldContext();

  const collection = useMemo(
    () =>
      collectionFromArray(items as RadioItemDef[], {
        getKey: (item) => item.key,
        getTextValue: (item) => (typeof item.label === "string" ? item.label : String(item.key)),
        isDisabled: (item) => item.disabled === true,
      }),
    [items],
  );

  const live = useLiveRef({ collection, onValueChange, orientation });
  const [registry] = useState(createItemRegistry);

  const { state, dispatch, store, composed } = useComposedMachine(() => {
    const config: CollectionBehaviorConfig = {
      getCollection: () => live.current.collection as Collection<unknown>,
      selectionMode: "single",
      selectionFollowsFocus: true,
      wrap: true,
      get orientation() {
        return live.current.orientation;
      },
      defaultSelectedKeys:
        (value ?? defaultValue) !== undefined && (value ?? defaultValue) !== null
          ? [(value ?? defaultValue) as Key]
          : undefined,
    };
    return composeMachine("radiogroup", radioBehaviors, config);
  });

  const nav = state.navigable as NavigableSlice;
  const selection = state.selectable as SelectableSlice;
  const selectedKey = [...selection.selectedKeys][0] ?? null;

  // Controlled mode: prop drives the machine.
  useEffect(() => {
    if (value !== undefined && value !== null && value !== selectedKey) {
      dispatch(selectIntents.select({ key: value }, "program"));
    }
  }, [value, selectedKey, dispatch]);

  useForgeEffects(store, {
    registry,
    events: {
      selectionChange: (detail) => {
        const keys = (detail as { selectedKeys: ReadonlySet<Key> }).selectedKeys;
        live.current.onValueChange?.([...keys][0] ?? null);
      },
    },
  });

  const onKeyDown = useKeymap(() => composed.keymap(store.getState()), dispatch);

  const domId = (key: Key) => `${baseId}-${key.replace(/[^a-zA-Z0-9_-]/g, "_")}`;

  return (
    <div
      role="radiogroup"
      {...composed.aria(state)}
      {...fieldControlProps(field)}
      aria-label={rest["aria-label"]}
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? undefined : 0}
      aria-activedescendant={nav.focusedKey !== null ? domId(nav.focusedKey) : undefined}
      onKeyDown={disabled ? undefined : onKeyDown}
      onFocus={() => {
        dispatch(focusIntents.focus({}, "keyboard"));
        // Tab lands on the checked radio (or the first one), per the APG.
        if (nav.focusedKey === null) {
          if (selectedKey !== null) dispatch(navIntents.move({ key: selectedKey }, "keyboard"));
          else dispatch(navIntents.first(undefined, "keyboard"));
        }
      }}
      onBlur={() => dispatch(focusIntents.blur(undefined))}
      className={cn(
        "flex gap-1 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring",
        orientation === "horizontal" ? "flex-row flex-wrap" : "flex-col",
        disabled && "pointer-events-none opacity-50",
        className,
      )}
    >
      {items.map((item) => {
        const checked = selectedKey === item.key;
        const focused = nav.focusedKey === item.key;
        return (
          <div
            key={item.key}
            id={domId(item.key)}
            ref={registry.register(item.key)}
            role="radio"
            aria-checked={checked}
            aria-disabled={item.disabled || undefined}
            onPointerDown={() => {
              if (item.disabled) return;
              dispatch(navIntents.move({ key: item.key }, "pointer"));
              dispatch(selectIntents.select({ key: item.key }, "pointer"));
            }}
            className={cn(
              "flex cursor-default items-start gap-2.5 rounded-md px-2 py-1.5 text-sm",
              focused && "ring-2 ring-ring ring-inset",
              item.disabled && "opacity-50",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors",
                checked ? "border-primary" : "border-border bg-surface",
              )}
            >
              {checked && <span className="size-2 rounded-full bg-primary" />}
            </span>
            <span className="flex flex-col">
              <span>{item.label}</span>
              {item.description && (
                <span className="text-xs text-muted-foreground">{item.description}</span>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}
