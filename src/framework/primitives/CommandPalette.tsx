import { useId, useMemo, useState, type ReactNode } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  actionable,
  actionIntents,
  composeMachine,
  createCollection,
  createSearchCollator,
  dismissable,
  dismissIntents,
  focusable,
  formatKeyCombo,
  navigable,
  navIntents,
  searchable,
  searchIntents,
  type Collection,
  type CollectionBehaviorConfig,
  type CollectionSourceNode,
  type DismissableSlice,
  type DismissReason,
  type Key,
  type NavigableSlice,
  type SearchableSlice,
} from "@/framework/core";
import {
  createItemRegistry,
  detectPlatform,
  Overlay,
  useComposedMachine,
  useForgeEffects,
  useKeymap,
  useLiveRef,
  useShortcut,
} from "@/framework/react";

/**
 * CommandPalette — the capstone composition:
 * Focusable + Searchable + Navigable + Actionable + Dismissable, opened by a
 * *global* shortcut (scope-aware: masked under modal overlays), rendered as a
 * modal Overlay, filtering through the culture-aware collator.
 */

export interface CommandDef {
  key: Key;
  label: string;
  section?: string;
  icon?: ReactNode;
  /** Display-only shortcut hint. */
  shortcut?: string;
  /** Extra search terms. */
  keywords?: string;
  disabled?: boolean;
}

export interface CommandPaletteProps {
  commands: CommandDef[];
  onRun: (key: Key) => void;
  /** Global shortcut that opens the palette. */
  shortcut?: string;
  placeholder?: string;
  locale?: string;
}

const domId = (base: string, key: Key) => `${base}-${key.replace(/[^a-zA-Z0-9_-]/g, "_")}`;

const paletteBehaviors = [focusable, searchable, navigable, actionable, dismissable] as const;

export function CommandPalette({
  commands,
  onRun,
  shortcut = "Mod+k",
  placeholder = "Type a command…",
  locale = "en",
}: CommandPaletteProps) {
  const baseId = useId();
  const [registry] = useState(createItemRegistry);
  const [platform] = useState(detectPlatform);

  const live = useLiveRef({ commands, onRun, filtered: null as Collection<CommandDef> | null });

  const { state, dispatch, store, composed } = useComposedMachine(() => {
    const config: CollectionBehaviorConfig = {
      getCollection: () => (live.current.filtered ?? createCollection([])) as Collection<unknown>,
      wrap: true,
    };
    return composeMachine("command-palette", paletteBehaviors, config);
  });

  const nav = state.navigable as NavigableSlice;
  const open = (state.dismissable as DismissableSlice).open;
  const query = (state.searchable as SearchableSlice).query;

  const filtered = useMemo(() => {
    const collator = createSearchCollator(locale);
    const q = query.trim();
    const contains = (text: string): boolean => {
      if (q.length === 0) return true;
      if (text.length < q.length) return false;
      for (let i = 0; i + q.length <= text.length; i++) {
        if (collator.compare(text.slice(i, i + q.length), q) === 0) return true;
      }
      return false;
    };
    const matching = commands.filter((c) => contains(`${c.label} ${c.keywords ?? ""}`));
    const bySection = new Map<string, CommandDef[]>();
    for (const c of matching) {
      const section = c.section ?? "Commands";
      bySection.set(section, [...(bySection.get(section) ?? []), c]);
    }
    const source: CollectionSourceNode<CommandDef | string>[] = [...bySection.entries()].map(
      ([section, items], index) => ({
        key: `__section-${index}`,
        value: section,
        kind: "section",
        children: items.map((c) => ({
          key: c.key,
          value: c,
          textValue: c.label,
          disabled: c.disabled,
        })),
      }),
    );
    return createCollection(source) as Collection<CommandDef | string>;
  }, [commands, query, locale]);
  live.current.filtered = filtered as Collection<CommandDef>;

  useShortcut(
    shortcut,
    () => {
      dispatch(dismissIntents.open(undefined, "shortcut"));
      dispatch(searchIntents.clear(undefined, "shortcut"));
      dispatch(navIntents.first(undefined, "shortcut"));
    },
    { global: true, description: "Open command palette" },
  );

  useForgeEffects(store, {
    registry,
    events: {
      action: (detail) => {
        dispatch(dismissIntents.close({ reason: "select" }, "program"));
        live.current.onRun((detail as { key: Key }).key);
      },
    },
  });

  const onKeyDown = useKeymap(
    () =>
      composed
        .keymap(store.getState())
        .filter((b) => b.keys !== "@printable" && b.keys !== "Space"),
    dispatch,
  );

  return (
    <Overlay
      open={open}
      onDismiss={(reason: DismissReason) => dispatch(dismissIntents.close({ reason }, "program"))}
      modal
      style={{ alignSelf: "start", marginTop: "15vh" }}
      panelProps={{ role: "dialog", "aria-modal": true, "aria-label": "Command palette" }}
    >
      <div className="w-[36rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl">
        <div className="flex items-center gap-2 border-b border-border px-3">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input
            data-autofocus
            type="text"
            role="combobox"
            aria-expanded
            aria-controls={`${baseId}-list`}
            aria-activedescendant={
              nav.focusedKey !== null ? domId(baseId, nav.focusedKey) : undefined
            }
            aria-autocomplete="list"
            aria-label="Search commands"
            autoComplete="off"
            placeholder={placeholder}
            value={query}
            onChange={(e) => {
              dispatch(searchIntents.setQuery({ query: e.target.value }, "keyboard"));
              dispatch(navIntents.first(undefined, "keyboard"));
            }}
            onKeyDown={onKeyDown}
            className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd className="shrink-0 rounded border border-border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground">
            Esc
          </kbd>
        </div>

        <div
          id={`${baseId}-list`}
          role="listbox"
          aria-label="Commands"
          className="max-h-80 overflow-auto p-1.5"
        >
          {filtered.size === 0 && (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              No command matches “{query}”.
            </p>
          )}
          {filtered.visibleKeys().map((key) => {
            const node = filtered.getNode(key)!;
            if (node.kind === "section") {
              return (
                <div
                  key={key}
                  role="presentation"
                  className="px-2.5 pt-2.5 pb-1 font-mono text-[10px] tracking-widest text-muted-foreground uppercase"
                >
                  {node.value as string}
                </div>
              );
            }
            const command = node.value as CommandDef;
            const focused = nav.focusedKey === key;
            return (
              <div
                key={key}
                id={domId(baseId, key)}
                ref={registry.register(key)}
                role="option"
                aria-selected={focused}
                aria-disabled={node.disabled || undefined}
                data-focused={focused || undefined}
                onPointerEnter={() =>
                  !node.disabled && dispatch(navIntents.move({ key }, "pointer"))
                }
                onPointerDown={(e) => {
                  e.preventDefault();
                  if (!node.disabled) dispatch(actionIntents.activate({ key }, "pointer"));
                }}
                className={cn(
                  "flex cursor-default items-center gap-2.5 rounded-md px-2.5 py-2 text-sm",
                  focused && "bg-accent text-accent-foreground",
                  node.disabled && "opacity-50",
                )}
              >
                {command.icon && <span className="text-muted-foreground">{command.icon}</span>}
                <span className="flex-1 truncate">{command.label}</span>
                {command.shortcut && (
                  <kbd className="rounded border border-border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground">
                    {formatKeyCombo(command.shortcut, platform)}
                  </kbd>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Overlay>
  );
}
