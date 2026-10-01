#!/usr/bin/env node
/**
 * SAATHI migration runner.
 *
 * Applies every file in database/migrations/, in filename order, that
 * hasn't already been recorded in the schema_migrations table. Each
 * migration runs inside its own transaction: either the whole file applies
 * or none of it does.
 *
 * schema_migrations is infrastructure for the runner itself, not part of
 * the frozen domain schema — it is created here, not in database/schema.sql,
 * so the canonical schema stays exactly what API_CONTRACT.md and the
 * schema.sql header describe.
 *
 * Safety property this enforces: an already-applied migration is
 * re-checksummed on every run. If a file that's already recorded as applied
 * has changed on disk, the runner refuses to continue rather than silently
 * re-applying or ignoring the drift — a frozen migration must not be
 * hand-edited after the fact (see 001_baseline.sql's own header).
 *
 * Usage:
 *   node scripts/migrate.js            # apply pending migrations
 *   node scripts/migrate.js --dry-run  # show what would run, apply nothing
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Pool } = require('pg');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'database', 'migrations');
const DRY_RUN = process.argv.includes('--dry-run');

function checksum(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function loadMigrationFiles() {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort() // filenames are zero-padded/numbered, so lexical sort == apply order
    .map((filename) => {
      const filePath = path.join(MIGRATIONS_DIR, filename);
      const sql = fs.readFileSync(filePath, 'utf8');
      return { filename, sql, checksum: checksum(sql) };
    });
}

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id          SERIAL PRIMARY KEY,
      filename    TEXT NOT NULL UNIQUE,
      checksum    TEXT NOT NULL,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

async function getAppliedMigrations(client) {
  const { rows } = await client.query(
    'SELECT filename, checksum FROM schema_migrations ORDER BY id ASC'
  );
  const map = new Map();
  for (const row of rows) map.set(row.filename, row.checksum);
  return map;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set (check .env).');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    await ensureMigrationsTable(client);
    const applied = await getAppliedMigrations(client);
    const files = loadMigrationFiles();

    if (files.length === 0) {
      console.log(`No migration files found in ${MIGRATIONS_DIR}`);
      return;
    }

    let pendingCount = 0;

    for (const { filename, sql, checksum: sum } of files) {
      const appliedChecksum = applied.get(filename);

      if (appliedChecksum) {
        if (appliedChecksum !== sum) {
          console.error(
            `\nSCHEMA DRIFT DETECTED: ${filename} was already applied with checksum ` +
            `${appliedChecksum.slice(0, 12)}... but the file on disk now checksums to ` +
            `${sum.slice(0, 12)}...\n` +
            `A migration file must never be edited after it has been applied. ` +
            `If the schema needs to change, add a new migration instead. Refusing to continue.`
          );
          process.exit(1);
        }
        continue; // already applied, unchanged — skip
      }

      pendingCount += 1;
      if (DRY_RUN) {
        console.log(`[dry run] would apply: ${filename}`);
        continue;
      }

      console.log(`Applying ${filename} ...`);
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (filename, checksum) VALUES ($1, $2)',
          [filename, sum]
        );
        await client.query('COMMIT');
        console.log(`  ✓ ${filename} applied`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`  ✗ ${filename} failed — rolled back.\n${err.message}`);
        process.exit(1);
      }
    }

    if (pendingCount === 0) {
      console.log('Database is already up to date. No migrations to apply.');
    } else if (DRY_RUN) {
      console.log(`\n${pendingCount} migration(s) pending (dry run — none applied).`);
    } else {
      console.log(`\n${pendingCount} migration(s) applied successfully.`);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
