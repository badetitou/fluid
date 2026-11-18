import { decryptSecret, encryptSecret, type KeyProvider } from './crypto';
import {
  authHeaders,
  toPublicSource,
  type CreateSourceBody,
  type GraphqlBody,
  type PublicSource,
  type UpdateSourceBody,
} from './model';
import { forwardGraphql, type ProxyResult } from './proxy';
import type { SourceRepository } from './repository';

const originOf = (url: string) => new URL(url).origin;

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
}

export function createSourceService(
  repo: SourceRepository,
  key: KeyProvider,
  opts: SourceServiceOptions = {},
): SourceService {
  return {
    async list() {
      return (await repo.list()).map(toPublicSource);
    },
    async get(id) {
      const record = await repo.get(id);
      return record ? toPublicSource(record) : null;
    },
    async create(input) {
      const secret = input.secret ? encryptSecret(input.secret, key()) : null;
      const record = await repo.create({
        name: input.name,
        url: input.url,
        authKind: input.authKind,
        headerName: input.authKind === 'header' ? (input.headerName ?? null) : null,
        secret: input.authKind === 'header' ? secret : null,
      });
      return toPublicSource(record);
    },
    async update(id, input) {
      const current = await repo.get(id);
      if (!current) return null;
      const authKind = input.authKind ?? current.authKind;
      let secret = current.secret;
      // Repointing to another origin must not hand the stored secret to the new host.
      const moved = input.url !== undefined && originOf(input.url) !== originOf(current.url);
      if (input.secret === null || authKind === 'none') secret = null;
      else if (moved && !input.secret) secret = null;
      else if (input.secret) secret = encryptSecret(input.secret, key());
      const record = await repo.update(id, {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.url !== undefined ? { url: input.url } : {}),
        authKind,
        headerName: authKind === 'header' ? (input.headerName ?? current.headerName) : null,
        secret,
      });
      return record ? toPublicSource(record) : null;
    },
    remove: (id) => repo.remove(id),
    async runGraphql(id, body) {
      const source = await repo.get(id);
      if (!source) return null;
      const secret = source.secret ? decryptSecret(source.secret, key()) : null;
      return forwardGraphql(source.url, authHeaders(source, secret), body, opts);
    },
  };
}
