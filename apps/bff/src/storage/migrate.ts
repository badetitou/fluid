import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { PGlite } from '@electric-sql/pglite';

const TRACKING_TABLE = '_fluid_migrations';

/** Applies prisma/migrations/<name>/migration.sql in order, once each, without the prisma CLI. */
export async function applyMigrations(db: PGlite, migrationsDir: string): Promise<string[]> {
  await db.exec(
    `CREATE TABLE IF NOT EXISTS "${TRACKING_TABLE}" (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`,
  );
  const done = await db.query<{ name: string }>(`SELECT name FROM "${TRACKING_TABLE}"`);
  const applied = new Set(done.rows.map((r) => r.name));

  const names = readdirSync(migrationsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(join(migrationsDir, e.name, 'migration.sql')))
    .map((e) => e.name)
    .sort();

  const newlyApplied: string[] = [];
  for (const name of names) {
    if (applied.has(name)) continue;
    const sql = readFileSync(join(migrationsDir, name, 'migration.sql'), 'utf8');
    await db.transaction(async (tx) => {
      await tx.exec(sql);
      await tx.query(`INSERT INTO "${TRACKING_TABLE}" (name) VALUES ($1)`, [name]);
    });
    newlyApplied.push(name);
  }
  return newlyApplied;
}
