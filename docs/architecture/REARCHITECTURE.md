# Réarchitecture de fluid : vers des mini composants

> Statut : **proposition** (2026-10-21). Rien n'est migré. Ce document fixe la cible, les règles,
> et l'ordre de migration. Les règles applicables au quotidien sont résumées dans `CLAUDE.md`,
> qu'utilise l'agent `practices-guardian` (`.claude/agents/practices-guardian.md`).

## 1. Constat (mesuré)

`node scripts/arch-metrics.mjs`, le 2026-10-21 :

| Indicateur | Valeur | Commentaire |
| --- | --- | --- |
| Fichiers source (hors générés, hors tests) | 76 / ~10,8 k lignes | Taille raisonnable : c'est le bon moment pour poser un cadre |
| Fichiers trop gros (tsx > 150, ts > 250) | 19 | `MillerColumn.tsx` 798 l., `ViewAssistantModal.tsx` 584 l. |
| Objets `style={{…}}` inline | 142 | 58 dans les deux composants ci-dessus |
| Composants qui appellent `bffClient` directement | 6 | L'accès aux données est éparpillé |
| `views/` qui importe `components/` | 1 | Dépendance circulaire `components ⇄ views` |
| Ratio fichiers de test / source (frontend) | 0,24 | La CI ne lance **aucun** test |

Problèmes structurels identifiés :

1. **Composants « dieu ».** `MillerColumnBody` porte 12 `useState`, la résolution des perspectives,
   l'injection de l'id, 5 mutations BFF (renommer, supprimer, défaut, layout, copie), le menu,
   les pastilles, deux variantes d'en-tête et trois modales. `ViewAssistantModal` mélange
   versionnement, streaming, persistance et rendu du chat.
2. **Un widget = 5 endroits à modifier.** Ajouter un type de widget touche le schéma zod
   (`packages/shared/src/view-spec.ts`), le `switch` de `views/WidgetRenderer.tsx`, le prompt texte
   du BFF (`apps/bff/src/llm/prompt.ts`), le mock LLM, et les exemples. Rien ne garantit qu'ils
   restent synchrones : le prompt peut décrire un widget que le front ne sait pas rendre.
3. **Couches non respectées.** `views/ViewRenderer` (moteur de rendu) importe
   `components/WidgetEditorModal` (UI applicative) qui elle-même appelle le BFF.
4. **Code mort.** `hooks/useMockViews.ts`, `hooks/mockViews.ts`, `views/mockViews.ts`,
   `graphql/mockGraphqlData.ts` (~1 300 lignes) ne sont importés par aucun module applicatif.
5. **Pas de garde-fou automatique.** `lint` = `tsc --noEmit` ; ni ESLint, ni Prettier en CI, ni tests en CI.

## 2. Principes cibles

- **Mini composant** : un fichier = un composant exporté, **≤ 150 lignes**, **≤ 7 props**, une seule
  responsabilité nommable en une phrase. Au-delà, on découpe.
- **Composant présentiel vs conteneur** : les mini composants d'UI reçoivent des données et des
  callbacks ; ils ne connaissent ni le BFF, ni zustand, ni urql. Les hooks (`useXxx`) font le lien.
