import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface GridProps {
  /** Number of columns. */
  columns?: number;
  /** Tailwind gap utility suffix, e.g. 3 -> gap-3. */
  gap?: number;
  className?: string;
  children: ReactNode;
}

/**
 * Grid — a minimal layout grid primitive.
 *
 * This is distinct from <DataGrid> (tabular data). Use Grid for arranging
 * arbitrary cells/cards. Column count drives an inline CSS grid template so it
 * stays dynamic without generating Tailwind classes at runtime.
 */
export function Grid({ columns = 3, gap = 4, className, children }: GridProps) {
  return (
    <div
      className={cn("grid", className)}
      style={{
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gap: `calc(${gap} * 0.25rem)`,
      }}
    >
      {children}
    </div>
  );
}

export type GridCellProps = React.HTMLAttributes<HTMLDivElement>;

export function GridCell({ className, ...props }: GridCellProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-md border border-border bg-surface p-4 text-sm",
        className,
      )}
      {...props}
    />
  );
}
