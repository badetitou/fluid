import { decryptSecret, encryptSecret, type KeyProvider } from './crypto';
import {
  authHeaders,
  toPublicSource,
  type CreateSourceBody,
  type GraphqlBody,
  type PublicSource,
  type SourceRecord,
  type UpdateSourceBody,
} from './model';
import { parseBearerChallenge } from './oauth/challenge';
import { authRequiredResult, joinScopes } from './oauth/model';
import type { OAuthService } from './oauth/service';
import { forwardGraphql, type ProxyResult } from './proxy';
import type { SourceData, SourceRepository } from './repository';

const originOf = (url: string) => new URL(url).origin;

/** A request the service cannot honour (surfaces as HTTP 400). */
export class SourceInputError extends Error {
  readonly statusCode = 400;
}

const noOAuth = { oauthIssuer: null, oauthClientId: null, oauthClientSecret: null, oauthScopes: null, oauthResource: null };

export interface SourceService {
  list(): Promise<PublicSource[]>;
  get(id: string): Promise<PublicSource | null>;
  create(input: CreateSourceBody): Promise<PublicSource>;
  update(id: string, input: UpdateSourceBody): Promise<PublicSource | null>;
  remove(id: string): Promise<boolean>;
  /** null when the source is not configured. */
  runGraphql(id: string, body: GraphqlBody): Promise<ProxyResult | null>;
}

export interface SourceServiceOptions {
  timeoutMs?: number;
  maxBytes?: number;
  fetchImpl?: typeof fetch;
  /** Sign-in and token handling for `oauth` sources; without it they always answer "signin". */
  oauth?: OAuthService;
}

export function createSourceService(
  repo: SourceRepository,
  key: KeyProvider,
  opts: SourceServiceOptions = {},
): SourceService {
  const publicOf = async (record: SourceRecord) =>
    toPublicSource(record, record.authKind === 'oauth' ? ((await opts.oauth?.credential(record.id)) ?? null) : null);

  /** The OAuth columns after an update: omitted fields keep their value. */
  function mergeOAuth(current: SourceRecord, input: UpdateSourceBody, moved: boolean) {
    const o = input.oauth ?? {};
    const oauthIssuer = o.issuer ?? current.oauthIssuer;
    const oauthClientId = o.clientId ?? current.oauthClientId;
    if (!oauthIssuer || !oauthClientId) throw new SourceInputError('oauth issuer and clientId are required');
    let oauthClientSecret = current.oauthClientSecret;
    // Another issuer, client or host must not receive the stored client secret.
    if (o.clientSecret === null || ((oauthIssuer !== current.oauthIssuer || moved) && !o.clientSecret)) {
      oauthClientSecret = null;
    } else if (o.clientSecret) oauthClientSecret = encryptSecret(o.clientSecret, key());
    return {
      oauthIssuer,
      oauthClientId,
      oauthClientSecret,
      oauthScopes: o.scopes ? joinScopes(o.scopes) : current.oauthScopes,
      oauthResource: o.resource === undefined ? current.oauthResource : o.resource,
    };
  }

  /** Auth through the stored OAuth token; typed errors tell the UI to sign in or reconnect. */
  async function runOAuth(source: SourceRecord, body: GraphqlBody): Promise<ProxyResult> {
    const token = (await opts.oauth?.accessToken(source)) ?? { ok: false as const, reason: 'signin' as const };
    if (!token.ok) return authRequiredResult(token.reason);
    const result = await forwardGraphql(source.url, { Authorization: `Bearer ${token.token}` }, body, opts);
    if (result.status === 401) return authRequiredResult('expired');
    const challenge = parseBearerChallenge(result.wwwAuthenticate);
    if (result.status === 403 && challenge.error === 'insufficient_scope') {
      return authRequiredResult('insufficient_scope', challenge.scope);
    }
    return result;
  }

  return {
    async list() {
      return Promise.all((await repo.list()).map(publicOf));
    },
    async get(id) {
      const record = await repo.get(id);
      return record ? publicOf(record) : null;
    },
    async create(input) {
      const o = input.authKind === 'oauth' ? input.oauth : undefined;
      const secret = input.secret ? encryptSecret(input.secret, key()) : null;
      const data: SourceData = {
        name: input.name,
        url: input.url,
        authKind: input.authKind,
        headerName: input.authKind === 'header' ? (input.headerName ?? null) : null,
        secret: input.authKind === 'header' ? secret : null,
        ...(o
          ? {
              oauthIssuer: o.issuer,
              oauthClientId: o.clientId,
              oauthClientSecret: o.clientSecret ? encryptSecret(o.clientSecret, key()) : null,
              oauthScopes: joinScopes(o.scopes),
              oauthResource: o.resource ?? null,
            }
          : noOAuth),
      };
      return publicOf(await repo.create(data));
    },
    async update(id, input) {
      const current = await repo.get(id);
      if (!current) return null;
      const authKind = input.authKind ?? current.authKind;
      let secret = current.secret;
      // Repointing to another origin must not hand the stored secret to the new host.
      const moved = input.url !== undefined && originOf(input.url) !== originOf(current.url);
      if (input.secret === null || authKind !== 'header') secret = null;
      else if (moved && !input.secret) secret = null;
      else if (input.secret) secret = encryptSecret(input.secret, key());
      const oauth = authKind === 'oauth' ? mergeOAuth(current, input, moved) : noOAuth;
      const record = await repo.update(id, {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.url !== undefined ? { url: input.url } : {}),
        authKind,
        headerName: authKind === 'header' ? (input.headerName ?? current.headerName) : null,
        secret,
        ...oauth,
      });
      if (!record) return null;
      // Tokens are only good for the config they were issued under.
      const reconfigured =
        moved ||
        authKind !== current.authKind ||
        oauth.oauthIssuer !== current.oauthIssuer ||
        oauth.oauthClientId !== current.oauthClientId ||
        oauth.oauthClientSecret !== current.oauthClientSecret ||
        oauth.oauthScopes !== current.oauthScopes ||
        oauth.oauthResource !== current.oauthResource;
      if (reconfigured) await opts.oauth?.signOut(id);
      return publicOf(record);
    },
    remove: (id) => repo.remove(id),
    async runGraphql(id, body) {
      const source = await repo.get(id);
      if (!source) return null;
      if (source.authKind === 'oauth') return runOAuth(source, body);
      const secret = source.secret ? decryptSecret(source.secret, key()) : null;
      return forwardGraphql(source.url, authHeaders(source, secret), body, opts);
    },
  };
}
