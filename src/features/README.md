# src/applications

**Role:** UI features — screens that compose `domains` + `framework/primitives`,
own their screen-local state (UI stores, forms), and orchestrate logic that spans
several domains.
**Layer / generation:** next-gen UI feature (RFC-003).
**Status:** active.

## What lives here

- `campaign-editor/` — the worked example feature:
  - `stores/campaignEditor.store.ts` — a **UI store**: a pure core `Store`, created
    and disposed by the component, **not registered in the container**.
  - `services/` — `campaignEditor.service.ts` (cross-domain orchestration: validate a
    campaign against categories + templates + fields) + `.facade.ts` + `tokens.ts`.
  - `forms/campaignForm.ts` — UI-local form model + schema.
  - `components/CampaignEditorScreen.tsx` — the composition root: mounts
    `ServicesProvider` against the current Account node; built from primitives.
  - `hooks/useCampaignEditorStore.ts` — the React binding (`useSyncExternalStore`)
    for the UI store.
  - `index.ts` (`registerCampaignEditorApp`) · `__tests__/`.

## Conventions / rules

- An application imports `framework`, domain **barrels + tokens**, and its own
  internals — **never another application**.
- **UI stores stay out of the container** (component-owned lifecycle); they _read_
  domain stores via `useStoreValue` and _act_ via facades. Dependency direction is
  always UI → container.
- Cross-domain validation/orchestration lives **here**, never as a cross-domain
  store edge.

## Used by / depends on

- **Inbound:** `app` (registers the app), the `/services-demo` route (mounts the screen).
- **Outbound:** `framework/primitives` + `react`, `framework/services`,
  `domains/{categories,templates,fields,campaigns}`, `platform/telemetry`.

## See also

- [docs/RFC-003-INDUSTRIAL-DOMAIN-ARCHITECTURE.md](../../docs/RFC-003-INDUSTRIAL-DOMAIN-ARCHITECTURE.md) — §6 UI stores out of the container.
- [../domains/README.md](../domains/README.md) — the business contexts this composes.
