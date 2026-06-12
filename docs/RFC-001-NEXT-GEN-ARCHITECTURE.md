# RFC-001 — Forge Next-Gen: a pure-core architecture for interactive components

Status: **implemented (foundation)** — `src/framework/core`, `src/framework/react`, `src/framework/primitives`
Demos: `/engine` (live inspector), `/grid-next` (500k-row grid)
Tests: `src/framework/core/**/*.test.ts` run in **plain Node** — no DOM, no React, no browser.

---

## 1. Executive summary

Forge's next generation is built on one structural bet:

> **A component is a pure machine plus a thin rendering shell.**
> `Intent → Reducer → State → Effects`, where React and the DOM are adapters.

Components are not written; they are **composed from behaviors**:

```
Button   = Focusable + Pressable
Checkbox = Focusable + Toggleable
Listbox  = Focusable + Navigable + Selectable
Tree     = Focusable + Navigable + Expandable + Selectable
Menu     = Focusable + Navigable + Actionable + Dismissable
ComboBox = Focusable + Searchable + Navigable + Selectable + Dismissable
Palette  = Focusable + Searchable + Navigable + Actionable + Dismissable
DataGrid = grid machine (2D cursor) + query core + loader machine + virtualizer
```

Everything that makes these components hard — keyboard semantics, selection
algebra, typeahead, ARIA, virtualization windowing, shortcut conflicts — lives
in `src/framework/core` as deterministic, serializable-friendly functions, and
is proven by unit tests that never touch a DOM.

## 2. Analysis of the existing code

Three generations coexist in this repository. Each contributed to this design.

### 2.1 `src/framework/components` (gen 1)

Plain React components with local `useState`, direct DOM focus calls
(`refs.current[i]?.focus()`), and per-component reimplementation of
navigation/selection.

- Good: clean props, co-located tests, an honest `useDataGrid` headless seam.
- Limits: nothing is testable without jsdom; List/Tree/Menu/DataGrid each own a
  private copy of the same logic; keyboard handling is imperative `switch`
  statements; roving-focus breaks under virtualization (the focused node must
  exist); no story for shortcuts, announcements, or state observability.

### 2.2 `src/framework/engines` + `collections` (gen 1.5)

Declared the right vision — behaviors, intents, state machines, effects,
collection engine — **as descriptors only**. Zero implementation. The contracts
themselves were too thin (e.g. `CollectionEngine.select(key): void` bakes in
mutation and hides modifiers, ranges, and effects).

### 2.3 `experimentations/` (gen 2 — the real prior art)

A substantially more advanced prototype: a pure
`reduceCollection(state, intent, context) → { state, effects }` state machine,
`ItemRuntime` derived flags, _RowKind_ renderer definitions with inheritance,
DOM node pooling with structure-keyed invalidation, prefix-sum layout state.

- Ideas adopted here: **intents/effects as data**, pure keyboard navigation
  over visible-id arrays, derived per-item runtime, the conviction that the
  renderer is swappable.
- Limits addressed here: the reducer was collection-only (no composition story
  for buttons/overlays/forms); `PoolRenderer` mutated the DOM imperatively and
  was untestable without jsdom; prefix sums were recomputed O(n) per height
  change; kind utilities were duplicated between `list/` and `virtual/`;
  ARIA was partial (no `role="option"`, no `aria-expanded` updates); five
  generic parameters on `RowKindDefinition` hurt ergonomics.

**Verdict:** the direction was right and validated twice; what was missing was
a _general_ composition mechanism, a hard purity boundary, and ruthless
attention to a11y and asymptotics. That is what this architecture delivers.

## 3. Non-negotiable principles

1. **The core imports nothing.** `src/framework/core` has no React, no DOM
   types beyond structural mirrors (`KeyStroke`), no browser globals except
   `Intl`. Enforced by `// @vitest-environment node` tests.
