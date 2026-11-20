# Pistes d'innovation et d'intégration pour fluid

> Veille du 2026-11-17. 15 sous-agents (haiku), en deux vagues, sur 15 axes : Glamorous Toolkit et lignée
> Smalltalk, UI générative, logiciel malléable, marché des générateurs de dashboards, MCP, données
> industrielles, analyse logicielle, NL2VIS, navigation, actions durables, sources universelles, plugins,
> enrichissement sémantique, et des compléments ciblés sur l'industriel et GT/Moose.
> **Limite** : la recherche web a été bridée (quota) sur la première vague ; ce qui n'a pas été vérifié est
> signalé (§7). Rien ici n'est une issue : ce sont des pistes à valider.

## 0. Ce que la veille confirme sur la position de fluid

- **Le créneau est libre.** Retool, Databricks Genie et Tableau Pulse gardent le LLM *dans la boucle
  d'exécution*. Palantir (Ontology + Action Types + AIP), le plus proche conceptuellement, exige une
  ontologie montée à la main et reste réservé aux grands comptes. Personne ne propose : *schéma GraphQL
  introspecté comme socle* + *navigation d'inspecteur* + *vue rejouée sans LLM*.
- **La thèse a un manifeste.** L'essai *Malleable Software* d'Ink & Switch (juin 2025) dit presque mot pour
  mot la vision de fluid : pente douce de personnalisation, outils qui se composent, IA *dans* un
  environnement malléable plutôt que générateur isolé.
- **Les standards convergent vers ce que fluid fait déjà.** A2UI (Google) génère depuis un *catalogue de
  composants déclaré* (= nos contrats de widgets), MCP Apps livre l'UI dans une iframe sandboxée
  (Claude, ChatGPT, VS Code, M365 Copilot). fluid a la première moitié, il lui manque la seconde.
- **Le point faible de « pour toujours »** : aujourd'hui une vue enregistrée est `{concept, title, spec}`
  (`apps/bff/prisma/schema.prisma`). Ni intention, ni schéma de référence, ni exemple, ni version. Si l'API
  change, la vue casse en silence.

## 1. Thèse proposée : l'intention est le code source, la ViewSpec est le binaire

Pour que « on demande une fois, ça marche pour toujours » soit vrai, il faut traiter la génération comme
une **compilation** :

| Artefact | Rôle | Inspiration |
| --- | --- | --- |
| **Intention** (la demande + le contexte) | le source, ce qu'on garde vraiment | Data Formulator, Jelly (CHI'25) |
| **ViewSpec** | le binaire, exécuté sans LLM | — (existe) |
| **Exemples** (réponse type + assertions) | les tests | `gtExample`, VisEval |
| **Annotations sémantiques** du schéma | les types | Sherlock/Doduo, lentilles Fresnel |
| **Empreinte du schéma** au moment de la génération | la cible de compilation | Hive App Deployments |

Cycle : *compiler* (LLM, une fois) → *exécuter* (sans LLM, toujours) → *détecter la dérive* (sans LLM) →
*recompiler* depuis l'intention, avec les exemples comme oracle → *l'humain valide le diff*.
La plupart des pistes ci-dessous sont des morceaux de ce cycle.

---

## 2. Les pistes

Notation : **Impact** / **Effort** de 1 à 3. *Accroche* = où ça se branche dans fluid aujourd'hui.

### A. Durabilité des vues

**A1. Exemples comme tests de vue** — I3 / E2
Chaque vue enregistrée garde un échantillon de réponse et des assertions de forme (champs liés présents,
types, non-vide). Au rechargement ou après un changement de schéma, on rejoue : *validité* (la requête
compile contre le schéma), *légalité* (champs liés présents et typés), *lisibilité* (bornes de layout),
découpage repris de VisEval. *Inspiration* : `gtExample` (exemples = docs + tests), VisEval (arXiv 2407.00981).
*Accroche* : `graphql` v17 est déjà dans le frontend (`validate()` statique) ; table `View` à enrichir.
*À investiguer* : combien de vues cassent entre deux versions réelles d'un modèle Moose ou d'une API publique ?

