import { forwardRef } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "size"> {
  label?: string;
}

/**
 * Checkbox — a native checkbox styled with a custom indicator.
 *
 * Built on a real <input type="checkbox"> so it is accessible and form-ready
 * by default. The visual box is a sibling driven by `peer` state.
 */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, id, ...props }, ref) => {
    const inputId = id ?? props.name;
    return (
      <label
        className={cn(
          "group inline-flex cursor-pointer items-center gap-2 text-sm select-none",
          props.disabled && "cursor-not-allowed opacity-50",
        )}
        htmlFor={inputId}
      >
        <span className="relative inline-flex">
          <input
            ref={ref}
            id={inputId}
            type="checkbox"
            className="peer sr-only"
            {...props}
          />
          <span
            className={cn(
              "flex size-4.5 items-center justify-center rounded-[5px] border border-border bg-surface transition-colors",
              "peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground",
              "peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background",
              className,
            )}
          >
            <Check className="size-3 opacity-0 transition-opacity peer-checked:opacity-100 group-has-[:checked]:opacity-100" />
          </span>
        </span>
        {label && <span>{label}</span>}
      </label>
    );
  },
);
Checkbox.displayName = "Checkbox";
