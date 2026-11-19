# OAuth dans fluid : proposition de conception

> Statut : **proposition** (2026-11-18) ; décision 1 (BFF par défaut) prise, décisions 2 à 4 ouvertes (§5). Complète la piste F6 et l'annexe A de
> [`pistes-innovation-2026-11.md`](pistes-innovation-2026-11.md). Sources vérifiées le 2026-11-18 :
> spec d'autorisation MCP `2025-11-25`, RFC 10017 (*OAuth 2.0 for Browser-Based Applications*, BCP 212,
> août 2026).

## 1. Deux besoins, une même pièce

fluid a besoin d'OAuth dans **deux sens** :

1. **fluid client OAuth des sources** : se connecter à une API GraphQL protégée (Cognite en OIDC via
   Entra ID, Speckle, GitHub, une API métier derrière Keycloak…) **au nom de l'utilisateur**.
2. **fluid serveur de ressources** : protéger sa propre API (le BFF) et son futur serveur MCP en HTTP, pour que
   Claude, ChatGPT ou VS Code s'y connectent (annexe A, piste F1).

La pièce commune, c'est **un BFF qui sait exécuter du GraphQL au nom de l'utilisateur**. C'est ce que
recommande la RFC 10017 pour une application qui manipule des données métier, et c'est ce que demande le
serveur MCP (`run_queries`, `run_view`) : un jeton reçu de Claude ne doit **jamais** être relayé vers une
source (*token passthrough* interdit par la spec MCP).

## 2. L'existant

- Le navigateur appelle la source **directement** : `createGraphQLClient(url)` (`apps/frontend/src/graphql/client.ts`,
  urql + `fetchExchange`), sans aucun en-tête. Il faut donc que la source accepte le CORS depuis l'origine de fluid.
- Les sources gardées sont dans `localStorage` (`entities/source/store.ts`, zustand `persist`), par URL.
- Les requêtes `q.source` d'une vue visent des `DataSource` de plugins (`views/runQueries.ts`), pas d'autres
  endpoints GraphQL.
- Le BFF n'a ni utilisateur ni session ni authentification. Il accepte le CORS de toute origine
  (`app.ts`) et ne fait aucun appel GraphQL. Il est **facultatif** : le mode GitLab Pages tourne sans lui.
- Un module de plugin s'exécute **dans la page** (`PLUGINS.md` §2) : tout secret présent dans la page (y compris
  la clé LLM, aujourd'hui) lui est lisible.

## 3. Les choix proposés

### 3.1 Les secrets des sources vivent dans le BFF (motif *Backend For Frontend*) — décidé le 2026-11-18

| Motif (RFC 10017, du plus sûr au moins sûr) | Où sont les jetons | Pour fluid |
| --- | --- | --- |
| **BFF** : client confidentiel, proxy de tous les appels | serveur ; le navigateur n'a qu'un cookie `Secure; HttpOnly; SameSite=Strict` | **par défaut** dès qu'une source est authentifiée |
| *Token-mediating backend* | jeton d'accès dans le navigateur | écarté : les plugins le liraient |
| Client navigateur public + PKCE | navigateur (mémoire, au mieux un Web Worker) | **repli** pour le mode sans BFF (Pages), annoncé comme moins sûr |

Le choix « BFF » apporte trois gains en plus de la sécurité :
- **Plus de problème de CORS** : beaucoup d'API industrielles ne l'autorisent pas. Une source peut être
  marquée « via le BFF » même sans authentification.
- **Exécution côté serveur** : c'est la base du serveur MCP, des checks planifiés (D2) et des abonnements
  relayés (F4).
- **Partage sûr** : une vue ne contient jamais de secret. Le jeton est résolu au moment de l'exécution, pour
  l'utilisateur qui regarde.

### 3.2 Configuration d'une source authentifiée

```ts
// packages/shared — validé par zod ; jamais de secret côté navigateur
interface SourceAuth {
  kind: 'none' | 'header' | 'oauth';
  // kind 'header' : clé d'API ou jeton personnel (PAT), stocké chiffré dans le BFF
  headerName?: string;            // 'Authorization' par défaut ('Bearer <secret>')
  // kind 'oauth'
  issuer?: string;                // découverte RFC 8414 / OIDC Discovery
  clientId?: string;              // client pré-enregistré
  scopes?: string[];
  resource?: string;              // RFC 8707 (audience), si l'émetteur le gère
}
```

- **Découverte automatique** : si la source répond `401` avec `WWW-Authenticate: Bearer resource_metadata=…`
  (RFC 9728, ce que la spec MCP impose aux serveurs MCP), fluid en déduit l'émetteur et les portées, comme un
  client MCP. Le même code de découverte sert donc aux sources GraphQL **et** aux serveurs MCP qu'on voudrait
  un jour consommer.
