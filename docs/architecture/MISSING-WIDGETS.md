# Widgets manquants

> Statut : en cours (2026-10-26). Issus de l'étude des vues Pharo/Moose (inspecteurs
> `<inspectorPresentationOrder:title:>`, navigateurs MooseIDE, `Famix-Visualizations`) comparées au
> catalogue de fluid. Chaque section est un brief autonome pour l'agent `widget-creator`.

## Règles communes à tous les widgets

- Widget **intégré** : schéma zod dans `packages/shared/src/widgets/<type>.ts`, contrat (label,
  description, `llmDoc`, ports) dans `packages/shared/src/plugins/contracts.ts`, renderer dans
  `apps/frontend/src/views/widgets/<type>/`, enregistré dans `catalog.tsx`, `widgetInfo.tsx`,
  `defaults.ts`, ajouté à sa **collection** (voir chaque section), exemple de référence testé
  dans `catalog.test.ts`. Conventions : celles de `classDiagram` (commit a3a1b79) et `specPresenter`.
- **Générique, pas Moose-only** : le widget lit des lignes GraphQL quelconques via `data`
  (`DataBinding` : `query`, `path`, `transform`) et des **chemins de champs** (dot paths, comme
  `field` / `superField` de `classDiagram`). Moose est le cas d'usage, pas une dépendance.
- **Navigation** : un élément qui représente une ligne ouvre la colonne suivante via `linkTo`
  (`{ concept, idField }`, voir `useLinkHref` dans `navigation/columnPath.ts`, et
  `linkTargetConcept` pour `__typename`). Sortie `selected` (la ligne cliquée) sur `emit`.
- **Thème** : couleurs uniquement via `useWidgetTheme(type)` (palette `series`, encres, surfaces),
  dégradés calculés à partir des jetons ; clair et sombre.
- **Taille** : `sizing: 'chart'` si le widget remplit sa cellule ; au-delà d'un seuil (indiqué par
  section), afficher un message « trop d'éléments, filtrez » plutôt que geler la page ; calcul de
  disposition lourd dans `model.ts` (pur, testé) ou un Web Worker comme `network`.
- **CLAUDE.md** : composants ≤ 150 lignes et ≤ 7 props, ≤ 3 `style={{}}` par fichier, `.ts` ≤ 250
  lignes, pas de `any`, logique pure dans `model.ts` + `model.test.ts`, entrée validée par zod.
- **Fini** = `pnpm -r typecheck`, `pnpm test`, `node scripts/arch-metrics.mjs` sans nouvelle
  violation ; une phrase dans `docs/architecture/PLUGINS.md` (§2, liste des collections).

---

## 1. `matrix` — matrice de dépendances (DSM, co-usage, heat map)

**Couvre** : DSM (`MiDSMBrowser`), Co-usage map (`MiCoUsageMapBrowser`), Heat map
(`MiHeatMapBrowser`). **Collection** : `fluid-graphs`.

**Données** : des lignes, chacune un élément ; ses dépendances sont un champ liste.
- `rowsField?` : chemin vers les éléments (sinon les lignes elles-mêmes) ;
- `idField` (défaut `id`), `labelField` (défaut `name`), `groupField?` (ex. `parentPackage.name`)
  pour regrouper et trier les axes par groupe ;
- `targetsField` : chemin vers la liste des cibles d'une ligne (ex. `outgoingInvocations.candidates`),
  chaque cible identifiée par `targetIdField` (défaut `id`) ;
