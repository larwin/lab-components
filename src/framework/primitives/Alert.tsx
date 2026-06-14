import { type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/shared/lib/utils";

/**
 * Alert / Callout — static feedback, no machine on purpose: correct role and
 * theme tokens are all it takes. Errors and warnings carry `role="alert"`
 * (announced when they appear), info/success use `role="status"` (polite).
 */

const alertVariants = cva("relative flex w-full gap-3 rounded-lg border p-4 text-sm", {
  variants: {
    kind: {
      info: "border-primary/30 bg-primary/5 text-foreground",
      success: "border-success/30 bg-success/5 text-foreground",
      warning: "border-warning/40 bg-warning/10 text-foreground",
      error: "border-destructive/40 bg-destructive/5 text-foreground",
    },
  },
  defaultVariants: { kind: "info" },
});

const KIND_ICONS = {
  info: <Info className="size-4 text-primary" />,
  success: <CheckCircle2 className="size-4 text-success" />,
  warning: <AlertTriangle className="size-4 text-warning" />,
  error: <XCircle className="size-4 text-destructive" />,
} as const;

export interface AlertProps extends VariantProps<typeof alertVariants> {
  title: ReactNode;
  children?: ReactNode;
  /** Replace the default kind icon (pass null to remove it). */
  icon?: ReactNode | null;
  className?: string;
}

export function Alert({ kind = "info", title, children, icon, className }: AlertProps) {
  const resolvedKind = kind ?? "info";
  return (
    <div
      role={resolvedKind === "error" || resolvedKind === "warning" ? "alert" : "status"}
      className={cn(alertVariants({ kind }), className)}
    >
      <span aria-hidden className="mt-0.5 shrink-0">
        {icon === undefined ? KIND_ICONS[resolvedKind] : icon}
      </span>
      <div className="flex-1">
        <p className="font-medium">{title}</p>
        {children && <div className="mt-1 text-muted-foreground">{children}</div>}
      </div>
    </div>
  );
}
