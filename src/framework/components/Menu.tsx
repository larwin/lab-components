import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface MenuItem {
  id: string;
  label: ReactNode;
  icon?: ReactNode;
  shortcut?: string;
  disabled?: boolean;
  danger?: boolean;
}

export interface MenuSection {
  id: string;
  label?: string;
  items: MenuItem[];
}

export interface MenuProps {
  sections: MenuSection[];
  onAction?: (id: string) => void;
  className?: string;
}

/**
 * Menu — a static, sectioned action menu.
 *
 * Rendering only (no popover trigger) so it can be embedded anywhere. A future
 * "intents" layer can map item ids to declarative actions/effects.
 */
export function Menu({ sections, onAction, className }: MenuProps) {
  return (
    <div
      role="menu"
      className={cn(
        "min-w-56 rounded-lg border border-border bg-popover p-1.5 shadow-lg",
        className,
      )}
    >
      {sections.map((section, si) => (
        <div key={section.id}>
          {si > 0 && <div className="my-1 h-px bg-border" />}
          {section.label && (
            <div className="px-2 py-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {section.label}
            </div>
          )}
          {section.items.map((item) => (
            <button
              key={item.id}
              role="menuitem"
              type="button"
              disabled={item.disabled}
              onClick={() => onAction?.(item.id)}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors outline-none",
                "hover:bg-muted focus-visible:bg-muted",
                item.danger && "text-destructive hover:bg-destructive/10",
                item.disabled && "pointer-events-none opacity-50",
              )}
            >
              {item.icon && <span className="size-4 text-muted-foreground">{item.icon}</span>}
              <span className="flex-1">{item.label}</span>
              {item.shortcut && (
                <span className="font-mono text-xs text-muted-foreground">
                  {item.shortcut}
                </span>
              )}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
