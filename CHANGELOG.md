# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- **BFF source proxy with encrypted secrets** (#14): `SourceConfig` model and migration, AES-256-GCM secret encryption keyed by `FLUID_SECRET_KEY` (generated in the data directory in local mode), CRUD routes with write-only secrets, and `POST /api/sources/:id/graphql` forwarding to the configured `http(s)` URL with the auth header.
- **Route a source through the BFF from settings** (#15): a saved source can carry a `bffSourceId` and the GraphQL client targets `<bff>/api/sources/<id>/graphql`. Connection settings gain a “Via the BFF” switch, auth kind, header name, and a write-only secret field (never kept in `localStorage` or component state).
- **OAuth sign-in for BFF-routed sources** (#18): `oauth` auth kind on source configs (issuer, client ID, encrypted client secret, scopes, optional RFC 8707 resource) and an `OAuthCredential` table with encrypted tokens. Authorization Code + PKCE S256 flow via `oauth4webapi` (RFC 8414/OIDC discovery with MCP path-insertion order, RFC 9728 hints from `401` challenges), server-side single-use pending state (10 min TTL), callback page notifying the opener, single-flight token refresh preserving rotated refresh tokens, sign-out, and typed `FLUID_AUTH_REQUIRED` errors (`signin`, `expired`, `insufficient_scope`).
- **OAuth sign-in UI and reconnect flow** (#17, #19): OAuth settings in the BFF source configuration (issuer, client ID, write-only client secret, scopes, resource, discovery), popup sign-in with origin-checked callback messages, connection status and sign-out, a “Reconnect” banner on `FLUID_AUTH_REQUIRED` that rebuilds the GraphQL client, and optional OAuth settings on source provider entries. End-to-end sign-in test over real HTTP and a hand-runnable OAuth test stub (auto-approving `/authorize`, token-protected GraphQL resource).

### Changed
- **BFF-routed source handling** (#15): BFF source calls are centralized in `bffClient.sources`, `BffHttpError` carries the HTTP status, and typed secrets are cleared only after a successful save.
- **OAuth callback/origin handling** (#18, #19): popup message target can be provided via `?origin` (default `FLUID_PUBLIC_URL`, else callback origin) with a startup warning when `FLUID_PUBLIC_URL` is unset in production; OAuth URLs are logged without query strings.
- **Config lifecycle hardening** (#18): tokens and pending sign-ins are bound to a source config fingerprint; pending sign-ins are dropped on sign-out, reconfiguration, and delete.

### Fixed
- **Source switching and resilience** (#15): a BFF-routed source can always be switched back to a direct connection; a failed delete on the BFF still clears the local ID with a warning. Source config/error state resets on source change and stale results are dropped.
- **Proxy and source update hardening** (#14): only Prisma “not found” is treated as a missing source; a stored secret is dropped when a source URL moves to another origin without a new secret; proxy enforces timeout/size caps and refuses to follow redirects.
- **OAuth UI robustness** (#19): discovery merges only its own fields and ignores answers for another source; reconnect prompt tracks failing operations and remains while any remain; a sign-in is bound to the source it started for (popup closed on source switch, callback message must come from the popup); sign-out restarts queries; plugin OAuth settings seed a newly created BFF config instead of overriding a saved choice; client rebuild is explicit.
- **OAuth token correctness** (#19): the OAuth stub returns an ID token only for OpenID Connect requests.
- **Miller navigation for ids containing slashes** (#29): the dashboard URL is parsed from the still-encoded `location.pathname` instead of React Router's decoded splat, so a key containing `/` (e.g. a Java/SCIP key) opens one detail column with the unchanged id instead of several bogus `Unknown concept` columns. Root and appended column paths now share the same encoding.

### Security
- **Secret and header handling in the proxy** (#14): reserved and hop-by-hop header names are rejected and protocol headers always win; upstream read timeout maps to `504`; generated key file is created atomically without overwrite and invalid key files are reported by path.
- **OAuth host and endpoint policy** (#18): shared host policy for the source proxy and all OAuth outbound calls (always refuse link-local/metadata ranges after DNS resolution, including `fd00:ec2::/32`, `100.100.100.200`, `168.63.129.16`, `192.0.0.192`, and IPv4-mapped/embedded cases; `FLUID_BLOCK_PRIVATE_HOSTS=1` also refuses loopback/private ranges). Discovery validates protected-resource metadata same-origin with the probed source and matching resource, rejects issuers with query/fragment, matches metadata issuer exactly, and requires `https` authorization/token endpoints when the issuer is `https`; endpoint scheme checks compare parsed protocols.
- **OAuth session/credential safety** (#18): login CSRF state bound to an `HttpOnly` `SameSite=Lax` cookie (per-state binder, cleared only after a matching binder, not set for unknown state); token writes guarded by a per-source auth generation (migration) and conditional writes in a transaction that locks the source row, so sign-out/reconfiguration/delete during refresh or code exchange cannot leave credentials behind; refresh also requires the access token it read to be unchanged. Single-flight covers read, refresh, and save.
- **Documentation**: `FLUID_SECRET_KEY` and OAuth/host-policy-related environment behavior documented (`README`, `.env.example`).

## [0.1.4] - 2026-11-17

### Added
- Read past a source's silent row cap when its per-request limit is unknown (large-list paging).
- BFF LLM chat endpoint and chat panel; build a view or dashboard from the conversation.
- Prompt/insight improvements (row-limit `$take` handling, AI analysis/insight widget, debounced analysis).

### Changed
- Moved CI to GitHub Actions.

### Fixed
- Lazy-loaded chat panel and related stability fixes.

## [0.1.3] - 2026-11-16
- First release published by GitLab CI.

## [0.1.2] - 2026-11-16
- First release published by GitLab CI.

## [0.1.1] - 2026-11-16
- First release published by GitLab CI.

## [0.1.0] - 2026-11-16
- First npm release of `@badetitou/fluid`.
