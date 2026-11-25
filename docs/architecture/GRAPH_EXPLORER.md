# Explorateur de graphe (`graphExplorer`)

Un widget de graphe hiérarchique dans la lignée de **Graphify** et des **HNode** de Moose : des milliers de
nœuds sont dessinés en même temps par sigma (WebGL), et les boîtes de containment sont dessinées dans la même
vue par une couche canvas 2D. Ouvrir une feuille l'agrandit en boîte contenant de vrais widgets fluid ancrés
sur le graphe (pas une carte flottante). L'état d'interaction reste session-only.

## Contrat partagé (`packages/shared`)

- `widgets/graphExplorer.ts` : champs, doc LLM (`graphExplorerWidgetDoc`), exemple curé (`graphExplorerExample`),
  `normalizeGraphExplorerIntent(intent)`.
- `widgets/graphExplorerPresets.ts` : constantes réservées et quatre presets. L'LLM écrit une **intention courte**
  (`preset` + quelques noms de champs) ; le normaliseur pur applique les valeurs du preset, puis les champs explicites.
- `view-spec.ts` : `graphExplorerDraftSchema`, `graphExplorerIntentSchema`, champ récursif `widgets` et `queries[].lazy`.
- `plugins/contracts.ts` : contrat exhaustif, donc la doc LLM est générée par `renderWidgetDocs` (aucun prompt écrit à la main).
- `hierarchyFields` donne les niveaux de containment ordonnés (par exemple `["parentPackage.name"]`) ;
  `groupByField` reste l'alias pour un seul niveau. `groupField`, lui, ne fait que colorer.

| Preset | Usage |
| --- | --- |
| `code-dependencies` | Paquets/classes et leurs dépendances, vue réseau, hiérarchie par paquet. |
| `inheritance` | Superclasses, vue arbre, groupes par paquet repliés. |
| `calls` | Appelants/appelés, hiérarchie par type porteur. |
| `generic` | Liste liée quelconque, sans containment. |

### Bindings réservés

- `$node` : la ligne du nœud ouvert, lue par les widgets imbriqués (`data: { query: "$node", path?: "..." }`).
- `$detail` : le résultat de la requête nommée par `detailQuery`, après sélection de `detailPath`.
- `detailQuery` doit nommer une requête de `ViewSpec.queries` avec `"lazy": true` et une variable GraphQL `$nodeId: ID!`.
  `detailIdField` choisit le champ du nœud passé à cette variable (défaut `id`).

`scopedResolver` (`views/data.ts`) chaîne ces portées : `$item` (accordéon imbriqué) → `$node` → `$detail` → résolveur de la vue.

## Moteur (`apps/frontend/src/views`)

- `graphSession/` : store en mémoire par provider, clé `${viewId}|${widgetId}|${query}`. `toggleExpanded`,
  `setCollapsedGroup`, `setFocus`, `setOverride` sont des fonctions pures testées. Le provider est monté dans
  `app/PluginRuntime.tsx`. Aucune écriture dans le ViewSpec ni dans un stockage du navigateur.
- `useNodeDetail.ts` : exécute la requête lazy via `queryRunner`, valide avec zod, met en cache pour la session et ignore
  les réponses périmées. `useViewData.ts` exclut les requêtes `lazy` du chargement initial et du `refetch`.
- `widgets/graphExplorer/hierarchyModel.ts` : arbre de containment (nœuds synthétiques `h:<niveau>:<chemin>`), nœuds
  visibles, focus, et agrégation des liens vers l'ancêtre visible commun (comportement HNode). Logique pure, testée.
- `widgets/graphExplorer/hierarchyLayout.ts` : placement déterminatif en boîtes imbriquées (rangées bornées), sans
  simulation ni worker : un passage linéaire, même pour des milliers de nœuds. Logique pure, testée.
- `widgets/graphExplorer/explorerGraph.ts` : un nœud graphology par boîte visible, donné à sigma. Le pan/zoom, le
  survol, la sélection et les arêtes sont gérés par WebGL : **aucun nœud DOM par élément**, aucun culling à 300.
- `widgets/graphExplorer/hierarchyCanvas.ts` : couche canvas 2D qui dessine les cadres des boîtes et les en-têtes,
  alignés sur la caméra de sigma. Un seul canvas pour tout le graphe.
- `widgets/graphExplorer/ExpandedNodeBox.tsx` : le seul contenu DOM d'une boîte ouverte. Il est positionné depuis
  `sigma.graphToViewport`, mis à l'échelle avec la caméra et clippé par la boîte dessinée. Au zoom < 0,45, seuls le
  cadre et l'en-tête restent visibles (les widgets ne deviennent pas illisibles).
- `ExplorerNodeCard.tsx` : une seule carte DOM pour le nœud survolé/sélectionné, avec l'action d'ouverture. Les
  boutons n'existent donc pas par nœud.
- `MAX_EXPANDED = 6` ne limite que les boîtes avec de vrais widgets (coût DOM) ; les expansions de containment et le
  nombre de nœuds dessinés ne sont pas plafonnés.
- `collapseAll`, `Expand all`, repli par boîte et focus sont dans `ExplorerToolbar` ; tout est session-only.

## Pourquoi sigma et pas React Flow

La première version utilisait React Flow : un élément DOM par nœud, donc quelques centaines de nœuds maximum.
Le critère n'était pas la boîte ouverte mais l'échelle. sigma dessine déjà des milliers de nœuds/arêtes en WebGL
(voir `network`) ; les boîtes sont ajoutées dans une couche canvas 2D alignée sur sa caméra, et seules les boîtes
réellement ouvertes ont du DOM. `@xyflow/react` a été retiré des dépendances.

## Limites et suites possibles

- Les positions, le zoom et le pan ne sont pas persistés (choix session-only), ni l'état des boîtes.
- Le placement des boîtes est une hiérarchie compacte déterministe : il ne gère pas encore le drag & drop des nœuds.
- Le detail query n'est exécutée qu'une fois par nœud pour la session ; un rechargement de page la refait.
- Une collection de plugins peut fournir ses propres presets en réutilisant le normaliseur et les ports `$node`/`$detail`.
