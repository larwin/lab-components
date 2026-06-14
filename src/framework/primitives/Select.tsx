import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import {
  collectionFromArray,
  composeMachine,
  dismissable,
  dismissIntents,
  focusable,
  navigable,
  navIntents,
  selectable,
  selectIntents,
  type Collection,
  type CollectionBehaviorConfig,
  type DismissableSlice,
  type DismissReason,
  type Key,
  type NavigableSlice,
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
import { fieldControlProps, useFieldContext } from "./Field";

/**
 * Select — the classic no-typing dropdown: a trigger button + the very same
 * listbox machine as Listbox (Navigable + Selectable, typeahead included) +
 * Dismissable, rendered through the Overlay engine. Selecting closes and
 * restores focus to the trigger as a declarative `dom/restore-focus` effect.
 */

export interface SelectOptionDef {
  key: Key;
  label: string;
  description?: string;
  disabled?: boolean;
}

export interface SelectProps {
  options: readonly SelectOptionDef[];
  value?: Key | null;
  defaultValue?: Key;
  onValueChange?: (value: Key | null) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Tab-order integration slot (roving toolbars set -1/0). Machine untouched. */
  tabIndex?: number;
  className?: string;
  "aria-label"?: string;
}

const selectBehaviors = [focusable, navigable, selectable, dismissable] as const;

export function Select({
  options,
  value,
  defaultValue,
  onValueChange,
  placeholder = "Sélectionner…",
  disabled = false,
  tabIndex,
  className,
  ...rest
}: SelectProps) {
  const baseId = useId();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const field = useFieldContext();

  const collection = useMemo(
    () =>
      collectionFromArray(options as SelectOptionDef[], {
        getKey: (option) => option.key,
        getTextValue: (option) => option.label,
        isDisabled: (option) => option.disabled === true,
      }),
    [options],
  );

  const live = useLiveRef({ collection, onValueChange });
  const [registry] = useState(createItemRegistry);

  const { state, dispatch, store, composed } = useComposedMachine(() => {
    const config: CollectionBehaviorConfig = {
      getCollection: () => live.current.collection as Collection<unknown>,
      selectionMode: "single",
      wrap: true,
      defaultSelectedKeys:
        (value ?? defaultValue) != null ? [(value ?? defaultValue) as Key] : undefined,
    };
    return composeMachine("select", selectBehaviors, config);
  });

  const nav = state.navigable as NavigableSlice;
  const open = (state.dismissable as DismissableSlice).open;
  const selection = state.selectable as SelectableSlice;
  const selectedKey = [...selection.selectedKeys][0] ?? null;
  const selectedOption = options.find((o) => o.key === selectedKey) ?? null;

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
        dispatch(dismissIntents.close({ reason: "select" }, "program"));
      },
    },
  });

  const onKeyDown = useKeymap(() => composed.keymap(store.getState()), dispatch);

  const openAndFocus = (source: "keyboard" | "pointer") => {
    dispatch(dismissIntents.open(undefined, source));
    if (selectedKey !== null) dispatch(navIntents.move({ key: selectedKey }, source));
    else dispatch(navIntents.first(undefined, source));
  };

  const domId = (key: Key) => `${baseId}-${key.replace(/[^a-zA-Z0-9_-]/g, "_")}`;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        tabIndex={tabIndex}
        {...fieldControlProps(field)}
        id={fieldControlProps(field).id ?? `${baseId}-trigger`}
        aria-label={field ? undefined : rest["aria-label"]}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? `${baseId}-listbox` : undefined}
        onClick={() => {
          if (open) dispatch(dismissIntents.close(undefined, "pointer"));
          else openAndFocus("pointer");
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openAndFocus("keyboard");
          }
        }}
        className={cn(
          "inline-flex h-9 min-w-44 items-center justify-between gap-2 rounded-md border border-border bg-surface px-3 text-sm transition-colors outline-none",
          "hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
          "disabled:pointer-events-none disabled:opacity-50",
          field?.invalid && "border-destructive",
          open && "bg-muted",
          className,
        )}
      >
        <span className={cn("truncate", !selectedOption && "text-muted-foreground")}>
          {selectedOption?.label ?? placeholder}
        </span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      <Overlay
        open={open}
        onDismiss={(reason: DismissReason) => dispatch(dismissIntents.close({ reason }, "program"))}
        anchorRef={triggerRef}
        placement="bottom-start"
        offset={4}
        matchAnchorWidth
      >
        <div
          id={`${baseId}-listbox`}
          role="listbox"
          tabIndex={-1}
          data-autofocus
          aria-labelledby={field?.labelId}
          aria-activedescendant={nav.focusedKey !== null ? domId(nav.focusedKey) : undefined}
          onKeyDown={onKeyDown}
          className="max-h-72 overflow-auto rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-lg outline-none"
        >
          {options.map((option) => {
            const selected = selectedKey === option.key;
            const focused = nav.focusedKey === option.key;
            return (
              <div
                key={option.key}
                id={domId(option.key)}
                ref={registry.register(option.key)}
                role="option"
                aria-selected={selected}
                aria-disabled={option.disabled || undefined}
                data-focused={focused || undefined}
                onPointerEnter={() =>
                  !option.disabled && dispatch(navIntents.move({ key: option.key }, "pointer"))
                }
                onClick={() =>
                  !option.disabled && dispatch(selectIntents.select({ key: option.key }, "pointer"))
                }
                className={cn(
                  "flex cursor-default items-center gap-2 rounded-md px-2.5 py-1.5 text-sm",
                  focused && "bg-accent text-accent-foreground",
                  option.disabled && "opacity-50",
                )}
              >
                <span className="flex size-4 shrink-0 items-center justify-center">
                  {selected && <Check className="size-3.5" />}
                </span>
                <span className="flex flex-col">
                  <span className="truncate">{option.label}</span>
                  {option.description && (
                    <span className="text-xs text-muted-foreground">{option.description}</span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </Overlay>
    </>
  );
}
