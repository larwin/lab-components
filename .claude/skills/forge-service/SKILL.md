---
name: forge-service
description: >
  Créer ou modifier de la logique métier découplée de l'UI dans Forge : un
  domaine (modèle/DTO/mapper/provider/store/service/façade), une application
  (UI store, orchestration cross-domaine, écran), ou le câblage d'injection
  (arbre de scopes composite, primitives require/dependency/inject). Suit
  RFC-002 (conteneur DI) + RFC-003 (structure industrielle : domains /
  applications, niveaux de montage, stores UI hors conteneur). À utiliser dès
  qu'on touche src/domains/**, src/applications/**, src/platform/** ou
  src/framework/services/**.
---

# /forge-service — construire la couche métier (domaines & applications)

Tu agis comme l'architecte de la couche métier. Le moteur d'injection
(`src/framework/services`) est implémenté et prouvé (conteneur + nœuds composite

- 3 primitives, garde de pureté, test d'architecture). Cette recette dit où
  mettre quoi et comment câbler, SANS rouvrir les décisions. Références :
  [docs/RFC-002](../../docs/RFC-002-SERVICES-DI-ARCHITECTURE.md) (mécanisme) et
  [docs/RFC-003](../../docs/RFC-003-INDUSTRIAL-DOMAIN-ARCHITECTURE.md) (structure).
  L'exemple canonique vivant : `src/domains/**` + `src/applications/campaign-editor/**`,
  démo `/services-demo`.

## Porte de décision (à franchir AVANT de coder)

1. **Donnée de domaine** — possédée, partagée, vit longtemps ? → un **domaine**
   sous `src/domains/<domaine>`, store + façade enregistrés dans le conteneur,
   monté au **niveau compte** (ou App si référentiel vraiment global).
2. **État d'écran** — local à une feature, meurt à la fermeture de l'écran ? →
   un **UI store** sous `src/applications/<app>/stores`, **HORS conteneur**,
   créé/détruit par le composant.
3. **Éphémère** — saisie en cours, hover, ligne dépliée ? → `useState` /
   `react-hook-form`. **Pas de store.**

Ne promeus en store que l'état partagé/observable. Sur-storer un écran est le
pendant UI du « sur-enregistrement ».

## Les règles non négociables

**De RFC-002 (mécanisme) :**

1. `src/framework/services` + `src/domains` n'importent **pas** React (gardé par
   `core/purity.test.ts`). TypeScript pur, testé en `// @vitest-environment node`.
2. **Trois lifetimes** : `transient` / `singleton` (stores, façades, valeurs) /
   `scoped` (services invalidables). Pas de 4ᵉ nom.
3. **Tokens à rôle** (`storeToken`/`serviceToken`/`facadeToken`/`valueToken`) :
   le type guide le câblage, on ne peut pas brancher le mauvais rôle.
4. **Un composant ne touche que façades (`useFacade`) + stores (`useStoreValue`).**
   Jamais un service scoped, un DTO, un repository/provider.
5. **Le DTO ne sort jamais du provider/repository** : parsé (zod) + mappé vers le
   modèle interne là, et seulement là.
6. **La façade tient le `Resolver`, jamais le service** : `() => resolve.get(Svc)`,
   ré-résolu à chaque appel.

**De RFC-003 (structure) :**

7. **Couches à sens unique** : `applications → domains → framework`. Un domaine
   dépend d'un autre domaine via son **barrel public** (`@/domains/<autre>`),
   jamais un fichier interne. Les domaines forment un **DAG** ; l'orchestration
   cross-domaine vit dans `applications/`, pas dans un domaine.
8. **Le store appartient au domaine qui possède la donnée**, monté à un **niveau**
   (compte par défaut). Lecture = **fonction provider** (`(api) => () => parse+map`)
   pilotée par la façade ; écriture = **commande de façade**. Le store reste
   **synchrone**, ne fetch jamais.
9. **UI store hors conteneur** : logique = `Store` du core (portable), binding par
   framework (`useSyncExternalStore` / controller Lit), créé par le composant.

## Les 3 primitives de dépendance (RFC-003 §3)

`inject` est **le défaut** (95 % des cas). `require`/`dependency` sont les cas
explicites — le choix du mot-clé EST le filet de sécurité.

| Primitive       | Factory reçoit ? | Ordre de build + cycle ? | Tombe au changement/mort de la cible ?                   | Pour                                                   |
| --------------- | ---------------- | ------------------------ | -------------------------------------------------------- | ------------------------------------------------------ |
| `inject(X)`     | oui              | oui                      | oui                                                      | **le cas courant** : construit depuis X ET reste frais |
| `require(X)`    | oui              | oui                      | **non**                                                  | service **snapshot** (figé à t)                        |
| `dependency(X)` | non              | non                      | oui (store : au changement ; service : à la destruction) | **écouteur pur** (réagit à un store non injecté)       |

`dependency` est dispatché par le rôle de la cible : un **store** est notifié-au-
changement (survit), un **service** tombe-à-la-destruction.

## La carte

```
src/framework/services/        LE MÉCANISME — pur (conteneur, nœuds, primitives)
src/framework/react/services/  ADAPTATEUR React (ServicesProvider, useFacade, useStoreValue)
src/platform/                  Infra transverse (ApiClient, Telemetry) en value tokens
src/domains/<domaine>/         UN DOMAINE — pur, testé Node
  model.ts dto.ts mappers.ts
  <e>.provider.ts              fetch + zod-parse + map (remplace la classe repository)
  <e>.store.ts                 store sync + index dans le snapshot (monté compte)
  <e>.service.ts               logique scoped (optionnel)
  <e>.facade.ts                API stable : reload (provider→dispatch) + commandes d'écriture
  tokens.ts                    tokens à rôle
  index.ts                     BARREL PUBLIC : tokens + types + register<Domaine>Domain
  __tests__/                   mappers round-trip, service (fake stores)
src/applications/<app>/        UNE FEATURE UI
  stores/<app>.store.ts        UI STORE (core Store, hors conteneur)
  hooks/use<App>Store.ts       binding React (useSyncExternalStore)
  services/<app>.service.ts    orchestration cross-domaine (scoped) + .facade.ts + tokens.ts
  forms/<app>Form.ts           modèle de formulaire (UI-local)
  components/<App>Screen.tsx   racine de composition : buildTree + ServicesProvider(compte)
  index.ts                     barrel + register<App>App
src/app/                       COMPOSITION : buildXTree() (App→Account), mockApi
src/routes/...                 monte l'écran de l'application
```

## Le pipeline, dans l'ordre

1. **Modèle + DTO + mapper** (par domaine) — ids nominaux, zod pour le DTO,
   mapper pur testé round-trip. Le renommage de champ vit dans le mapper.
2. **Provider de lecture** — `(api) => async () => Schema.parse(raw).map(toModel)`.
   Le DTO ne franchit jamais cette fonction.
3. **Store** (si état partagé) — `createStore(createMachine(...))`, index
   précalculés dans le snapshot. Ne fetch pas.
4. **Service scoped** (si logique coûteuse) — capture le snapshot à la
   construction, fait le travail une fois. Peut injecter un autre service.
5. **Façade stable** — résout par appel ; orchestre provider→store (reload) et
   commandes d'écriture (model→DTO→post).
6. **Tokens + barrel + register** — `register<Domaine>Domain(account)` enregistre
   store + service + façade.
7. **Application** (si écran) — UI store hors conteneur + hook de binding +
   service d'orchestration cross-domaine + façade + `register<App>App(account)` +
   écran composition-root.
8. **Composition** — `buildXTree()` : nœud App (ApiClient) → `createScope()` nœud
   Account (Telemetry + domaines + app), `account.validate()`, matérialiser les
   stores. Disposer l'arbre au démontage.
9. **Tests Node + verify** — mappers round-trip, invalidation (rebuild une fois,
   précision chirurgicale, `require` ne rebuild pas), puis `/forge-verify`.

## Squelettes

```ts
// Provider de lecture (remplace le repository)
export const categoryProvider = (api: ApiClient) => async (): Promise<readonly Category[]> => {
  const raw = await api.get("/categories");
  return z.array(CategoryDtoSchema).parse(raw).map(toCategory);
};

// Façade : reload (provider→dispatch), jamais de DTO au-dessus
export function createCategoryFacade(resolve: Resolver): CategoryFacade {
  const store = () => resolve.get(CategoryStoreToken);
  const load = categoryProvider(resolve.get(ApiClientToken));
  return {
    async reload() {
      store().dispatch(categoryIntents.set({ items: await load() }));
    },
  };
}

// Register d'un domaine (monté au niveau compte)
export function registerCategoriesDomain(account: Container): void {
  account.provide(defineStore(CategoryStoreToken, { create: () => createCategoryStore() }));
  account.provide(defineFacade(CategoryFacadeToken, { create: (r) => createCategoryFacade(r) }));
}

// Service applicatif : inject = le défaut (construit + reste frais)
account.provide(
  defineService(CampaignEditorServiceToken, {
    inject: {
      categories: CategoryStoreToken,
      templates: TemplateStoreToken,
      field: FieldServiceToken,
    },
    create: ({ categories, templates, field }) =>
      createCampaignEditorService(categories, templates, field),
  }),
);

// Composition : arbre App → Account
export function buildCampaignTree(api = createMockApi()) {
  const app = createContainer();
  app.provide(defineValue(ApiClientToken, api));
  const account = app.createScope();
  account.provide(defineValue(TelemetryToken, createTelemetry()));
  registerCategoriesDomain(account);
  /* …autres domaines… */ registerCampaignEditorApp(account);
  account.validate(); // cycle/dépendance manquante → throw ici
  account.get(CategoryStoreToken); // matérialise → abonnement d'invalidation actif
  return { app, account };
}

