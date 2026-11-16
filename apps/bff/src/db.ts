import 'dotenv/config';
import { Prisma } from './generated/prisma/client';
import { createStorage } from './storage/client';
import { resolveStorageMode } from './storage/mode';

export const storageMode = resolveStorageMode(process.env);
const storage = createStorage(storageMode);

export const prisma = storage.prisma;
/** Must be awaited before serving requests (applies migrations on PGlite). */
export const initDb = storage.init;
export const closeDb = storage.close;

export { Prisma };
