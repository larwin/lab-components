import { useState } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/shared/lib/utils";

/**
 * Avatar — image with an initials fallback (broken/missing src falls back
 * automatically). Static by design: an `img` with a proper alt, no machine.
 */

const avatarVariants = cva(
  "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted font-medium text-muted-foreground select-none",
  {
    variants: {
      size: {
        sm: "size-7 text-[10px]",
        md: "size-9 text-xs",
        lg: "size-12 text-sm",
      },
    },
    defaultVariants: { size: "md" },
  },
);

/** "Ada Lovelace" → "AL", "forge" → "F" (first two word initials). */
function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => [...word][0]?.toUpperCase() ?? "")
    .join("");
}

export interface AvatarProps extends VariantProps<typeof avatarVariants> {
  name: string;
  src?: string;
  className?: string;
}

export function Avatar({ name, src, size, className }: AvatarProps) {
  const [failed, setFailed] = useState(false);
  const showImage = src !== undefined && !failed;
  return (
    <span className={cn(avatarVariants({ size }), className)}>
      {showImage ? (
        <img
          src={src}
          alt={name}
          onError={() => setFailed(true)}
          className="size-full object-cover"
        />
      ) : (
        <span aria-hidden>{initialsOf(name)}</span>
      )}
      {!showImage && <span className="sr-only">{name}</span>}
    </span>
  );
}
