# Journal de santé de l'architecture

Tenu par l'agent `practices-guardian` (`.claude/agents/practices-guardian.md`).
Entrée la plus récente en haut ; les anciennes entrées ne sont jamais réécrites.

## 2026-11-25 — explorateur de graphe : passage à une échelle milliers de nœuds

| Indicateur | Valeur | Δ |
| --- | --- | --- |
| Fichiers trop gros | 3 (0 dans le frontend) | = |
| Objets style inline | 47 | ↑ 4 |
| bffClient dans l'UI | 0 | = |
| Violations de couche | 0 | = |
| `any` explicites | 5 (BFF uniquement) | = |
| Ratio de tests frontend | 0.34 | = |
| typecheck / tests | ✅ / ✅ | |

**Changement de moteur**
- `@xyflow/react` retiré : un DOM par nœud plafonnait l'explorateur à quelques centaines d'éléments utiles.
- sigma/graphology dessine désormais les nœuds et arêtes en WebGL, comme `network`. La caméra est ajustée au
  graphe complet (aucun culling à 300) ; pan/zoom/hit-testing restent gérés par sigma.
- `hierarchyModel.ts` implémente le modèle HNode : containment hiérarchique, liens agrégés vers l'ancêtre visible,
  placement déterministe en boîtes imbriquées (`hierarchyLayout.ts`). Les deux modules ont leurs tests.
- Un seul canvas 2D (`hierarchyCanvas.ts`) dessine les cadres et en-têtes de toutes les boîtes. Seules les boîtes
  ouvertes ont du DOM (`ExpandedNodeBox.tsx`), ancrées et mises à l'échelle avec la caméra ; `MAX_EXPANDED = 6`
  ne limite plus que ces cartes de widgets, pas le graphe.
- L'action d'ouverture passe par une carte unique (`ExplorerNodeCard.tsx`) pour le nœud survolé/sélectionné, plus les
  boutons du bandeau. Aucun bouton n'est créé par nœud.
- Le contrat partagé gagne `hierarchyFields` (niveaux ordonnés) ; `groupByField` reste l'alias à un niveau.
- Session-only conservé : ni expansion, ni repli, ni focus, ni caméra ne sont écrits dans le `ViewSpec` ou un stockage.

**À améliorer**
- Le drag & drop des nœuds n'est pas encore disponible ; le placement des boîtes est déterministe.
- `graphExplorer.ts`, `view-spec.ts` et `examples.ts` restent dans la dette des fichiers > 250 lignes du package partagé.

Voir `docs/architecture/GRAPH_EXPLORER.md` pour le contrat et le moteur.

## 2026-11-24 — explorateur de graphe extensible (widget `graphExplorer`)

| Indicateur | Valeur | Δ |
| --- | --- | --- |
| Fichiers trop gros | 3 (0 dans le frontend) | = |
| Objets style inline | 43 | ↑ 32 |
| bffClient dans l'UI | 0 | = |
| Violations de couche | 0 | = |
| `any` explicites | 5 (BFF uniquement) | ↑ 1 |
| Ratio de tests frontend | 0.34 | ↑ 0.18 |
| typecheck / tests | ✅ / ✅ | |

**Mécanisme ajouté**
- `@fluid/shared` : contrat `graphExplorer`, presets (`code-dependencies`, `inheritance`, `calls`, `generic`) et
  normaliseur pur d'une intention courte (`normalizeGraphExplorerIntent`). La doc LLM passe par `renderWidgetDocs`,
  pas par une modification manuelle des prompts. Les requêtes `lazy` sont exclues du chargement initial de la vue.
- `views/graphSession/` : état d'interaction **en mémoire uniquement** (nœuds ouverts, groupes repliés, focus),
  partagé par les colonnes via un provider monté dans `PluginRuntime`. Rien n'est écrit dans le `ViewSpec`, ni dans
  `localStorage`/`sessionStorage` ; une régénération par l'assistant conserve l'état si l'id du widget est stable.
- `views/widgets/graphExplorer/` : rendu React Flow (`@xyflow/react`, chargé en lazy). Un nœud ouvert change de type
  sans changer d'id : sa boîte est un vrai nœud du graphe, pas une carte au-dessus du canvas. Elle contient des widgets
  fluid réels via `NestedWidget` et les resolvers `$node` / `$detail`. sigma reste inchangé pour `network` (grands graphes).
- Les ids des widgets imbriqués sont préfixés par le nœud, pour éviter les collisions de ports entre boîtes ouvertes.
- Les détails sont chargés à la demande par `useNodeDetail`, validés avec zod et mis en cache pour la session.

