import { Fragment, useId, useMemo, useRef, useState } from "react";
import { ChevronRight, Ellipsis } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  composeMachine,
  dismissIntents,
  navIntents,
  type Collection,
  type CollectionBehaviorConfig,
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
import { menuBehaviors, menuCollection } from "./menu-core";
import { MenuPanel } from "./Menu";
import { collapseBreadcrumbs } from "./breadcrumbs-core";

/**
 * Breadcrumbs — nav > ol with `aria-current="page"` on the last segment.
 * Past `maxVisible` segments the middle collapses into a "…" trigger opening
 * the existing Menu machine (menu-core + MenuPanel, untouched): the overflow
 * is a real menu — arrows, typeahead, Escape, focus restore included.
 */

export interface BreadcrumbItemDef {
  key: Key;
  label: string;
  href?: string;
}

export interface BreadcrumbsProps {
  items: readonly BreadcrumbItemDef[];
  /** Navigate callback (also fired by the overflow menu). */
  onNavigate?: (key: Key, item: BreadcrumbItemDef) => void;
  /** Collapse the middle into a "…" menu beyond this many visible segments. */
  maxVisible?: number;
  className?: string;
  "aria-label"?: string;
}

export function Breadcrumbs({
  items,
  onNavigate,
  maxVisible = 4,
  className,
  ...rest
}: BreadcrumbsProps) {
  const { head, collapsed, tail } = collapseBreadcrumbs(items, maxVisible);
  const lastKey = items[items.length - 1]?.key;

  const crumb = (item: BreadcrumbItemDef) => {
    const isCurrent = item.key === lastKey;
    const shared = cn(
      "rounded-sm text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
      isCurrent ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
    );
    return (
      <li key={item.key} className="flex items-center gap-1.5">
        {item.href && !isCurrent ? (
          <a
            href={item.href}
            onClick={(e) => {
              e.preventDefault();
              onNavigate?.(item.key, item);
            }}
            className={shared}
          >
            {item.label}
          </a>
        ) : (
          <span aria-current={isCurrent ? "page" : undefined} className={shared}>
            {item.label}
          </span>
        )}
      </li>
    );
  };

  const separator = (
    <li aria-hidden className="flex items-center">
      <ChevronRight className="size-3.5 text-muted-foreground/60" />
    </li>
  );

  return (
    <nav aria-label={rest["aria-label"] ?? "Fil d'Ariane"} className={className}>
      <ol className="flex flex-wrap items-center gap-1.5">
        {head.map((item, i) => (
          <Fragment key={item.key}>
            {i > 0 && separator}
            {crumb(item)}
          </Fragment>
        ))}
        {collapsed.length > 0 && (
          <>
            {separator}
            <li className="flex items-center">
              <BreadcrumbOverflowMenu items={collapsed} onNavigate={onNavigate} />
            </li>
          </>
        )}
        {tail.map((item) => (
          <Fragment key={item.key}>
            {separator}
            {crumb(item)}
          </Fragment>
        ))}
      </ol>
    </nav>
  );
}

/** The "…" trigger + the existing Menu machine over the collapsed segments. */
function BreadcrumbOverflowMenu({
  items,
  onNavigate,
}: {
  items: readonly BreadcrumbItemDef[];
  onNavigate?: (key: Key, item: BreadcrumbItemDef) => void;
}) {
  const baseId = useId();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [platform] = useState(detectPlatform);
  const [registry] = useState(createItemRegistry);

  const collection = useMemo(
    () => menuCollection([{ items: items.map(({ key, label }) => ({ key, label })) }]),
    [items],
  );
  const live = useLiveRef({ collection, items, onNavigate });

  const { state, dispatch, store, composed } = useComposedMachine(() => {
    const config: CollectionBehaviorConfig = {
      getCollection: () => live.current.collection as Collection<unknown>,
      wrap: true,
    };
    return composeMachine("breadcrumbs-menu", menuBehaviors, config);
  });

  const nav = state.navigable as NavigableSlice;
  const open = (state.dismissable as DismissableSlice).open;

  useForgeEffects(store, {
    registry,
    events: {
      action: (detail) => {
        const key = (detail as { key: Key }).key;
        const item = live.current.items.find((i) => i.key === key);
        if (item) live.current.onNavigate?.(key, item);
        dispatch(dismissIntents.close({ reason: "select" }, "program"));
      },
    },
  });

  const onKeyDown = useKeymap(() => composed.keymap(store.getState()), dispatch);

  const openAndFocus = (source: "keyboard" | "pointer") => {
    dispatch(dismissIntents.open(undefined, source));
    dispatch(navIntents.first(undefined, source));
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        id={`${baseId}-trigger`}
        aria-label={`${items.length} segments masqués`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? `${baseId}-menu` : undefined}
        onClick={() => {
          if (open) dispatch(dismissIntents.close(undefined, "pointer"));
          else openAndFocus("pointer");
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openAndFocus("keyboard");
          }
        }}
        className={cn(
          "inline-flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors outline-none",
          "hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
          open && "bg-muted text-foreground",
        )}
      >
        <Ellipsis className="size-4" />
      </button>

      <Overlay
        open={open}
        onDismiss={(reason: DismissReason) => dispatch(dismissIntents.close({ reason }, "program"))}
        anchorRef={triggerRef}
        placement="bottom-start"
        offset={6}
      >
        <MenuPanel
          baseId={baseId}
          collection={collection}
          focusedKey={nav.focusedKey}
          registry={registry}
          dispatch={dispatch}
          onKeyDown={onKeyDown}
          platform={platform}
          labelledBy={`${baseId}-trigger`}
        />
      </Overlay>
    </>
  );
}
