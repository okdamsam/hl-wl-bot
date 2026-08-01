import Database from 'better-sqlite3';
import { readdirSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from '../config.js';
import { logger } from '../lib/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Ensure the directory containing the database file exists.
const dbDir = dirname(config.DATABASE_PATH);
if (dbDir) mkdirSync(dbDir, { recursive: true });

export const db = new Database(config.DATABASE_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function runMigrations(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      filename   TEXT    PRIMARY KEY,
      applied_at INTEGER NOT NULL
    )
  `);

  const migrationsDir = join(__dirname, 'migrations');

  if (!existsSync(migrationsDir)) {
    logger.info('No migrations directory found, skipping');
    return;
  }

  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const applied = new Set(
    (db.prepare('SELECT filename FROM _migrations').all() as { filename: string }[]).map(
      (r) => r.filename
    )
  );

  for (const file of files) {
    if (applied.has(file)) continue;

    const sql = readFileSync(join(migrationsDir, file), 'utf-8');
    logger.info(`Applying migration: ${file}`);
    db.exec(sql);
    db.prepare('INSERT INTO _migrations (filename, applied_at) VALUES (?, ?)').run(
      file,
      Math.floor(Date.now() / 1000)
    );
    logger.info(`Applied: ${file}`);
  }
}