2. **State changes only through intents.** Every mutation is a dispatched,
   journaled, replayable description carrying its `source`
   (keyboard/pointer/shortcut/program).
3. **Effects describe; adapters execute.** A reducer returns
   `FocusElement`, `ScrollToItem`, `Announce`, `RestoreFocus`, `EmitEvent`,
   `LoadData` — never calls them. Even userland callbacks (`onPress`,
   `onSelectionChange`) are effects (`event/emit`) interpreted at the edge.
4. **Composition over inheritance.** Behaviors contribute orthogonal
   fragments — state slice, intent handlers, keymap, ARIA — and are merged by
   `composeMachine`. New components are new compositions first, new code last.
5. **Virtualization is a first-class citizen**, not a wrapper. Logical focus
   (`aria-activedescendant`) instead of roving tabindex is chosen _because_
   focused items may be unmounted.
6. **Accessibility and i18n are outputs of the core**, not component-level
   garnish: ARIA derives from state, typeahead/sort go through `Intl.Collator`,
   announcements are effects.

## 4. The architecture

```
┌────────────────────────────────────────────────────────────────────┐
│ src/framework/primitives  — Button, Listbox, TreeView, DataGrid    │  thin shells
├────────────────────────────────────────────────────────────────────┤
│ src/framework/react       — useMachine, useKeymap, useVirtualizer, │  ONE adapter
│   effect interpreters (focus/scroll/announce/events), shortcuts    │  among many
├────────────────────────────────────────────────────────────────────┤
│ src/framework/core        — THE PRODUCT                            │
│   runtime/        Intent, Effect, Machine, Store, inspector bus    │
│   behaviors/      composeMachine + Focusable, Pressable,           │
│                   Toggleable, Navigable, Selectable, Expandable,   │
│                   Dismissable                                      │
│   collection/     normalized nodes, visibility, navigation,        │
│                   selection algebra, culture-aware typeahead       │
│   interaction/    key combos, keymap resolution, shortcut scopes   │
│   virtualization/ Fenwick-tree windowing (O(log n) everything)     │
│   data/           SortSpec/filter — serializable query descriptors │
│   i18n/           translator, collators, direction                 │
└────────────────────────────────────────────────────────────────────┘
```

### 4.1 Runtime — `core/runtime`

`defineIntent`/`defineEffect` create typed factories with `.match()` guards.
A `Machine` is `(state, intent) → { state, effects }`. The `Store` is the only
stateful object: it journals every transition (ring buffer, time-travel via
`replaceState`) and broadcasts to a **global inspector bus** (`inspect()`) —
the `/engine` page is a Redux-DevTools-style window over every live machine.

### 4.2 Behaviors — `core/behaviors`

A behavior owns a namespaced state slice and contributes:

```ts
defineBehavior({
  name: "selectable",
  initial(config) { … },
  handlers: { "select/select": (slice, intent, ctx) => slice | { state, effects } },
  keymap(slice, ctx) { return [{ keys: "Mod+a", intent: … }] },
  aria(slice, ctx)   { return { "aria-multiselectable": … } },
})
```

`composeMachine(id, behaviors, config)` merges any set into one machine.
Two deliberate mechanics make cross-behavior choreography safe **without
coupling**:

- **Pipeline fan-out** — several behaviors may handle the same intent, in
  composition order, each writing only its slice. `ctx.read()` sees slices
  already updated in this dispatch (Selectable reads the key Navigable just
  focused → selection-follows-focus, Shift+Arrow ranges).
- **`ctx.readInitial()`** — reads pre-dispatch state. Expandable uses it so
  ArrowLeft on a leaf climbs to the parent (Navigable) _without_ the parent
  then being collapsed by Expandable reading the freshly-moved focus. The
  WAI-ARIA tree pattern emerges from two behaviors with disjoint conditions.

