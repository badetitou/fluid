# Système de plugins de fluid

> Statut : **étape 1 livrée** (2026-10-22) ; **trois types de plugins** et View Builders (2026-10-26). Ce document fixe l'API des plugins, celle des widgets,
> et ce qu'il reste à faire. Il prolonge `REARCHITECTURE.md` §4 (« un widget = un dossier »).

## 1. Pourquoi

Chaque nouveau widget ou thème grossissait le cœur : schéma zod dans `view-spec.ts`, renderer dans
`catalog.tsx`, doc écrite à la main dans **trois** prompts (`prompt.ts` ×2, `claudePrompt.ts`),
palette codée en dur dans `theme.ts`. On divise : le cœur ne connaît plus que des **contrats**,
et ce qui les remplit vient de **plugins** que l'utilisateur active, désactive ou installe.

## 2. Ce qu'est un plugin

Un plugin a un **manifeste** (JSON, validé par zod) et, optionnellement, un **module** (code).
Il est d'**un seul type** (`kind`), qui dit ce qu'il contribue :

| Type (`kind`) | Contribution | Contenu | Code ? |
| --- | --- | --- | --- |
| `theme` | `themes` | jetons de couleur, polices, rayon, palette de séries, surcharges par widget | non (JSON pur) |
| `widget` | `widgets` | des types de widgets : contrat (schéma, doc LLM, ports) + renderer. Un widget **affiche** les données qu'on lui donne, il ne fait jamais de requête | oui (module ESM) |
| `viewBuilder` | `viewBuilders` | propose des **perspectives** (des `ViewSpec`) pour une colonne, et peut apporter la **source de données** que lisent leurs requêtes (autre chose que GraphQL) | oui (module ESM) |

`kind` peut être omis : il se déduit de la contribution (anciens manifestes). Un manifeste qui
mélange deux contributions est refusé. Un plugin peut déclarer des **réglages** (`settings` :
`key`, `label`, `placeholder`, `default`…) que l'utilisateur remplit dans *Settings → Plugins*
(ex. l'URL d'un backend) ; ils sont passés à ses View Builders.

```jsonc
// https://exemple.org/plugins/tagcloud/manifest.json
{
  "id": "tagcloud",                     // [a-z0-9-], unique ; préfixe des types de widgets
  "name": "Tag cloud",
  "version": "1.0.0",
  "description": "…",
  "kind": "widget",                     // theme | widget | viewBuilder (déduit si absent)
  "module": "./index.js",               // relatif au manifeste ; requis sauf pour un thème
  "contributes": {
    "widgets": [ WidgetContract, … ]    // ou "themes": [ThemeDefinition] / "viewBuilders": [{ id, label, color? }]
  }
}
```

### Sources