- `weightField?` : poids d'une dépendance quand les cibles sont des objets association
  (sinon chaque occurrence compte 1, les doublons s'additionnent).
- Option `columns?: "same" | "targets"` : `same` (DSM carrée, mêmes éléments en lignes et colonnes,
  défaut) ou `targets` (co-usage : lignes = conteneurs, colonnes = éléments utilisés).

**Rendu** : grille de cellules colorées selon le poids (échelle séquentielle depuis la palette du
thème), libellés des lignes à gauche et des colonnes en haut (verticaux), bandes de groupes. En DSM,
diagonale grisée et **cycles** (i→j et j→i) marqués d'une couleur d'alerte. Tri : ordre d'origine,
par nom, par groupe, ou par poids total. Survol : infobulle « A → B : n ». Jusqu'à ~300×300 en
canvas ou SVG ; au-delà, message.

**Interactions** : clic sur une cellule → `selected` = `{ source, target, weight }` (les deux
lignes) ; clic sur un libellé → navigation `linkTo` vers l'élément, `selected` = la ligne.

**llmDoc** : à utiliser pour « qui dépend de qui » entre paquets/classes/modules, quand un graphe
serait illisible ; préférer `network` sous ~50 nœuds peu denses.

---

## 2. `boxes` — vue polymétrique et treemap

**Couvre** : System Complexity (`FamixTypeGroupSystemComplexity`, `MiSystemComplexityBrowser`),
Package complexity, Nesting (`FamixTypeGroupNesting`), Distribution map
(`MiDistributionMapBrowser`), Architectural map. **Collection** : `fluid-software-maps`.

**Données** : des lignes, une boîte chacune.
- `idField`, `labelField` ;
- `widthField?`, `heightField?` : métriques numériques donnant la taille (ex. `numberOfAttributes`,
  `numberOfMethods`) ; absentes → taille fixe ;
- `colorField?` : métrique (dégradé clair→foncé) **ou** valeur catégorielle (palette `series`,
  légende) — détecté sur les valeurs, forçable par `colorScale?: "sequential" | "categorical"` ;
- `parentField?` : chemin vers l'id du parent (hiérarchie, ex. `superclass.id` pour l'héritage)
  → disposition **arbre** (System Complexity) ;
- `groupField?` : chemin vers un conteneur (ex. `parentPackage.name`) → boîtes **regroupées** dans
  des cadres titrés (Distribution map / Architectural map) ;
- `layout`: `"tree" | "flow" | "treemap"` (défaut : `tree` si `parentField`, sinon `flow`) ;
  `treemap` utilise `sizeField` (aire) et imbrique les groupes (Nesting).

**Rendu** : SVG ; boîtes à bordure fine, arêtes parent→enfant orthogonales en `tree`, légende des
couleurs (min/max ou catégories), zoom/pan simple (molette + glisser) au-delà de l'écran. Jusqu'à
~2 000 boîtes ; au-delà, message.

**Interactions** : survol → infobulle (libellé + valeurs des métriques avec leur nom) ; clic →
`linkTo` + `selected` = la ligne ; option de surligner les boîtes d'un même groupe au survol.

**llmDoc** : « vue polymétrique » : comparer des éléments sur 2–3 métriques à la fois (taille,
couleur) avec leur hiérarchie ou leur conteneur ; l'exemple canonique est classes ×
attributs/méthodes/lignes de code avec l'héritage.

---

## 3. `butterfly` — dépendances entrantes / sortantes d'un élément

**Couvre** : Butterfly map (`MiButterflyMapBrowser`), une partie de System Attraction.
**Collection** : `fluid-graphs`.

