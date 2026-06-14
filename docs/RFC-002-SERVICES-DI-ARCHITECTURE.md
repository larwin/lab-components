# RFC-002 — Business services & dependency injection, decoupled from the UI

> **Updated by [RFC-003](RFC-003-INDUSTRIAL-DOMAIN-ARCHITECTURE.md) (2026-06-14).** The
> mechanism and decisions below still hold, but the packaging evolved and this
> document keeps its original names/paths as a point-in-time record:
>
> - The worked example **moved** from `src/examples/campaign` (deleted) to
>   `src/domains/business/campaign/{categories,templates,campaigns}` +
>   `src/domains/business/data-management/fields` + `src/features/campaign-editor`.
> - Renames: `ContactService` → `FieldService`, `CampaignService` →
>   `CampaignEditorService`, `buildCampaignContainer` → `buildWebApplication`
>   (now exported from root `src/WebApplication.ts`), the
>   repository classes → **provider functions**.
> - The flat container is now a **composite scope tree** (App → [Agency] → Account),
>   and the `inject`-as-sole-dependency rule (§2 D4) is **extended** by three
>   primitives `require` / `dependency` / `inject` (RFC-003 §3).
>
> Read RFC-003 for the current structure; read on here for the original rationale.

Status: **implemented (foundation)** — `src/framework/services`, `src/framework/react/services`, worked example in `src/examples/campaign`, demo at `/services-demo`.
Prerequisite: [RFC-001](RFC-001-NEXT-GEN-ARCHITECTURE.md) (the pure-core engine this layer reuses).
Tests: `src/framework/services/**/*.test.ts` and `src/examples/campaign/**/*.test.ts` run in **plain Node** — no DOM, no React. A purity guard (`core/purity.test.ts`) asserts `src/framework/services` never imports React.

---

## 1. Executive summary

Forge already proved one bet (RFC-001): _a component is a pure machine plus a thin
shell._ This RFC extends the same bet to the **business layer**:

> A feature is a set of **pure services and live stores**, wired by a tiny
> container, behind **stable facades**. React (or Lit, or anything) is an adapter.

The mechanism is small and has no magic:

- **Tokens are role-branded** (`storeToken`, `serviceToken`, `facadeToken`,
  `valueToken`). The role steers every wiring decision and every hook, so a
  developer cannot connect the wrong kind of thing — the compiler refuses it.
- **Dependencies are declared with one `inject` map, which is also how the
  factory receives them.** There is no second list to keep in sync; you cannot
  use a dependency you did not declare. The declared graph and the real graph
  can never drift apart.
- **Invalidation is reactive, precomputed and recursion-free.** A live store
  changes → the services that (transitively) depend on it are dropped and lazily
  rebuilt, exactly once. The cascade walks a precomputed set and visits each
  token at most once, so a runaway loop is impossible by construction. Cycles
  are rejected eagerly by `validate()` with the offending path printed.

Everything that is hard — keeping services framework-free, not recomputing
expensive work, never serving a stale instance, never leaking a backend DTO into
a form — is handled by the layer, proven by Node tests, and demonstrated live at
`/services-demo`.

---

## 2. The decisions (what I locked, and how)

This section is the contract. Each decision is a rule a developer can rely on.

### D1 — No DI library. A ~250-line hand-rolled container.

Rejected: inversify / tsyringe / typedi. They are class + decorator +
`reflect-metadata` heavy, add bundle weight, fight a codebase that is 100%
factory functions, and hide the dependency graph in runtime metadata. The
hand-rolled container ([container.ts](../src/framework/services/container/container.ts))
is plain data, tree-shakeable (`"sideEffects": false`), and inspectable.

### D2 — Three lifetimes, no more.

`transient` (fresh per resolve), `singleton` (one instance — stores and
facades), `scoped` (memoised, invalidated when a declared dependency changes —
services). The five lifetimes I first sketched collapsed: `live` and
`stale-refresh` are just a `singleton` store; `facade/stable` is a _role_, not a
lifetime. Fewer names, no overlap.

### D3 — Role-branded tokens make wiring foolproof.

A token is created with the constructor that matches its role:

```ts
const FieldStoreToken = storeToken<FieldState>("FieldStore");
const ContactServiceToken = serviceToken<ContactService>("ContactService");
const CampaignFacadeToken = facadeToken<CampaignFacade>("CampaignFacade");
const ApiClientToken = valueToken<ApiClient>("ApiClient");
```

