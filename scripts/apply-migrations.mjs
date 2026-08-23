#!/usr/bin/env node
/**
 * Apply SQL migrations using Supabase SQL API via service role postgres REST is not available.
 * Uses the Management-less approach: execute via `pg` if DATABASE_URL set,
 * otherwise prints instructions.
 *
 * Preferred: SUPABASE_DB_URL (direct postgres connection string from project settings)
 * or paste files in SQL Editor.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const migrationsDir = join(root, 'supabase/migrations')

const files = readdirSync(migrationsDir)
  .filter((f) => f.endsWith('.sql'))
  .sort()

const combined = files
  .map((f) => `-- >>> ${f}\n` + readFileSync(join(migrationsDir, f), 'utf8'))
  .join('\n\n')

const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL

if (!dbUrl) {
  console.log('No SUPABASE_DB_URL set.')
  console.log('Open Supabase Dashboard → SQL Editor and run files in order:')
  files.forEach((f) => console.log(` - supabase/migrations/${f}`))
  console.log('\nOr set SUPABASE_DB_URL and rerun: npm run db:apply')
  process.exit(0)
}

const { default: pg } = await import('pg').catch(() => ({ default: null }))
if (!pg) {
  console.error('Install pg: npm install -D pg')
  process.exit(1)
}

const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })
await client.connect()
try {
  await client.query(combined)
  console.log('Migrations applied:', files.join(', '))
} finally {
  await client.end()
}