**A2. Détection de dérive + réparation bornée** — I3 / E2
Empreinte d'introspection par source ; diff classé *breaking / dangerous / safe* (graphql-inspector) ;
seules les vues touchées sont signalées (badge sur la perspective). Réparation : le LLM reçoit le diff et
les diagnostics, propose un patch minimal, re-validé statiquement, **montré en diff, jamais appliqué seul**.
*Inspiration* : graphql-inspector, Hive App Deployments (GA mars 2026 : opérations persistées par version
d'app vérifiées contre le schéma), Cambria (lentilles entre versions de schéma).
*Note* : aucune publication sur la réparation de requêtes GraphQL par LLM ; c'est mesurable chez nous.

**A3. Garder l'intention, pouvoir recompiler** — I2 / E1
Stocker la demande, le fil du chat (`buildViewSeed` existe déjà) et le modèle utilisé à côté de la spec.
Permet A2, la recompilation sur une autre source, et la traçabilité (« pourquoi cette vue existe »).

**A4. Documents persistés (trusted documents)** — I2 / E1
Une vue référence ses opérations par hash ; le BFF n'exécute que des opérations connues. Prérequis de
sécurité pour exposer des vues ailleurs (F1, F2) ou les partager (G3).

**A5. Couches et versions** — I2 / E2
Séparer la vue *de base* (générée) des *couches* de l'utilisateur (renommage, filtre, widget masqué) :
régénérer la base n'écrase pas les retouches. Historique, brouillons, `forkedFrom`.
*Inspiration* : *Gradual generation of UIs* (arXiv 2601.17975), Patchwork (Ink & Switch).

### B. Une couche sémantique qui émerge du schéma

**B1. Annotations sémantiques éditables** — I3 / E2 ⭐
Pour chaque `Type.champ` : rôle (libellé, identifiant, statut, date, géo, unité, quantité, lien externe).
Le LLM *propose* une fois par source, l'utilisateur *confirme*, c'est versionné et stocké côté BFF.
C'est l'ontologie de Palantir, mais **déduite de l'introspection au lieu d'être construite à la main**.
Ça nourrit les prompts (moins d'hallucinations de champs), les vues automatiques et B2/B3.
*Inspiration* : Sherlock/Doduo/ArcheType (annotation de colonnes), rôles sémantiques Tableau, RIGOR (ontologie
depuis un schéma relationnel, arXiv 2506.01232).
*Pour l'industriel* : le **bSDD** de buildingSMART expose classes et propriétés IFC (avec unités) en
GraphQL (`test.bsdd.buildingsmart.org/graphql`) : une source d'annotations toute faite pour le BIM.

**B2. Choix de widget déterministe** — I2 / E2
Des règles (type sémantique, cardinalité, nombre de lignes) donnent les widgets *admissibles* pour une
requête ; le LLM choisit parmi eux, et les vues automatiques s'améliorent **sans LLM**.
*Inspiration* : Draco (contraintes ASP sur Vega-Lite, successeur `cmudig/draco2`), étape « résumer puis
proposer des buts » de LIDA.

**B3. Vues par rôle ou par standard, donc portables** — I3 / E3 ⭐
Une vue liée à des *rôles* (« un équipement avec statut et position ») plutôt qu'à un nom de type GraphQL se
réapplique sur un autre site ou une autre API. Pour les standards c'est décisif : vues pour les sous-modèles
**AAS**, pour les classes **IFC**, pour le métamodèle **Famix** (commun à Java, TypeScript, Pharo). Base d'une
bibliothèque partagée de vues. *Inspiration* : lentilles Fresnel (`fresnel:defaultLens` par classe), Phlow.

**B4. Les backends livrent leurs propres perspectives (« Remote Phlow » généralisé)** — I3 / E2 ⭐
GT laisse Python ou JS déclarer des vues (`@gtView` dans `gtoolkit_bridge`) que l'inspecteur affiche.
fluid le fait déjà pour Pharo avec Spec-Fluid. Proposer un **protocole ouvert** : un endpoint connu
(ex. `/.well-known/fluid/views?type=…`) qui rend des ViewSpec (ou des onglets) pour un type, et qu'un
`viewBuilder` générique consomme. Une équipe métier publie ses perspectives *avec* son API.
Les vues voyagent avec les données, sans plugin à écrire.
*Statut : **fait dans Open Views** (2026-11, epic badetitou/fluid#44)* : protocole « fluid Open Views » v1
([`OPEN-VIEWS.md`](../architecture/OPEN-VIEWS.md)), builder générique `open-views`, l'image Pharo
(`SFServer`, projet Spec-Fluid) comme premier fournisseur, [exemple de fournisseur Node](../examples/open-views-provider/).

### C. Pente douce pour l'utilisateur final

**C1. Chaque retouche LLM laisse un contrôle** — I2 / E2
Quand l'utilisateur demande « seulement 2025 » ou « en barres », le paramètre modifié devient un
contrôle persistant de la vue : la prochaine fois, pas besoin du LLM.
*Inspiration* : DynaVis (CHI 2024 Best Paper), Biscuit (UI éphémères qu'on épingle).

**C2. Réutiliser avant de générer** — I2 / E1
Avant d'appeler le LLM, chercher dans les vues enregistrées (même concept, concept voisin, autre source) et
les proposer ; s'en servir comme exemples dans le prompt. *Inspiration* : « verified answers » de Genie,
constat de *Generative Interfaces for LMs* (arXiv 2508.19227) : on génère trop souvent des UI inutiles.

**C3. Voir ce que reçoit un widget** — I1 / E1
Un panneau qui montre les données exactes liées à un widget, à côté du rendu, pour comprendre une
liaison cassée sans ouvrir le JSON. *Inspiration* : `present!` de Clerk, Portal.

### D. Des actions qui durent

**D1. Spécification d'action complète** — I3 / E2
Étendre `actions` : préconditions (prédicat évaluable par requête), **dry-run** (aperçu de l'effet ou du
nombre d'objets touchés), confirmation, rôle requis, journal d'exécution (qui, quand, version, entrées).
*Inspiration* : Palantir Action Types (changement transactionnel nommé, typé, avec règles de soumission).

**D2. Contrôles et surveillances (« checks ») : une demande, une règle permanente** — I3 / E2 ⭐
Un *check* = requête + prédicat + vue des violations + action proposée. Il tourne au chargement, sur
planning ou sur abonnement, et ses résultats s'affichent en **pastilles dans les colonnes Miller**.
Ça unifie les trois cas d'usage :
- **Moose** : règles d'architecture (couches, cycles, code mort), comme jQAssistant ou les critiques de Moose ;
  les règles de `CLAUDE.md` de fluid lui-même feraient une démo parfaite ;
- **industriel** : seuils, alarmes, équipement sans maintenance depuis N jours ;
- **données** : complétude, doublons.
Le LLM écrit le prédicat une fois ; l'évaluation est du code pur (`model.ts` + test).

**D3. Approbation et workflows courts** — I2 / E3
Une étape « en attente de validation » avant une mutation, avec le contenu exposé à l'opérateur. N'aborder
qu'après D1/D2. *Inspiration* : `interrupt()` de LangGraph, blocs d'AIP Logic.

**D4. Rapports planifiés** — I1 / E2
Le widget `insight` sur un planning, résultat envoyé ou archivé. Utile mais dépend d'un exécuteur côté BFF.

### E. Navigation

**E1. Bus entre colonnes, avec sélections-prédicats** — I3 / E2
L'étape 6 de `PLUGINS.md` (suivre / figer / surligner, façon MiBus). Proposition concrète : la sélection
circule comme un **prédicat** (`champ op valeurs`), pas comme une liste d'id. Elle survit au rechargement et
à la dérive, et elle se réapplique sur une autre source. *Inspiration* : sélections de Mosaic (UW, 2024).

**E2. Pivot d'ensemble avec comptes, facettes en tête de colonne** — I2 / E2
Sur une colonne, choisir un type de lien en voyant d'avance les comptes (« 34 dépendances, 12 appelants »),
et ouvrir la colonne suivante sur **tout l'ensemble lié**, pas un seul objet. Facettes avec comptes et
filtres en pastilles. *Inspiration* : Palantir Vertex / Object Views, facettes de Datasette.

**E3. Piste d'exploration rejouable → récit** — I3 / E2 ⭐
Enregistrer le chemin (type, lien, filtre, perspective) et le rejouer, le partager, ou le **transformer en
page** : une suite de perspectives commentées, à la Lepiter, qui devient un rapport d'analyse Moose ou un
compte rendu d'incident industriel. *Inspiration* : patterns *Composed Narrative* et *Project Diary* du
catalogue *Moldable Development* (Nierstrasz & Gîrba, EuroPLoP 2024, arXiv 2409.18811).

**E4. Canevas spatial de colonnes épinglées** — I1 / E3, à garder en réserve.

### F. fluid partout, tout dans fluid

**F1. fluid comme serveur MCP** — I3 / E2 ⭐
Exposer : `list_views`, `run_view` (données), `create_view_draft` (validé par les mêmes zod et
catalogue que l'assistant), et les actions enregistrées en *outils* soumis à liste blanche. Claude Code ou
tout agent peut alors **construire des dashboards pour l'utilisateur** et réutiliser ses vues.
*Inspiration* : Apollo MCP Server (une opération = un outil). Auth : OAuth 2.1 + jetons à audience
(RFC 8707), à faire en même temps (fluid n'a pas d'auth).

**F2. Vues fluid dans Claude, ChatGPT, VS Code (MCP Apps)** — I3 / E2
Un outil MCP dont `_meta.ui.resourceUri` sert le moteur de rendu et la ViewSpec enregistrée, en iframe
sandboxée. Le moteur (`views/`) n'importe ni `features/` ni `components/`, il est donc presque prêt à être
empaqueté seul. Même profil MIME chez OpenAI (`text/html;profile=mcp-app`). **Détaillé en annexe A.**

**F3. Sources au-delà de GraphQL** — I3 / E2
- **DuckDB-WASM** : on dépose un CSV, Parquet ou JSON, chaque table devient un concept, sans serveur ni
  fuite de données. Premier adaptateur non-GraphQL du « concept » généralisé.
- **GraphQL Mesh dans le BFF** : on colle une URL OpenAPI, le BFF en fait un sous-graphe que fluid
  introspecte. Ouvre d'un coup les API REST industrielles (AAS/BaSyx Part 2, Eclipse Ditto, HighByte).
- **Serveurs MCP comme sources** : plus tard ; risque d'injection de prompt via les sorties d'outils.

**F4. Abonnements GraphQL (widgets en direct)** — I3 / E2
fluid n'en a aucun aujourd'hui. Prérequis pour l'industriel (D2 sur événement, tableaux de bord
d'atelier) et utile pour Speckle. `graphql-ws` / `graphql-sse`.

**F5. Contrats exportables** — I2 / E1
Générer le JSON Schema des contrats zod : sert de catalogue A2UI, de schémas d'entrée d'outils MCP et de
doc publique. Exporteur ViewSpec → A2UI ensuite.

**F6. En-têtes d'auth par connexion** — I3 / E1
Déjà repéré dans `MUTATIONS.md` comme « étape à part ». Bloquant pour toute API industrielle réelle
(Cognite en OIDC, Speckle avec jeton, bSDD sécurisé). **Conception OAuth : [`oauth-conception.md`](oauth-conception.md).**

### G. Écosystème de plugins

**G1. Bac à sable pour widgets tiers et générés** — I2 / E3
Iframe d'origine nulle et `postMessage` validé par zod ; données fournies par l'hôte, pas de `fetch`.
**Leçon de Figma** : leur bac à sable « Realms » a été percé puis remplacé par une VM en Wasm ; ne pas
compter sur SES/ShadowRealm (encore au stade 2.7) comme frontière. Pour l'agent `widget-creator`, ça
permettrait d'installer un widget généré sans risque.

**G2. Registre** — I2 / E2
Index Git de manifestes pointant vers des versions taguées et hachées ; niveaux non revu / communauté /
vérifié (Grafana, Obsidian, Open VSX). Les plugins générés par IA partent en « non revu ».

**G3. Partage de vues** — I3 / E1
Permalien, export et import JSON, `forkedFrom`, et un « views as code » (dossier de vues dans un dépôt Git,
synchronisé). Le local-first à base de CRDT (Automerge, Yjs) viendra plus tard.

---

## 3. Par cas d'usage

### Moose / analyse logicielle
- **Source SCIP → concepts** : explorer *n'importe quel dépôt* (TS, Java, Python, Rust…) sans image Pharo,
  à partir d'un `index.scip` ; ajouter le *churn* Git pour des hotspots à la CodeScene. Porte d'entrée légère
  vers fluid, Moose restant la voie riche.
- **Ville logicielle 3D** (CodeCharta, CodeCity) : un widget à trois métriques (surface, hauteur, couleur)
  qui réutilise three.js de la collection `fluid-3d`. Pont entre les cas 3D et Moose.
- **Checks d'architecture** (D2) avec pastilles dans les colonnes.
- **Récupération d'architecture par LLM** (ArchAgent arXiv 2601.13007, SemRef ICSE 2026) : le LLM propose
  des regroupements, qu'on garde comme **annotations ou tags** (B1), puis vues et export C4/Structurizr.
- Catalogue **Backstage** via son module GraphQL (Frontside) : propriété et dépendances de services.

### Industriel / gestion de données
- **Démo la plus rapide** : **Speckle** (`app.speckle.systems/graphql`, requêtes, mutations, abonnements
  WebSocket avec jeton) donne GraphQL, temps réel et 3D d'un coup. Il faut F4 et F6.
- **OPC UA / MQTT → GraphQL** : `automation-gateway` (vogler75, Docker `rocworks/automation-gateway`, GPL-3)
  sert OPC UA, MQTT et PLC4X en GraphQL. Démo d'atelier locale possible aujourd'hui (abonnements à tester).
- **Cognite Data Fusion** génère un GraphQL à partir de ses modèles de données (requêtes et mutations,
  OIDC) : cible naturelle, mais l'essai n'est ouvert qu'aux employés Cognite.
- **AAS** (sous-modèles en REST Part 2) via Mesh (F3) : la hiérarchie AAS colle aux colonnes Miller.
- **bSDD** comme annotations sémantiques des propriétés IFC (B1), **IFC5 / IFCx** (JSON, alpha) à surveiller
  pour le widget 3D.

### 3D
CodeCity pour Moose, IFC enrichi par le bSDD, Speckle en direct : trois démos qui partagent la même collection.

---

## 4. Idées plus spéculatives

- **Marché de vues par standard** (suite de B3) : « les vues AAS de la communauté », « les vues Famix ».
- **Le LLM comme critique de dashboard** : le widget `insight` signale aussi ce que la vue *cache* (pattern
  *Blind Spot* de feenk) et propose une perspective manquante.
- **Mode « atelier »** : présentation plus abonnements plus checks, sur un écran mural, sans LLM.
- **Agent de maintenance nocturne** : chaque nuit, dérive, réparations proposées et nouvelles annotations,
  rassemblées dans une boîte de validation.

## 5. Priorisation proposée

| # | Piste | Pourquoi d'abord | Prérequis |
| --- | --- | --- | --- |
| 1 | **A1 + A2 + A3** durabilité (exemples, dérive, intention) | rend le « pour toujours » crédible ; tout le reste s'appuie dessus | — |
| 2 | **B1** annotations sémantiques (+ B2) | améliore la génération et les vues automatiques ; socle de B3 | — |
| 3 | **D2** checks avec pastilles | la fonction « une demande, une règle permanente » la plus visible ; démo Moose sans dépendance | — (D1 pour l'action) |
| 4 | **F1 → F2** fluid serveur MCP puis MCP Apps | met fluid là où sont les utilisateurs et les agents | A4, F6, une auth minimale |
| 5 | **B4** protocole de perspectives livrées par le backend (**fait** : Open Views, #44) | simplifie l'intégration de tout système métier ; généralise Spec-Fluid | — |
| démo | **F4 + F6 + Speckle** | démo industrielle et 3D en direct | — |

Gains rapides (E1) : C3 (voir les données d'un widget), F5 (JSON Schema des contrats), A3 (stocker
l'intention), G3 (export et import de vues).

**Questions à trancher avant de créer des issues**
1. Une vue est-elle liée à une *source* ? Aujourd'hui elle ne l'est qu'à un nom de concept, ce qui est à la
   fois une force (portabilité) et un risque (même nom, autre schéma). B3 et A2 dépendent de ce choix.
2. Faut-il une notion d'utilisateur et de rôle ? D1, F1 et G3 en ont besoin, alors que fluid n'a pas d'auth.
3. Le BFF devient-il un exécuteur (plannings, checks, abonnements côté serveur), ou tout reste-t-il dans
   le navigateur ?

## 6. Ce qu'on écarte pour l'instant
- **A2A** : protocole agent à agent, pas d'accès aux données. Hors sujet tant que F1 n'existe pas.
- **SES / ShadowRealm** comme frontière de sécurité (cf. G1).
- **Thesys C1 / OpenUI** comme moteur de rendu : on perdrait notre catalogue.
- **Canevas infini** et **collaboration CRDT** : coûteux, bénéfice incertain face aux colonnes Miller.

## 7. Non vérifié ou à revérifier
- Détails de l'éditeur IA de n8n, de Datadog Bits, de Power Apps Copilot, Hex Magic, Tableau Pulse (mémoire seule).
- Version et date de la dernière Moose, noms de classes du bus de MooseIDE (rien trouvé de fiable en ligne).
- Publication web de Lepiter ; état de Lively.next (pas d'activité visible depuis mi-2024).
- Introspection et abonnements chez Cognite ; abonnements dans `automation-gateway`.
- Révision MCP 2026-07-28 (référencée, contenu non lu) ; A2UI v1.0 annoncée en *release candidate*.
- La réparation de requêtes GraphQL par LLM n'a aucune publication dédiée : à mesurer nous-mêmes.

## Annexe A. MCP Apps en détail (pistes F1 et F2)

### A.1 Le mécanisme (spec `2026-01-26`, vérifiée le 2026-11-18)

MCP Apps est l'extension officielle de MCP (`io.modelcontextprotocol/ui`, SDK
`@modelcontextprotocol/ext-apps`) qui permet à un serveur MCP d'afficher une **interface interactive dans la
conversation** au lieu de texte. Hôtes : Claude (web, Desktop), VS Code Copilot, Microsoft 365 Copilot, Goose,
Postman, MCPJam, Archestra. ChatGPT utilise le même profil via son Apps SDK. La spec n'est **pas encore GA** :
la clé plate `_meta["ui/resourceUri"]` est déjà dépréciée et « retirée avant GA ».

- **Déclaration** : un outil porte `_meta.ui.resourceUri: "ui://…"` et `_meta.ui.visibility` :
  `["model"]` (l'agent le voit), `["app"]` (seule l'interface peut l'appeler, caché au LLM) ou les deux
  (par défaut).
- **Ressource** : une page HTML, MIME `text/html;profile=mcp-app`, livrée en texte ou en base64. Son
  `_meta.ui` déclare la CSP (`connectDomains` pour fetch et WebSocket, `resourceDomains` pour les
  scripts, styles, polices et images, `frameDomains`, `baseUriDomains`), des `permissions` (caméra,
  micro, géolocalisation, presse-papier), un `domain` d'origine dédié et `prefersBorder`.
- **Bac à sable** : iframe sans accès au DOM, aux cookies ni au stockage de l'hôte ; tout passe par
  `postMessage` en JSON-RPC.
- **Messages** :

| Sens | Message | Usage |
| --- | --- | --- |
| vue → hôte | `ui/initialize`, puis `ui/notifications/initialized` | poignée de main ; l'hôte renvoie son contexte (modes d'affichage disponibles…) |
| hôte → vue | `ui/notifications/tool-input-partial` | arguments **en cours de streaming** (au mieux, non fiable) |
| hôte → vue | `ui/notifications/tool-input`, puis `ui/notifications/tool-result` | arguments complets, puis `CallToolResult` (`structuredContent`) |
| hôte → vue | `ui/notifications/host-context-changed`, `ui/resource-teardown` | changement de contexte, fermeture |
| vue → hôte | `tools/call`, `resources/read` | appeler un outil ou lire une ressource **du même serveur** (outil visible `"app"`) |
| vue → hôte | `ui/update-model-context` | dire au modèle ce que l'utilisateur regarde ; chaque appel remplace le précédent |
| vue → hôte | `ui/message` | écrire dans la conversation (l'hôte peut demander confirmation) |
| vue → hôte | `ui/open-link`, `ui/request-display-mode` | ouvrir une URL ; passer en `inline`, `fullscreen` ou `pip` |
| vue → hôte | `ui/notifications/size-changed` | hauteur du contenu |

- **Consentement** : l'hôte **doit** refuser un `tools/call` vers un outil sans visibilité `"app"`, mais la
  spec **n'impose aucune confirmation** pour les appels venant de l'interface. C'est au serveur de protéger
  ses écritures.

### A.2 Ce que fluid exposerait

Le serveur MCP vit **dans le BFF** : il a déjà la base des vues, la validation des brouillons
(`llm/validateDraft.ts`, `checkWidgetsAgainstCatalog`) et `renderWidgetDocs`. Deux transports partagent
les mêmes gestionnaires d'outils : **Streamable HTTP** sur `/mcp`, et **stdio** via la CLI (`npx @badetitou/fluid mcp`)
pour Claude Desktop et VS Code en local.

| Outil | Visibilité | Entrée → sortie |
| --- | --- | --- |
| `list_sources`, `list_concepts` | model | les sources connues ; les concepts d'une source (résumé d'introspection) |
| `list_views` | model | vues enregistrées par concept (titre, widgets, intention si A3) |
| `show_view` | model + app | `{ viewId }` ou `{ concept, itemId? }` → `structuredContent: { spec, data }` ; `resourceUri: ui://fluid/viewer` |
| `draft_view` | model | `{ concept, spec, intent }` → validé (zod, catalogue, requêtes contre le schéma) → `{ spec, data, issues }` ; même `resourceUri` |
| `run_queries` | app | les requêtes **d'une spec enregistrée ou d'un brouillon validé** → données (jamais du GraphQL arbitraire) |
| `save_view` | app | enregistre le brouillon affiché (bouton « Enregistrer dans fluid ») |
| `invoke_action` | app | exécute une action de la vue, **après confirmation dans l'interface** |

La description de `draft_view` contient la doc générée par `renderWidgetDocs` : **c'est le LLM de l'hôte qui
écrit la ViewSpec**, et fluid n'a besoin d'aucun fournisseur LLM configuré. Le serveur valide et refuse, comme
l'assistant le fait déjà.

### A.3 La page `ui://fluid/viewer`

- **Contenu** : le moteur (`views/` : `ViewRenderer`, `plugin-api`), le catalogue des widgets intégrés et les
  thèmes, dans une nouvelle entrée Vite (au niveau `app`, qui a le droit d'importer le moteur) compilée en un
  seul fichier (`vite-plugin-singlefile`).
- **Widgets lourds** (`code`, `richtext`, `network`, 3D) : soit embarqués (le bundle grossit), soit
  chargés depuis l'origine publique de fluid, déclarée dans `resourceDomains`. **À mesurer.**
- **Données** : par `tools/call run_queries` → le BFF interroge la source. Aucun jeton de source dans
  l'iframe, pas de `connectDomains`. Ça demande que **le BFF sache exécuter du GraphQL**, ce qui est aussi
  la pièce centrale de l'OAuth côté sources (`oauth-conception.md`, phase 1).
- **Thème** : le contexte de l'hôte (clair ou sombre) choisit la variante du thème fluid.
- **Plugins tiers** : seulement les intégrés au début ; les modules chargés par URL demanderaient d'élargir la CSP.

### A.4 Correspondance des interactions fluid ↔ MCP Apps

| fluid | MCP Apps |
| --- | --- |
| aperçu en direct pendant la génération | `tool-input-partial` : la spec s'affiche pendant que l'hôte l'écrit |
| sortie `@<widget>.selected` | `ui/update-model-context` (« le personnage sélectionné est Rick Sanchez, id 1… ») |
| `linkTo` vers une entité | `tools/call show_view` dans l'iframe (navigation sur place), ou `ui/open-link` vers fluid (lien profond) |
| actions (mutations) | `tools/call invoke_action` ; confirmation dans l'interface, journal côté BFF |
| « Enregistrer » | `tools/call save_view` |
| « Demander au LLM » sur un widget | `ui/message` (texte et sélection) |
| plein écran, mode présentation | `ui/request-display-mode` (`fullscreen`) |

### A.5 Sécurité

- **Pas de proxy générique** : `run_queries` n'exécute que les requêtes d'une spec connue (vue enregistrée ou
  brouillon validé et gardé en mémoire), référencées par hash, d'où le lien avec A4 (documents persistés).
- **Écritures** : `invoke_action` en visibilité `["app"]` uniquement (le LLM ne peut pas l'appeler),
  confirmation dans l'interface, et l'écriture doit être activée pour la connexion (règle de `MUTATIONS.md`).
- **Contenu non fiable** : les données d'une source passent dans le contexte du modèle via
  `update-model-context` ; elles peuvent contenir des injections. Ne remonter que la sélection, compactée.
- **Authentification** : stdio = pas d'OAuth (la spec MCP le dit : identifiants pris dans l'environnement).
  HTTP = fluid devient serveur de ressources OAuth 2.1 (`oauth-conception.md`, phase 4).

### A.6 Prototype proposé (chaque étape = une MR minimale)

1. **Lecture seule en stdio** : `fluid mcp`, outils `list_views` et `show_view`, page `ui://fluid/viewer`
   avec le moteur en un seul fichier, sources publiques (Rick and Morty) interrogées par le BFF. *Question :
   le moteur tient-il dans une iframe d'hôte, et à quelle taille ?*
2. **Génération par l'hôte** : `draft_view` (validation partagée avec l'assistant), aperçu par
   `tool-input-partial`, `save_view`. *Question : la qualité des specs écrites par Claude avec la doc des widgets.*
3. **Boucle avec le modèle** : `update-model-context` sur les sorties de widgets, `ui/message`, plein écran.
4. **Actions** : `invoke_action` avec confirmation.
5. **Transport HTTP + OAuth** : après la phase 3 d'`oauth-conception.md`.

### A.7 Dans l'autre sens : fluid hôte de MCP Apps

Le SDK fournit le côté hôte (`AppBridge`, `@mcp-ui/client` pour React). Un widget `mcpApp` pourrait afficher
dans un dashboard fluid l'interface publiée par **un autre** serveur MCP (supervision d'un fournisseur
industriel, visionneuse 3D…), isolée dans l'iframe que demandait déjà G1. À explorer une fois A.6 fait.

## Sources principales
- MCP Apps — https://modelcontextprotocol.io/extensions/apps/overview ; spec — https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/2026-01-26/apps.mdx
- Malleable Software, Ink & Switch, 2025 — https://www.inkandswitch.com/essay/malleable-software/
- Moldable Development patterns — https://arxiv.org/abs/2409.18811 ; Phlow pour Python — https://book.gtoolkit.com/phlow-for-python-dyl98a2rcczf8f4tdf7e1pstj
- gtExample — https://book.gtoolkit.com/examples-by-example-fnfe114i8o8iglknjt6n1c4l
- DynaVis (CHI'24) — https://arxiv.org/abs/2401.10880 ; Jelly (CHI'25) — https://arxiv.org/abs/2503.04084 ; Gradual generation — https://arxiv.org/abs/2601.17975
- MCP Apps — https://blog.modelcontextprotocol.io/posts/2026-01-26-mcp-apps/ ; A2UI — https://github.com/google/A2UI ; AG-UI — https://docs.ag-ui.com
- Apollo MCP Server — https://www.apollographql.com/docs/apollo-mcp-server/define-tools
- Palantir Action Types — https://www.palantir.com/docs/foundry/action-types/overview ; Retool, gouvernance des apps générées — https://retool.com/blog/how-to-govern-ai-generated-apps-enterprise ; Genie — https://docs.databricks.com/aws/en/genie/
- Mosaic — https://idl.uw.edu/mosaic ; Draco — https://uwdata.github.io/draco ; VisEval — https://arxiv.org/abs/2407.00981 ; Data Formulator 2 — https://arxiv.org/abs/2408.16119
- graphql-inspector — https://the-guild.dev/graphql/inspector ; Hive App Deployments — https://the-guild.dev/graphql/hive/docs/features/app-deployments
- DuckDB-WASM — https://duckdb.org/docs/2.0/clients/wasm/overview.html ; GraphQL Mesh — https://the-guild.dev/graphql/mesh/v1
- Figma, système de plugins — https://www.figma.com/blog/how-we-built-the-figma-plugin-system/ ; signature Grafana — https://grafana.com/developers/plugin-tools/publish-a-plugin/sign-a-plugin
- Speckle GraphQL — https://docs.speckle.systems/developers/api/graphql ; bSDD API — https://github.com/buildingSMART/bSDD ; automation-gateway — https://github.com/vogler75/automation-gateway ; Cognite DM GraphQL — https://docs.cognite.com/cdf/dm/dm_graphql
- SCIP — https://sourcegraph.com/blog/announcing-scip ; CodeCharta — https://github.com/maibornwolff/codecharta ; jQAssistant — https://jqassistant.github.io/jqassistant/current
- Palantir Vertex — https://palantir.com/docs/foundry/vertex/explore-object-relationships/ ; facettes Datasette — https://docs.datasette.io/en/stable/facets.html
