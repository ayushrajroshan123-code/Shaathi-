#!/usr/bin/env node
/**
 * SAATHI schema verifier.
 *
 * Introspects a live PostgreSQL database and diffs it against
 * database/expected-schema.json (tables, columns, indexes, triggers,
 * functions, extensions). This is the mechanical check that "the code was
 * written to match schema.sql" actually holds against a real database, not
 * just against the SQL file on disk.
 *
 * Exit code 0 = matches. Exit code 1 = drift found (printed in detail).
 *
 * Usage:
 *   node scripts/verify-schema.js
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const MANIFEST_PATH = path.join(__dirname, '..', 'database', 'expected-schema.json');

function diffSets(expected, actual) {
  const expectedSet = new Set(expected);
  const actualSet = new Set(actual);
  const missing = [...expectedSet].filter((x) => !actualSet.has(x));
  const extra = [...actualSet].filter((x) => !expectedSet.has(x));
  return { missing, extra };
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set (check .env).');
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  let hasDrift = false;
  const report = [];

  function fail(section, message) {
    hasDrift = true;
    report.push({ section, ok: false, message });
  }
  function pass(section, message) {
    report.push({ section, ok: true, message });
  }

  try {
    // --- Extensions ---------------------------------------------------
    const { rows: extRows } = await client.query(
      `SELECT extname FROM pg_extension`
    );
    const installedExt = extRows.map((r) => r.extname);
    for (const ext of manifest.extensions) {
      if (installedExt.includes(ext)) {
        pass('extension', `${ext} installed`);
      } else {
        fail('extension', `${ext} is NOT installed`);
      }
    }

    // --- Tables ---------------------------------------------------------
    const { rows: tableRows } = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `);
    const excludedTables = Object.keys(manifest.excluded_from_verification || {});
    const actualTables = tableRows
      .map((r) => r.table_name)
      .filter((t) => !excludedTables.includes(t));
    const expectedTables = Object.keys(manifest.tables);

    const tableDiff = diffSets(expectedTables, actualTables);
    if (tableDiff.missing.length) {
      fail('tables', `missing tables: ${tableDiff.missing.join(', ')}`);
    }
    if (tableDiff.extra.length) {
      fail('tables', `unexpected tables not in manifest: ${tableDiff.extra.join(', ')}`);
    }
    if (!tableDiff.missing.length && !tableDiff.extra.length) {
      pass('tables', `all ${expectedTables.length} expected tables present, no extras`);
    }

    // --- Columns per table -----------------------------------------------
    for (const [table, spec] of Object.entries(manifest.tables)) {
      if (!actualTables.includes(table)) continue; // already reported as missing above

      const { rows: colRows } = await client.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = $1`,
        [table]
      );
      const actualCols = colRows.map((r) => r.column_name);
      const colDiff = diffSets(spec.columns, actualCols);

      if (colDiff.missing.length || colDiff.extra.length) {
        if (colDiff.missing.length) {
          fail(`columns:${table}`, `missing columns: ${colDiff.missing.join(', ')}`);
        }
        if (colDiff.extra.length) {
          fail(`columns:${table}`, `unexpected columns: ${colDiff.extra.join(', ')}`);
        }
      } else {
        pass(`columns:${table}`, `all ${spec.columns.length} expected columns present`);
      }

      // --- Indexes for this table ---
      if (spec.indexes && spec.indexes.length) {
        const { rows: idxRows } = await client.query(
          `SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND tablename = $1`,
          [table]
        );
        const actualIdx = idxRows.map((r) => r.indexname);
        const idxDiff = diffSets(spec.indexes, actualIdx);
        if (idxDiff.missing.length) {
          fail(`indexes:${table}`, `missing indexes: ${idxDiff.missing.join(', ')}`);
        } else {
          pass(`indexes:${table}`, `all ${spec.indexes.length} expected indexes present`);
        }
      }

      // --- Triggers for this table ---
      if (spec.triggers && spec.triggers.length) {
        const { rows: trigRows } = await client.query(
          `SELECT DISTINCT trigger_name FROM information_schema.triggers
           WHERE event_object_schema = 'public' AND event_object_table = $1`,
          [table]
        );
        const actualTrig = trigRows.map((r) => r.trigger_name);
        const trigDiff = diffSets(spec.triggers, actualTrig);
        if (trigDiff.missing.length) {
          fail(`triggers:${table}`, `missing triggers: ${trigDiff.missing.join(', ')}`);
        } else {
          pass(`triggers:${table}`, `all ${spec.triggers.length} expected triggers present`);
        }
      }
    }

    // --- Functions ---------------------------------------------------------
    const { rows: fnRows } = await client.query(`
      SELECT routine_name FROM information_schema.routines
      WHERE routine_schema = 'public' AND routine_type = 'FUNCTION'
    `);
    const actualFns = fnRows.map((r) => r.routine_name);
    const fnDiff = diffSets(manifest.functions, actualFns);
    if (fnDiff.missing.length) {
      fail('functions', `missing functions: ${fnDiff.missing.join(', ')}`);
    } else {
      pass('functions', `all ${manifest.functions.length} expected functions present`);
    }
  } finally {
    client.release();
    await pool.end();
  }

  // --- Report ---------------------------------------------------------
  console.log('\nSAATHI schema verification\n' + '='.repeat(60));
  for (const { section, ok, message } of report) {
    console.log(`${ok ? '✓' : '✗'} [${section}] ${message}`);
  }
  console.log('='.repeat(60));
  if (hasDrift) {
    console.log('RESULT: DRIFT DETECTED — live database does not match database/expected-schema.json\n');
    process.exit(1);
  } else {
    console.log('RESULT: MATCH — live database matches the canonical schema.\n');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
