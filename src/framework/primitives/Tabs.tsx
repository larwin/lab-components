import { useEffect, useId, useMemo, useState, type ReactNode } from "react";
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
 * Tabs — the WAI-ARIA tablist pattern as a collection machine. "Automatic"
 * activation is literally `selectionFollowsFocus: true`; "manual" turns it
 * off and lets Enter/Space activate — the difference between the two modes is
 * one config flag on the same machine, not two implementations.
 */

export interface TabDef {
  key: Key;
  label: ReactNode;
  content: ReactNode;
  disabled?: boolean;
}

export interface TabsProps {
  tabs: readonly TabDef[];
  value?: Key | null;
  defaultValue?: Key;
  onValueChange?: (value: Key | null) => void;
  /** "automatic" (arrows activate, default) or "manual" (Enter/Space activates). */
  activation?: "automatic" | "manual";
  orientation?: "horizontal" | "vertical";
  className?: string;
  "aria-label": string;
}

const tabsBehaviors = [focusable, navigable, selectable] as const;

export function Tabs({
  tabs,
  value,
  defaultValue,
  onValueChange,
  activation = "automatic",
  orientation = "horizontal",
  className,
  ...rest
}: TabsProps) {
  const baseId = useId();

  const collection = useMemo(
    () =>
      collectionFromArray(tabs as TabDef[], {
        getKey: (tab) => tab.key,
        getTextValue: (tab) => (typeof tab.label === "string" ? tab.label : String(tab.key)),
        isDisabled: (tab) => tab.disabled === true,
      }),
    [tabs],
  );

  const live = useLiveRef({ collection, onValueChange, activation, orientation });
  const [registry] = useState(createItemRegistry);

  const { state, dispatch, store, composed } = useComposedMachine(() => {
    const config: CollectionBehaviorConfig = {
      getCollection: () => live.current.collection as Collection<unknown>,
      selectionMode: "single",
      get selectionFollowsFocus() {
        return live.current.activation === "automatic";
      },
      get orientation() {
        return live.current.orientation;
      },
      wrap: true,
      defaultSelectedKeys: [value ?? defaultValue ?? tabs[0]?.key].filter(
        (k): k is Key => k != null,
      ),
    };
    return composeMachine("tabs", tabsBehaviors, config);
  });

  const nav = state.navigable as NavigableSlice;
  const selection = state.selectable as SelectableSlice;
  const selectedKey = [...selection.selectedKeys][0] ?? null;

  // Controlled mode.
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

  const tabId = (key: Key) => `${baseId}-tab-${key.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
  const panelId = (key: Key) => `${baseId}-panel-${key.replace(/[^a-zA-Z0-9_-]/g, "_")}`;

  const selectedTab = tabs.find((t) => t.key === selectedKey) ?? null;

  return (
    <div className={cn("flex w-full flex-col gap-3", className)}>
      <div
        role="tablist"
        aria-label={rest["aria-label"]}
        aria-orientation={orientation}
        {...composed.aria(state)}
        tabIndex={0}
        aria-activedescendant={nav.focusedKey !== null ? tabId(nav.focusedKey) : undefined}
        onKeyDown={onKeyDown}
        onFocus={() => {
          dispatch(focusIntents.focus({}, "keyboard"));
          // Tab lands on the active tab, per the APG.
          if (nav.focusedKey === null) {
            if (selectedKey !== null) dispatch(navIntents.move({ key: selectedKey }, "keyboard"));
            else dispatch(navIntents.first(undefined, "keyboard"));
          }
        }}
        onBlur={() => dispatch(focusIntents.blur(undefined))}
        className={cn(
          "flex gap-1 rounded-lg bg-muted p-1 outline-none focus-visible:ring-2 focus-visible:ring-ring",
          orientation === "vertical" ? "w-fit flex-col" : "w-fit flex-row",
        )}
      >
        {tabs.map((tab) => {
          const selected = selectedKey === tab.key;
          const focused = nav.focusedKey === tab.key;
          return (
            <div
              key={tab.key}
              id={tabId(tab.key)}
              ref={registry.register(tab.key)}
              role="tab"
              aria-selected={selected}
              aria-controls={selected ? panelId(tab.key) : undefined}
              aria-disabled={tab.disabled || undefined}
              onPointerDown={() => {
                if (tab.disabled) return;
                dispatch(navIntents.move({ key: tab.key }, "pointer"));
                dispatch(selectIntents.select({ key: tab.key }, "pointer"));
              }}
              className={cn(
                "cursor-default rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                focused && "ring-2 ring-ring ring-inset",
                selected ? "bg-surface shadow-sm" : "text-muted-foreground hover:text-foreground",
                tab.disabled && "opacity-50",
              )}
            >
              {tab.label}
            </div>
          );
        })}
      </div>

      {selectedTab && (
        <div
          key={selectedTab.key}
          id={panelId(selectedTab.key)}
          role="tabpanel"
          aria-labelledby={tabId(selectedTab.key)}
          tabIndex={0}
          className="rounded-lg border border-border bg-surface p-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {selectedTab.content}
        </div>
      )}
    </div>
  );
}
