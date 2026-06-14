# RFC-003 v2 — Industrial architecture: composite scopes, domains/applications & a three-primitive dependency model

Status: **implemented (v2, 2026-06-14)** — supersedes the v1 draft of this file. Product of a design review against RFC-002 and the NP6 `Sharding` DI library. Foundation shipped: composite scopes + `require`/`dependency`/`inject` in `src/framework/services`, example migrated to `src/domains/*` + `src/applications/campaign-editor`, boundaries guarded by `purity.test.ts`, demo at `/services-demo` (470 tests green).
Prerequisites: [RFC-001](RFC-001-NEXT-GEN-ARCHITECTURE.md) (pure core), [RFC-002](RFC-002-SERVICES-DI-ARCHITECTURE.md) (DI container + services).
Scope: **where code lives**, **who owns/mounts a store**, **how the dependency graph is declared**, and **how data stays fresh** — without breaking RFC-002's guarantees (purity, role-branded tokens, recursion-free invalidation, DTO≠model).

---

## 0. What changed from v1 (and why)

v1 proposed a flat container + per-screen child scopes and a binary "domain store vs UI store". The review (informed by the NP6 `Sharding` C# library) changed five things:

1. **Flat container → composite scope tree.** Borrowed from `Sharding`'s `Platform → Agency → Customer`. Browser levels: **App → [Agency] → Account**. Each node owns its cache and builds per-node instances. This is the proper answer to v1's "fix `createScope`" hand-wave.
2. **Domain stores live at the leaf (Account), not the root.** Most business data is per-tenant. Mount level is an explicit, per-registration property (like `Sharding`'s `[Scope]`).
3. **UI stores leave the container entirely.** They are created/destroyed by the component (framework-owned lifecycle). This deletes the cross-scope-invalidation problem v1 spent a whole section on.
4. **The repository class collapses into a provider function** for the read path; writes stay as façade commands.
5. **One `inject` becomes three primitives** — `require` / `dependency` / `inject` — separating construction from invalidation, after deciding the extra expressiveness is worth losing RFC-002's "graph can't lie" guarantee.

---

## 1. Two tiers, one product (the fork that frames everything)

The NP6 `Sharding` library and the Forge container solve the same problem at **different tiers**, and must not be merged:

|              | **`Sharding` (server / BFF)**                                         | **Forge (browser)**                                              |
| ------------ | --------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Concurrency  | many tenants live at once (wide tree)                                 | one active account (narrow, re-addressable tree)                 |
| Store model  | memoized async fetcher (pull + TTL)                                   | sync observable snapshot (push), for `useSyncExternalStore`      |
| Invalidation | static `[Dependency]` graph + route events, async queue, `FlushAsync` | synchronous, before re-render (no tearing)                       |
| Activation   | reflection (`Activator`, attributes) — free in C#                     | factory functions + plain-data manifests (no `reflect-metadata`) |
| Declaration  | attributes/decorators                                                 | co-located manifest fields (decorators OK on a Node backend)     |

**The concepts cross-pollinate; the implementations stay tier-appropriate.** They meet at the **provider / HTTP boundary**: the browser's provider function calls the server (which may itself be a `Sharding` app). This RFC is the **browser tier**. Where it borrows a `Sharding` idea, it re-expresses it as plain data, never reflection.

---

## 2. The composite scope tree

A scope is a **node** in a tree (the composite pattern: trunk → branches → leaves):

```
App        (trunk)   — singletons shared by everything: reference data, current user, theme, config
  └─ [Agency]  (branch, LATENT) — shared by a group of accounts (distributed-marketing clients)
        └─ Account (leaf)  — one client account: the bulk of business data
```

- A node **owns its instance cache** and **builds its registrations lazily, per node**.
- Resolution **walks up** the tree: an Account asks for a service; if not mounted at Account, the lookup climbs to Agency, then App. (Exactly `Sharding`'s parent fallthrough.)
- **Today we configure App + Account.** Agency is modelled but absent (a pass-through). When a client goes "agency mode", agency becomes a real middle node — **no refactor**, just registrations at a new level. Hard-coding "2 levels" would cost that refactor later; the mechanism is N-level, the configuration is 2.

### 2.1 Isolation is structural, not by destruction

Each Account node holds **its own** store instances. Switching account = **re-addressing a different leaf** (`accounts["24"]`), not destroying and rebuilding `accounts["23"]`. Account 23's data lives in node 23 and is **never reachable** from node 24's screens — isolation is a property of the tree, not of a teardown step. The browser **may** dispose inactive leaves to save memory, but that is a **policy choice**, not a correctness requirement.

### 2.2 The "current account" shortcut

The full path stays addressable (`agencies["A"].accounts["23"].store(CategoryStoreToken)`) for cross-account, admin, and debug. For everyday code, the **active leaf node** is exposed ambiently:

- **React:** `<ServicesProvider node={currentAccountNode}>`; `useStoreValue(CategoryStoreToken, …)` resolves against the current node — the full path is never typed. **The provider is the shortcut.**
- **Lit:** the same node via `@lit/context`.
- **Framework-free:** façades receive the current node and call `node.get(Token)`.

### 2.3 Two orthogonal axes, named to never collide again

Every registration sets **two independent things**. v1 blurred them under the word "root"; never again:

- **Mount level** (this section): _where the instance lives_ — App / [Agency] / Account.
- **Cascade behaviour** (§3): _how it reacts when something changes_ — droppable? emitter?

`CategoryStore` = { mount **Account**, **non-droppable**, **emitter** }. `CampaignService` = { mount **Account**, **droppable**, emitter-if-depended-on }. Same level, opposite cascade behaviour — because the two axes are set independently.

---

## 3. The dependency model — `require` / `dependency` / `inject`

The single biggest change from RFC-002. RFC-002's `inject` did construction **and** invalidation in one declaration (safe, but inexpressive). v2 splits them into **two graphs** and offers a sugar for the common case.

### 3.1 The three primitives

| Primitive                              | Factory **receives** the value? | In **build order** (+ cycle check)? | **Falls** when target changes / dies? | Use for                                                       |
| -------------------------------------- | ------------------------------- | ----------------------------------- | ------------------------------------- | ------------------------------------------------------------- |
| **`require(X)`**                       | yes                             | yes                                 | **no**                                | a **snapshot service**: built from X at time _t_, then frozen |
| **`dependency(X)`**                    | no                              | no                                  | yes                                   | a **pure listener**: react to a store you don't build from    |
| **`inject(X)`** = require + dependency | yes                             | yes                                 | yes                                   | **the common case**: built from X _and_ stays fresh with X    |

`inject(X)` is exact sugar for `require(X) + dependency(X)` on the same target. The primitives compose freely: `require(A) + dependency(B)` means "build from A, fall when B changes, don't build from B."

### 3.2 `dependency` semantics are dispatched by the target's role

Because tokens are role-branded (RFC-002 D3), the **target's role decides** what "falls when target changes/dies" means — with no ambiguity and no conflict possible:

- **target is a Store** → the store is **non-droppable + emitter**; `dependency` means _"I am notified its data changed, and I fall"_ (the store survives). This is `Sharding`'s proposed `[Listener]`, and Forge already implements it as `store.subscribe`. Only a `Store` can be a `dependency`-emitter — exactly the constraint the NP6 design wants.
- **target is a Service / destructible** → `dependency` means _"I fall when it is destroyed/rebuilt"_ (destruction propagation — `Sharding`'s existing `[Dependency]`).

A store is never destroyed; a service never emits. The partition is clean.

### 3.3 The keyword choice **is** the safety net

Splitting the graphs loses RFC-002's "declared graph = real graph" guarantee — you can now _forget_ to stay fresh. The three keywords neutralise this without a separate marker:

- `inject` is documented as **"the word you want 95% of the time"** → a developer reaching for "I need X" gets freshness **by default**.
- Pinning is the **deliberately less obvious** `require` → a `require(Store)` without `inject` **reads in review as an intentional snapshot**, not an oversight.
- A forgotten freshness becomes "you wrote `require` where you meant `inject`" — a **one-token, visible** difference.

So `require`-only is the explicit, reviewable marker; no `pinned` attribute needed. (A test — "after a store change this derived service recomputes" — backs it up for services that must stay fresh.)

### 3.4 Cycle handling, per graph

- **Construction graph** (`require` + the require-part of `inject`): cycles are **fatal**, rejected eagerly at build with the path (RFC-002's `validate()`, unchanged). A → B → A is unbuildable.
- **Invalidation graph** (`dependency` + the dependency-part of `inject`): cycles are **not** rejected — "they fall together" is fine, absorbed by the precomputed walk-once reverse-reach set (recursion-free, RFC-002 §3). No explosion.

### 3.5 Manifest shape (browser) and decorators (backend)

Browser — plain-data, co-located with the factory, tree-shakeable, no `reflect-metadata`:

```ts
defineService(CampaignEditorServiceToken, {
  level: "account",
  inject: { categories: CategoryStoreToken, contact: ContactServiceToken }, // build + stay fresh
  require: { config: AppConfigToken }, // build from, but DON'T fall when config changes (snapshot)
  dependency: [SelectionStoreToken], // fall when this store changes; NOT passed to create
  create: ({ categories, contact, config }) =>
    createCampaignEditorService(categories, contact, config),
});
```

Backend (Node `Sharding` or a port) — the same semantics as **standard TC39 decorators** carrying explicit tokens (no `reflect-metadata`, no `experimentalDecorators`):

```ts
@Scope("account")
@Inject(CategoryStoreToken)
@Require(AppConfigToken)
@Dependency(SelectionStoreToken)
class CampaignEditorService {
  /* … */
}
```

> Decorators are acceptable on a backend (bundle size irrelevant, ergonomics scale). They are **not** used in the browser: even standard decorators self-register by import side-effect, which fights tree-shaking and graph visibility — the manifest form keeps the graph as inspectable data.

---

## 4. Layers & folder tree

Three layers, strictly one-directional: `applications → domains → framework`. All under `src/`; `@/framework` stays the single stability boundary.

```
src/
  framework/                         # PURE TECH — RFC-001 + RFC-002 (+ composite-tree upgrade, §8)
    core/                            # engine (no React, no DOM) — Store, machine, loader machine
    services/                        # DI container: nodes, require/dependency/inject, validate
    react/services/                  # ServicesProvider(node), useFacade, useStoreValue
    primitives/  components/  themes/

  platform/                          # cross-cutting infra as value tokens (no business)
    http/  telemetry/  i18n/  index.ts   # registerPlatform(appNode, config)

  domains/                           # BUSINESS — pure TS, Node-tested
    categories/
      model.ts                       # Category, CategoryId (branded)
      dto.ts                         # zod wire schemas
      mappers.ts                     # DTO <-> model, round-trip tested
      category.provider.ts           # (composite) => Promise<Category[]>  : fetch + parse + map  (replaces the repo class)
      category.store.ts              # CategoryStore — sync observable, mounted at ACCOUNT
      category.service.ts            # domain logic (optional)
      category.facade.ts             # CategoryFacade — stable API + read triggers + write commands
      tokens.ts                      # role-branded tokens (+ mount level intent)
      register.ts                    # registerCategoriesDomain(appNode, accountNode)
      index.ts                       # PUBLIC BARREL: tokens + interfaces + register ONLY
      __tests__/
    templates/ fields/ permissions/ campaigns/   # same shape

  applications/                      # UI FEATURES — screens
    campaign-editor/
      stores/campaignEditor.store.ts # UI STORE — pure core Store (portable), OUT of the container
      services/campaignEditor.service.ts  # app orchestration across domains (scoped, in the account node)
      forms/campaignForm.ts          # form model + schema (UI-local)
      components/CampaignEditorScreen.tsx  # composition root: current node + ServicesProvider
      hooks/useCampaignEditorStore.ts # React binding for the UI store (useSyncExternalStore)
      tokens.ts  index.ts  __tests__/

  app/                               # GLOBAL composition root
    tree.ts                          # buildScopeTree(config): App node (+ Account node on login)
    AppProviders.tsx                 # <ServicesProvider node={currentAccountNode}> + theme
  routes/                            # TanStack routes -> mount an application screen
```

**File-naming rule:** a `*.store.ts` under `domains/` is a domain store (entity noun, mounted Account/App); a `*.store.ts` under `applications/*/stores/` is a UI store (screen noun, **not** in the container). Location encodes the difference.

---

## 5. Stores, providers & freshness (framework-free)

### 5.1 Read path: the repository class becomes a provider function

A repository whose only job was "fetch → parse → map → hand to store" was ceremony. Replace it with a **provider function**:

```ts
// domains/categories/category.provider.ts
export const categoryProvider = (node: ScopeNode) => async (): Promise<Category[]> => {
  const raw = await node.get(ApiClientToken).get(`/accounts/${node.id}/categories`);
  return z.array(CategoryDtoSchema).parse(raw).map(toCategory); // DTO boundary stays INSIDE here
};
```

- The **DTO never escapes** the provider (RFC-002's boundary, preserved).
- The **store does not fetch.** It stays a **synchronous** observable so `useSyncExternalStore` works without `await` in render. The provider is driven by the **loader machine / façade**, which dispatches the result into the sync store.
- Default to a provider function; escalate to a small **data-source class** only when the I/O is rich (multi-endpoint, pagination, optimistic writes).

### 5.2 Write path stays on the façade

A store is read state. Commands (`upsert`, `create`, `delete` = model→DTO→POST) are **façade methods** calling the api client via the mapper. They do not live in a store or a provider.

### 5.3 "Who refreshes, without React"

The decision _"this is stale, refetch"_ is **framework-free**; only the **lifecycle trigger** (mount/unmount) is framework-specific.

```
core Store (sync snapshot)            ← state for the UI binding
core Loader machine (pure async)      ← fetch + loading/error/staleness (NOT react-query — portable)
Façade (framework-free)               ← orchestrates: provider -> loader -> dispatch into store
Triggers: mount (adapter) · user action · server push SSE/WS (framework-free listener) · timer
```

- The **loader machine** (RFC-001 core) gives dedup/retry/staleness **without** react-query, so it works under Lit too. react-query stays an optional convenience, **off** the portable critical path.
- A **server push (SSE/WebSocket)** handled by a framework-free listener that calls `facade.reload()` is the browser equivalent of `Sharding`'s route invalidation — the optional real-time path.

### 5.4 Forge cascade ≠ `Sharding` cascade

Worth stating so nobody conflates them: in Forge a store change drops **derived services** so they **recompute** from the current snapshot (the store is never dropped, never refetched by the cascade). In `Sharding`, invalidation drops a memoized cache so it **refetches**. Recomputation vs refetch — different by design, both correct for their tier.

---

## 6. UI stores — out of the container

A UI store's create/dispose is owned by the **component lifecycle**, which is framework-specific. So UI stores **do not** go in the container.

- **Logic is portable:** a UI store is a pure `createStore(createMachine(...))` from the core — TypeScript, Node-testable, identical across frameworks.
- **Only the binding differs:** React = created per component (`useRef`) + `useSyncExternalStore`; Lit = a `ReactiveController`. The RFC-001 "pure machine + thin shell" pattern, applied to screen state.
- **Instance-per-mount for free:** two open editors → two UI stores, isolated, each disposed on its own unmount. No container scope needed for this.
- It **reads** account stores via `useStoreValue` and **acts** via façades. Dependency direction is always UI → container, never the reverse.

This is the clean structural form of v1's "domain vs UI store": _in the container at a mount level_ vs _out of the container, owned by the component_.

---

## 7. Architecture rules (the contract)

1. `framework/**` imports only `framework`. `domains/**` imports `framework` + other domains' **public barrels** only. `applications/<a>/**` imports `framework`, domain barrels, its own internals — never another application.
2. A domain depends on another domain via its **facade + tokens**, never its store, provider, or internal files.
3. **Domains form a DAG.** Cross-domain orchestration (e.g. validate a campaign against categories + templates + fields) lives in the **application** layer, never as a hidden cross-domain store edge.
4. **Mount level is explicit** per registration. Default business data → **Account**. Only genuinely global reference → **App**. Agency is reserved.
5. **`inject` is the default**; `require` (snapshot) and `dependency` (pure listener) are the explicit, reviewable specials.
6. **Stores are sync and never fetch.** Fetch lives in a provider, driven by the loader/façade. DTOs never leave the provider.
7. **UI stores are never registered in the container.**
8. **The container imports no React** (purity guard extended to the new files).

---

## 8. Container upgrade (small, localized)

RFC-002's `createScope()` was test-only. The composite tree needs two well-scoped changes to `framework/services`:

1. **Per-node cache with owner-resolution.** A node owns the cache for what it **registers**; resolving a token registered at an **ancestor** delegates build + cache + subscription to that **owner** node (so an App singleton is built once at App, never duplicated by an Account node resolving it). This is `Sharding`'s `Composite` behaviour.
2. **Two declaration graphs.** Build the construction graph from `require` + `inject`; the invalidation graph from `dependency` + `inject`; compute reverse-reach over the **invalidation** graph; dispatch `dependency` semantics by the target token's role (store ⇒ notify-on-change, service ⇒ drop-on-destroy).

Today we instantiate **two** levels (App at boot, Account on login/switch). Agency is a latent level the resolver already walks through. New tests: "App singleton is never duplicated by an Account resolve", "an Account service with `inject(store)` rebuilds on store change", "an Account service with `require(store)` does **not** rebuild (snapshot)", "switching account re-addresses a fresh leaf with isolated state".

This is a half-day-ish PR and is **step 1** of the migration — nothing else lands correctly before it.

---

## 9. Naming conventions

| Thing                             | Pattern                                                               | Example                                               |
| --------------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------- |
| Branded id / model / DTO / mapper | `<E>Id` / `<E>` / `<E>Dto` / `to<E>`                                  | `CategoryId`, `Category`, `CategoryDto`, `toCategory` |
| Provider (read)                   | `<entity>Provider`, file `<entity>.provider.ts`                       | `categoryProvider`                                    |
| Domain store                      | `<Entity>Store`, under `domains/`, mounted Account/App                | `CategoryStore`                                       |
| UI store                          | `<Screen>Store`, under `applications/*/stores/`, **out of container** | `CampaignEditorStore`                                 |
| Service                           | `<Entity>Service` (domain) / `<Screen>Service` (app)                  | `CategoryService`, `CampaignEditorService`            |
| Facade                            | `<X>Facade`                                                           | `CategoryFacade`                                      |
| Token                             | `<X>Token` (role-branded)                                             | `CategoryStoreToken`                                  |
| Register fn / app composition     | `register<Domain>Domain` / `create<Screen>Screen`                     | `registerCategoriesDomain`                            |

`Ui` is **not** stuffed into names — screen nouns (`Editor`, `Page`, `Search`) + location carry it. Exception: an editable view-copy of one entity → `CategoryEditViewStore`, never `CategoryStore`.

---

## 10. Avoiding circular dependencies

1. **Lint boundaries** (`import/no-cycle`, `no-restricted-imports`): the layer rules of §7, enforced in CI.
2. **Public barrels**: a domain `index.ts` exports tokens + interfaces + register only — internals are physically unreachable across domains.
3. **`validate()`**: construction cycles rejected eagerly with the path (run on each node build).
4. **Design rule**: domains are a DAG; mutual need ⇒ lift to the application layer.

An **architecture test** (extending `core/purity.test.ts`) asserts the import boundaries hold — layering proven by CI, not discipline.

---

## 11. Testing

Node, no DOM (RFC-001 convention), co-located in `__tests__/`:

- **Mappers**: DTO→model→DTO round-trips.
- **Providers**: fetch+parse+map against a fake api client; assert DTOs never escape.
- **Domain service / app service**: fake stores passed as args, no container; assert `inject` rebuilds and `require` does **not** (the snapshot guarantee).
- **Container**: per-node cache, owner-resolution, no singleton duplication, reverse-reach over the invalidation graph, account-switch isolation.
- **Screen**: a per-test Account node off `buildScopeTree(fakeConfig)` + jsdom; the component sees only facades and stores.
- **Architecture**: import-boundary offenders scan.

---

## 12. Migration strategy (incremental, example keeps working)

1. **Container upgrade (§8) first.** Composite nodes + owner-resolution + the two declaration graphs + `require`/`dependency`/`inject`. _Exit:_ the four new container tests green.
2. **Carve domains.** `src/examples/campaign` → `domains/{categories,templates,fields,campaigns}`; repo classes → provider functions; add barrels + `register`. _Exit:_ domain tests green, purity guard extended.
3. **Carve the application.** `campaign-editor`: UI store (out of container), cross-domain orchestration as `CampaignEditorService`, the screen as composition root. _Exit:_ two mounted editors don't share state.
4. **Mount levels + account switch.** Move business stores to the Account node; prove isolation + switch. _Exit:_ account-switch test green.
5. **Lint boundaries + architecture test.** _Exit:_ a deliberate cross-layer import fails CI.
6. **platform/ + app/.** ApiClient/telemetry as platform value tokens; `buildScopeTree`; `<AppProviders>`. _Exit:_ tree validates; demo route is a thin mount.
7. **Skill update (§13) + a second domain end-to-end** to prove the recipe generalises.
8. **Retire `src/examples/`** once `domains/` + `applications/` are the living reference.

---

## 13. Skill update spec (`/forge-service`)

To apply **after** steps 1–2 (the skill must describe a structure that exists). Edits:

- **New decision gate up front:** domain data (owned, shared, mounted at a level) → domain store + container; screen state (local, instance-scoped) → UI store **out** of the container; ephemeral → `useState`/`react-hook-form`.
- **Replace the "carte"** with the three-layer map (§4) + per-role naming (§9).
- **New dependency section:** `require` / `dependency` / `inject`, the by-role `dependency` dispatch, "`inject` is the default", the keyword-as-safety-net rule (§3).
- **Read = provider function, write = façade command** (§5); store stays sync, never fetches.
- **Mount level + composite node** (§2), current-account shortcut.
- **UI store out of the container** (§6): portable core Store + framework binding.
- **Boundary rules + architecture test** (§7, §10) into "Definition of done".
- Keep every RFC-002 non-negotiable (role tokens, three lifetimes, facade-holds-resolver, DTO≠model, Node tests).

(Not yet applied — follows your validation + migration step 1.)

---

## 14. Advantages / inconvenients / risks

**Advantages** — scales to many domains (a domain = a folder + one `register`); unambiguous ownership; correct lifetimes via mount level; per-tenant isolation is structural (security); snapshot services are first-class; portability preserved (providers + loader machine, no react-query lock-in); boundaries CI-enforced.

**Inconvenients** — more ceremony per domain (barrel + register + tokens; mitigated by a scaffold); the container upgrade is real, unavoidable work first; the domain-vs-application call needs judgement; `inject`/`require`/`dependency` is a richer model to learn than one `inject`.

**Risks** —

1. **Over-storing screens** → keep ephemeral state in `useState` (§ gate).
2. **Forgotten freshness** (`require` where `inject` was meant) → the keyword-as-marker + a "recomputes on change" test (§3.3).
3. **Cross-domain coupling creep** → barrels + DAG + lint.
4. **Account-switch leak** if a stale node is reused → isolation test (§8).
5. **Container upgrade regressing invalidation** → keep the precomputed recursion-free model; the four new tests gate it.
6. **A second state model creeping in** (zustand/nanostores) → rejected, RFC-002 §11 stands.

---

## 15. Where the final design diverges from the original sketch

A record of the honest disagreements, several now resolved through the review:

1. **UI stores are not container singletons** (original sketch implied they were just another store). They are component-owned, out of the container — else two editors collide. **Resolved: out.**
2. **Three store tiers, not two** (domain / UI / ephemeral); don't promote every field to a store.
3. **`framework/domains/applications` are layers under `src/`, not 11 top-level role folders, not a parallel repo root.** One stability boundary.
4. **`campaigns` (domain) ≠ `campaign-editor` (application).** Cross-entity validation is application orchestration.
5. **Construction does not imply invalidation.** `require` alone never causes a fall — your correction; it makes snapshot services first-class. The original RFC-002 coupling was the inexpressive default.
6. **The repository class is mostly ceremony** for reads → provider function; writes stay on the façade.
7. **Decorators**: viable as standard TC39 (no `reflect-metadata`) **on a backend**; in the browser, manifest fields beat them (tree-shaking, graph visibility). Inversify rejected.
8. **Don't try to make one DI serve both tiers.** `Sharding` (server) and Forge (browser) share concepts, not code.

---

## 16. Open questions

1. The `platform/` seam vs treating HTTP/telemetry as App-level value tokens directly in `app/tree.ts` — separate folder or fold in?
2. Agency level: model it now as a latent pass-through (this RFC), or omit entirely until the first agency-mode client?
3. Should the loader machine own staleness/TTL, or is "refetch on explicit trigger only" enough for v1 of the migration?
