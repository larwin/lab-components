---
name: forge-service
description: >
  Créer ou modifier un service métier, un store vivant, une façade ou le câblage
  d'injection de dépendances Forge en suivant la méthode RFC-002 (modèle interne
  → DTO/mapper → repository → store → service scoped → façade → token → conteneur
  → adaptateur → démo → verify). À utiliser dès qu'on ajoute de la logique métier
  découplée de l'UI dans src/framework/services, src/examples/** ou la couche
  applicative d'une feature.
---

# /forge-service — construire la couche métier sur le conteneur Forge

Tu agis comme l'architecte de la couche services. Le moteur d'injection
(`src/framework/services`) est déjà implémenté et prouvé (13 tests conteneur,
exemple Campaign à 11 tests, garde de pureté). Cette recette dit comment ajouter
de la logique métier SANS retoucher les décisions prises. La référence complète
est [docs/RFC-002-SERVICES-DI-ARCHITECTURE.md](../../docs/RFC-002-SERVICES-DI-ARCHITECTURE.md) ;
l'exemple canonique vivant est `src/examples/campaign/**`.

## Les règles non négociables (RFC-002 §2)

1. **`src/framework/services` n'importe rien.** Pas de React, pas de DOM — gardé
   par `src/framework/core/purity.test.ts`. Les services et stores métier sont
   du TypeScript pur, testés en `// @vitest-environment node`.
2. **Trois lifetimes, pas plus.** `transient` (calcul pur), `singleton` (stores
   - façades + valeurs), `scoped` (services invalidables). On ne crée pas de
     quatrième nom.
3. **Tokens à rôle.** Un token se crée avec le constructeur de son rôle :
   `storeToken` / `serviceToken` / `facadeToken` / `valueToken`. Le type guide
   tout le reste — `defineStore` n'accepte qu'un store token, `useFacade` qu'une
   façade. On ne peut pas brancher le mauvais type.
4. **`inject` est la SEULE source des dépendances.** Un service déclare ses
   dépendances dans `inject` et les reçoit par ce même map. La factory ne reçoit
   que ça — impossible d'utiliser une dépendance non déclarée, impossible de
   désynchroniser le graphe déclaré du graphe réel. Jamais de décorateur, jamais
   de second tableau `dependsOn`.
5. **Un composant ne dépend que de façades (`useFacade`) et de stores
   (`useStoreValue`).** Jamais d'un service `scoped` (il peut être invalidé entre
   deux rendus) — il n'existe d'ailleurs aucun hook qui résout un service token.
   Jamais d'un DTO, jamais d'un repository.
6. **Le store ne porte que de l'état + index.** Pas de validation, pas d'appel
   API, pas de logique métier. Les index (`Map` par id) vivent DANS le snapshot,
   construits dans le reducer, pour que les sélecteurs restent O(1) et stables.
7. **Le DTO ne sort jamais du repository.** Il est parsé (zod) et mappé vers le
   modèle interne dans le repository. Les formulaires ne voient que le modèle.
8. **Cache serveur = react-query, pas un service.** Les services portent la
   logique métier ; le cache HTTP (dédup/retry/staleTime) appartient à
   react-query ou à la loader machine du core.

## La carte

```
src/framework/services/        LE MÉCANISME — pur, testé en Node
  container/token.ts           valueToken/storeToken/serviceToken/facadeToken
  container/container.ts       createContainer + define* + validate + invalidate
src/framework/react/services/  L'ADAPTATEUR React (fin)
  ServicesProvider.tsx         <ServicesProvider>, useContainer, useFacade
  useStoreValue.ts             useSyncExternalStore + sélecteur
src/examples/campaign/         L'EXEMPLE CANONIQUE (à copier/imiter)
  model · dto · mappers · api · repositories · stores · services · facades
  · tokens · container · *.test.ts
src/routes/services-demo.tsx   La démo (nav: groupe « Next-Gen Engine »)
docs/RFC-002-...md             La référence + les décisions
```

## Le pipeline, dans l'ordre

### 1. Modèle interne + DTO + mapper

- Modèle interne (`model.ts`) : la forme UI/métier, ids nominaux
  (`type CategoryId = string & { __brand }`), vrais types (Date, enums), pas de
  string nu.
- DTO (`dto.ts`) : schémas zod du contrat réseau (snake_case). `z.infer` donne
  les types.
