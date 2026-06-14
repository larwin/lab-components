# Plan de ménage `src/` — proposition à valider

> **Statut : PROPOSITION. Rien n'a été supprimé ni déplacé.** Ce document liste les
> actions destructives candidates, leur impact et l'ordre recommandé. Chaque étape
> attend un **go explicite** de Nicolas avant exécution, étape par étape.
>
> La phase « clarté » (audit + README par dossier + carte `src/README.md` + alignement
> de `CLAUDE.md`) est, elle, **faite et non destructive**.

Preuves d'usage relevées le 2026-06-14 par grep d'imports sur tout `src/`.
« Inbound » = fichiers hors du dossier (et hors de ses propres tests) qui l'importent.

## Tableau de décision

| #   | Cible                                    | Statut prouvé                                          | Action recommandée                                                                | Impact si exécutée                                                                                                                         |
| --- | ---------------------------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | `src/framework/engines`                  | **mort** — 0 importer                                  | **Supprimer**                                                                     | Aucun (aucun import). À retirer du registre mental ; aucun fichier ne casse.                                                               |
| 2   | `src/framework/collections`              | **mort** — 0 importer (descripteurs seuls)             | **Supprimer**                                                                     | Aucun. Le moteur réel est `core/collection`. Le README de ce dossier disparaît avec lui.                                                   |
| 3   | `src/lib/api`                            | **mort** — 0 importer (exemple `createServerFn`)       | **Supprimer** (ou garder 1 fichier balisé « example » si on veut l'échantillon)   | Aucun import à corriger.                                                                                                                   |
| 4   | `src/components/ui` (46 fichiers shadcn) | **île isolée** — 0 consommateur externe                | **Décision produit requise** (voir ci-dessous)                                    | Si suppression : `use-mobile` perd son seul consommateur vivant ; ~10 dépendances npm (Radix & co.) deviennent potentiellement retirables. |
| 5   | `src/framework/components` (gen-1)       | **legacy ENCORE UTILISÉ** — 9 routes via `@/framework` | **NE PAS supprimer.** Migrer d'abord les routes vers `primitives/`, puis retirer. | Suppression immédiate = 9 routes cassées. Chantier de migration séparé.                                                                    |

## Détail & recommandations

### Lot A — suppressions sûres (impact nul prouvé)

**#1 `framework/engines` + #2 `framework/collections`.** Zéro import entrant dans tout
`src/` (vérifié : `grep "@/framework/(collections|engines)"` → aucune correspondance).
Ce sont des descripteurs gen-1.5 jamais implémentés ; le code réel vit dans
`framework/core` (collection, behaviors, virtualization…). Leurs propres READMEs le
disent. **Recommandation : supprimer les deux dossiers.** Risque : nul.

**#3 `src/lib/api`.** `example.functions.ts` est un échantillon TanStack `createServerFn`
sans aucun importer. **Recommandation : supprimer** `src/lib/api/` (ou conserver le
fichier renommé/balisé si on veut garder l'exemple sous la main). Risque : nul.

> Lot A = ~3 dossiers, 0 import à corriger. C'est le « go » le plus simple à donner.

### Lot B — décision produit : `src/components/ui`

46 composants shadcn/Radix, **aucun consommateur hors du dossier** (13 références, toutes
internes, 8 fichiers). CLAUDE.md interdit déjà d'y bâtir du neuf ; l'UI vivante se
compose de `@/framework/primitives`. Trois options :

- **B1 — Supprimer** tout `src/components/ui`. Le plus net. Impact : retirer aussi
  l'unique usage vivant de `@/hooks/use-mobile` (l'autre est dans `experimentations/`,
  sandbox lint-ignoré) ; auditer/retirer les dépendances npm devenues orphelines
  (plusieurs `@radix-ui/*`, `cmdk`, `vaul`, `embla-carousel-react`, `recharts`,
  `sonner`, `input-otp`, `react-day-picker`, `react-resizable-panels`). **Un build +
  tsc confirmera qu'aucun import ne casse.**
- **B2 — Conserver mais isoler** : garder le code comme réserve de référence, statut
  « isolated » déjà documenté dans son README. Aucun risque, mais le bruit reste.
- **B3 — Extraire** hors de `src/` (vers un dossier `legacy/` ou `experimentations/`)
  pour le sortir de l'API mentale sans le perdre.

**Recommandation : B1 (supprimer)** — c'est du code mort vis-à-vis du produit et la
suppression est mécaniquement vérifiable. À ne faire qu'après ton go, et idéalement en
deux temps : (a) retirer `components/ui`, (b) PR séparée pour le nettoyage des
dépendances `package.json` (plus risqué à valider).

### Lot C — chantier de migration (pas une suppression)

**#5 `framework/components` (gen-1).** Contrairement à ce qu'un premier grep naïf
suggérait, ces composants **ne sont pas morts** : 9 routes de démo les importent via le
barrel racine `@/framework` (`collections`, `components`, `data-grid`, `debug`,
`accessibility`, `theming`, `virtualization`, `canvas-grid`, `grid-next`). Les
supprimer maintenant casse ces routes.

**Recommandation :** chantier séparé « migrer les routes legacy vers `primitives/` » :
pour chaque route, remplacer `List→Listbox`, `Tree→TreeView`, `Radio→RadioGroup`,
`Button/Checkbox/Input/Select/Menu/DataGrid` gen-1 par leurs primitives. Quand plus
aucune route n'importe `@/framework` (gen-1), retirer `framework/components` **et** le
barrel racine `src/framework/index.ts`. C'est le plus gros lot, à planifier à part.

## Ordre d'exécution proposé

1. **Lot A** (engines + collections + lib/api) — go simple, impact nul, `tsc`/build/tests verts attendus immédiatement.
2. **Lot B** (`components/ui`) — décision produit B1/B2/B3, puis exécution + vérif build.
3. **Lot C** (migration gen-1 → primitives) — chantier dédié, route par route, suppression finale du barrel.

## Garde-fous d'exécution (rappel)

- Une étape = un go. Vérifier après chaque étape : `bun run format` (+ `git restore experimentations/`),
  `bun run test`, `bun run lint`, `bun run build`, **`bunx tsc --noEmit`**.
- Staging par chemins explicites ; branche dédiée ; ne pas committer les untracked
  locaux (`.claude/`).
- Ne jamais toucher `routeTree.gen.ts` ni `experimentations/`.

---

## Journal d'exécution — 2026-06-14 (branche `chore/src-cleanup`)

**Fait :**

- **Lot A** — supprimés : `src/framework/engines`, `src/framework/collections`,
  `src/lib/api`. (0 import, impact nul.)
- **Lot B** — supprimé : `src/components/ui` (46 fichiers shadcn). `use-mobile`
  perd son seul consommateur vivant (reste dans `experimentations/`). `package.json`
  **non touché** : le nettoyage des dépendances npm orphelines (Radix, cmdk, vaul,
  embla, recharts, sonner, input-otp, react-day-picker, react-resizable-panels) reste
  une PR séparée à valider.
- **Lot C** — supprimés : `src/framework/components` (gen-1) + le barrel racine
  `src/framework/index.ts` ; et **7 routes vitrines/legacy** : `/components`,
  `/collections`, `/data-grid`, `/virtualization`, `/accessibility`, `/theming`,
  `/debug` (+ entrées `nav.ts` + bloc « L'existant conservé » de la home).
  Les 2 vitrines phares **conservées** : `/grid-next` (500k) et `/canvas-grid` (1M),
  dont le `Select` gen-1 a été basculé sur la primitive `Select` (geste minimal — la
  seule façon CLAUDE-compatible de les garder).

**Vérif après ménage :** `bun run build` OK · `bunx tsc --noEmit` 0 erreur ·
`bun run test` **457 verts** (50 fichiers ; −13 tests = les 4 fichiers de tests gen-1
supprimés). `routeTree.gen.ts` régénéré, 0 référence aux routes supprimées.
Lint : reste rouge pour la raison **CRLF environnementale préexistante** (autocrlf=true
sans `.gitattributes`), hors périmètre de ce ménage.

## Composants à bâtir plus tard (manques `components/ui` → primitives)

Recensés avant la suppression de `components/ui` : composants shadcn qui n'avaient
**aucun équivalent** dans `@/framework/primitives`. À refaire en primitives (méthode
`/forge-feature`) le jour où un besoin réel apparaît :

| Manque réel       | Primitive à créer                                         |
| ----------------- | --------------------------------------------------------- |
| `aspect-ratio`    | `AspectRatio`                                             |
| `chart`           | `Chart` (data-viz)                                        |
| `collapsible`     | `Collapsible`/`Disclosure` (un seul volet, ≠ `Accordion`) |
| `hover-card`      | `HoverCard`                                               |
| `navigation-menu` | `NavigationMenu`                                          |
| `scroll-area`     | `ScrollArea`                                              |

Couverts mais pas en 1:1 (à reconsidérer au cas par cas) : `label` (atomique, vs le
label du `Field`), `resizable` N-volets (vs `Splitter` 2-volets), `table` sémantique
légère (vs `DataGrid` lourd), `sidebar` (composite d'app — le playground a le sien).