From there the type system steers you: `defineStore` only accepts a store token,
`useFacade` only accepts a facade token, `useStoreValue` only accepts a store
token. You cannot pass a service where a facade is expected. The role is visible
at the declaration site — the dependency directives are, as required, _clearly
identifiable_.

### D4 — `inject` is the single source of dependency truth.

A service declares its dependencies and receives them through the **same** map.
The factory gets only what it injected — it has no other handle, so it cannot
reach an undeclared dependency:

```ts
defineService(ContactServiceToken, {
  inject: { fields: FieldStoreToken, telemetry: TelemetryToken },
  create: ({ fields, telemetry }) => createContactService(fields, telemetry),
});
```

The container builds the dependency graph from `inject`. There is no `@DependsOn`
decorator and no separate `dependsOn` array that could fall out of sync. This is
the property that makes it impossible to get the graph wrong.

### D5 — Decorators are rejected.

`@Injectable @Lifetime @DependsOn` need `experimentalDecorators` +
`reflect-metadata`, force classes, and bury the graph in metadata. The `define*`
helpers read better, keep the graph as data, and pair each role with its only
sensible lifetime so a developer never picks a lifetime by hand.

### D6 — `version` on stores is dropped.

A live store is the core `Store<S>` ([runtime/store.ts](../src/framework/core/runtime/store.ts)),
which only notifies when `next !== prev`. `useSyncExternalStore` needs a
referentially stable snapshot, which immutable state already gives. A
`version: number` adds nothing over reference equality (both O(1)). Selectors
return stable slices; indexes (`Map` by id) live _inside_ the snapshot, built in
the reducer, so they are stable too.

### D7 — Components depend only on facades and stores.

`useFacade(token)` to act, `useStoreValue(token, selector)` to react. There is
**no `useService`** by design: a component must never hold a `scoped` service,
because it can be invalidated between renders. Because service tokens have no
hook that accepts them, this is a compile-time guarantee, not a guideline.

### D8 — Server cache is react-query's job, not the services'.

Services own business logic; `@tanstack/react-query` (already wired in
[router.tsx](../src/router.tsx)) owns the server cache — dedup, retry, staleTime.
If services start caching HTTP responses, you have rebuilt react-query, worse.
In the example the repositories are deliberately thin (parse + map); a real app
would back them with react-query or the core loader machine.

---

## 3. Recursion & cycle safety (the explicit requirement)

Two kinds of runaway recursion were called out; both are handled.

**Construction cycles** (A injects B injects A): rejected _eagerly_ by
`container.validate()`, which does a DFS over the `inject` graph and throws with
the exact path — `Dependency cycle detected: A → B → A`. `buildCampaignContainer`
calls `validate()` at startup, so a cycle can never ship. A second, defensive
guard in `get()` throws if resolution re-enters a token already on the stack.

**Invalidation-cascade cycles**: the cascade never recurses. `validate()`
precomputes, for every reactive token, the **set** of scoped tokens whose
dependency closure contains it (`reverseScopedReach`). When a store changes,
`invalidate()` iterates that precomputed set once and drops each cached instance
— O(affected), each token visited at most once. Dropping a cache cannot trigger
another drop (rebuild is lazy, on the next `resolve`), so there is no feedback
loop. The live store itself is a `singleton` and is never in a scoped reach set,
so it is never dropped on its own change.

There is also no stale-read window: the container subscribes to each store at
build time (before any React subscription), so when a dispatch fires, the cache
is dropped synchronously, before React's scheduled re-render reads anything.

This is proven in [container.test.ts](../src/framework/services/container/container.test.ts):
cycle detection, "rebuild exactly once", transitive cascade, surgical precision
(an unrelated store never rebuilds a service), and "the live store is never
dropped".

---

## 4. The layered model

