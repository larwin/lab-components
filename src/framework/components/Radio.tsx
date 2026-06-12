import { createContext, forwardRef, useContext } from "react";
import { cn } from "@/lib/utils";

interface RadioGroupContextValue {
  name: string;
  value?: string;
  onValueChange?: (value: string) => void;
}

const RadioGroupContext = createContext<RadioGroupContextValue | null>(null);

export interface RadioGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  name: string;
  value?: string;
  onValueChange?: (value: string) => void;
}

export function RadioGroup({
  name,
  value,
  onValueChange,
  className,
  children,
  ...props
}: RadioGroupProps) {
  return (
    <RadioGroupContext.Provider value={{ name, value, onValueChange }}>
      <div role="radiogroup" className={cn("flex flex-col gap-2", className)} {...props}>
        {children}
      </div>
    </RadioGroupContext.Provider>
  );
}

export interface RadioProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "type" | "size"
> {
  value: string;
  label?: string;
}

export const Radio = forwardRef<HTMLInputElement, RadioProps>(
  ({ className, label, value, ...props }, ref) => {
    const group = useContext(RadioGroupContext);
    const checked = group ? group.value === value : props.checked;
    return (
      <label
        className={cn(
          "group inline-flex cursor-pointer items-center gap-2 text-sm select-none",
          props.disabled && "cursor-not-allowed opacity-50",
        )}
      >
        <span className="relative inline-flex">
          <input
            ref={ref}
            type="radio"
            className="peer sr-only"
            name={group?.name}
            value={value}
            checked={checked}
            onChange={(e) => group?.onValueChange?.(e.target.value)}
            {...props}
          />
          <span
            className={cn(
              "flex size-4.5 items-center justify-center rounded-full border border-border bg-surface transition-colors",
              "peer-checked:border-primary",
              "peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background",
              className,
            )}
          >
            <span className="size-2 scale-0 rounded-full bg-primary transition-transform peer-checked:scale-100 group-has-[:checked]:scale-100" />
          </span>
        </span>
        {label && <span>{label}</span>}
      </label>
    );
  },
);
Radio.displayName = "Radio";
