/**
 * db/migrate.ts — Migration CLI with rollback + pre-migration backup.
 *
 * Usage (tsx):
 *   tsx db/migrate.ts up [dbPath]     # backup, then apply pending .sql files
 *   tsx db/migrate.ts down [dbPath]   # backup, then roll back 0002_products
 *
 * `down` intentionally only reverses 0002 (products): earlier migrations are
 * the app baseline and have no recorded rollback. Nothing here replaces
 * initDatabase() — the Electron main process keeps using runMigrations().
 */
import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export const MIGRATIONS_DIR = path.join(__dirname, 'migrations')

/** Copy the live DB file to a timestamped backup. Returns the backup path. */
export function backupDatabase(dbPath: string): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupPath = `${dbPath}.bak_${stamp}`
  fs.copyFileSync(dbPath, backupPath)
  console.log(`[migrate] Backup written to ${backupPath}`)
  return backupPath
}

function sortedMigrationFiles(): string[] {
  return fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort()
}

/** Apply every .sql migration in order (idempotent — tolerates "already exists"). */
export function migrateUp(sqlite: Database.Database): void {
  for (const file of sortedMigrationFiles()) {
    const ddl = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8')
    try {
      sqlite.exec(ddl)
      console.log(`[migrate] Applied ${file}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (/already exists/i.test(message)) {
        console.warn(`[migrate] ${file} already applied, skipping`)
        continue
      }
      throw error
    }
  }
}

/** Roll back migration 0002 (products table + indexes drop with the table). */
export function migrateDown(sqlite: Database.Database): void {
  sqlite.exec('DROP TABLE IF EXISTS `products`')
  console.log('[migrate] Rolled back 0002_products (dropped `products`)')
}

function openDb(dbPath: string): Database.Database {
  const sqlite = new Database(dbPath)
  sqlite.pragma('foreign_keys = ON')
  return sqlite
}

function main(): void {
  const [command, dbPathArg] = process.argv.slice(2)
  if (command !== 'up' && command !== 'down') {
    console.error('Usage: tsx db/migrate.ts <up|down> [dbPath]')
    process.exit(1)
  }
  const dbPath = dbPathArg ?? process.env['OPEN3DCALC_DB_PATH'] ?? path.join(__dirname, '..', 'open3dcalc.db')
  if (!fs.existsSync(dbPath) && command === 'down') {
    console.error(`[migrate] Database not found at ${dbPath}`)
    process.exit(1)
  }
  backupDatabase(dbPath)
  const sqlite = openDb(dbPath)
  try {
    if (command === 'up') migrateUp(sqlite)
    else migrateDown(sqlite)
  } finally {
    sqlite.close()
  }
}

if (process.argv[1] === __filename) {
  main()
}