- **Logique pure hors de React** : versionnement, calcul de layout, construction de specs → fonctions
  pures dans `model.ts`, testées unitairement (comme `gridLayout.ts` aujourd'hui, qui est le bon exemple).
- **Un widget = un dossier** (plugin) : schéma, documentation LLM, rendu, éditeur, test, ensemble.
- **Dépendances à sens unique** entre couches (voir §3), vérifiées par un lint.
- **Styles** : pas d'objet `style={{}}` construit dans le rendu au-delà de 3 par fichier ; les styles
  statiques vont dans un CSS module (`X.module.css`, natif dans Vite) avec les variables CSS d'antd ;
  les styles qui dépendent du token passent par un petit hook `useXxxStyles()` mémorisé.

## 3. Structure cible du frontend

Inspirée de *Feature-Sliced Design*, simplifiée. Les couches ne peuvent importer que **vers le bas** :

```
apps/frontend/src/
  app/          ← bootstrap : main.tsx, App.tsx (routes), providers, theme, runtime-config
  pages/        ← assemblage d'écrans : ConnectPage, HomePage, MillerListPage, SettingsPage
  features/     ← une action utilisateur = un dossier
    perspective-switcher/   pastilles, sélection, renommage inline
    perspective-menu/       menu « … » (actions sur la perspective courante)
    layout-editor/          édition du layout à la souris (toolbar + état)
    view-assistant/         chat LLM de création/raffinement de vue
    view-json-editor/       éditeur JSON
    widget-assistant/       édition d'un widget par LLM
    concept-pinning/        épingler un concept dans la barre
    llm-settings/           modale de réglages LLM
  entities/     ← modèle métier + accès aux données, sans UI applicative
    concept/      introspection, useConcept(s), conceptSchema
    view/         useViews, viewScope, registry (vues auto), api (bffClient côté vues)
    preferences/  stores zustand (connexion, densité, thème, épingles, icônes)
  engine/       ← moteur de rendu des ViewSpec : ViewRenderer, WidgetGrid, gridLayout, data, useViewData
  catalog/      ← les widgets, un dossier chacun (cf. §4)
  shared/       ← générique, zéro métier
    ui/           Pill, ChatBubble, EmptyState, PanelHeader, IconButton…
    hooks/        useElementWidth…
    lib/          format, humanize…
```

Règle d'import (du haut vers le bas uniquement) :
`app → pages → features → entities → engine → catalog → shared`.
Chaque dossier expose un `index.ts` ; on n'importe pas les fichiers internes d'une autre slice.

> `engine` ne connaît **aucune** feature : l'édition d'un widget est injectée par le parent
> via une prop `renderWidgetActions?: (w: Widget) => ReactNode`. C'est ce qui casse le cycle actuel
> `ViewRenderer → WidgetEditorModal → bffClient`.

## 4. Catalogue de widgets en plugins

Aujourd'hui le type `pie` est câblé à la main dans 5 fichiers (schéma, `WidgetRenderer`, `ViewRenderer`,
exemples, prompt BFF). Cible :

```
packages/shared/src/widgets/
  pie.ts        export const pieWidget = { type: 'pie', schema: z.object({...}), llmDoc: `…` }
  index.ts      WIDGET_DEFINITIONS = [table, statistic, descriptions, line, bar, area, pie]
                widgetSchema = z.discriminatedUnion('type', WIDGET_DEFINITIONS.map(d => d.schema))

apps/frontend/src/catalog/
  pie/
    PieWidget.tsx        rendu (≤ 150 l.)
    pie.test.tsx
    index.ts             export const pie: WidgetRenderer<'pie'> = { type: 'pie', Render: PieWidget, icon }
  index.ts               RENDERERS: Record<WidgetType, WidgetRenderer>  ← typé exhaustif
```

- Le **prompt du BFF** concatène `WIDGET_DEFINITIONS.map(d => d.llmDoc)` au lieu de décrire les widgets à la main.
- `RENDERERS` est un `Record<WidgetType, …>` : oublier le rendu d'un nouveau type **ne compile plus**.
- Un test vérifie que chaque `type` de `WIDGET_DEFINITIONS` a un renderer et un exemple.

Ajouter un widget devient : 1 fichier dans `shared/widgets`, 1 dossier dans `catalog`, 1 ligne dans chaque `index.ts`.

## 5. Découpage des deux gros composants

### `MillerColumn.tsx` (798 l.) →

| Nouvel élément | Rôle | Où |
| --- | --- | --- |
| `MillerColumn` | charge le concept, affiche erreur/squelette, fournit le contexte de chemin | `pages/miller/` |
| `useColumnPerspectives(concept, itemId)` | entrées filtrées par scope, perspective active, spec avec id injecté | `entities/view/` |
| `usePerspectiveMutations({ refetch })` | renommer / supprimer / défaut / sauver layout, avec `busy` + messages | `entities/view/` |
| `useLayoutEditor(selected, fullscreen)` | brouillon de layout, tidy, entrée/sortie du plein écran | `features/layout-editor/` |
| `ColumnHeader` (+ `CompactColumnHeader`) | mise en page de l'en-tête selon densité | `pages/miller/` |
| `PerspectivePills`, `PerspectivePill`, `PillRenameInput`, `NewPerspectivePill` | barre de pastilles | `features/perspective-switcher/` |
| `usePerspectiveMenuItems(...)` + `PerspectiveMenu` | menu « … » | `features/perspective-menu/` |
| `LayoutEditToolbar` | Tidy / Cancel / Done | `features/layout-editor/` |
| `ColumnDialogs` + `useColumnDialogs()` | une seule source d'état pour les 3 modales (réducteur) | `pages/miller/` |

