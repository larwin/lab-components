import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

/* ── Page header ──────────────────────────────────────────────────────────*/

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
      <div className="max-w-2xl">
        {eyebrow && (
          <p className="mb-1.5 font-mono text-xs font-medium tracking-widest text-primary uppercase">
            {eyebrow}
          </p>
        )}
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        {description && (
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}

/* ── Showcase card ────────────────────────────────────────────────────────*/

export function Showcase({
  title,
  description,
  children,
  className,
  contentClassName,
}: {
  title?: string;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-card shadow-sm",
        className,
      )}
    >
      {(title || description) && (
        <div className="border-b border-border px-5 py-4">
          {title && <h3 className="font-sans text-sm font-semibold">{title}</h3>}
          {description && (
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          )}
        </div>
      )}
      <div className={cn("p-5", contentClassName)}>{children}</div>
    </section>
  );
}

/* ── Demo surface (dotted backdrop) ───────────────────────────────────────*/

export function DemoSurface({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-4 rounded-lg border border-dashed border-border bg-muted/30 p-6",
        className,
      )}
    >
      {children}
    </div>
  );
}

/* ── Control field ────────────────────────────────────────────────────────*/

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

/* ── Metric card ──────────────────────────────────────────────────────────*/

export function MetricCard({
  label,
  value,
  unit,
  accent,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
        {label}
      </p>
      <p className="mt-1 flex items-baseline gap-1">
        <span
          className={cn(
            "font-sans text-2xl font-bold tabular-nums",
            accent && "text-primary",
          )}
        >
          {value}
        </span>
        {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
      </p>
    </div>
  );
}

/* ── Status pill ──────────────────────────────────────────────────────────*/

const STATUS_STYLES: Record<string, string> = {
  active: "bg-success/15 text-success",
  paid: "bg-success/15 text-success",
  pending: "bg-warning/15 text-warning",
  processing: "bg-warning/15 text-warning",
  inactive: "bg-muted text-muted-foreground",
  refunded: "bg-destructive/15 text-destructive",
  cancelled: "bg-destructive/15 text-destructive",
};

export function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize",
        STATUS_STYLES[status] ?? "bg-muted text-muted-foreground",
      )}
    >
      {status}
    </span>
  );
}

/* ── Inline code block ────────────────────────────────────────────────────*/

export function CodeBlock({ code, label }: { code: string; label?: string }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      {label && (
        <div className="flex items-center gap-2 border-b border-border bg-muted/50 px-3 py-1.5">
          <span className="flex gap-1.5">
            <span className="size-2.5 rounded-full bg-destructive/60" />
            <span className="size-2.5 rounded-full bg-warning/60" />
            <span className="size-2.5 rounded-full bg-success/60" />
          </span>
          <span className="font-mono text-xs text-muted-foreground">{label}</span>
        </div>
      )}
      <pre className="overflow-x-auto p-4 text-xs leading-relaxed">
        <code className="font-mono">{code}</code>
      </pre>
    </div>
  );
}
