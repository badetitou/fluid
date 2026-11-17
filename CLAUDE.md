# fluid — notes pour Claude

Monorepo pnpm : `apps/frontend` (React + Vite + antd), `apps/bff` (Fastify + Prisma, proxy LLM),
`packages/shared` (ViewSpec, schémas zod). fluid n'a pas de backend GraphQL à lui : on se connecte
à des API publiques (Rick and Morty par défaut) ou à n'importe quelle API GraphQL.
Voir `README.md` pour le lancement.

## Commandes

- `pnpm -r typecheck` — typecheck de tous les workspaces
- `pnpm test` — tests (vitest côté frontend)
- `node scripts/arch-metrics.mjs` — indicateurs d'architecture (`--json` pour le journal)

## Règles d'architecture

Une réarchitecture est en cours : cible et plan dans `docs/architecture/REARCHITECTURE.md`.
Le code nouveau ou modifié suit ces règles ; la dette existante est suivie dans
`docs/architecture/health-log.md`. L'agent `practices-guardian` vérifie ces règles.

1. **Mini composants** : un composant exporté par fichier, ≤ 150 lignes, ≤ 7 props, une responsabilité.
   Plus de 4 `useState` → extraire un hook.
2. **Couches** (imports vers le bas uniquement) :
   `app → pages → features → entities → engine → catalog → shared`.
   Le moteur de rendu (`views/`, futur `engine/`) n'importe jamais `components/` ni `features/`.
3. **Données** : les composants d'UI n'appellent ni `bffClient`, ni urql, ni zustand en écriture
   directement ; ils passent par un hook. Côté BFF, une route n'appelle pas Prisma.
4. **Logique pure** hors de React (`model.ts`), avec un `*.test.ts` à côté.
5. **Widgets et plugins** : un type de widget = contrat (schéma, doc LLM, ports d'entrée/sortie, dans
   `packages/shared/src/plugins/contracts.ts`) + renderer + exemple + test, ajoutés ensemble, dans une
   collection (plugin). Les prompts ne décrivent jamais un widget à la main : ils passent par
   `renderWidgetDocs`. Un renderer reçoit `WidgetProps` et lit le thème via `useWidgetTheme` (pas de
   couleur en dur). Voir `docs/architecture/PLUGINS.md`.
6. **Styles** : au plus 3 `style={{…}}` par fichier ; sinon CSS module ou hook `useXxxStyles`.
7. **Typage** : pas de `any` ; valider avec zod toute donnée entrante (LLM, BFF, GraphQL).
8. Fichiers modules (`.ts`) ≤ 250 lignes. Le code généré (`**/generated/**`) est exclu.

Quand tu changes un seuil ici, change-le aussi dans `scripts/arch-metrics.mjs`.

## Carte

- `apps/frontend/src` : `app/`, `pages/`, `features/`, `entities/` (dont `entities/plugin`), `views/`
  (moteur de rendu, widgets), `shared/` ; accès BFF dans `entities/*`.
- `apps/bff/src` : `routes/`, `llm/` (prompts), `db.ts` (Prisma).
- `apps/cli/src` : CLI `@badetitou/fluid` (`npx`), couche tout en haut ; `scripts/` = build (esbuild) + smoke du tarball.
- `packages/shared/src` : `view-spec.ts`, `widgets/`, `plugins/contracts.ts`.
- Backend Moose/Pharo de démo : GraphQL sur `localhost:8080`, image pilotée par le MCP `pharo` (:4000).

## Workflow

- Équipe, agents et historique des rétros : `.claude/team.md`. Explorer avec l'agent `scout`.
- Dépôt sur **GitHub** (`badetitou/fluid`) : `gh`. Une tâche → une issue → une PR minimale.
- Issues et PR en anglais, sans attribution Claude.
- CI : `.github/workflows/ci.yml` (checks, tarball CLI, images ghcr.io, publication npm sur tag `vX.Y.Z`) et `pages.yml`.
- Avant de merger des branches de tâche : skill `review-team` (checks : `pnpm -r typecheck`, `pnpm test`).
- Ne pas committer les changements de port dans `.claude/launch.json`.