- Mapper (`mappers.ts`) : fonctions pures DTO → modèle ET modèle → DTO, testées
  en round-trip. Le renommage de champ (`label` → `name`) vit ici et seulement
  ici.

### 2. Repository (la frontière)

- `create<X>Repository(api)` : appelle l'API, `Schema.parse(raw)`, puis mappe.
  Le DTO ne franchit jamais cette fonction. Implémentation interchangeable
  (réel/fake/serveur).

### 3. Store vivant (si état partagé observable)

- `createStore(createMachine({...}))` du core. Une intention `set` qui remplace
  - réindexe. Le snapshot contient `byId`/`active`/… précalculés. Voir
    `stores.ts`.

### 4. Service scoped (la logique)

- `create<X>Service(deps...)` : capture les snapshots de ses stores à la
  CONSTRUCTION, fait le travail coûteux (compilation de validateurs, projections)
  UNE fois, retourne une API pure. Pas de React. Voir `services.ts`.
- Un service peut injecter un autre service (composition) — l'invalidation est
  transitive.

### 5. Façade stable

- `create<X>Facade(resolve: Resolver)` : la SEULE chose qui reçoit le resolver.
  Elle résout le service courant À CHAQUE APPEL (`const svc = () => resolve.get(Token)`),
  ne le capture jamais. Elle orchestre repo + store + service. Voir `facades.ts`.

### 6. Tokens + conteneur (le graphe comme donnée)

- `tokens.ts` : un token à rôle par dépendance.
- `container.ts` : `buildXContainer(api)` enregistre tout via les `define*`, dans
  l'ordre valeurs → repos → stores → services (avec `inject`) → façades, puis
  **`c.validate()`** (échec immédiat si dépendance manquante ou cycle, avec le
  chemin), puis matérialise les stores (`c.get(StoreToken)`) pour activer leurs
  abonnements d'invalidation.

### 7. Adaptateur React + démo

- Route : `buildXContainer()` une fois (`useState(() => …)`), `dispose()` au
  démontage, `<ServicesProvider container={…}>`. Les composants utilisent
  `useFacade(FacadeToken)` (agir) et `useStoreValue(StoreToken, s => s.slice)`
  (réagir). UI faite UNIQUEMENT de primitives `@/framework/primitives`.

### 8. Tests Node + verify

- `mappers.test.ts` (round-trip), `<feature>.test.ts` (invalidation prouvée :
  « rebuild une seule fois », « un store non lié ne reconstruit rien »,
  « validation contre les règles vivantes », « save mappe vers le DTO »).
- `/forge-verify` : format, `bun run test`, lint, build, purity.

## Squelettes

```ts
// Service scoped
export function createContactService(fieldStore: Store<FieldState>): ContactService {
  const fields = fieldStore.getState().all; // snapshot capturé à la construction
  const validators = compileValidators(fields); // coûteux, UNE fois
  return { validateCustomValues: (v) => run(validators, v) };
}

// Façade : résout par appel, ne capture jamais le service
export function createContactFacade(resolve: Resolver): ContactFacade {
  const service = () => resolve.get(ContactServiceToken);
  return { validate: (m) => service().validateCustomValues(m) };
}

// Conteneur : le graphe est une donnée lisible
c.provide(defineStore(FieldStoreToken, { create: () => createFieldStore() }));
c.provide(
  defineService(ContactServiceToken, {
    inject: { fields: FieldStoreToken }, // ← LA déclaration de dépendance
    create: ({ fields }) => createContactService(fields),
  }),
);
c.provide(defineFacade(ContactFacadeToken, { create: (r) => createContactFacade(r) }));
c.validate(); // cycle/dépendance manquante → throw ici
```

## Pièges connus du repo

- `bun test` (runner Bun natif) ramasse `experimentations/` → **toujours
  `bun run test`** (vitest). Lancer un test isolé avec `--reporter=verbose` (le
  reporter par défaut tronqué a déjà fait croire à un faux échec de collection).
- `bun run format` reformate `experimentations/` → `git restore experimentations/`
  avant tout commit.
- Nouvelle route ⇒ `bun run build` régénère `routeTree.gen.ts` avant le typecheck.
- Ne jamais réécrire un fichier UTF-8 via PowerShell (`Set-Content`) — corruption
  d'encodage. Utiliser Write/Edit.