```
┌───────────────────────────────────────────────────────────────────────┐
│ UI-LOCAL          a form being edited → react-hook-form / useState.    │
│                   NOT injected, dies with the screen.                  │
├───────────────────────────────────────────────────────────────────────┤
│ FACADE (singleton) stable API for features: validate/save/load/reload. │
│                   Never invalidated. Holds the resolver, re-resolves   │
│                   the current service on every call.                   │
├───────────────────────────────────────────────────────────────────────┤
│ SERVICE (scoped)  business logic. Memoised; rebuilt once when a        │
│                   declared dependency changes. No React.               │
├───────────────────────────────────────────────────────────────────────┤
│ LIVE STORE        observable state + indexes. getState/subscribe.      │
│ (singleton)       No heavy business logic.                             │
├───────────────────────────────────────────────────────────────────────┤
│ REPOSITORY        the boundary: call API, zod-parse, map to a model.   │
│                   Swappable (real / fake / server).                    │
├───────────────────────────────────────────────────────────────────────┤
│ MAPPER            pure DTO ↔ model functions. Tested both directions.  │
├───────────────────────────────────────────────────────────────────────┤
│ DTO               wire contract. Validated at the boundary, NEVER      │
│                   handled by a form.                                   │
└───────────────────────────────────────────────────────────────────────┘
         INTERNAL MODEL: the UI/business shape, per feature.
```

**The rule:** a component depends on **facades** (to act) and **stores** (to
react). Never a service, never a DTO, never a repository.

**When to use what** (the antidote to over-engineering): server data with
cache/retry → react-query, not a service. Shared reactive state without logic →
a store alone. Pure compute with one implementation → a plain function, do not
even register it. Expensive logic derived from a live store → a `scoped` service
behind a facade. That last case is the only one where DI earns its keep.

---

## 5. The container API (implemented)

`src/framework/services` — pure, no React. Two files plus a barrel.

```ts
// Lifetimes & the resolver handed only to facades.
export type Lifetime = "transient" | "singleton" | "scoped";
export interface Resolver {
  get<T>(token: AnyToken<T>): T;
}

export interface Container extends Resolver {
  provide<T>(provider: Provider<T>): void;
  invalidate(token: AnyToken<unknown>): void; // drop a token + its scoped dependents
  validate(): void; // eager: missing deps + cycles, throws with the path
  createScope(): Container; // child cache, inherits/overrides registrations (tests)
  dispose(): void;
}
```

The `define*` helpers each pair a role with its only sensible lifetime:

| Helper            | Lifetime    | Factory receives | Use for                         |
| ----------------- | ----------- | ---------------- | ------------------------------- |
| `defineValue`     | singleton   | —                | ApiClient, config, repositories |
| `defineSingleton` | singleton   | injected deps    | a singleton built from deps     |
| `defineStore`     | singleton\* | injected deps    | live stores (\*reactive root)   |
| `defineService`   | scoped      | injected deps    | business services               |
| `defineFacade`    | singleton   | the `Resolver`   | stable facades                  |
| `defineTransient` | transient   | injected deps    | pure stateless compute          |

Only `defineFacade` receives the resolver — it is the one role allowed to hold a
handle, precisely because its job is to re-resolve. Every other factory gets only
its injected dependencies and therefore cannot capture a stale instance.

---

## 6. The worked example (`src/examples/campaign`)

A realistic Campaign/Contact domain — 3 stores, 2 services, 2 facades, mocked
varying data, demoed at `/services-demo`.

```
src/examples/campaign/
  model.ts          nominal ids + internal models + form model
  dto.ts            zod schemas + DTO types (snake_case wire shapes)
  mappers.ts        pure DTO ↔ model, both directions
  api.ts            mock ApiClient: latency + data that VARIES between calls
  repositories.ts   call API → zod-parse → map. DTOs never escape here.
  stores.ts         CategoryStore / TemplateStore / FieldStore (core Store + indexes)
  services.ts       ContactService (fields), CampaignService (cat+tpl+ContactService)
  facades.ts        ContactFacade, CampaignFacade
  tokens.ts         every dependency as a role-branded token
  container.ts      buildCampaignContainer() — the whole graph as data + validate()
  mappers.test.ts   round-trip proofs
  campaign.test.ts  invalidation proven through the real services
```

The dependency graph, visible as data in `container.ts`:

```
ApiClient (value)
  └─ Category/Template/Field/Campaign repositories (values)
CategoryStore, TemplateStore, FieldStore (live, reactive roots)
ContactService  ── inject ──▶ FieldStore
CampaignService ── inject ──▶ CategoryStore, TemplateStore, ContactService
CampaignFacade, ContactFacade ── resolve current service per call
```

Consequences, all unit-tested:

- **Reload categories / templates** → only `CampaignService` rebuilds
  (`ContactService` is untouched — it does not inject those stores).
