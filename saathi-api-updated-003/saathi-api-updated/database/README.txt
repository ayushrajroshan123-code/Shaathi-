SAATHI database — migration layer
==================================

database/schema.sql is the canonical, human-reviewed, frozen artifact.
It is not run directly anymore. Instead:

  database/migrations/001_baseline.sql
    An executable copy of schema.sql's exact body at the moment it was
    frozen. This is what actually gets applied to a database.

  database/migrations/002_auth.sql
    Additive: real session auth (email + password only — see
    API_CONTRACT.md decision #7.1). Adds columns to `users` and a new
    `sessions` table. Does not redefine anything 001 already declared.

Both files are applied, in order, by the migration runner — never by
hand with psql -f, so that what's applied is tracked and checksummed.

Setup
-----

  cp .env.example .env        # set DATABASE_URL to an empty database
  npm install
  npm run migrate             # applies 001, then 002, in order
  npm run verify-schema       # introspects the live DB, diffs it against
                               # database/expected-schema.json

`npm run db:setup` does both in sequence. Run `npm run migrate:dry-run`
first if you just want to see what's pending without applying anything.

How the runner protects "frozen"
---------------------------------

Every migration file is checksummed (SHA-256) at apply time, and the
checksum is stored in schema_migrations (a bookkeeping table the runner
itself creates — it is not part of the frozen domain schema, and
verify-schema.js ignores it). On every subsequent run, already-applied
files are re-checksummed against disk. If a frozen migration file was
hand-edited after being applied, the runner refuses to continue rather
than silently re-applying or ignoring the drift.

This means the correct way to change something schema.sql already
declares is the same discipline API_CONTRACT.md uses: never edit
001_baseline.sql (or schema.sql) after the fact. Update schema.sql as the
readable record of the new decision, then add a new numbered migration
(003_*, 004_*, ...) that ALTERs the live schema to match, and update
database/expected-schema.json in the same change.

Adding a new migration
-----------------------

  1. Write database/migrations/00N_<name>.sql — additive/ALTER only,
     following 002_auth.sql's pattern. Never edit an already-applied file.
  2. Update database/expected-schema.json to describe the resulting
     shape (new/changed tables, columns, indexes, triggers).
  3. Update database/schema.sql's own comments if the change reflects a
     new frozen decision (per the amend-by-superseding rule), or note in
     the new migration's header that it's a deliberate deviation pending
     a schema.sql update.
  4. npm run migrate && npm run verify-schema.

Fresh vs. existing databases
------------------------------

001_baseline.sql assumes a genuinely empty database (its CREATE TABLE
statements have no IF NOT EXISTS / OR REPLACE guards, matching
schema.sql's own "frozen" posture — it should never need to be
re-applied). If you already have a database that was set up by running
the old schema.sql directly with psql, do NOT run the migration runner
against it as-is: either start from a clean database, or manually
INSERT a row into schema_migrations for 001_baseline.sql (with its
correct checksum) before running `npm run migrate`, so the runner treats
001 as already applied and only runs 002 onward.
