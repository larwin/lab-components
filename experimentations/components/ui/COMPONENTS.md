# UI Components Inventory

Small local reference for shared `src/components/ui` primitives already used by the menu work.

## `Button`
File: [button.tsx](/c:/Github/GridLab/grid-foundation-claude/src/components/ui/button.tsx)

Signature:
```ts
type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };
```

Notes:
- supports `variant`, `size`, `asChild`
- used in playground actions and triggers

## `Badge`
File: [badge.tsx](/c:/Github/GridLab/grid-foundation-claude/src/components/ui/badge.tsx)

Signature:
```ts
type BadgeProps = React.HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof badgeVariants>;
```

Notes:
- supports `variant`
- used for small status chips in playground pages

## `Checkbox`
File: [checkbox.tsx](/c:/Github/GridLab/grid-foundation-claude/src/components/ui/checkbox.tsx)

Signature:
```ts
const Checkbox: React.ForwardRefExoticComponent<
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>;
```

Notes:
- Radix-based
- renders its own interactive root
- do not nest inside another `<button>`
- useful props in current menu work: `checked`, `tabIndex`, `aria-label`, `className`

## `Input`
File: [input.tsx](/c:/Github/GridLab/grid-foundation-claude/src/components/ui/input.tsx)

Signature:
```ts
const Input: React.ForwardRefExoticComponent<
  React.ComponentProps<'input'>
>;
```

Notes:
- shared text/number input styling
- useful props in current menu work: `type`, `defaultValue`, `placeholder`, `disabled`, event handlers, `className`

## `MaterialSymbol`
File: [MaterialSymbol.tsx](/c:/Github/GridLab/grid-foundation-claude/src/components/ui/icons/MaterialSymbol.tsx)

Signature:
```ts
type MaterialSymbolProps = {
  name: string;
  size?: number;
  className?: string;
  fill?: boolean;
};
```

Notes:
- used for menu arrows and other icon affordances
- keep icon naming aligned with Material Symbols names
