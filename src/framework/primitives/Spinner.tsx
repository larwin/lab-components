import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Spinner — indeterminate activity with a screen-reader label:
 * `role="status"` + visually-hidden text, the spinning circle itself is
 * decorative.
 */

const spinnerVariants = cva("animate-spin text-muted-foreground", {
  variants: {
    size: {
      sm: "size-4",
      md: "size-6",
      lg: "size-8",
    },
  },
  defaultVariants: { size: "md" },
});

export interface SpinnerProps extends VariantProps<typeof spinnerVariants> {
  /** Screen-reader label. */
  label?: string;
  className?: string;
}

export function Spinner({ size, label = "Chargement…", className }: SpinnerProps) {
  return (
    <span role="status" className={cn("inline-flex items-center", className)}>
      <svg aria-hidden viewBox="0 0 24 24" fill="none" className={spinnerVariants({ size })}>
        <circle
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="3"
          className="opacity-20"
        />
        <path
          d="M22 12a10 10 0 0 0-10-10"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
      <span className="sr-only">{label}</span>
    </span>
  );
}
