---
name: forge-review
description: >
  Relire un diff ou des fichiers du moteur Forge contre les principes du
  RFC-001 (pureté du core, intents/effets, composition, a11y, virtualisation,
  testabilité). À utiliser pour relire un chantier, une PR, ou du code écrit
  par un autre contributeur sur src/framework/**.
---

# /forge-review — relecture contre le RFC-001

Relis le code visé (par défaut : `git diff` du travail en cours, sinon les
fichiers indiqués) **contre les principes ci-dessous**, dans cet ordre de
gravité. Rapporte chaque violation avec `fichier:ligne`, le principe enfreint,
et le correctif concret. Termine par un verdict : conforme / corrections
mineures / refonte nécessaire.

## Violations bloquantes (cassent l'architecture)

1. **Import React/DOM dans le core.** `src/framework/core` et
   `src/framework/canvas` n'importent jamais `react`/`react-dom` ; pas de
   `document`/`window` dans `core/` (seul `Intl` est permis ; les types
   structurels comme `KeyStroke` remplacent les types DOM). Le test
   `purity.test.ts` doit continuer de passer.
2. **Mutation hors intent.** Tout changement d'état passe par
   `store.dispatch(intent)` — jamais de setter direct, jamais d'état métier
   dans un `useState` de composant (les `useState` de composant ne portent que
   du présentationnel : ghost de drag, valeur d'input contrôlé…).
3. **Effet exécuté dans un reducer.** Un handler retourne
   `withEffects(state, …)` ; il n'appelle jamais `focus()`, `fetch()`,
   `navigator.*`, un callback utilisateur, ni `Date.now()` (le temps est
   injecté via les payloads).
4. **Callback utilisateur appelé depuis la machine.** Les sorties sont des
   effets `event/emit { name, detail }` interprétés par `useForgeEffects` —
   c'est ce qui rend les machines rejouables.

## Violations majeures (dette immédiate)

5. **Logique métier dans une primitive React.** Si un `if` encode une règle
   d'interaction (sélection, navigation, conflit de touches), il appartient au
   core. La primitive : rend l'état, transforme les événements DOM en intents,
   interprète les effets. Rien d'autre.
6. **Clavier impératif.** Pas de `switch (e.key)` pour de la sémantique de
   composant : keymap déclarative (`"Mod+a"`, `"Shift+ArrowDown"`, `"Space"`,
   `"@printable"`) résolue par `resolveBinding`. Les conflits se règlent par
   ordre de composition et bindings retournant `null`.
7. **Roving tabindex sur une collection.** Focus logique via
   `aria-activedescendant` (l'item focalisé peut être démonté par la
   virtualisation). Vérifier aussi : rôles ARIA complets (`option`,
   `treeitem` + `aria-level/posinset/setsize`, `gridcell` + indices), annonces
   SR pour les opérations invisibles (drag, copie).
8. **Reconstruction de machine sur changement de props.** La config lit les
   props via getters sur `useLiveRef` ; `useState(() => …)` pour les handlers
   stables ; ref callbacks mémoïsés par clé (registry) pour ne pas casser les
   `memo` d'items.

## Violations mineures (qualité)

9. **Tests manquants ou au mauvais étage.** La logique nouvelle a des tests
   `// @vitest-environment node` qui dispatchent des intents et inspectent
   état + effets. Les tests RTL ne couvrent que le câblage adaptateur.
10. **Asymptotique.** Pas de O(n) par frame sur les chemins scroll/mesure
    (le virtualizer Fenwick existe pour ça) ; pas de recalcul de collection
    par keystroke sans mémoïsation.
11. **Conventions.** Intents `domaine/action` ; types exportés depuis les
    barrels (`core/index.ts`, `react/index.ts`, `primitives/index.ts`) ;
    données contrôlées (la primitive ne mute jamais `data`) ; messages
    utilisateur localisables.

## Sortie attendue

```
VERDICT : conforme | corrections mineures | refonte nécessaire
BLOQUANT  fichier:ligne — principe N — correctif
MAJEUR    …
MINEUR    …
```

Si le diff touche `experimentations/` : signaler — ce dossier est un bac à
sable en lecture seule.

## LEARNINGS (enrichi au fil des sessions — voir /forge-learn)

- 2026-06-12 · Point de vigilance récurrent : les indices (curseur, colonnes)
  doivent référencer l'univers _visuel/effectif_ (après réordonnancement,
  groupement, filtre), lu via live ref — pas l'ordre des props.
- 2026-06-12 · Pour l'async : vérifier que les réponses portent un numéro de
  séquence et que le reducer rejette les séquences périmées — l'anti-course
  par discipline d'adaptateur est une violation du principe 3.