**À améliorer**
- React Flow garde un nœud DOM par élément visible : au-delà de quelques milliers de nœuds, préférer `network` (WebGL).
- Les positions des nœuds ne sont pas sauvegardées (choix session-only), ni le zoom courant.
- `graphExplorer.ts` et `view-spec.ts` restent dans la dette des fichiers > 250 lignes du package partagé.

Voir `docs/architecture/GRAPH_EXPLORER.md` pour le contrat et les points d'extension.

## 2026-10-21 — refonte du frontend (mini composants + performances)

| Indicateur | Valeur | Δ |
| --- | --- | --- |
| Fichiers trop gros | 3 (0 dans le frontend) | ↓ 16 |
| Objets style inline | 11 | ↓ 131 |
| bffClient dans l'UI | 0 | ↓ 6 |
| Violations de couche | 0 (contrôle étendu à toutes les couches) | ↓ 1 |
| `any` explicites | 4 (BFF uniquement) | ↓ 6 |
| Ratio de tests frontend | 0.16 | ↓ 0.08 (141 fichiers au lieu de 69 ; 156 tests au lieu de 121) |
| typecheck / tests | ✅ / ✅ | |

Étape de migration atteinte : 0, 1, 3, 4 et 5 (frontend) ; 2 partielle (cf. REARCHITECTURE.md §8)

**Progrès**
- Code mort supprimé (`useMockViews`, `mockViews` ×2, `mockGraphqlData`, ~1 300 lignes).
- `MillerColumn` (798 l.) → `pages/miller/` : `useColumnController` + 8 mini composants ; état des modales dans un réducteur testé.
- `ViewAssistantModal` (584 l.) → `features/view-assistant/` : `model.ts` testé, `useAssistantSession`, 7 composants ; `ChatBubble` et `Reasoning` dans `shared/ui`.
- Accès BFF regroupé dans `entities/view`, `entities/llm`, `entities/preferences`.
- Cycle `views → components` cassé : `ViewRenderer` reçoit `renderWidgetActions`.
- Catalogue de widgets typé exhaustivement (`WIDGET_RENDERERS`), test de couverture des types.
- Performances : pages, modales et graphiques chargés à la demande (bundle initial ≈ 0,8 Mo au lieu de 2,9 Mo ;
  `@ant-design/plots` isolé dans un chunk de 1,46 Mo) ; cartes de widget et colonnes mémoïsées
  (un drag ne re-rend plus les widgets, ouvrir une colonne ne re-rend plus les autres) ; la saisie dans
  l'assistant ne re-rend plus l'aperçu ; modales montées seulement quand elles sont ouvertes.

**À améliorer**
- `views/widgets/charts.tsx` (4 composants) et `views/format.tsx` (2) : à éclater lors du catalogue en plugins (étape 2).
- Étape 2 côté BFF/shared : prompt généré depuis `WIDGET_DEFINITIONS` ; `prompt.ts`, `view-spec.ts` toujours trop gros.
- `views/` n'est pas encore renommé `engine/` ni `catalog/` ; `hooks/useConcepts.ts` et `store.ts` restent à ranger dans `entities/`.
- Tests de `navigation/` : erreurs de typage préexistantes (non vérifiées par `tsc`, qui exclut les tests).
- Étape 0 : ESLint et tests en CI toujours absents.

## 2026-10-21 — audit complet (référence avant migration)

| Indicateur | Valeur | Δ |
| --- | --- | --- |
| Fichiers trop gros | 19 | — |
| Objets style inline | 142 | — |
| bffClient dans l'UI | 6 | — |
| Violations de couche | 1 | — |
| `any` explicites | 10 | — |
| Ratio de tests frontend | 0.24 | — |
| typecheck / tests | non lancés | |

Étape de migration atteinte : aucune (cf. REARCHITECTURE.md §8)

**Dette principale**
- `apps/frontend/src/components/MillerColumn.tsx` — 798 lignes, 12 `useState`, 22 styles inline
- `apps/frontend/src/components/ViewAssistantModal.tsx` — 584 lignes, 36 styles inline
- `apps/frontend/src/views/ViewRenderer.tsx` — importe `components/WidgetEditorModal` (cycle de couches)
- Code mort : `hooks/useMockViews.ts`, `hooks/mockViews.ts`, `views/mockViews.ts`, `graphql/mockGraphqlData.ts`
- CI : pas de tests ni de lint exécutés