- **Enregistrement du client** : par ordre de préférence MCP, **pré-enregistré** (l'admin saisit
  `client_id` et secret dans *Settings → Connexion*, cas Entra ID et Keycloak), puis **Client ID Metadata
  Document** (le BFF sert `/oauth/client-metadata.json`, dérivé de l'URL publique de fluid, si l'émetteur
  annonce `client_id_metadata_document_supported`), puis **DCR** (RFC 7591) en dernier recours.
- **Livraison par plugin** : un `sourceProvider` peut fournir `auth` avec chaque source. Une entreprise
  publie un plugin « nos API » et l'utilisateur final n'a rien à configurer, à part se connecter.

### 3.3 Le flux d'autorisation (source OAuth, mode BFF)

1. Le navigateur ouvre une fenêtre sur `GET /api/sources/:id/oauth/start` ; le BFF crée `state`, PKCE
   `S256` (refuser si `code_challenge_methods_supported` manque, règle MCP) et `nonce`, puis redirige vers
   l'émetteur avec `resource` (RFC 8707).
2. L'émetteur revient sur `GET /api/oauth/callback` ; le BFF vérifie `state`, échange le code, chiffre et
   stocke jeton d'accès et jeton de rafraîchissement (rotation attendue de l'émetteur).
3. Les requêtes de la vue partent vers `POST /api/sources/:id/graphql` ; le BFF ajoute `Authorization`,
   rafraîchit le jeton si besoin, et en cas de `401` ou `403 insufficient_scope` renvoie une erreur typée que
   l'UI traduit en « Se reconnecter » (élévation de portée).
4. Côté frontend, `createGraphQLClient` prend l'URL du proxy au lieu de celle de la source ; le reste
   (urql, `runQueries`, pagination) ne change pas.

Bibliothèques candidates (à confirmer au premier spike) : `oauth4webapi` ou `openid-client` v6 (panva ;
découverte, PKCE, paramètre `resource`, Node **et** navigateur, donc aussi le mode Pages), `jose` (validation
de JWT et JWKS), `@fastify/cookie` et une session signée.

### 3.4 L'identité dans fluid

Les jetons sont stockés **par utilisateur**, ce qui demande une notion d'utilisateur. Proposition graduée :

| Mode | Utilisateur | Pour |
| --- | --- | --- |
| **Local** (npx, `127.0.0.1`) | un seul utilisateur implicite, sans connexion | usage actuel, inchangé |
| **Équipe** | connexion OIDC à fluid via un **fournisseur d'identité externe** (Keycloak, Entra ID, Authentik…) ; session par cookie | déploiement partagé (Helm, Docker) |

fluid **n'implémente pas de serveur d'autorisation** au départ : il délègue à un fournisseur d'identité
configuré par `FLUID_OIDC_ISSUER`, `FLUID_OIDC_CLIENT_ID` et `FLUID_OIDC_CLIENT_SECRET`. Un serveur intégré
(`oidc-provider` de panva) ne viendrait que si des auto-hébergeurs sans fournisseur d'identité le demandent.

### 3.5 fluid serveur de ressources (MCP en HTTP, API du BFF)

