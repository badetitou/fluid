import type { PrismaClient } from '../../generated/prisma/client';
import { isNotFound } from '../repository';
import type { CredentialRecord } from './model';

// The only Prisma access for OAuth credentials. Tokens arrive and leave encrypted.

export interface CredentialData {
  sourceId: string;
  /** Already encrypted. */
  accessToken: string;
  /** Already encrypted. */
  refreshToken: string | null;
  expiresAt: Date | null;
  scope: string | null;
}

export interface CredentialRepository {
  get(sourceId: string): Promise<CredentialRecord | null>;
  save(data: CredentialData): Promise<void>;
  remove(sourceId: string): Promise<boolean>;
}

export function createCredentialRepository(prisma: PrismaClient): CredentialRepository {
  return {
    get: (sourceId) => prisma.oAuthCredential.findUnique({ where: { sourceId } }),
    async save({ sourceId, ...rest }) {
      await prisma.oAuthCredential.upsert({ where: { sourceId }, create: { sourceId, ...rest }, update: rest });
    },
    async remove(sourceId) {
      try {
        await prisma.oAuthCredential.delete({ where: { sourceId } });
        return true;
      } catch (err) {
        if (isNotFound(err)) return false;
        throw err;
      }
    },
  };
}
