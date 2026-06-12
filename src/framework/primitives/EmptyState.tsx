import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * EmptyState — "nothing here yet" with an optional action. Static layout;
 * the icon is decorative, the message carries the meaning.
 */

export interface EmptyStateProps {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** Call to action (a Button, a link…). */
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border px-6 py-10 text-center",
        className,
      )}
    >
      {icon && (
        <span aria-hidden className="mb-1 text-muted-foreground/60 [&>svg]:size-8">
          {icon}
        </span>
      )}
      <p className="text-sm font-semibold">{title}</p>
      {description && <p className="max-w-sm text-xs text-muted-foreground">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
