import { cn } from "@/shared/lib/utils";

/**
 * Skeleton — a loading placeholder, hidden from assistive tech (the loading
 * *state* should be announced by the surface that owns it, not by each bone).
 */

export interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return <div aria-hidden className={cn("animate-pulse rounded-md bg-muted", className)} />;
}