**Données** : **un** élément central (vue de détail : `data` pointe sur l'objet), et :
- `incomingField` : chemin vers ses dépendants (ex. `incomingInvocations.sender`) ;
- `outgoingField` : chemin vers ses dépendances (ex. `outgoingInvocations.candidates`) ;
- `labelField`, `idField`, `groupField?` (couleur par conteneur) ;
- `depth?` (1 ou 2, défaut 1) : à 2, les mêmes champs sont suivis sur les voisins **si la requête
  les a sélectionnés** (le widget ne fait pas de requête) ; un voisin au niveau 2 absent est ignoré.

**Rendu** : SVG ; l'élément au centre, les entrants en colonne(s) à gauche, les sortants à droite,
flèches vers la droite, épaisseur selon le nombre d'occurrences (doublons agrégés), libellés
tronqués avec infobulle. Compteurs « n entrants / m sortants » en en-tête. Au-delà de ~60 voisins
par côté : regrouper par `groupField` (une boîte « paquet (k) ») ou message.

**Interactions** : clic sur un voisin → `linkTo` (ouvre ce voisin : on « navigue » de papillon en
papillon) + `selected`.

**llmDoc** : vue de détail d'un élément quand la question est « qui m'appelle / qui j'appelle ».

---

## 4. `blueprint` — Class Blueprint

**Couvre** : `FamixTType>>miInspectionBlueprint:` (`CBView`, MooseIDE-ClassBlueprint).
**Collection** : `fluid-software-maps`.

**Données** : une classe (vue de détail) et :
- `methodsField` (ex. `methods`), `attributesField` (ex. `attributes`), `labelField` ;
- pour chaque méthode, `callsField` (méthodes de la même classe qu'elle appelle, par id),
  `accessesField` (attributs qu'elle lit/écrit, par id), et des indicateurs facultatifs
  `isConstructorField`, `isAccessorField` (getter/setter), `isPublicField` (sinon
  déduits : constructeur = appelé par personne de la classe et nommé comme `initialize*`/`<init>`,
  accesseur = n'accède qu'à un attribut et ≤ 2 instructions si `linesField` présent),
  `sizeField?` (lignes → hauteur de la boîte), `isAbstractField?`, `isOverridingField?`.

**Rendu** : cinq colonnes, comme le Blueprint Moose : **Initialisation**, **Interface externe**
(publiques appelées de l'extérieur ou non appelées en interne), **Implémentation interne**,
**Accesseurs**, **Attributs** ; chaque méthode est une petite boîte (hauteur = taille, couleur selon
le type : abstraite, redéfinie, accesseur…), arêtes des appels internes (vers la droite) et des
accès aux attributs ; légende des couleurs. Au-delà de ~300 méthodes : message.

**Interactions** : survol d'une méthode → met en évidence ses appels et accès ; clic → `linkTo`
vers la méthode/l'attribut + `selected`.

**llmDoc** : structure interne d'une classe (cohésion, couches, accès aux attributs) ; uniquement
en vue de détail d'une classe dont la requête ramène méthodes et attributs avec leurs liens.

---

## 5. `sankey` — flux entre groupes

**Couvre** : dépendances agrégées entre paquets/couches (Layer visualisation,
`MiLayerVisualizationBrowser`), migrations, tout flux pondéré. **Collection** : `fluid-charts`.

**Données** : des lignes **liens** : `sourceField`, `targetField` (libellés ou ids),
`valueField?` (défaut 1, les doublons s'additionnent) ; ou bien des lignes éléments avec
`groupField` + `targetsField` + `targetGroupField` (le widget agrège élément→élément en
groupe→groupe, utile car les API ne servent pas l'agrégat). Option `nodeOrder?` (liste) et
`columns?` (affecter un groupe à une colonne, pour les couches).

**Rendu** : SVG, nœuds en colonnes, rubans d'épaisseur proportionnelle, couleur du nœud source
(palette `series`), cycles tolérés (lien retour dessiné en arc sous la figure, signalé). Disposition
calculée dans `model.ts` (pas de dépendance lourde ; `d3-sankey` acceptable s'il est déjà léger).

**Interactions** : survol d'un ruban → « A → B : v » ; clic sur un nœud → `selected` =
`{ group, rows }` (les lignes de ce groupe) ; clic sur un ruban → `selected` = `{ source, target,
value, rows }`.

**llmDoc** : flux pondérés entre peu de groupes (≤ ~40 nœuds) ; pour de nombreux éléments
individuels préférer `matrix`.

---

## 6. `pyramid` — Overview Pyramid

**Couvre** : `OverviewPyramid` (Lanza & Marinescu). **Collection** : `fluid-software-maps`.

**Données** : un objet (le modèle ou un paquet) portant les métriques par champs configurables,
avec ces clés de config (toutes facultatives, une métrique absente laisse sa brique vide) :
`nop` (paquets), `noc` (classes), `nom` (méthodes), `loc`, `cyclo`, `calls` (appels),
`fanout`, `andc` (descendants moyens), `ahh` (hauteur d'héritage moyenne). Chaque clé est un
chemin de champ ; on peut aussi donner `rows` + agrégation (`count`/`sum`/`avg` sur un champ des
lignes) pour les calculer côté widget à partir de listes.

**Rendu** : la pyramide classique à trois parties — **taille & complexité** (gauche : NOP, NOC,
NOM, LOC, CYCLO, en escalier), **couplage** (droite : CALLS, FANOUT), **héritage** (haut : ANDC,
AHH) — avec les valeurs brutes et les **ratios** (NOC/NOP, NOM/NOC, LOC/NOM, CYCLO/LOC, CALLS/NOM,
FANOUT/CALLS) colorés bas/moyen/haut selon des seuils par défaut (Java, ceux de l'article)
surchargeables par `thresholds?`. Légende des couleurs.

**Interactions** : survol d'une brique → nom complet de la métrique et seuils ; pas de navigation.

**llmDoc** : synthèse d'un système ou d'un paquet en une figure ; uniquement si les métriques sont
disponibles (ou calculables à partir des listes).
