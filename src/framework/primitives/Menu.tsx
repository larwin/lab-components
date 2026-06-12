import { useId, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  actionable,
  composeMachine,
  createCollection,
  dismissable,
  dismissIntents,
  focusable,
  formatKeyCombo,
  navigable,
  navIntents,
  actionIntents,
  type Collection,
  type CollectionBehaviorConfig,
  type CollectionSourceNode,
  type DismissableSlice,
  type DismissReason,
  type Key,
  type NavigableSlice,
} from "@/framework/core";
import {
  createItemRegistry,
  detectPlatform,
  Overlay,
  useComposedMachine,
  useForgeEffects,
  useKeymap,
  useLiveRef,
} from "@/framework/react";

/**
 * Menu — Focusable + Navigable + Actionable + Dismissable over the collection
 * engine, rendered through the Overlay engine.
 *
 * Items are *activated*, not selected: Enter/Space/click emit an `action`
 * effect and the menu closes, restoring focus to the trigger. Sections and
 * separators are collection nodes of non-"item" kinds — navigation skips them
 * for free.
 */

export interface MenuItemDef {
  key: Key;
  label: string;
  icon?: ReactNode;
  /** Display-only shortcut hint (e.g. "Mod+S"). */
  shortcut?: string;
  disabled?: boolean;
  destructive?: boolean;
}

export interface MenuSectionDef {
  label?: string;
  items: MenuItemDef[];
}

export interface MenuProps {
  /** Trigger button content. */
  label: ReactNode;
  sections: MenuSectionDef[];
  onAction: (key: Key) => void;
  className?: string;
}

const domId = (base: string, key: Key) => `${base}-${key.replace(/[^a-zA-Z0-9_-]/g, "_")}`;

const menuBehaviors = [focusable, navigable, actionable, dismissable] as const;

export function Menu({ label, sections, onAction, className }: MenuProps) {
  const baseId = useId();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [platform] = useState(detectPlatform);

  const collection = useMemo(() => {
    const source: CollectionSourceNode<MenuItemDef | string>[] = sections.map((section, index) => ({
      key: `__section-${index}`,
      value: section.label ?? "",
      kind: "section",
      children: section.items.map((item) => ({
        key: item.key,
        value: item,
        textValue: item.label,
        disabled: item.disabled,
      })),
    }));
    return createCollection(source);
  }, [sections]);

  const live = useLiveRef({ collection, onAction });
  const [registry] = useState(createItemRegistry);

  const { state, dispatch, store, composed } = useComposedMachine(() => {
    const config: CollectionBehaviorConfig = {
      getCollection: () => live.current.collection as Collection<unknown>,
      wrap: true,
    };
    return composeMachine("menu", menuBehaviors, config);
  });

  const nav = state.navigable as NavigableSlice;
  const open = (state.dismissable as DismissableSlice).open;

  useForgeEffects(store, {
    registry,
    events: {
      action: (detail) => {
        live.current.onAction((detail as { key: Key }).key);
        dispatch(dismissIntents.close({ reason: "select" }, "program"));
      },
    },
  });

  const onKeyDown = useKeymap(() => composed.keymap(store.getState()), dispatch);

  const openAndFocus = (edge: "first" | "last", source: "keyboard" | "pointer") => {
    dispatch(dismissIntents.open(undefined, source));
    dispatch(
      edge === "first" ? navIntents.first(undefined, source) : navIntents.last(undefined, source),
    );
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        id={`${baseId}-trigger`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? `${baseId}-menu` : undefined}
        onClick={() => {
          if (open) dispatch(dismissIntents.close(undefined, "pointer"));
          else openAndFocus("first", "pointer");
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openAndFocus("first", "keyboard");
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            openAndFocus("last", "keyboard");
          }
        }}
        className={cn(
          "inline-flex h-9 items-center gap-2 rounded-md border border-border bg-surface px-4 text-sm font-medium transition-colors outline-none",
          "hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
          open && "bg-muted",
          className,
        )}
      >
        {label}
        <ChevronDown
          className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")}
        />
      </button>

      <Overlay
        open={open}
        onDismiss={(reason: DismissReason) => dispatch(dismissIntents.close({ reason }, "program"))}
        anchorRef={triggerRef}
        placement="bottom-start"
        offset={6}
      >
        <div
          id={`${baseId}-menu`}
          role="menu"
          tabIndex={-1}
          data-autofocus
          aria-labelledby={`${baseId}-trigger`}
          aria-activedescendant={
            nav.focusedKey !== null ? domId(baseId, nav.focusedKey) : undefined
          }
          onKeyDown={onKeyDown}
          className="min-w-52 rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-lg outline-none"
        >
          {collection.visibleKeys().map((key) => {
            const node = collection.getNode(key)!;
            if (node.kind === "section") {
              const sectionLabel = node.value as string;
              return sectionLabel ? (
                <div
                  key={key}
                  role="presentation"
                  className="px-2 pt-2 pb-1 font-mono text-[10px] tracking-widest text-muted-foreground uppercase"
                >
                  {sectionLabel}
                </div>
              ) : (
                <div key={key} role="separator" className="my-1 h-px bg-border" />
              );
            }
            const item = node.value as MenuItemDef;
            const focused = nav.focusedKey === key;
            return (
              <div
                key={key}
                id={domId(baseId, key)}
                ref={registry.register(key)}
                role="menuitem"
                aria-disabled={node.disabled || undefined}
                data-focused={focused || undefined}
                onPointerEnter={() =>
                  !node.disabled && dispatch(navIntents.move({ key }, "pointer"))
                }
                onClick={() =>
                  !node.disabled && dispatch(actionIntents.activate({ key }, "pointer"))
                }
                className={cn(
                  "flex cursor-default items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm",
                  focused && "bg-accent text-accent-foreground",
                  node.disabled && "opacity-50",
                  item.destructive && "text-destructive",
                )}
              >
                {item.icon && <span className="text-muted-foreground">{item.icon}</span>}
                <span className="flex-1 truncate">{item.label}</span>
                {item.shortcut && (
                  <kbd className="font-mono text-[10px] text-muted-foreground">
                    {formatKeyCombo(item.shortcut, platform)}
                  </kbd>
                )}
              </div>
            );
          })}
        </div>
      </Overlay>
    </>
  );
}
