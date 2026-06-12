import { useCallback, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface ListItem {
  id: string;
  label: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
}

export interface ListProps {
  items: ListItem[];
  selectedId?: string;
  onSelect?: (id: string) => void;
  className?: string;
  "aria-label"?: string;
}

/**
 * List — a single-select collection with roving keyboard navigation.
 *
 * This is the reference implementation for the collection engine. Selection,
 * focus and rendering are deliberately separated so a future virtualization
 * layer can wrap the item renderer without touching navigation logic.
 */
export function List({
  items,
  selectedId,
  onSelect,
  className,
  "aria-label": ariaLabel = "List",
}: ListProps) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const focusItem = useCallback((index: number) => {
    const max = refs.current.length - 1;
    const clamped = Math.max(0, Math.min(index, max));
    refs.current[clamped]?.focus();
  }, []);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent, index: number) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          focusItem(index + 1);
          break;
        case "ArrowUp":
          e.preventDefault();
          focusItem(index - 1);
          break;
        case "Home":
          e.preventDefault();
          focusItem(0);
          break;
        case "End":
          e.preventDefault();
          focusItem(items.length - 1);
          break;
      }
    },
    [focusItem, items.length],
  );

  return (
    <ul role="listbox" aria-label={ariaLabel} className={cn("flex flex-col gap-1", className)}>
      {items.map((item, i) => {
        const selected = item.id === selectedId;
        return (
          <li key={item.id} role="option" aria-selected={selected}>
            <button
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              disabled={item.disabled}
              onClick={() => onSelect?.(item.id)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={cn(
                "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors outline-none",
                "hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
                selected && "bg-accent text-accent-foreground",
                item.disabled && "pointer-events-none opacity-50",
              )}
            >
              {item.icon && <span className="text-muted-foreground">{item.icon}</span>}
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-medium">{item.label}</span>
                {item.description && (
                  <span className="truncate text-xs text-muted-foreground">{item.description}</span>
                )}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
