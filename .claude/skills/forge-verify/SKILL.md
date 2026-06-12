---
name: forge-verify
description: >
  Boucle de vérification complète du repo lab-components (format, tests
  vitest, lint, build, garde de pureté, hygiène du diff). À lancer après toute
  modification de code — par Claude ou manuelle — et systématiquement avant un
  commit.
---

# /forge-verify — la boucle de validation Forge

Exécute ces étapes **dans l'ordre** et rapporte les chiffres réels (jamais
« ça devrait passer »).

## 1. Format

```
bun run format
```

⚠️ Prettier reformate aussi `experimentations/` (conversions LF→CRLF sans
valeur). Immédiatement après :

```
git restore experimentations/
```

`experimentations/` est le bac à sable gen-2 (source d'inspiration, lint-ignored) :
il ne doit **jamais** apparaître dans un diff.

## 2. Tests

```
bun run test
```

- **Jamais `bun test`** : c'est le runner natif de Bun, il ramasse
  `experimentations/` et n'a pas le setup jsdom → faux échecs massifs.
- Vérifier que `purity.test.ts` est dans les fichiers passés : c'est la garde
  d'architecture (zéro import React dans `core/` et `canvas/`, ni dans
  `gridMachine.ts`). S'il échoue, c'est le code qui a tort, pas le test.
- Un seul fichier : `bun vitest run <chemin>`.

## 3. Lint

```
bun run lint
```

Attendu : **0 erreur**. Les ~10 warnings `react-refresh/only-export-components`
sont préexistants et acceptés — ne pas les « corriger » en éclatant des
fichiers, ne pas en ajouter de nouveaux types.

## 4. Typecheck + build

```
bun run build
bunx tsc --noEmit
```

Dans cet ordre si une route a été ajoutée/renommée : le build régénère
`routeTree.gen.ts` dont le typecheck dépend. `routeTree.gen.ts` ne s'édite
jamais à la main.

## 5. Hygiène du diff (avant commit)

- `git status --short` : aucun fichier `experimentations/` modifié.
- La table de statut de `docs/RFC-001-NEXT-GEN-ARCHITECTURE.md` reflète le
  chantier (🔜 → ✅ avec lien démo).
- Si une nouvelle route existe : entrée dans `src/playground/nav.ts` et,
  pour un chantier majeur, carte sur la home (`src/routes/index.tsx`).
- Commit : seulement à la demande de Nicolas ; message conventionnel
  (`feat(framework): …`) avec un corps qui liste ce qui est vérifiable.

## Rapport attendu

Une ligne par étape avec les chiffres : `X tests verts · lint 0 erreur ·
build OK · diff propre`. En cas d'échec : la cause racine et le correctif,
pas un contournement.

## LEARNINGS (enrichi au fil des sessions — voir /forge-learn)

- 2026-06-12 · PowerShell 5.1 : ne jamais réécrire un fichier texte via
  `Get-Content`/`Set-Content` (corruption UTF-8) — outils Write/Edit
  uniquement. Confirmé en vague 4 : même un « petit » remplacement regex en
  batch (`-replace` sur tous les call sites) mojibake les tirets/accents ;
  pour N occurrences identiques, Edit `replace_all` ou réécriture Write.
  `git push` écrit sa confirmation sur stderr : le `NativeCommandError`
  PowerShell est cosmétique si `main -> main` apparaît.
- 2026-06-12 · Formatage ciblé : `bunx prettier --write <fichiers du chantier>`
  évite le passage global de `bun run format` sur `experimentations/` (et donc
  le `git restore` obligatoire). Le lint vérifie prettier de toute façon.
- 2026-06-12 · Caractères Unicode invisibles (U+202F…) littéraux dans le code
  ⇒ erreur lint `no-irregular-whitespace` : toujours des échappements
  `\uXXXX` dans les regex. Piège de réparation : l'outil Edit ne matche pas
  les invisibles de façon fiable et la génération retombe en littéraux ; la
  voie sûre est PowerShell `[IO.File]` en construisant la chaîne par morceaux
  (`[char]0x5C + 'u00a0'`), écrite via `WriteAllText` + `UTF8Encoding($false)`
  — jamais `WriteAllLines`, qui force du CRLF (vague de `Delete ␍` prettier).
