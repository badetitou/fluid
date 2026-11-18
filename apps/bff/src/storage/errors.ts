/** Prisma's "record to update/delete not found"; any other failure must surface. */
export function isNotFound(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: unknown }).code === 'P2025';
}