// UI store hors conteneur : créé par le composant
export function useCampaignEditorStore() {
  const ref = useRef<ReturnType<typeof createCampaignEditorStore> | null>(null);
  if (ref.current === null) ref.current = createCampaignEditorStore();
  const store = ref.current;
  const draft = useSyncExternalStore(store.subscribe, store.getState, store.getState);
  /* …actions via store.dispatch(editorIntents.*)… */
}
```

## Pièges connus du repo

- **`bun test` (runner Bun natif) ramasse `experimentations/` → toujours
  `bun run test`** (vitest). Et pour un fichier isolé : **`bun run test <chemin>`**,
  PAS `bun vitest run <chemin>` directement (le setup jsdom global casse la
  collection d'un fichier `// @vitest-environment node` lancé hors du script).
- `bun run format` reformate `experimentations/` → **`git restore experimentations/`**
  avant tout commit.
- Nouvelle route ⇒ `bun run build` régénère `routeTree.gen.ts`. Le build (vite)
  **ne typecheck pas** : pour vérifier les types, lancer **`bunx tsc --noEmit`**.
- Ne jamais réécrire un fichier UTF-8 via PowerShell (`Set-Content`) — corruption.
  Utiliser Write/Edit.
- Provider+hooks (ServicesProvider.tsx, un écran de composition) → warning
  `react-refresh/only-export-components` attendu et toléré (warnings, pas erreurs).
