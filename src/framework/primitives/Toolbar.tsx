import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { Check, Ellipsis } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import {
  collectionFromArray,
  composeMachine,
  dismissIntents,
  flipHorizontalStroke,
  navIntents,
  partitionOverflow,
  scrollToItem,
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
  detectPlatform,
  Overlay,
  resolveBinding,
  strokeFromEvent,
  useComposedMachine,
  useForgeEffects,
  useKeymap,
  useLiveRef,
  useShortcut,
} from "@/framework/react";
import { MenuPanel } from "./Menu";
import { menuBehaviors, menuCollection, type MenuSectionDef } from "./menu-core";
import { Select } from "./Select";
import {
  OVERFLOW_TRIGGER_KEY,
  overflowMenuSections,
  toolbarBehaviors,
  toolbarCollection,
  toolbarOverflowItems,
  type ToolbarButtonDef,
  type ToolbarItemDef,
  type ToolbarSelectDef,
  type ToolbarToggleDef,
  type ToolbarToggleGroupDef,
} from "./toolbar-core";

/**
 * Toolbar — APG toolbar: ONE tab stop, internal roving over real buttons.
 *
 * The bar is the untouched [Focusable + Navigable(horizontal, wrap)] machine
 * with `scrollToItem` reinterpreted as DOM focus (the Accordion pattern);
 * RTL flips the strokes before keymap resolution. Heterogeneous content with
 * zero new logic: buttons are native buttons (activation is native DOM),
 * toggle groups are the Selectable behavior (the ToggleGroup slice), the
 * compact select is the existing Select primitive, separators are layout.
 * Disabled items stay focusable (`aria-disabled`, no navigation hole).
 *
 * Overflow: measured widths feed the pure `partitionOverflow` policy
 * (core/layout); overflowed items stay MOUNTED but hidden — their machines
 * and global shortcuts stay alive — while the "…" trigger opens the
 * untouched Menu machine over `overflowMenuSections`.
 */

const GAP_PX = 4; // must match the row's `gap-1`
const DEFAULT_TRIGGER_WIDTH = 36;

const FOCUSABLE_ITEM_SELECTOR = "button, [tabindex]";

