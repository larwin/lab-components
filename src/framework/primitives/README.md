# src/framework/primitives

**Role:** the next-gen component library — each primitive is a thin React shell over
machines composed from `core` behaviors. Logic, keyboard handling and ARIA come from
the core; the shell only renders, forwards DOM events as intents, and interprets
effects.
**Layer / generation:** next-gen (RFC-001).
**Status:** active — **the components new code should use.**

## What lives here

- ~61 component modules: Button, Checkbox, Switch, Toggle, ToggleGroup, RadioGroup,
  TextField, TextArea, SearchField, NumberField, Slider, Rating, PinInput, TagsInput,
  Listbox, TreeView, Select, ComboBox, Menu, ContextMenu, CommandPalette, Tabs,
  Accordion, Dialog, Drawer, AlertDialog, Popover, Tooltip, Toast, Toolbar,
  FloatingToolbar, Carousel, Splitter, Breadcrumbs, Pagination, Menubar, Calendar,
  DateField, DatePicker, DateRangePicker, TimeField, TimePicker, TimeZoneSelect,
  DateTimeField, DateTimePicker, ColorPicker, Progress, Meter, Alert, Spinner,
  Skeleton, Badge, Avatar, Card, Separator, EmptyState, Dropzone, KanbanBoard, …
- `*-core.ts` files (breadcrumbs, carousel, dropzone, menu, menubar, tags, toolbar) —
  **pure machine/policy builders, Node-testable**, kept next to the shell that uses them.
- `datagrid/` — `DataGrid.tsx` + `gridMachine.ts` (the grid machine, **shared with
  the canvas renderer**) + tests.

## Conventions / rules

- Compose behaviors from `@/framework/core`; bind them with `@/framework/react`
  hooks. The shell owns styling (CVA + Tailwind), DOM and prop wrapping only.
- A new component is a **new composition first, new code last**. If logic is needed,
  it goes in `core` (or a co-located `*-core.ts`) with Node tests — never inline in
  the shell.
- This is the import target for all UI: **`@/framework/primitives`**, not the
  `@/framework` root barrel (which is gen-1).

## Used by / depends on

- **Inbound:** every feature route (18+ importers), `applications/campaign-editor`,
  `framework/canvas` (the shared `gridMachine`).
- **Outbound:** `framework/core`, `framework/react`, `react`.

## See also

- [docs/RFC-001-NEXT-GEN-ARCHITECTURE.md](../../../docs/RFC-001-NEXT-GEN-ARCHITECTURE.md) — §5 status matrix lists every primitive + its demo route.
- [../components/README.md](../components/README.md) — the gen-1 components these supersede.