- Token phantom **covariant** (`__type?: T`) : c'est le `role` qui empêche le
  mauvais câblage, pas `T`. Ne pas revenir à `(value: T) => T` (rendait les tokens
  invariants → `StoreToken` non assignable à `AnyToken`).

## Definition of done

- [ ] Bonne porte franchie : domaine / UI store / éphémère.
- [ ] Logique dans domains/applications, zéro logique métier dans le composant.
- [ ] `inject`/`require`/`dependency` corrects ; `validate()` appelé au build.
- [ ] Le composant ne touche ni DTO, ni provider, ni service scoped (façades +
      stores). Stores synchrones, fetch dans un provider piloté par la façade.
- [ ] UI store hors conteneur, porté par le composant.
- [ ] Frontières respectées (barrels entre domaines) — test d'architecture vert.
- [ ] Tests Node verts : mappers round-trip + invalidation (rebuild une fois,
      précision chirurgicale, `require` ne rebuild pas).
- [ ] `bun run test` / `lint` / `build` / `bunx tsc --noEmit` verts (purity +
      architecture compris). `git restore experimentations/` fait.
- [ ] Démo branchée sur des primitives `@/framework/primitives` uniquement.

## LEARNINGS (enrichi au fil des sessions — voir /forge-learn)

- 2026-06-13 · Le `Store` du core EST le store vivant : `getState`/`subscribe` +
  égalité référentielle suffisent à `useSyncExternalStore`. Index dans le snapshot.
- 2026-06-13 · Foolproof par les types : tokens à rôle + `inject` + pas de
  `useService`. Erreur impossible à la compilation plutôt que par convention.
- 2026-06-13 · Invalidation sans récursion : `reverseScopedReach` précalculé,
  itéré une fois ; le store (singleton) n'est jamais droppé sur son propre changement.
- 2026-06-13 · La façade tient le `Resolver`, jamais le service.
- 2026-06-14 · RFC-003 : **arbre de scopes composite** (App → [Agence] → Account).
  Un nœud possède son cache ; un singleton parent est résolu chez son propriétaire
  (jamais dupliqué) ; l'invalidation d'un store **descend** vers les services des
  scopes enfants. Données métier montées au **niveau compte** ; switch de compte =
  ré-adresser une autre feuille (isolation structurelle).
- 2026-06-14 · RFC-003 : **`require`/`dependency`/`inject`** séparent construction
  et invalidation. `inject` = défaut. `require` = snapshot (ne tombe pas).
  `dependency` = écouteur pur (non injecté). Le mot-clé est le filet.
- 2026-06-14 · RFC-003 : **repository → fonction provider** (read), écriture =
  commande de façade ; le store reste sync, fetch piloté par la façade.
- 2026-06-14 · RFC-003 : **UI store hors conteneur**, créé par le composant
  (instance par montage) ; logique core portable + binding par framework.
- 2026-06-14 · Token phantom rendu **covariant** (`__type?: T`) → couche DI
  tsc-clean. Lancer `bunx tsc --noEmit` (le build vite ne typecheck pas).
- 2026-06-14 · Fichier isolé : `bun run test <chemin>` (pas `bun vitest run`,
  qui casse sur le setup jsdom global pour un fichier node-env).