const cssEscape = (value: string): string =>
  typeof CSS !== "undefined" && CSS.escape ? CSS.escape(value) : value.replace(/"/g, '\\"');

interface ToolbarValueController {
  getValue(): readonly Key[];
  activate(key: Key): void;
}

type ControllerMap = Map<Key, ToolbarValueController>;

interface RowState {
  /** null until the first measurement: render everything, then partition. */
  visible: ReadonlySet<Key> | null;
  overflow: ReadonlySet<Key>;
  hasOverflow: boolean;
}

const sameSet = (a: ReadonlySet<Key>, b: ReadonlySet<Key>): boolean =>
  a.size === b.size && [...b].every((k) => a.has(k));

export interface ToolbarProps {
  items: readonly ToolbarItemDef[];
  "aria-label": string;
  /** Visual only: editor bar or floating rounded pill. Same machine. */
  variant?: "bar" | "pill";
  dir?: "ltr" | "rtl";
  /** aria-label of the "…" overflow trigger. */
  overflowLabel?: string;
  /** Observability: fired when the set of overflowed items changes. */
  onOverflowChange?: (overflowKeys: Key[]) => void;
  className?: string;
}

export function Toolbar({
  items,
  variant = "bar",
  dir = "ltr",
  overflowLabel = "Plus d'actions",
  onOverflowChange,
  className,
  ...rest
}: ToolbarProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widthsRef = useRef(new Map<Key, number>());
  const triggerWidthRef = useRef(DEFAULT_TRIGGER_WIDTH);
  const [controllers] = useState<ControllerMap>(() => new Map());
  // Group/select values live in their machines: bump to re-render the menu.
  const [, bumpValues] = useReducer((v: number) => v + 1, 0);
  const [platform] = useState(detectPlatform);

  const [row, setRow] = useState<RowState>({
    visible: null,
    overflow: new Set(),
    hasOverflow: false,
  });

  const collection = useMemo(
    () => toolbarCollection(items, row.overflow, row.hasOverflow),
    [items, row.overflow, row.hasOverflow],
  );
  const live = useLiveRef({ items, collection, dir, onOverflowChange });

  useEffect(() => {
    live.current.onOverflowChange?.([...row.overflow]);
  }, [row.overflow, live]);

  const { state, dispatch, store, composed } = useComposedMachine(() => {
    const config: CollectionBehaviorConfig = {
      getCollection: () => live.current.collection as Collection<unknown>,
      orientation: "horizontal",
      wrap: true,
    };
    return composeMachine("toolbar", toolbarBehaviors, config);
  });

  const nav = state.navigable as NavigableSlice;

  /* ---- "logical focus moved" becomes DOM focus on the real control ---- */
  const focusItem = useCallback((key: Key) => {
    const el = containerRef.current?.querySelector<HTMLElement>(
      `[data-toolbar-key="${cssEscape(key)}"]`,
    );
    if (!el) return;
    if (el.matches(FOCUSABLE_ITEM_SELECTOR)) el.focus();
    else el.querySelector<HTMLElement>(FOCUSABLE_ITEM_SELECTOR)?.focus();
  }, []);

  useForgeEffects(store, {
    overrides: {
      [scrollToItem.type]: (effect) => focusItem((effect.payload as { key: Key }).key),
    },
  });

  /* ---- measurement → pure partition ---- */
  const recompute = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    for (const el of container.querySelectorAll<HTMLElement>("[data-measure-key]")) {
      const width = el.offsetWidth;
      if (width > 0) widthsRef.current.set(el.dataset.measureKey as Key, width);
    }
    const trigger = container.querySelector<HTMLElement>("[data-overflow-trigger]");
    if (trigger && trigger.offsetWidth > 0) triggerWidthRef.current = trigger.offsetWidth;

    const styles = getComputedStyle(container);
    const availableWidth =
      container.clientWidth - parseFloat(styles.paddingLeft) - parseFloat(styles.paddingRight);

    const partition = partitionOverflow({
      items: toolbarOverflowItems(live.current.items, (key) => widthsRef.current.get(key) ?? 0),
      availableWidth,
      triggerWidth: triggerWidthRef.current,
      gap: GAP_PX,
    });
    setRow((prev) => {
      const visible = new Set(partition.visibleKeys);
      const overflow = new Set(partition.overflowKeys);
      if (
        prev.visible !== null &&
        prev.hasOverflow === partition.hasOverflow &&
        sameSet(prev.visible, visible) &&
        sameSet(prev.overflow, overflow)
      ) {
        return prev;
      }
      return { visible, overflow, hasOverflow: partition.hasOverflow };
    });
  }, [live]);

  useLayoutEffect(() => {
    recompute();
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => recompute());
    observer.observe(container);
    return () => observer.disconnect();
  }, [recompute, items]);

  // The trigger mounts only once overflowing: re-measure its real width.
  useLayoutEffect(() => {
    if (row.hasOverflow) recompute();
  }, [row.hasOverflow, recompute]);

  /* ---- roving tabindex ---- */
  const firstItemKey = useMemo(
    () => collection.visibleKeys().find((k) => collection.getNode(k)?.kind === "item") ?? null,
    [collection],
  );
  const rovingKey =
    nav.focusedKey !== null && collection.getNode(nav.focusedKey) !== undefined
      ? nav.focusedKey
      : firstItemKey;
  const tabIndexFor = (key: Key) => (key === rovingKey ? 0 : -1);

  /* ---- keyboard: flip strokes in RTL, ignore portaled panels ---- */
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.defaultPrevented) return;
    // Portaled overlay panels (select listbox, overflow menu) bubble through
    // the React tree: never treat their keys as toolbar navigation.
    if (!containerRef.current?.contains(e.target as Node)) return;
    const resolved = resolveBinding(
      composed.keymap(store.getState()),
      flipHorizontalStroke(strokeFromEvent(e), live.current.dir),
      platform,
    );
    if (!resolved) return;
    if (resolved.binding.preventDefault !== false) e.preventDefault();
    dispatch(resolved.intent);
  };

  /* ---- DOM focus (tab in, click) re-aligns logical focus ---- */
  const onFocus = (e: React.FocusEvent) => {
    const key = (e.target as HTMLElement)
      .closest("[data-toolbar-key]")
      ?.getAttribute("data-toolbar-key");
    if (key) dispatch(navIntents.move({ key }, "keyboard"));
  };

  /* ---- overflow menu action routing ---- */
  const onOverflowAction = (defKey: Key, itemKey: Key | undefined) => {
    const def = live.current.items.find((d) => d.key === defKey);
    if (!def) return;
    if (def.kind === "button") {
      if (!def.disabled) def.onPress?.();
    } else if (itemKey !== undefined) {
      controllers.get(defKey)?.activate(itemKey);
    }
  };

  const hidden = (key: Key) => row.visible !== null && !row.visible.has(key);

  return (
    <div
      ref={containerRef}
      role="toolbar"
      aria-label={rest["aria-label"]}
      aria-orientation="horizontal"
      dir={dir}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      className={cn(
        "flex min-w-0 flex-nowrap items-center gap-1 overflow-hidden border-border bg-surface p-1",
        variant === "bar" && "rounded-lg border",
        variant === "pill" && "rounded-full border shadow-lg",
        className,
      )}
    >
      {items.map((def) => {
        switch (def.kind) {
          case "button":
            return (
              <ToolbarButtonItem
                key={def.key}
                def={def}
                tabIndex={tabIndexFor(def.key)}
                hidden={hidden(def.key)}
              />
            );
          case "toggle-group":
            return (
              <ToolbarToggleGroupItem
                key={def.key}
                def={def}
                tabIndexFor={tabIndexFor}
                hidden={hidden(def.key)}
                controllers={controllers}
                onValuesChanged={bumpValues}
              />
            );
          case "select":
            return (
              <ToolbarSelectItem
                key={def.key}
                def={def}
                tabIndex={tabIndexFor(def.key)}
                hidden={hidden(def.key)}
                controllers={controllers}
                onValuesChanged={bumpValues}
              />
            );
          case "separator":
            return (
              <div
                key={def.key}
                role="separator"
                aria-orientation="vertical"
                data-measure-key={def.key}
                style={hidden(def.key) ? { display: "none" } : undefined}
                className="h-5 w-px shrink-0 self-center bg-border"
              />
            );
        }
      })}
      {row.hasOverflow && (
        <ToolbarOverflowMenu
          items={items}
          overflowKeys={row.overflow}
          controllers={controllers}
          tabIndex={tabIndexFor(OVERFLOW_TRIGGER_KEY)}
          label={overflowLabel}
          onAction={onOverflowAction}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Items                                                               */
/* ------------------------------------------------------------------ */

const itemClass = (active: boolean, disabled?: boolean) =>
  cn(
    "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2 text-sm font-medium transition-colors outline-none",
    "hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
    active && "bg-accent text-accent-foreground hover:bg-accent",
    disabled && "opacity-50 hover:bg-transparent",
  );

function ToolbarButtonItem({
  def,
  tabIndex,
  hidden,
}: {
  def: ToolbarButtonDef;
  tabIndex: number;
  hidden: boolean;
}) {
  const live = useLiveRef({ def });
  // Global shortcut stays registered while overflowed: the item is hidden,
  // not unmounted — "shrinking the toolbar never loses a shortcut".
  useShortcut(
    def.shortcut ?? "",
    () => {
      const d = live.current.def;
      if (!d.disabled) d.onPress?.();
    },
    { global: true, enabled: !!def.shortcut && !def.disabled, description: def.label },
  );

  return (
    <button
      type="button"
      data-toolbar-key={def.key}
      data-measure-key={def.key}
      tabIndex={tabIndex}
      // aria-disabled (not `disabled`): APG keeps the item focusable so the
      // arrow circuit has no hole; activation is gated instead.
      aria-disabled={def.disabled || undefined}
      aria-label={def.showLabel ? undefined : def.label}
      title={def.showLabel ? undefined : def.label}
      aria-keyshortcuts={def.shortcut}
      onClick={() => {
        if (!def.disabled) def.onPress?.();
      }}
      style={hidden ? { display: "none" } : undefined}
      className={itemClass(false, def.disabled)}
    >
      {def.icon}
      {def.showLabel && def.label}
    </button>
  );
}

const sameKeys = (a: ReadonlySet<Key>, b: readonly Key[]) =>
  a.size === b.length && b.every((k) => a.has(k));

function ToolbarToggleGroupItem({
  def,
  tabIndexFor,
  hidden,
  controllers,
  onValuesChanged,
}: {
  def: ToolbarToggleGroupDef;
  tabIndexFor: (key: Key) => number;
  hidden: boolean;
  controllers: ControllerMap;
  onValuesChanged: () => void;
}) {
  const collection = useMemo(
    () =>
      collectionFromArray(def.items as ToolbarToggleDef[], {
        getKey: (item) => item.key,
        getTextValue: (item) => item.label,
      }),
    [def.items],
  );
  const live = useLiveRef({ collection, def, onValuesChanged });

  // The exact ToggleGroup slice: Selectable alone — navigation belongs to
  // the toolbar machine (the toggles are toolbar stops), selection stays here.
  const { state, dispatch, store } = useComposedMachine(() => {
    const config: CollectionBehaviorConfig = {
      getCollection: () => live.current.collection as Collection<unknown>,
      get selectionMode() {
        return live.current.def.mode ?? "multiple";
      },
      toggleOnSelect: true,
      defaultSelectedKeys: def.value ?? def.defaultValue,
    };
    return composeMachine("toolbar-toggles", [selectable] as const, config);
  });

  const selection = state.selectable as SelectableSlice;

  // Controlled mode: re-align the machine when the prop diverges.
  useEffect(() => {
    const value = def.value;
    if (value === undefined || sameKeys(selection.selectedKeys, value)) return;
    dispatch(selectIntents.clear(undefined, "program"));
    for (const key of value) dispatch(selectIntents.select({ key, toggle: true }, "program"));
  }, [def.value, selection.selectedKeys, dispatch]);

  useForgeEffects(store, {
    events: {
      selectionChange: (detail) => {
        const keys = (detail as { selectedKeys: ReadonlySet<Key> }).selectedKeys;
        live.current.def.onValueChange?.([...keys]);
        live.current.onValuesChanged();
      },
    },
  });

  useEffect(() => {
    controllers.set(def.key, {
      getValue: () => [...(store.getState().selectable as SelectableSlice).selectedKeys],
      activate: (key) => dispatch(selectIntents.select({ key, toggle: true }, "pointer")),
    });
    return () => {
      controllers.delete(def.key);
    };
  }, [controllers, def.key, store, dispatch]);

  return (
    <div
      role="group"
      aria-label={def.label}
      data-measure-key={def.key}
      style={hidden ? { display: "none" } : undefined}
      className="flex shrink-0 items-center gap-0.5"
    >
      {def.items.map((item) => (
        <ToolbarToggleButton
          key={item.key}
          item={item}
          pressed={selection.selectedKeys.has(item.key)}
          tabIndex={tabIndexFor(item.key)}
          onActivate={() =>
            dispatch(selectIntents.select({ key: item.key, toggle: true }, "pointer"))
          }
        />
      ))}
    </div>
  );
}

function ToolbarToggleButton({
  item,
  pressed,
  tabIndex,
  onActivate,
}: {
  item: ToolbarToggleDef;
  pressed: boolean;
  tabIndex: number;
  onActivate: () => void;
}) {
  const live = useLiveRef({ item, onActivate });
  useShortcut(
    item.shortcut ?? "",
    () => {
      if (!live.current.item.disabled) live.current.onActivate();
    },
    { global: true, enabled: !!item.shortcut && !item.disabled, description: item.label },
  );

  return (
    <button
      type="button"
      data-toolbar-key={item.key}
      tabIndex={tabIndex}
      aria-pressed={pressed}
      aria-disabled={item.disabled || undefined}
      aria-label={item.label}
      title={item.label}
      aria-keyshortcuts={item.shortcut}
      onClick={() => {
        if (!item.disabled) onActivate();
      }}
      className={itemClass(pressed, item.disabled)}
    >
      {item.icon}
    </button>
  );
}

function ToolbarSelectItem({
  def,
  tabIndex,
  hidden,
  controllers,
  onValuesChanged,
}: {
  def: ToolbarSelectDef;
  tabIndex: number;
  hidden: boolean;
  controllers: ControllerMap;
  onValuesChanged: () => void;
}) {
  const [internal, setInternal] = useState<Key | null>(def.defaultValue ?? null);
  const value = def.value !== undefined ? def.value : internal;
  const live = useLiveRef({ def, value, onValuesChanged });

  const commit = useCallback(
    (next: Key | null) => {
      const d = live.current.def;
      if (d.value === undefined) setInternal(next);
      d.onValueChange?.(next);
      live.current.onValuesChanged();
    },
    [live],
  );

  useEffect(() => {
    controllers.set(def.key, {
      getValue: () => (live.current.value != null ? [live.current.value] : []),
      activate: (key) => commit(key),
    });
    return () => {
      controllers.delete(def.key);
    };
  }, [controllers, def.key, live, commit]);

  return (
    <div
      data-toolbar-key={def.key}
      data-measure-key={def.key}
      style={hidden ? { display: "none" } : undefined}
      className="shrink-0"
    >
      <Select
        options={def.options}
        value={value}
        onValueChange={commit}
        aria-label={def.label}
        tabIndex={tabIndex}
        className="h-7 min-w-28 px-2 text-xs"
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Overflow "…" — the untouched Menu machine                           */
/* ------------------------------------------------------------------ */

function ToolbarOverflowMenu({
  items,
  overflowKeys,
  controllers,
  tabIndex,
  label,
  onAction,
}: {
  items: readonly ToolbarItemDef[];
  overflowKeys: ReadonlySet<Key>;
  controllers: ControllerMap;
  tabIndex: number;
  label: string;
  onAction: (defKey: Key, itemKey: Key | undefined) => void;
}) {
  const baseId = useId();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [platform] = useState(detectPlatform);
  const [registry] = useState(createItemRegistry);

  // Recomputed every render: the parent re-renders on any group/select value
  // change (bumpValues), so the checks below never go stale. Menus are small.
  const values = new Map<Key, readonly Key[]>();
  for (const [key, controller] of controllers) values.set(key, controller.getValue());
  const sections = overflowMenuSections(items, overflowKeys, values);
  const entries = sections.flatMap((s) => s.entries);

  const menuSections: MenuSectionDef[] = sections.map((section) => ({
    label: section.label,
    items: section.entries.map((entry) => ({
      key: entry.menuKey,
      label: entry.label,
      icon: entry.selected ? <Check className="size-3.5" /> : entry.icon,
      shortcut: entry.shortcut,
      disabled: entry.disabled,
    })),
  }));

  const collection = menuCollection(menuSections);
  const live = useLiveRef({ collection, entries, onAction });

  const { state, dispatch, store, composed } = useComposedMachine(() => {
    const config: CollectionBehaviorConfig = {
      getCollection: () => live.current.collection as Collection<unknown>,
      wrap: true,
    };
    return composeMachine("toolbar-overflow", menuBehaviors, config);
  });

  const nav = state.navigable as NavigableSlice;
  const open = (state.dismissable as DismissableSlice).open;

  useForgeEffects(store, {
    registry,
    events: {
      action: (detail) => {
        const menuKey = (detail as { key: Key }).key;
        const entry = live.current.entries.find((e) => e.menuKey === menuKey);
        if (entry) live.current.onAction(entry.defKey, entry.itemKey);
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
        data-toolbar-key={OVERFLOW_TRIGGER_KEY}
        data-overflow-trigger
        tabIndex={tabIndex}
        aria-label={label}
        title={label}
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
        className={cn(itemClass(open), "px-1.5")}
      >
        <Ellipsis className="size-4" />
      </button>

      <Overlay
        open={open}
        onDismiss={(reason: DismissReason) => dispatch(dismissIntents.close({ reason }, "program"))}
        anchorRef={triggerRef}
        placement="bottom-end"
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

/* ------------------------------------------------------------------ */
/* FloatingToolbar — the selection pill                                */
/* ------------------------------------------------------------------ */

export interface FloatingToolbarProps {
  /** The element whose text selection anchors the pill. */
  containerRef: RefObject<HTMLElement | null>;
  items: readonly ToolbarItemDef[];
  "aria-label": string;
  className?: string;
}

/**
 * FloatingToolbar — the same Toolbar primitive, anchored to the live text
 * selection through the Overlay engine (virtual anchor sized on the range
 * rect — the ContextMenu pattern). A separate wrapper rather than a Toolbar
 * prop: unlike the TimePicker variants (same contract, different projection),
 * floating adds a *lifecycle* (selection anchor, dismissal) — that is
 * composition, not a render variant.
 */
export function FloatingToolbar({ containerRef, items, className, ...rest }: FloatingToolbarProps) {
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const [rect, setRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  useEffect(() => {
    const onSelectionChange = () => {
      const selection = document.getSelection();
      const container = containerRef.current;
      if (!selection || selection.rangeCount === 0 || selection.isCollapsed || !container) {
        setRect(null);
        return;
      }
      const range = selection.getRangeAt(0);
      if (!container.contains(range.commonAncestorContainer)) {
        setRect(null);
        return;
      }
      const r = range.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) {
        setRect(null);
        return;
      }
      setRect({ x: r.x, y: r.y, w: r.width, h: r.height });
    };
    document.addEventListener("selectionchange", onSelectionChange);
    return () => document.removeEventListener("selectionchange", onSelectionChange);
  }, [containerRef]);

  return (
    <>
      {rect && (
        <div
          ref={anchorRef}
          aria-hidden
          style={{
            position: "fixed",
            left: rect.x,
            top: rect.y,
            width: rect.w,
            height: rect.h,
            pointerEvents: "none",
          }}
        />
      )}
      <Overlay
        open={rect !== null}
        onDismiss={() => setRect(null)}
        anchorRef={anchorRef}
        placement="top"
        offset={8}
        restoreFocus={false}
      >
        {/* preventDefault on mousedown: pressing a pill button must not
            collapse the text selection it acts upon. */}
        <div onMouseDown={(e) => e.preventDefault()}>
          <Toolbar
            items={items}
            variant="pill"
            aria-label={rest["aria-label"]}
            className={className}
          />
        </div>
      </Overlay>
    </>
  );
}
