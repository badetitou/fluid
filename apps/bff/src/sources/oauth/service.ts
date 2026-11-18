import type { KeyProvider } from '../crypto';
import type { SourceRepository } from '../repository';
import { type OAuthSource } from './client';
import type { CredentialRepository } from './credentials';
import {
  createDiscoverer,
  discoverAuthorizationServer,
  discoverProtectedResource,
  type AuthServerInfo,
  type ProtectedResourceInfo,
} from './discovery';
import { createOAuthFlow, FlowError, type CallbackResult, type StartOptions } from './flow';
import type { CredentialRecord } from './model';
import { createPendingStore, type PendingStore } from './pkce-pending';
import { createSafeFetch, type SafeFetchOptions } from './safe-fetch';
import { createTokenManager, type TokenResult } from './tokens';

export interface DiscoveryQuery {
  /** The source's GraphQL URL: probed for RFC 9728 protected resource metadata. */
  url?: string;
  issuer?: string;
}

export interface DiscoveryResult {
  resource: ProtectedResourceInfo | null;
  authorizationServer:
    | (Pick<AuthServerInfo, 'authorizationEndpoint' | 'tokenEndpoint' | 'scopesSupported'> & {
        issuer: string;
        supportsS256: boolean;
      })
    | null;
  suggestion: { issuer: string | null; scopes: string[]; resource: string | null };
}

export interface OAuthService {
  discover(query: DiscoveryQuery): Promise<DiscoveryResult>;
  /** The authorization URL; throws FlowError (404 unknown source, 400 not OAuth / no S256, 502). */
  start(sourceId: string, opts: StartOptions): Promise<{ url: string; binder: string }>;
  callback(query: URLSearchParams, binder: string | null): Promise<CallbackResult>;
  /** Deletes the credential and forgets sign-ins in flight; true when a credential existed. */
  signOut(sourceId: string): Promise<boolean>;
  credential(sourceId: string): Promise<CredentialRecord | null>;
  accessToken(source: OAuthSource): Promise<TokenResult>;
}

export interface OAuthServiceDeps {
  sources: Pick<SourceRepository, 'get'>;
  creds: CredentialRepository;
  key: KeyProvider;
  net?: SafeFetchOptions;
  pending?: PendingStore;
  now?: () => number;
}

export function createOAuthService(deps: OAuthServiceDeps): OAuthService {
  const { sources, creds, key, now } = deps;
  const fetchOut = createSafeFetch(deps.net);
  const discover = createDiscoverer(fetchOut, undefined, now);
  const pending = deps.pending ?? createPendingStore(undefined, now);
  const loadSource = (id: string) => sources.get(id);
  const flow = createOAuthFlow({ creds, key, discover, fetchOut, pending, loadSource, now });
  const tokens = createTokenManager({ creds, key, discover, fetchOut, loadSource, now });

  return {
    async discover({ url, issuer }) {
      const resource = url ? await discoverProtectedResource(url, fetchOut) : null;
      const chosen = issuer ?? resource?.authorizationServers[0] ?? null;
      let authorizationServer: DiscoveryResult['authorizationServer'] = null;
      if (chosen) {
        try {
          const info = await discoverAuthorizationServer(chosen, fetchOut);
          authorizationServer = {
            issuer: info.as.issuer,
            authorizationEndpoint: info.authorizationEndpoint,
            tokenEndpoint: info.tokenEndpoint,
            scopesSupported: info.scopesSupported,
            supportsS256: info.s256,
          };
        } catch {
          authorizationServer = null;
        }
      }
      return {
        resource,
        authorizationServer,
        suggestion: { issuer: chosen, scopes: resource?.scopes ?? [], resource: resource?.resource ?? null },
      };
    },
    async start(sourceId, opts) {
      const source = await sources.get(sourceId);
      if (!source) throw new FlowError(404, 'Source not found');
      return flow.start(source, opts);
    },
    callback: (query, binder) => flow.complete(query, binder),
    async signOut(sourceId) {
      pending.dropForSource(sourceId);
      return creds.remove(sourceId);
    },
    credential: (sourceId) => creds.get(sourceId),
    accessToken: (source) => tokens.accessToken(source),
  };
}