Keymaps are **data** (`"Shift+ArrowDown"`, `"Mod+a"`, `"@printable"` for
typeahead); first match in composition order wins, and a binding may return
`null` to fall through (Space joins an _active_ typeahead search, otherwise
falls through to selection — a real conflict solved declaratively).

Planned behaviors on the same contract: Searchable (filter-as-state),
Editable, Draggable/Sortable, Groupable, Validatable, Virtualizable (windowing
intents for accessibility tools).

### 4.3 Collection engine — `core/collection`

One normalized model for List/Tree/Menu/ComboBox/CommandPalette/Grid rows:
`createCollection` indexes any nested source into `CollectionNode`s (key,
kind: item/section/separator, depth, parentKey, childKeys, indexInParent,
textValue) with O(1) lookup, duplicate-key detection, and a cached
`visibleKeys(expandedKeys)` sequence — **the single spine** that navigation,
selection ranges, typeahead and the virtualizer all index into.

Pure functions on top: `nextKey/previousKey/firstKey/lastKey/pageKey`
(disabled-skipping, optional wrap), `keysBetween` (ranges),
`applySelect/selectAll` (file-explorer semantics: replace / Ctrl-toggle /
Shift-extend with a stable anchor), `typeaheadStep` (Intl search collator —
"e" finds "Élodie"; single-char repeat cycles, multi-char builds a prefix;
expiry via injected timestamps, hence fully testable).

### 4.4 Interaction system — `core/interaction`

- `parseKeyCombo("Mod+Shift+K")` / `matchesCombo` / `formatKeyCombo` ("⇧⌘K" on
  mac) — `Mod` resolves per platform.
- `createShortcutManager`: a **scope tree** mirroring the UI. Resolution walks
  from the active scope up the ancestor chain; within a scope, priority then
  recency. `blocking: true` (modal dialogs) stops the walk; `capturesText`
  (inputs) swallows printable strokes but lets combos through; `when`
  predicates make shortcuts contextual; `getConflicts()` surfaces real
  collisions instead of silently picking one. A button can be activated by a
  global shortcut without focus — the journal records `source: "shortcut"`.

### 4.5 Virtualization — `core/virtualization`

Sizes live in a **Fenwick tree**: measure O(log n), offset-of O(log n),
index-at-offset O(log n) via bit-walking, linear-time construction. This is
what makes _dynamic heights at 500k rows_ tractable (the experimentations
prototype recomputed O(n) prefix sums per height change). The React binding
coalesces scroll through rAF and re-renders **only when the window changes**.
Horizontal = same object, other axis; 2D = two instances (grid columns next).

### 4.6 Data layer — `core/data`

`SortSpec[]` and filter inputs are **plain serializable descriptors** feeding
pure `sortRows` (multi-column, stable, `Intl.Collator`-aware, numeric-smart)
and `filterRows` (diacritic-insensitive). For remote data, the same
descriptors travel inside a `DataQuery` to a `DataSource` — one async function
`(query, signal) → DataPage`. Switching client/server sort changes the
executor, not the component (`/grid-next` vs `/data-loader` prove it on the
same DataGrid).

The **loader machine** (`core/data/loader`) makes async state pure: every
request is a `data/fetch` effect carrying a monotonic sequence number;
responses come back as resolve/reject _intents_; the reducer drops stale
sequences — so out-of-order responses (slow page-2 landing after a re-sort)
are impossible **by construction**, not by adapter discipline. Starting a new
query emits `data/cancel` for the in-flight request, which `useDataSource`
maps to `AbortController.abort()`. Races, cancellation and cursor pagination
are unit-tested in plain Node with zero async code.

### 4.7 A11y & i18n

ARIA is **derived**: behaviors emit host attributes; primitives add the
pattern roles (`listbox/option`, `tree/treeitem` with `aria-level`,
`aria-posinset`, `aria-setsize`, `grid/row/gridcell` with `aria-rowcount`,
`aria-activedescendant`). `announce` effects feed a shared live region.
`core/i18n` provides translator bundles with interpolation + fallback chain,
search/sort collators, and direction (RTL keymap flipping is an adapter
concern, by design).