- Un fichier provider+hooks (ServicesProvider.tsx) déclenche le warning
  `react-refresh/only-export-components` — c'est attendu et toléré (même cas que
  `shortcuts.tsx`), ce sont des warnings, pas des erreurs.

## Definition of done

- [ ] Logique dans `services`/`stores`, zéro logique métier dans le composant.
- [ ] `inject` = seule déclaration de dépendance ; `c.validate()` appelé au build.
- [ ] Le composant ne touche ni DTO, ni repository, ni service scoped (façades +
      stores uniquement).
- [ ] Tests Node verts : mappers round-trip + invalidation (rebuild une fois,
      précision chirurgicale).
- [ ] `bun run test` / `lint` / `build` verts (purity.test.ts compris).
- [ ] Démo branchée sur des primitives du projet uniquement + nav à jour.

## LEARNINGS (enrichi au fil des sessions — voir /forge-learn)

- 2026-06-13 · Le `Store` du core EST le store vivant : `getState`/`subscribe` +
  égalité référentielle (`next !== prev`) suffisent à `useSyncExternalStore`.
  Pas de champ `version` — il n'ajoute rien à la comparaison de référence. Les
  index (`byId`, `active`) vont DANS le snapshot (construits au reduce) pour que
  les sélecteurs de `useStoreValue` restent stables et ne bouclent pas.
- 2026-06-13 · Foolproof par les types : tokens à rôle (`storeToken`/`serviceToken`
  /`facadeToken`/`valueToken`) + `inject` map comme seule source de dépendance
  (la factory ne reçoit que ses injectés) + pas de `useService` pour les
  composants. On rend l'erreur impossible à la compilation plutôt que par
  convention.
- 2026-06-13 · Invalidation sans récursion : `validate()` précalcule
  `reverseScopedReach` (token → ensemble des services scoped dont la clôture de
  dépendances le contient) sur un DAG validé ; `invalidate()` itère cet ensemble
  UNE fois et droppe les caches — pas de récursion, chaque token visité au plus
  une fois, le rebuild est paresseux au prochain `resolve`. Le store vivant
  (singleton) n'est jamais dans un reach scoped, donc jamais droppé sur son
  propre changement.
- 2026-06-13 · Cycles attrapés tôt : `validate()` fait un DFS sur le graphe
  `inject` et jette avec le chemin (`A → B → A`) ; un second garde dans `get()`
  attrape la ré-entrée dynamique. Appeler `validate()` dans `buildXContainer` ⇒
  un cycle ne peut pas être livré.
- 2026-06-13 · La façade tient le `Resolver`, jamais le service. C'est le seul
  rôle à recevoir le resolver (`defineFacade`). Tous les autres factories ne
  reçoivent que leurs injectés ⇒ ils ne peuvent pas capturer une instance
  périmée. Le bug qui tuerait tout : une façade qui mémorise `resolve.get(Svc)`
  en haut au lieu de `() => resolve.get(Svc)`.
- 2026-06-13 · Service → service : faire dépendre CampaignService de
  ContactService (et non re-câbler FieldStore deux fois) prouve l'invalidation
  transitive — changer les fields reconstruit les deux, recharger les templates
  ne reconstruit que Campaign. Préférer la composition de services à la
  duplication d'injection de stores.
- 2026-06-13 · Démontrer l'invalidation à l'écran : un compteur de builds
  (telemetry injectée en valueToken, incrémentée dans la factory du service),
  lu APRÈS chaque action dans un handler (jamais pendant le render — sinon effet
  de bord de render). Résoudre les services dans les handlers, lire les stores
  pour l'affichage via `useStoreValue`.
- 2026-06-13 · Étendre la garde de pureté à toute nouvelle couche pure
  (`offenders("src/framework/services")` dans purity.test.ts) — la portabilité
  se prouve par CI, pas par discipline.
- 2026-06-13 · Règle UI (Nicolas) : n'utiliser QUE des composants existants —
  jamais de markup brut quand une primitive existe. Une liste de données = la
  primitive `Listbox` (`selectionMode="none"` + slot `renderItem` pour
  name + Badge), pas un `<ul><li>`. Avant d'écrire du JSX, vérifier le barrel
  `src/framework/primitives/index.ts` ; si la primitive manque, la créer via
  `/forge-feature` d'abord. Voir CLAUDE.md « Component usage (hard rule) ».