- **Add a required field** → `FieldStore` changes → `ContactService` rebuilds,
  and `CampaignService` rebuilds too because it injects `ContactService`
  (transitive). Both exactly once.
- **Save** → the facade validates via the service, then the repository maps the
  form model to a DTO; the form never touches the DTO.

Core service interfaces:

```ts
export interface ContactService {
  requiredFieldKeys(): readonly string[];
  validateCustomValues(values: Readonly<Record<string, string>>): ValidationResult;
}
export interface CampaignService {
  templatesForCategory(categoryId: CategoryId | ""): readonly Template[];
  validate(model: CampaignFormModel): ValidationResult; // delegates custom fields to ContactService
}
export interface CampaignFacade {
  validate(model: CampaignFormModel): ValidationResult;
  save(model: CampaignFormModel): Promise<{ campaign: Campaign; dto: CampaignUpsertDto }>;
  reloadCategories(): Promise<void>;
  reloadTemplates(): Promise<void>;
  serviceBuilds(): { contact: number; campaign: number };
}
```

The DTO ≠ model boundary, made tangible on screen (`/services-demo` shows both
the internal form model and the produced snake_case DTO side by side):

```ts
const CampaignUpsertDtoSchema = z.object({
  label: z.string(), //               ← backend name for `name`
  category_id: z.string(), //         ← snake_case
  template_id: z.string().nullable(),
  custom_values: z.record(z.string()),
});
export const toCampaignUpsertDto = (m: CampaignFormModel): CampaignUpsertDto => ({
  label: m.name.trim(),
  category_id: m.categoryId,
  template_id: m.templateId,
  custom_values: m.customValues,
});
```

---

## 7. React adapter (`src/framework/react/services`)

Three small pieces over a context, mirroring `useMachine`'s
`useSyncExternalStore`:

```tsx
<ServicesProvider container={container}>…</ServicesProvider>;

const facade = useFacade(CampaignFacadeToken); // stable singleton, safe per render
const active = useStoreValue(CategoryStoreToken, (s) => s.active); // reactive slice
```

`useStoreValue` is `useSyncExternalStore(store.subscribe, () => selector(store.getState()))`.
The selector must return a referentially stable value when nothing changed
(select a slice, or read a precomputed index from the snapshot) — the one real
performance footgun of this layer, and a local, lintable one.

The composition root (the demo route) builds the container once, wraps the tree,
and disposes on unmount. Components below import facades and stores only.

---

## 8. Lit / Web Components adapter (when needed)

Reimplement one file — a `ReactiveController` instead of `useSyncExternalStore`:

```ts
export class StoreController<S, U> implements ReactiveController {
  value: U;
  constructor(
    host: ReactiveControllerHost,
    private store: Store<S>,
    private sel: (s: S) => U,
  ) {
    host.addController(this);
    this.value = sel(store.getState());
  }
  hostConnected() {
    this.unsub = this.store.subscribe(() => {
      this.value = this.sel(this.store.getState());
      this.host.requestUpdate();
    });
  }
  hostDisconnected() {
    this.unsub?.();
  }
}
```

The container (via `@lit/context` or a module singleton), the stores, services,
facades, mappers and repositories all move **unchanged**. This is RFC-001 §7
("a new adapter reimplements only the thin layer") applied to the business
layer.

---

## 9. Testing strategy

All of it runs in Node, no DOM (the convention from RFC-001).

- **A service alone** — pass fake stores as arguments, no container. (`campaign.test.ts`)
- **The container** — lifetimes, missing-dep & cycle rejection, transitive
  invalidation, surgical precision, "live store never dropped", scope override.
  (`container.test.ts`, 13 tests)
- **Invalidation** — the central guarantee: a build counter proves "rebuilt once
  per change" and "an unrelated store never rebuilds a service".
- **Mappers** — DTO → model → DTO round-trips. (`mappers.test.ts`)
- **A facade** — with a fake container (`createContainer` + a stubbed service).
- **A React form** — `createScope()` / `buildContainer(fakeApi)` + jsdom; the
  component sees only facades and stores.

`createContainer().createScope()` and `buildCampaignContainer(fakeApi)` give test
isolation for free: each test builds its own graph and swaps in fakes by
re-registering tokens.

---

## 10. Performance strategy

