# src/framework/core

**Role:** the pure, deterministic heart of Forge — every hard interaction problem
(keyboard semantics, selection, typeahead, virtualization, ARIA derivation, async
races, dates/times/zones, colour math) solved as `Intent → Reducer → State → Effects`.
**Layer / generation:** next-gen (RFC-001). **The actual product.**
**Status:** active.

## What lives here

- `runtime/` — `defineIntent`/`defineEffect`, the `Machine` and `Store`, the
  journal + global inspector bus.
- `behaviors/` — `composeMachine` + the orthogonal behaviors (Focusable, Pressable,
  Toggleable, Navigable, Selectable, Expandable, Dismissable, Searchable,
  Actionable, Autoplayable, Validatable, NumericValue, collection-config).
- `collection/` — normalized nodes, visibility, navigation, selection algebra,
  culture-aware typeahead. **The live replacement for `framework/collections`.**
- `interaction/` — key-combo parsing, keymap resolution, shortcut scope tree.
- `virtualization/` — Fenwick-tree windowing (O(log n)).
- `data/` — serializable sort/filter/group/pagination descriptors + the async
  loader machine (sequence-based race elimination).
- `dnd/` — the pure drag machine.
- `overlay/` — toast queue machine + pure positioning (flip/shift) math.
- `text/`, `field/` — character-limit/PIN policies; the generic segment-field machine.
- `date/`, `time/` — `DateValue`/`TimeValue`/`ZonedDateTime`, calendar grid, Intl
  services, the time picker geometry.
- `color/` — RGB/HSL/HSV/OKLCH conversions, CSS parsing, WCAG contrast, ΔEOK.
- `layout/` — overflow partitioning (toolbar/breadcrumbs).
- `i18n/` — translator bundles, collators, number formatting.

## Conventions / rules

- **Imports nothing** — no React, no DOM types beyond structural mirrors
  (`KeyStroke`), no browser globals except `Intl`. Enforced by `purity.test.ts`.
- State changes **only through intents**; side-effects are returned as **effect
  descriptions**, never executed here (even `onPress`/`onSelectionChange` are
  `event/emit` effects).
- Tests run in **plain Node** (`// @vitest-environment node`) — no jsdom.
- Leaf data tables that not everyone needs (e.g. `time/windows-zones.ts`,
  `color/named.ts`) are **not** re-exported by the barrel — consumers inject them.

## Used by / depends on

- **Inbound:** `framework/react`, `framework/canvas`, `framework/primitives`,
  `framework/services` (the `Store` type), `domains`.
- **Outbound:** nothing — `core` is a leaf.

## See also

- [docs/RFC-001-NEXT-GEN-ARCHITECTURE.md](../../../docs/RFC-001-NEXT-GEN-ARCHITECTURE.md) — §3 principles, §4 architecture.
