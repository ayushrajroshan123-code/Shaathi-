const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { query } = require('../src/db');

function checksum(content) {
  const normalized = content.replace(/\r\n/g, '\n');
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

async function run() {
  console.log('--- STARTING MIGRATION RUNNER INTEGRATION & UNIT TEST ---');

  // 1. Guard against non-test database
  const { rows: dbRows } = await query('SELECT current_database() AS db');
  assert.strictEqual(dbRows[0].db, 'saathi_test', 'Must target saathi_test');
  console.log('[Database Guard] Verified connected to saathi_test');

  // 2. Determinism across CRLF and LF
  const sampleUnix = "CREATE TABLE test (\n  id SERIAL PRIMARY KEY\n);\n";
  const sampleWindows = "CREATE TABLE test (\r\n  id SERIAL PRIMARY KEY\r\n);\r\n";
  assert.strictEqual(checksum(sampleUnix), checksum(sampleWindows), 'Checksum must be identical across CRLF and LF');
  console.log('[Test 01] Checksum determinism across LF and CRLF: PASS');

  // 3. Tamper detection logic
  const originalHash = checksum(sampleUnix);
  const tamperedContent = "CREATE TABLE test (\n  id SERIAL PRIMARY KEY,\n  tampered BOOL\n);\n";
  const tamperedHash = checksum(tamperedContent);
  assert.notStrictEqual(originalHash, tamperedHash, 'Tampered content must produce different checksum');
  console.log('[Test 02] Tamper detection distinguishes modified migration: PASS');

  // 4. Live database verification: all 8 migrations match schema_migrations
  const { rows: appliedRows } = await query('SELECT filename, checksum FROM schema_migrations ORDER BY id ASC');
  assert.strictEqual(appliedRows.length, 8, 'Expected exactly 8 applied migrations');

  const migrationsDir = path.join(__dirname, '..', 'database', 'migrations');
  const filesOnDisk = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
  assert.strictEqual(filesOnDisk.length, 8, 'Expected exactly 8 migration files on disk');

  for (let i = 0; i < filesOnDisk.length; i++) {
    const filename = filesOnDisk[i];
    const sql = fs.readFileSync(path.join(migrationsDir, filename), 'utf8');
    const diskHash = checksum(sql);
    const dbRecord = appliedRows.find(r => r.filename === filename);

    assert(dbRecord, `Migration ${filename} must exist in schema_migrations`);
    assert.strictEqual(diskHash, dbRecord.checksum, `Checksum on disk must match database for ${filename}`);
  }
  console.log('[Test 03] All 8 migrations on disk match database records: PASS');

  console.log('--- ALL MIGRATION RUNNER TESTS PASSED ---');
}

run().catch(err => {
  console.error('Migration runner test failed:', err);
  process.exit(1);
});
