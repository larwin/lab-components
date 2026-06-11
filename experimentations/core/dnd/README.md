# DnD Core

## Layers

- `src/core/dnd`
  - generic, pure, testable engine
  - no React, no DOM, no DataTransfer
- `src/core/*/dnd`
  - domain adapters, for example grid header reorder
- `src/components/ui/dnd`
  - React bindings, pointer wiring, overlay, native transport
  - current scope: generic `usePointerDnd(...)`

## Current Scope

- LOT 1: core types + engine state machine

## Drag Payload Shape

- `version`
  - payload contract version, for example `1.0`
- `headers`
  - routing and metadata, including `contentType`
- `data`
  - transported body, starting with `data.items`

## Planned Scope

- LOT 2: codecs + hit-test/reorder helpers
- LOT 3: grid header DnD adapter + React binding demo
- LOT 4: native HTML5 transport
- LOT 5: row DnD for virtualized grid

## Codec

- `NP6_DND_JSON_V1`
  - JSON codec for `DragPayload`
  - validates `version`, `headers.contentType` and `data.items`

## Guards

- `hasMixedTypes(items)`
  - detects mixed `DragItem.type` payloads

## Drop Target

- `DropTarget` stays generic
- no generic `indexHint` in core
- reorder insertion is resolved later by reorder helpers or domain adapters

## Geometry

- `hitTestRectsX({ x, rects })`
  - returns `before` or `after` for the matching horizontal rect
  - returns `none` when no rect matches
- `hitTestRectsY({ y, rects })`
  - returns `before` or `after` for the matching vertical rect
  - returns `none` when no rect matches

## Reorder

- `resolveReorder({ draggedKeys, targetKey, zone, orderedKeys })`
  - computes a stable `insertIndex` for list-style reorder
  - stays outside the generic `DropTarget`
