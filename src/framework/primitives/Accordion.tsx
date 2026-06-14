import { useId, useMemo, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import {
  collectionFromArray,
  composeMachine,
  expandable,
  expandIntents,
  navigable,
  navIntents,
  focusable,
  scrollToItem,
  type Collection,
  type CollectionBehaviorConfig,
  type ExpandableSlice,
  type Key,
} from "@/framework/core";
import {
  createItemRegistry,
  useComposedMachine,
  useForgeEffects,
  useKeymap,
  useLiveRef,
} from "@/framework/react";

/**
 * Accordion — Expandable over a flat collection, single or multiple mode.
 *
 * Headers are real buttons in the tab order (APG accordion), so logical focus
 * maps to DOM focus: arrow keys go through the Navigable machine (wrap,
 * Home/End, disabled sections skipped) and its `scrollToItem` effect is
 * reinterpreted as "focus that header button".
 */

export interface AccordionItemDef {
  key: Key;
  title: ReactNode;
  content: ReactNode;
  disabled?: boolean;
}

export interface AccordionProps {
  items: readonly AccordionItemDef[];
  /** "single" (default): opening a section closes the others. */
  mode?: "single" | "multiple";
  defaultExpandedKeys?: readonly Key[];
  onExpandedChange?: (expandedKeys: ReadonlySet<Key>) => void;
  className?: string;
}

const accordionBehaviors = [focusable, navigable, expandable] as const;

export function Accordion({
  items,
  mode = "single",
  defaultExpandedKeys,
  onExpandedChange,
  className,
}: AccordionProps) {
  const baseId = useId();

  const collection = useMemo(
    () =>
      collectionFromArray(items as AccordionItemDef[], {
        getKey: (item) => item.key,
        getTextValue: (item) => (typeof item.title === "string" ? item.title : String(item.key)),
        isDisabled: (item) => item.disabled === true,
      }),
    [items],
  );

  const live = useLiveRef({ collection, onExpandedChange, mode });
  const [registry] = useState(createItemRegistry);

  const { state, dispatch, store, composed } = useComposedMachine(() => {
    const config: CollectionBehaviorConfig & {
      expansionMode: "single" | "multiple";
      defaultExpandedKeys?: readonly Key[];
    } = {
      getCollection: () => live.current.collection as Collection<unknown>,
      get expansionMode() {
        return live.current.mode;
      },
      defaultExpandedKeys,
      wrap: true,
    };
    return composeMachine("accordion", accordionBehaviors, config);
  });

  const expandedKeys = (state.expandable as ExpandableSlice).expandedKeys;

  useForgeEffects(store, {
    registry,
    events: {
      expandedChange: (detail) =>
        live.current.onExpandedChange?.(
          (detail as { expandedKeys: ReadonlySet<Key> }).expandedKeys,
        ),
    },
    overrides: {
      // Headers are real buttons: "logical focus moved" becomes DOM focus.
      [scrollToItem.type]: (effect) => {
        registry.get((effect.payload as { key: Key }).key)?.focus();
      },
    },
  });

  const onKeyDown = useKeymap(() => composed.keymap(store.getState()), dispatch);

  const headerId = (key: Key) => `${baseId}-header-${key.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
  const panelDomId = (key: Key) => `${baseId}-panel-${key.replace(/[^a-zA-Z0-9_-]/g, "_")}`;

  return (
    <div className={cn("w-full divide-y divide-border rounded-lg border border-border", className)}>
      {items.map((item) => {
        const expanded = expandedKeys.has(item.key);
        return (
          <div key={item.key}>
            <h3 className="m-0">
              <button
                type="button"
                id={headerId(item.key)}
                ref={registry.register(item.key)}
                aria-expanded={expanded}
                aria-controls={expanded ? panelDomId(item.key) : undefined}
                disabled={item.disabled}
                onFocus={() => dispatch(navIntents.move({ key: item.key }, "keyboard"))}
                onKeyDown={onKeyDown}
                onClick={() =>
                  dispatch(
                    expanded
                      ? expandIntents.collapse({ key: item.key }, "pointer")
                      : expandIntents.expand({ key: item.key }, "pointer"),
                  )
                }
                className={cn(
                  "flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium transition-colors outline-none",
                  "hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                  "disabled:pointer-events-none disabled:opacity-50",
                )}
              >
                {item.title}
                <ChevronDown
                  className={cn(
                    "size-4 shrink-0 text-muted-foreground transition-transform",
                    expanded && "rotate-180",
                  )}
                />
              </button>
            </h3>
            {expanded && (
              <div
                id={panelDomId(item.key)}
                role="region"
                aria-labelledby={headerId(item.key)}
                className="px-4 pb-4 text-sm text-muted-foreground"
              >
                {item.content}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