Conforme à la spec MCP `2025-11-25` :
- **Métadonnées** : `/.well-known/oauth-protected-resource/mcp` (RFC 9728) avec `authorization_servers`
  (le fournisseur d'identité de 3.4) et `scopes_supported`.
- **Défi** : `401` avec `WWW-Authenticate: Bearer resource_metadata="…", scope="…"` ; `403
  insufficient_scope` pour l'élévation de portée.
- **Validation** : signature (JWKS), expiration, **audience = l'URI canonique de fluid** (RFC 8707) ;
  sinon `401`.
- **Portées** proposées : `views:read`, `views:write` (brouillons, enregistrement), `data:read` (exécuter des
  vues), `actions:invoke` (mutations).
- **Vers les sources** : jamais le jeton de Claude. Le BFF utilise le jeton de source **de l'utilisateur
  identifié** (3.3), ou un **échange de jeton** (RFC 8693, ou *On-Behalf-Of* d'Entra) quand la source et fluid
  partagent le même fournisseur d'identité, ce qui est le cas courant en entreprise.
- **stdio** (`fluid mcp` en local) : pas d'OAuth, comme le prévoit la spec MCP ; le mode Local s'applique.

### 3.6 Stockage

Nouvelles tables (Prisma, PGlite ou PostgreSQL), lues par des services et jamais par les routes
(règle 3 de `CLAUDE.md`) :
- `User` (`issuer`, `subject`, nom) ; un utilisateur `local` implicite en mode Local.
- `SourceConfig` (URL, `SourceAuth`, secret client **chiffré**).
- `SourceCredential` (utilisateur, source, jetons **chiffrés**, expiration, portées).
- Chiffrement AES-GCM avec une clé `FLUID_SECRET_KEY` ; générée et stockée dans le dossier de données en mode Local.

## 4. Découpage proposé (une phase = une ou plusieurs MR minimales)

| Phase | Contenu | Débloque |
| --- | --- | --- |
| **1. Proxy GraphQL du BFF** | `POST /api/sources/:id/graphql`, `SourceConfig`, option « via le BFF » par source ; `kind: 'header'` (clé d'API, PAT) chiffré côté serveur | sources sans CORS, Speckle ou GitHub par PAT, prérequis de MCP Apps (A.3) |
| **2. OAuth vers une source** | flux 3.3 avec client pré-enregistré, découverte RFC 8414 / OIDC / RFC 9728, rafraîchissement, « Se reconnecter » | Cognite, Keycloak, Speckle par OAuth |
| **2 bis. Repli navigateur** | PKCE côté navigateur, jetons en mémoire, pour le mode sans BFF | démo GitLab Pages avec une source protégée |
| **3. Identité fluid** | connexion OIDC à fluid, sessions, `User`, jetons de source par utilisateur ; le mode Local reste sans connexion | déploiements d'équipe, partage sûr de vues (G3) |
| **4. Serveur de ressources** | métadonnées RFC 9728, défis `401` / `403`, validation de l'audience, portées ; serveur MCP en HTTP | connecteur fluid dans claude.ai, ChatGPT, M365 |
| 5. (si besoin) | serveur d'autorisation intégré, Client ID Metadata Document, échange de jeton | auto-hébergement sans fournisseur d'identité |

**Tests** : un émetteur simulé dans vitest (par ex. `oauth2-mock-server`, à confirmer) pour les phases 2 à 4,
et un Keycloak en Docker pour un test d'intégration manuel ou en CI.

## 5. Décisions à prendre

1. ~~Le proxy du BFF devient-il la voie normale pour les sources authentifiées ?~~ **Décidé le 2026-11-18 :
   oui.** Une source authentifiée (en-tête ou OAuth) passe par le BFF et ses secrets n'atteignent jamais la
   page. Sans BFF, seul le repli 2 bis existe, réservé aux démos. Une source publique reste appelée en
   direct, sauf si l'utilisateur coche « via le BFF » (par exemple pour contourner le CORS).
2. **Quel fournisseur d'identité vise-t-on d'abord** pour le cas industriel (Entra ID, Keycloak, autre) ? Ça
   décide du mode d'enregistrement du client (Entra : pré-enregistrement ; Keycloak : DCR possible) et de
   l'échange de jeton.
3. **Le mode Équipe (phase 3) est-il nécessaire tôt**, ou un déploiement mono-utilisateur derrière un
   reverse proxy suffit-il un moment ?
4. **La clé LLM** passe-t-elle côté BFF au passage ? Aujourd'hui elle est dans `localStorage`, lisible par
   les plugins.

## 6. Risques

- **Cookie de session et CORS** : le BFF accepte toute origine aujourd'hui ; avec des cookies, il faudra
  restreindre les origines (`FLUID_PUBLIC_URL`) et vérifier l'origine des requêtes d'écriture (CSRF).
- **Abonnements** (F4) : relayer le WebSocket par le BFF, ou ajouter le jeton dans `connectionParams`, à concevoir avec F4.
- **Mode Pages** : un client public dans la page reste exposé aux plugins ; à réserver aux démos.
- **Émetteurs hétérogènes** : GitHub, Speckle et Entra divergent sur PKCE, `resource` et la rotation des
  jetons ; tester chacun avant de l'annoncer.
- **Spec MCP mouvante** : une révision `2026-07-28` est référencée et n'a pas été lue ; revérifier avant la phase 4.

## Sources
- Autorisation MCP `2025-11-25` — https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization
- RFC 10017 / BCP 212 — https://datatracker.ietf.org/doc/draft-ietf-oauth-browser-based-apps/
- RFC 9728 (Protected Resource Metadata), RFC 8707 (Resource Indicators), RFC 8414, RFC 7591, RFC 8693 (Token Exchange)
- Client ID Metadata Document — https://datatracker.ietf.org/doc/html/draft-ietf-oauth-client-id-metadata-document-00