Les 12 `useState` deviennent 3 hooks + un réducteur de dialogues ; aucun fichier > 150 lignes.

### `ViewAssistantModal.tsx` (584 l.) →

- `features/view-assistant/model.ts` : `versionTurns`, `buildHistory`, `summarizeSpec`, `specByVersion` (purs, testés).
- `useAssistantSession(...)` : turns, version active, `generate()`, `stop()`, flux `live`.
- `useSaveAssistantView(...)` : préservation du layout + create/update.
- UI : `AssistantChat`, `TurnItem`, `PendingTurn`, `LiveOutput`, `ChatComposer`, `AssistantPreview`,
  `VersionSelect`, et `ChatBubble` dans `shared/ui` (réutilisé par `WidgetEditorModal`).

## 6. BFF

Plus petit et déjà correctement séparé (`routes/`, `llm/`). Cible légère, par module :

```
apps/bff/src/modules/
  views/   routes.ts (HTTP + validation)  service.ts (règles)  repo.ts (Prisma)
  prefs/   …
  llm/     routes.ts  generate.ts  providers/{openai,ollama,claudeCode,mock}.ts  prompt/
```

Règles : une route ne touche jamais Prisma directement ; les providers LLM implémentent une interface
commune ; le prompt est construit à partir de `WIDGET_DEFINITIONS` (§4).

## 7. Garde-fous automatiques

| Outil | Ce qu'il vérifie |
| --- | --- |
| ESLint (`typescript-eslint`, `eslint-plugin-react-hooks`) | règles des hooks, `no-explicit-any` |
| `max-lines` (150 tsx / 250 ts) + `max-lines-per-function` | taille des mini composants |
| `import/no-restricted-paths` (ou `eslint-plugin-boundaries`) | sens des couches du §3 |
| `knip` | code mort, exports et dépendances inutilisés |
| CI : `pnpm test` + `prettier --check` | aujourd'hui absents de `.github/workflows/ci.yml` |
| `scripts/arch-metrics.mjs` + agent `practices-guardian` | tendance dans le temps (journal de santé) |

Les règles ESLint démarrent en `warn` pour ne pas bloquer, puis passent en `error` à la fin de la migration.

## 8. Plan de migration (PR courtes, l'app fonctionne à chaque étape)

| # | PR | Risque |
| --- | --- | --- |
| 0 | Garde-fous : ESLint en `warn`, tests + prettier en CI, suppression du code mort | faible |
| 1 | Extraire `shared/ui` (`Pill`, `ChatBubble`, `PanelHeader`) + les fonctions pures en `model.ts` avec tests | faible |
| 2 | Catalogue de widgets en plugins (§4), prompt BFF généré | moyen |
| 3 | Découper `MillerColumn` (§5), en commençant par les hooks | moyen |
| 4 | Découper `ViewAssistantModal` puis `WidgetEditorModal` (partagent `ChatBubble`, la session) | moyen |
| 5 | Déplacer les dossiers vers la structure §3 (déplacements seuls, pas de logique) | faible mais bruyant |
| 6 | BFF en modules (§6) | faible |
| 7 | Passer les règles ESLint en `error` ; cibles : 0 fichier trop gros, 0 violation de couche | — |

Chaque PR met à jour `docs/architecture/health-log.md` via l'agent `practices-guardian`.

## 9. Décisions à prendre

- **Styles** : CSS modules + variables CSS antd (recommandé, zéro dépendance) vs `antd-style` (CSS-in-JS lié aux tokens).
- **Seuil de taille** : 150 lignes par composant est volontairement strict ; 200 est un compromis acceptable.
- **Le mock LLM** (`apps/bff/src/llm/mock.ts`) : le garder comme provider de démo, ou le remplacer par des fixtures de test.
- **Vues curatées** (`packages/shared/src/examples.ts`) : elles ciblent les concepts `Account` et
  `Transaction` de l'ancienne banque de démo (supprimée le 2026-10-21) et ne s'affichent plus que si une
  source expose ces types. Les supprimer, ou les réécrire pour une source publique (Rick and Morty).