| Concern                   | Answer (in the implementation)                                                                                                                 |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Thousands of categories   | Index `Map` built in the reducer, lives in the snapshot → O(1) lookups.                                                                        |
| Expensive projections     | Built in the `scoped` factory → once per dependency version, not per call.                                                                     |
| Compiled validators       | Same: compiled at service construction, reused until invalidation.                                                                             |
| Fine-grained invalidation | Reverse-reach is per reactive root; an unrelated store rebuilds nothing.                                                                       |
| No needless recompute     | Reference equality (`next !== prev`) → no notify, no rebuild.                                                                                  |
| Subscription leaks        | `subscribe` returns an unsubscribe; the container subscribes once/store and `dispose()` cleans up; React/Lit adapters unsubscribe on teardown. |
| Service lifetime          | `scoped` instances are GC'd on invalidation; singletons live with the scope.                                                                   |

The one watch-item: a `useStoreValue` selector that allocates a new object each
call forces re-renders. Select stable slices or precompute the projection in the
snapshot.

---

## 11. Library verdict

**Recommended** (all present except the container): the hand-rolled container,
the core `Store`, `@tanstack/react-query` (server cache), `zod` (DTO validation +
mappers), `react-hook-form` (UI-local form state), and the core loader machine
for headless async.

**Rejected**: inversify / tsyringe / typedi (classes + decorators +
reflect-metadata, against the grain); RxJS (overkill — we need subscribe/snapshot,
not an operator language); nanostores / zustand / jotai (redundant with the core
`Store`, and a second state model fragments the architecture).

---

## 12. Migration plan (incremental, no big bang)

1. **PoC, read-only.** One live store + one component via `useStoreValue`. _Exit:_
   store change updates the UI without prop drilling, tested.
2. **Container.** tokens + `createContainer` + `defineValue`/`defineSingleton`,
   `ServicesProvider`. _Exit:_ `container.test.ts` green (resolve, cycle, scope).
3. **Live stores.** core `Store` + indexes. _Exit:_ "notifies only on change".
4. **Scoped services + invalidation.** `inject` graph + `validate()`. _Exit:_
   "rebuild exactly once" green.
5. **Facades.** re-resolve per call. _Exit:_ "facade never holds a stale service".
6. **React adapters.** `useFacade` + `useStoreValue`. _Exit:_ a form wired end to
   end on fakes.
7. **Test strategy frozen.** `buildContainer(fakeApi)`, fixtures, mapper
   round-trips.
8. **Generalize.** second feature, then a cookbook (the `/forge-service` skill).

This RFC has already done steps 1–7 for the Campaign example.

---

## 13. Risks

1. **Over-registration.** Putting everything in the container "because we can".
   Mitigation: a plain function suffices when there is one implementation and no
   live dependency.
2. **Unstable `useStoreValue` selectors** → re-renders. Mitigation: review +
   snapshot indexes.
3. **Invalidation cascade too broad.** A god-store everything depends on.
   Mitigation: fine stores, minimal `inject`, the "surgical precision" test.
4. **Blurred service / react-query boundary.** Mitigation: the D8 rule.
5. **A facade capturing a service.** The bug that kills the design. Mitigation:
   facades hold only the resolver; the "no stale service" test guards it.
6. **A second state model creeping in.** Mitigation: the library verdict (§11).

---

## 14. Success criteria

- [x] A service is tested in Node with no React/DOM mocks.
- [x] Changing `FieldStore` updates the UI **and** invalidates the dependent
      services, proven by a test, rebuilding exactly once.
- [x] A component references no DTO, repository, or scoped service directly
      (enforced by token roles — there is no hook that resolves a service token).
- [x] `src/framework/services` imports no React (purity guard).
- [x] Swapping a repository for a fake is one re-registration, zero component
      changes (`buildCampaignContainer(fakeApi)`).
- [x] The dependency graph is readable in `container.ts` without running code.
- [x] No new state/DI library beyond the hand-rolled container.

---

## 15. Verification (this RFC's claims, checked)

- `bun run test` → **459 passed** (51 files), including 13 container tests, 11
  example tests, and the purity guard extended to `src/framework/services`.
- `bun run lint` → 0 errors (only the repo-wide `react-refresh` warnings shared
  by every provider+hooks file).
- `bun run build` → succeeds; the demo route bundles as `services-demo-*.js`.
- Demo: `/services-demo` — reload buttons mutate live stores via a mocked
  backend; the build counters show services rebuilding exactly once, with
  surgical precision; the saved panel shows the internal model and the wire DTO
  side by side.