### 4.8 Overlays — `core/overlay` + `react/overlay`

`Dismissable` models open/close with `RestoreFocus` effects and Escape via
keymap. On top of it:

- **`core/overlay/positioning`** — pure rect math (`computePosition`):
  placement grammar (`bottom-start`…), main-axis flip to the least-overflowing
  side, cross-axis shift into the boundary. Node-tested like the virtualizer.
- **`react/Overlay`** — the single rendering engine for every floating
  surface: portal to body, a global **layer stack** (pressing inside layer N
  dismisses every layer above N; Escape pops the topmost only), focus
  save/initial-focus/trap/restore, anchored position tracking on
  scroll/resize, `matchAnchorWidth` for combo boxes, and — for modals — a
  **blocking shortcut scope** so page shortcuts (e.g. the palette's Mod+K)
  are masked while a dialog is open.
- **Primitives**: `Menu` (Actionable: activation-as-event, not selection),
  `ComboBox` (Searchable: the query is machine state; the host feeds the
  filtered collection back through `getCollection()` so Navigable/Selectable
  operate on the filtered universe transparently), `CommandPalette`
  (global-shortcut modal search) and `Dialog` (controlled, machine-less by
  design — app state owns it). Demo: `/overlays`.

## 5. What exists today vs. what's next

| Area                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Status                                                             |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Runtime (intents/effects/machine/store/journal/inspector)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | ✅ implemented + tested                                            |
| Behavior composition + 7 behaviors                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | ✅ implemented + tested                                            |
| Collection engine (nav/selection/typeahead/visibility)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | ✅ implemented + tested                                            |
| Shortcuts (scopes/priorities/conflicts) + key combos                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | ✅ implemented + tested                                            |
| Virtualizer (Fenwick, dynamic sizes) + React binding                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | ✅ implemented + tested                                            |
| Query core (multi-sort/filter)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | ✅ implemented + tested                                            |
| Primitives: Button, Listbox, TreeView, DataGrid                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | ✅ implemented (+ RTL tests on Listbox)                            |
| Playground: `/engine` inspector, `/grid-next` 500k                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | ✅ implemented                                                     |
| i18n translator/collators                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | ✅ minimal core                                                    |
| Overlay engine: pure positioning core (flip/shift, Node-tested) + React `Overlay` (portal, layer stack with outside-press cascade, focus trap/restore, anchored tracking, blocking shortcut scopes)                                                                                                                                                                                                                                                                                                                                                                         | ✅ implemented                                                     |
| Searchable + Actionable behaviors                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | ✅ implemented + tested                                            |
| Menu, ComboBox, CommandPalette, Dialog primitives                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | ✅ implemented (+ RTL tests on Menu/ComboBox), demo at `/overlays` |
| Async data: `DataSource` contract, `arraySource`, loader machine (seq-based race elimination, cancellation effects, cursor pagination), `useDataSource`, DataGrid server mode + infinite scroll                                                                                                                                                                                                                                                                                                                                                                             | ✅ implemented + tested, demo at `/data-loader`                    |
| Tooltip (warm-delay policy) + Popover (Dismissable machine) on the Overlay engine                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | ✅ implemented, demo at `/overlays`                                |
| Grid inline editing (F2/Enter/type-to-edit/double-click, journaled draft, Enter ↓ / Tab → commits, modal-while-editing machine) + clipboard (Ctrl+C TSV copy effect, TSV block paste fan-out)                                                                                                                                                                                                                                                                                                                                                                               | ✅ implemented + tested, demo at `/grid-next`                      |
| Grid column model: pure `GridColumnsState` (order/widths/pinnedLeft) + resize/move/pin intents, `effectiveColumnOrder`, drag-resize handles, drag & drop header reorder, sticky pinned columns                                                                                                                                                                                                                                                                                                                                                                              | ✅ implemented + tested, demo at `/grid-next`                      |
| Row grouping: pure `buildGroups`/`flattenGroups` (multi-level, path keys, culture-ordered, per-group sum/avg/min/max/count), collapsed-keys in the grid machine, group headers with per-column aggregates, Enter/click toggle, group rows excluded from selection/editing                                                                                                                                                                                                                                                                                                   | ✅ implemented + tested, demo at `/grid-next`                      |
| Drag & drop: pure drag machine (`drag/start → over → drop/cancel`, keyboard target moves with zone/index clamping, SR announcements as effects, drop emits a `move` event — data stays controlled) + KanbanBoard (pointer hit-testing, ghost, full keyboard DnD)                                                                                                                                                                                                                                                                                                            | ✅ implemented + tested, demo at `/kanban`                         |
| **Renderer adapter #2 — canvas** (`src/framework/canvas`): the same grid machine, Fenwick virtualizer, sort core and `GRID_KEYMAP` drive an immediate-mode canvas painter with zero React imports, enforced by an architecture purity test (`core/purity.test.ts`)                                                                                                                                                                                                                                                                                                          | ✅ implemented, demo at `/canvas-grid` (1M rows)                   |
| Form controls wave 1: `Validatable` behavior (dirty/touched/error, assertive SR announcements as effects) + `NumericValue` behavior (clamp/snap/float-safe stepping, spinbutton vs slider keymap profiles) + locale-aware `formatNumber`/`parseNumber` (Intl round-trip) + `orientation`/`defaultSelectedKeys`/`toggleOnSelect` on the collection config — primitives Checkbox (mixed), Switch, Toggle (aria-pressed), ToggleGroup, RadioGroup (follow-focus radiogroup), TextField, NumberField, Slider, Form/Field (submit validates the registry, focuses first invalid) | ✅ implemented + tested (Node machines), demo at `/controls`       |

The structural roadmap is complete. Remaining work is breadth, not
architecture: full i18n message bundles + RTL keymap flipping, remaining
playgrounds (benchmarks with live render metrics), and migrating the gen-1
routes to the next-gen primitives.

## 6. Key decisions & trade-offs

- **aria-activedescendant over roving tabindex** — one DOM focus target, works
  with virtualization and 100k items; cost: per-item ids and careful SR
  testing. Roving remains possible per-primitive (it's an adapter detail).
- **Slice-per-behavior state with pipeline fan-out** — no global type magic,
  cross-behavior reads are explicit (`read`/`readInitial`), order is the only
  coupling and is owned by the primitive. Rejected: event-bus between
  behaviors (hidden control flow), single shared blob (write conflicts).
- **Output events as effects** — keeps machines 100% pure and replayable;
  devtools show `event/emit` like any other consequence of a transition.
- **Config via live getters** — machines are built once; props are read
  through refs at dispatch time. No machine rebuilds, no stale closures.
- **`bun run test` (vitest), not `bun test`** — Bun's native runner also
  ingests `experimentations/` and lacks the jsdom setup; the script is the
  contract. `experimentations/` is lint-ignored as a sandbox.

## 7. Extension cookbook

- **New behavior**: `defineBehavior` with namespaced intents
  (`"drag/start"`), pure handlers, optional keymap/aria → unit-test by
  dispatching intents at a composed machine. No React involved.
- **New component**: pick behaviors, `composeMachine`, write a shell that
  (1) renders state, (2) forwards DOM events as intents, (3) registers
  elements in an `ItemRegistry`, (4) interprets effects via `useForgeEffects`
  (overridable per effect type — that's how the grid reroutes `ScrollToItem`
  into the virtualizer).
- **New adapter (Vue/Solid/canvas)**: reimplement `src/framework/react`'s
  five small modules; the core — which is the actual product — moves unchanged.
