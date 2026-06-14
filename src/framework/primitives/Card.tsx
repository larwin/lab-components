import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils";

/**
 * Card — a static surface with optional header and footer rows. Pure layout
 * over theme tokens; no machine, no role (a card is just a region of layout).
 */

export interface CardProps {
  title?: ReactNode;
  description?: ReactNode;
  /** Right side of the header row (badge, menu…). */
  headerExtra?: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
  className?: string;
}

export function Card({ title, description, headerExtra, footer, children, className }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card text-card-foreground shadow-sm",
        className,
      )}
    >
      {(title || description || headerExtra) && (
        <div className="flex items-start justify-between gap-4 border-b border-border p-4">
          <div>
            {title && <h3 className="text-sm font-semibold">{title}</h3>}
            {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
          </div>
          {headerExtra}
        </div>
      )}
      {children && <div className="p-4 text-sm">{children}</div>}
      {footer && (
        <div className="flex items-center justify-end gap-2 border-t border-border p-3">
          {footer}
        </div>
      )}
    </div>
  );
}
