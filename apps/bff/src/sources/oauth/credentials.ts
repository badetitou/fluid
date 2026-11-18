import type { PrismaClient } from '../../generated/prisma/client';
import type { CredentialRecord } from './model';

// The only Prisma access for OAuth credentials. Tokens arrive and leave encrypted.
//
// Writes are conditional on the source's `authGeneration`, which sign-out, reconfiguration and
// delete bump. The check and the write run in one transaction that first takes the source row's
// lock (a no-op update guarded by the generation), so a token write cannot slip in after an
// invalidation: either it commits first and the invalidation then removes it, or the
// invalidation commits first and the write is refused.

export interface CredentialData {
  sourceId: string;
  /** Already encrypted. */
  accessToken: string;
  /** Already encrypted. */
  refreshToken: string | null;
  expiresAt: Date | null;
  scope: string | null;
}

export interface WriteGuard {
  /** The source's `authGeneration` when the sign-in or refresh began. */
  generation: number;
  /** Refresh only: the access-token ciphertext that was read; the write needs it unchanged. */
  expectedAccessToken?: string;
}

export interface CredentialRepository {
  get(sourceId: string): Promise<CredentialRecord | null>;
  /** Writes the credential unless the guard no longer holds; false when it was refused. */
  saveIf(data: CredentialData, guard: WriteGuard): Promise<boolean>;
  /** Signs out: deletes the credential and bumps the generation. True when a credential existed. */
  revoke(sourceId: string): Promise<boolean>;
}

export function createCredentialRepository(prisma: PrismaClient): CredentialRepository {
  return {
    get: (sourceId) => prisma.oAuthCredential.findUnique({ where: { sourceId } }),

    saveIf({ sourceId, ...rest }, { generation, expectedAccessToken }) {
      return prisma.$transaction(async (tx) => {
        const locked = await tx.sourceConfig.updateMany({
          where: { id: sourceId, authGeneration: generation },
          data: { authGeneration: generation },
        });
        if (locked.count === 0) return false;
        if (expectedAccessToken !== undefined) {
          const updated = await tx.oAuthCredential.updateMany({
            where: { sourceId, accessToken: expectedAccessToken },
            data: rest,
          });
          return updated.count === 1;
        }
        await tx.oAuthCredential.upsert({ where: { sourceId }, create: { sourceId, ...rest }, update: rest });
        return true;
      });
    },

    revoke(sourceId) {
      return prisma.$transaction(async (tx) => {
        await tx.sourceConfig.updateMany({ where: { id: sourceId }, data: { authGeneration: { increment: 1 } } });
        const removed = await tx.oAuthCredential.deleteMany({ where: { sourceId } });
        return removed.count > 0;
      });
    },
  };
}
