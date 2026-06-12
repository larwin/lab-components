import { cn } from "@/lib/utils";

/**
 * Separator — semantic (`role="separator"`) or purely decorative
 * (`aria-hidden`), horizontal or vertical. Tokens only.
 */

export interface SeparatorProps {
  orientation?: "horizontal" | "vertical";
  /** Decorative separators are hidden from the accessibility tree. */
  decorative?: boolean;
  className?: string;
}

export function Separator({
  orientation = "horizontal",
  decorative = true,
  className,
}: SeparatorProps) {
  return (
    <div
      role={decorative ? undefined : "separator"}
      aria-hidden={decorative || undefined}
      aria-orientation={decorative ? undefined : orientation}
      className={cn(
        "shrink-0 bg-border",
        orientation === "horizontal" ? "h-px w-full" : "h-full w-px self-stretch",
        className,
      )}
    />
  );
}
