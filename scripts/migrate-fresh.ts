import 'dotenv/config'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { readMigrationFiles } from 'drizzle-orm/migrator'

if (!process.env.DIRECT_URL) {
  throw new Error('DIRECT_URL is not set. Check .env or .env.local')
}

const config = { migrationsFolder: './migrations' }

async function main() {
  const migrations = readMigrationFiles(config)

  // Postgres forbids using a brand-new enum value (from an ALTER TYPE ...
  // ADD VALUE) inside the same transaction that added it — including in
  // index predicates and CHECK constraints (see migrations/0010 +
  // migrations/0011, and docs/DECISIONS.md). `drizzle-kit migrate` applies
  // every pending migration in a single transaction, which only breaks
  // against a genuinely empty database: on the real dev/prod project,
  // migrations were applied incrementally, so the ADD VALUE was already
  // committed by the time a migration that uses it existed.
  //
  // Fix: split into two batches at the last migration that adds an enum
  // value, so it commits before anything that might depend on it runs.
  // Reuses Drizzle's own migrator (readMigrationFiles + dialect.migrate)
  // instead of reimplementing its bookkeeping.
  const splitIndex = migrations.reduce(
    (lastIndex, migration, index) =>
      migration.sql.some((stmt) => /ADD VALUE/i.test(stmt)) ? index : lastIndex,
    -1,
  )

  const sql = postgres(process.env.DIRECT_URL!, {
    max: 1,
    // 'require' encrypts the connection without validating the certificate
    // chain — full chain verification (`true`) fails on networks with a
    // TLS-inspecting proxy/antivirus injecting their own root cert, which
    // `postgres`/`drizzle-kit` elsewhere in this project don't run into
    // because they don't set `ssl` at all (see src/lib/db/index.ts).
    ssl: process.env.CI ? false : 'require',
  })
  // `dialect`/`session` back the public migrate() Drizzle exports but
  // aren't part of its typed public API — same objects migrate() itself
  // calls internally (drizzle-orm/postgres-js/migrator.cjs).
  const db = drizzle(sql) as unknown as {
    dialect: { migrate: (migrations: unknown, session: unknown, config: unknown) => Promise<void> }
    session: unknown
  }

  if (splitIndex === -1) {
    await db.dialect.migrate(migrations, db.session, config)
  } else {
    await db.dialect.migrate(migrations.slice(0, splitIndex + 1), db.session, config)
    await db.dialect.migrate(migrations.slice(splitIndex + 1), db.session, config)
  }

  await sql.end()
  console.log(`Applied ${migrations.length} migration(s) to a fresh database.`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