- **Intégrés** (`builtin`) : livrés avec fluid, désactivables, jamais supprimés.
  Les 13 widgets historiques sont répartis en 4 collections (`essentials`, `charts`, `code`,
  `structure`) et le thème badetitou devient un plugin, à côté de deux autres thèmes (Solarized,
  High contrast). Le plugin `fluid-theme-catppuccin` apporte les palettes [Catppuccin](https://catppuccin.com/)
  en trois thèmes : Latte en mode clair, Frappé, Macchiato ou Mocha en mode sombre
  (`entities/plugin/catppuccin.ts`). Une 5ᵉ
  collection, `fluid-3d` (`model3d`, `scene3d`, three.js chargé à la demande), affiche des éléments IFC.
  La collection `charts` compte aussi le widget `sankey` (flux pondérés entre quelques groupes, en SVG
  maison, disposition calculée sans dépendance ; clic → `selected` = `{ group, rows }` ou
  `{ source, target, value, rows }`).
  Une 6ᵉ collection, `fluid-graphs` (« Graphs »), apporte le widget `network` (graphe
  nœuds-arêtes en WebGL avec sigma + graphology, pour des milliers de nœuds) et le widget
  `classDiagram` (diagramme de classes UML d'une hiérarchie d'héritage, en HTML/SVG maison,
  branches repliables).
  Elle compte aussi le widget `butterfly` (vue de détail d'un élément : ses dépendants à gauche,
  ses dépendances à droite, en SVG maison, liens répétés plus épais, profondeur 1 ou 2, regroupés
  par `groupField` au-delà de 60 voisins par côté ; clic sur un voisin → `linkTo` + `selected`).
  Elle compte enfin le widget `matrix` (matrice de dépendances : DSM carrée avec diagonale grisée et
  cycles en couleur d'alerte, ou carte de co-usage `columns: "targets"` ; cellules colorées selon le
  poids, axes triables et groupés, SVG maison jusqu'à 300 × 300 ; clic sur une cellule →
  `selected` = `{ source, target, weight }`, clic sur un libellé → `linkTo` + `selected`).
  La collection `fluid-software-maps` (« Software maps ») compte le widget `pyramid` (Overview
  Pyramid de Lanza & Marinescu : taille, couplage et héritage d'un système ou d'un paquet en une
  figure, ratios colorés selon les seuils Java / C++ / Smalltalk de Moose ; ni navigation ni sortie).
  Elle compte aussi le widget `blueprint` (Class Blueprint de Moose : les méthodes d'une classe en
  cinq colonnes, initialisation, interface externe, implémentation interne par profondeur d'appel,
  accesseurs, attributs, avec appels internes et accès aux attributs, en SVG maison ; survol → liens
  mis en évidence, clic → `linkTo` + `selected` ; message au-delà de 300 méthodes).
  Elle compte aussi le widget `boxes` (vue polymétrique : une boîte par ligne, largeur / hauteur /
  couleur issues de métriques, en arbre (`parentField`), en cadres par groupe ou en treemap, SVG
  maison avec zoom et déplacement ; survol → métriques, clic → `linkTo` + `selected` ; message
  au-delà de 2 000 boîtes).
  Une collection `fluid-inspectors` (« Inspectors ») apporte le widget `specPresenter`, qui dessine
  un onglet d'inspecteur Pharo servi par Spec-Fluid (tables, arbres, SVG Roassal, texte), ses
  entités ouvrant une colonne et sortant sur `selected`.
  Les types intégrés n'ont **pas** de préfixe (`scatter`, `network`) : le `/` est réservé aux
  widgets de plugins (`<pluginId>/<nom>`), c'est lui qui distingue un type intégré d'un type externe.
  Un renderer intégré dont les dépendances sont lourdes est chargé à la demande (`lazy.tsx` :
  `code`, `richtext`, `network`) ; un calcul lourd part dans un Web Worker (disposition du réseau).
- **Installés par URL** : on colle l'URL d'un manifeste dans *Settings → Plugins*. Le manifeste
  est mémorisé (localStorage) ; le module est rechargé au démarrage.

### Sécurité

Un module de plugin est du **code exécuté dans la page** (accès aux données affichées, au
localStorage — donc à la clé d'API LLM). En conséquence :
- un plugin *thème seul* (pas de `module`) s'installe sans avertissement : c'est du JSON ;
- un plugin avec `module` exige une confirmation explicite qui le dit ;
- seuls `https:` et l'origine de fluid sont acceptés.

Isoler le code tiers (iframe + `postMessage`) est possible plus tard sans changer le contrat des
widgets (cf. §9), au prix d'un rendu moins intégré.

## 3. L'API Widget

Un widget est décrit en deux moitiés, pour que le BFF (Node, sans React) en connaisse la partie
sérialisable :

```ts
// packages/shared — le contrat, sérialisable
interface WidgetContract {
  type: string;            // 'table' (intégré) ou '<pluginId>/<nom>' (plugin)
  label: string;
  description: string;     // une phrase, pour les humains (Settings)
  llmDoc: string;          // comment le LLM doit l'utiliser (concaténé dans les prompts)
  inputs: PortSpec[];      // ce que le widget lit
  outputs: PortSpec[];     // ce qu'il émet
  actions: ActionSlot[];   // les champs de config qui nomment des actions de la vue (MUTATIONS.md)
  jsonSchema?: object;     // plugins : schéma JSON du widget (les intégrés ont leur zod)
  example?: Widget;        // une configuration valide de référence (testée)
}
interface PortSpec { name: string; shape: 'rows' | 'object' | 'value' | 'any'; description: string }

// apps/frontend — le rendu
interface WidgetRendererDefinition {
  type: string;
  Render: ComponentType<WidgetProps>;
  sizing?: 'chart' | 'flow';   // 'chart' : remplit sa cellule au lieu de défiler
}
interface WidgetProps<W> {
  widget: W;                                   // sa config (validée)
  data: unknown;                               // l'entrée principale `data`, résolue
  resolve: (binding: DataBinding) => unknown;  // les autres entrées
  emit: (port: string, value: unknown) => void;// les sorties
  invoke?: (action, { target, form }) => Promise<ActionResult>; // les mutations de la vue (MUTATIONS.md)
  fitHeight?: number;
}
```

Les quatre propriétés demandées :

1. **API claire** — `WidgetContract` + `WidgetRendererDefinition` ; un widget intégré et un widget
   de plugin passent par le même chemin (`useWidgetRenderer(type)`).
2. **Thémable** — `useWidgetTheme(type)` donne au renderer les jetons du thème actif (mode, couleurs
   d'encre/surface, palette de séries, police, rayon) **fusionnés avec les surcharges que le thème
   déclare pour ce type** (`theme.widgets["charts/pie"] = { … }`). Les mêmes jetons sont posés en
   variables CSS (`--fluid-*`) pour les CSS modules. Les graphiques prennent leur palette du thème.
3. **Entrées** — `inputs` décrit les ports ; l'entrée principale est `data` (le `DataBinding`
   habituel), les autres sont des champs `DataBinding` de la config (ex. `compare` du widget code).
4. **Sorties (transmission)** — `emit(port, valeur)` publie une valeur au niveau de la vue.
   Un autre widget la lit avec la requête réservée **`@<widgetId>`** :
   `"data": { "query": "@accounts", "path": "selected" }`. Le widget lecteur se met à jour à chaque
   émission : sélectionner une ligne de la table *accounts* alimente le détail à côté.
   La navigation Miller (`linkTo`) reste la sortie vers *la colonne suivante* ; une sortie vers
   *un widget voisin* passe par `@id`.

Un widget dont le plugin est désactivé ou absent ne casse pas la vue : un encart indique le
plugin à activer. Côté schéma, un type `'<plugin>/<nom>'` est accepté par `widgetSchema`
(objet ouvert) ; c'est le catalogue actif qui le valide finement (`jsonSchema` → zod).

## 4. Thèmes

```ts
interface ThemeDefinition {
  id: string; label: string; description?: string;
  light?: ThemeTokens; dark?: ThemeTokens;          // au moins un des deux
}
interface ThemeTokens {
  primary, surface, surfaceCard, surfaceElevated, border, borderSubtle,
  ink, inkSecondary, inkMuted, link, selected: string;
  gradient?: [string, string, string];               // barre de marque
  series?: string[];                                 // palette des graphiques
  fontFamily?: string; radius?: number;
  widgets?: Record<string, Record<string, string>>; // surcharges par type de widget
}
```

Le thème actif et le mode (clair/sombre) sont deux réglages distincts ; un thème qui n'a qu'un mode
l'impose. `buildTheme(tokens, mode)` produit la config antd, `themeCssVariables(tokens)` les
variables CSS.

## 4 bis. View Builders et sources de données

Une colonne Miller montre des **perspectives** : les vues enregistrées dans le BFF, puis celles
que proposent les View Builders actifs, dans l'ordre des plugins. Les intégrés :

| Plugin | View Builder | Perspectives |
| --- | --- | --- |
| `fluid-curated-views` | `curated-views` | les exemples livrés (`EXAMPLE_VIEWS`) |
| `fluid-auto-views` | `auto-views` | vue d'ensemble, détail (+ édition), arbre, tirés de l'introspection |
| `spec-fluid` | `spec-fluid` | les onglets d'inspecteur Pharo d'une entité Moose (projet **Spec-Fluid** de l'image) |

```ts
interface ViewBuilder {
  id: string; label: string;
  perspectives?(ctx): Perspective[];                              // calculées depuis la colonne
  fetchPerspectives?(ctx, signal): Promise<Perspective[]>;        // demandées à un backend
  dataSource?(settings): DataSource;                              // le backend lu par leurs requêtes
}
interface ViewBuilderContext { concept; columnKind; itemId?; conceptByName; queriesByType; writable; settings }
interface Perspective { key; title; origin: 'curated' | 'auto' | 'remote'; spec: ViewSpec; defaultFor?: 'list' | 'detail' }
interface DataSource { id; run(query, variables, signal?): Promise<unknown> }
```

Une requête de vue qui porte `source: "<id>"` n'est pas envoyée à urql : `useViewData` la confie à
la `DataSource` de ce nom (contexte `DataSourcesContext` du moteur, rempli par l'app). La `ViewSpec`
reste déclarative : on peut l'enregistrer, l'éditer ou la faire modifier par le LLM.

**Spec-Fluid.** Le projet Pharo `Spec-Fluid` (paquets `Spec-Fluid*` de l'image, serveur
`SFServer start`, port 8081) sert, pour une entité (id GraphQL `<modelId>:<mooseID>`), la liste de
ses onglets d'inspecteur (pragma `<inspectorPresentationOrder:title:>`) et chaque onglet converti
en document JSON (`packages/shared/src/specFluid.ts` : `table`, `tree`, `svg` pour Roassal,
`text`, `composite`, `notebook` pour les onglets `SpNotebookPresenter`). Les cellules qui désignent une entité portent `ref: { id, type }` : le widget
`specPresenter` en fait des liens vers la colonne suivante et les émet sur `selected`. Renseigner
l'URL dans *Settings → Plugins → Spec-Fluid* (vide = désactivé).

**Couleurs.** Chaque view builder a sa couleur, marquée sur le point des pastilles de ses
perspectives : `color` (`#rrggbb`) de son contrat dans le manifeste, sinon la suivante d'une palette
(`builderColors.ts`). L'utilisateur la change dans *Settings → Plugins* (sélecteur sur la carte du
plugin, ↶ pour revenir à celle du builder) ; le choix est gardé par navigateur.

Un module de plugin `viewBuilder` exporte
`{ viewBuilders: { "<id>": { perspectives | fetchPerspectives, dataSource? } } }`.

## 5. Le LLM et l'agent de création de widgets

- Les prompts ne décrivent plus les widgets à la main : `renderWidgetDocs(catalogue)` concatène les
  `llmDoc` **des widgets actifs seulement** (un widget désactivé n'est jamais proposé).
- Le frontend envoie le catalogue actif avec chaque génération :
  `widgets: { types: [...intégrés actifs], external: [...contrats des plugins] }`.
- Le BFF valide la réponse contre ce catalogue (`checkWidgetsAgainstCatalog`) : type actif,
  et pour un widget de plugin, son `jsonSchema`. L'erreur repart dans le tour de réparation.
- Les ports sont documentés au LLM (`renderPortDocs`) : il sait relier une sortie à une entrée
  avec `@<widgetId>`.
- **Agent de widget** (`features/widget-assistant`) : il reçoit en plus la liste des autres widgets
  de la vue (id, type, sorties) pour pouvoir se brancher sur l'un d'eux, et valide la proposition
  contre le catalogue du frontend avant de l'appliquer.

## 6. Écrire un plugin de widgets

```js
// index.js — pas de bundler requis : React et antd sont fournis par fluid
export default function plugin(host) {
  const { React, antd, useWidgetTheme } = host;
  function TagCloud({ widget, data, emit }) {
    const theme = useWidgetTheme(widget.type);
    /* … */ emit('selected', row);
  }
  return { widgets: { 'tagcloud/cloud': { Render: TagCloud } } };
}
```

Exemples servis par le frontend : `apps/frontend/public/plugins/` (`tagcloud`, `nord-theme`).
Installer `/plugins/tagcloud/manifest.json` depuis *Settings → Plugins* pour essayer.

## 7. Où vit le code

| Élément | Où |
| --- | --- |
| Contrats, ports, collections intégrées, docs LLM, validation de catalogue | `packages/shared/src/plugins/` |
| Thèmes intégrés, schéma de manifeste | `apps/frontend/src/entities/plugin/` |
| API de rendu (`WidgetProps`, `useWidgetRenderer`, `useWidgetTheme`, sorties) | `apps/frontend/src/views/plugin-api/` (moteur) |
| Plugins intégrés, store, chargeur, hooks, runtime | `apps/frontend/src/entities/plugin/` |
| View Builders intégrés (curated, auto, Spec-Fluid) | `apps/frontend/src/entities/plugin/builders/` |
| Perspectives d'une colonne (vues enregistrées + View Builders) | `apps/frontend/src/entities/view/` |
| `DataSource`, `DataSourcesContext` | `apps/frontend/src/views/plugin-api/dataSources.ts` (moteur) |
| Documents Spec-Fluid (zod) | `packages/shared/src/specFluid.ts` |
| Écran *Settings → Plugins* | `apps/frontend/src/features/plugin-manager/` |
| Prompts | `apps/bff/src/llm/` (consomment `renderWidgetDocs`) |

Le moteur (`views/`) ne dépend pas des plugins : il expose des contextes que l'app remplit.

## 8. Étapes

| # | Contenu | État |
| --- | --- | --- |
| 1 | Contrats + ports, collections intégrées, thèmes en plugins, sorties `@id`, Settings → Plugins (activer / installer par URL), prompts générés, catalogue envoyé au BFF, agent de widget | ✅ |
| 2 | Déplacer chaque widget intégré dans `catalog/<type>/` (contrat + renderer + exemple + test côte à côte) | à faire |
| 3 | Registre distant : une page web qui liste des manifestes, installable en un clic | à faire |
| 4 | Isolation optionnelle des modules tiers (iframe sandbox) | à étudier |
| 5 | Trois types de plugins (thème, widget, View Builder), sources de données non GraphQL, Spec-Fluid | ✅ |
| 6 | Bus entre colonnes (suivre / figer / surligner, comme `MiBus` de MooseIDE) | à faire |

## 9. Autres types de plugins envisageables

À discuter : sections de la barre latérale, actions sur une perspective (export CSV…), formats de
cellule (`format`), fournisseurs LLM. Les sources de données et les gabarits de vues sont couverts
par les View Builders (§4 bis).
