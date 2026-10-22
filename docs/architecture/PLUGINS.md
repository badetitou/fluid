# Système de plugins de fluid

> Statut : **étape 1 livrée** (2026-10-22). Ce document fixe l'API des plugins, celle des widgets,
> et ce qu'il reste à faire. Il prolonge `REARCHITECTURE.md` §4 (« un widget = un dossier »).

## 1. Pourquoi

Chaque nouveau widget ou thème grossissait le cœur : schéma zod dans `view-spec.ts`, renderer dans
`catalog.tsx`, doc écrite à la main dans **trois** prompts (`prompt.ts` ×2, `claudePrompt.ts`),
palette codée en dur dans `theme.ts`. On divise : le cœur ne connaît plus que des **contrats**,
et ce qui les remplit vient de **plugins** que l'utilisateur active, désactive ou installe.

## 2. Ce qu'est un plugin

Un plugin a un **manifeste** (JSON, validé par zod) et, optionnellement, un **module** (code).
Il *contribue* des éléments typés ; aujourd'hui deux types de contribution :

| Contribution | Contenu | Code ? |
| --- | --- | --- |
| `themes` | jetons de couleur, polices, rayon, palette de séries, surcharges par widget | non (JSON pur) |
| `widgets` | une collection de types de widgets : contrat (schéma, doc LLM, ports) + renderer | oui (module ESM) |

Un plugin peut contribuer les deux. D'autres types de contribution s'ajouteront à côté de
`themes` et `widgets` dans `contributes` (cf. §9), sans changer le reste.

```jsonc
// https://exemple.org/plugins/tagcloud/manifest.json
{
  "id": "tagcloud",                     // [a-z0-9-], unique ; préfixe des types de widgets
  "name": "Tag cloud",
  "version": "1.0.0",
  "description": "…",
  "module": "./index.js",               // relatif au manifeste ; requis si `widgets`
  "contributes": {
    "themes": [ ThemeDefinition, … ],
    "widgets": [ WidgetContract, … ]
  }
}
```

### Sources

- **Intégrés** (`builtin`) : livrés avec fluid, désactivables, jamais supprimés.
  Les 13 widgets historiques sont répartis en 4 collections (`essentials`, `charts`, `code`,
  `structure`) et le thème badetitou devient un plugin, à côté de deux autres thèmes. Une 5ᵉ
  collection, `fluid-3d` (`model3d`, `scene3d`, three.js chargé à la demande), affiche des éléments IFC.
  Une 6ᵉ collection, `fluid-graphs` (« Graphs »), apporte le widget `network` (graphe
  nœuds-arêtes en WebGL avec sigma + graphology, pour des milliers de nœuds).
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

## 9. Autres types de plugins envisageables

À discuter : sources de données (autre chose que GraphQL), sections de la barre latérale,
actions sur une perspective (export CSV…), formats de cellule (`format`), fournisseurs LLM,
gabarits de vues (dashboards prêts à l'emploi par schéma connu).
