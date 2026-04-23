import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import type { Digest } from './types'

const DB_PATH = path.join(process.cwd(), 'data', 'digest.db')

let db: Database.Database | null = null

function getDb(): Database.Database {
  if (db) return db

  const dataDir = path.dirname(DB_PATH)
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true })
  }

  db = new Database(DB_PATH)
  db.exec(`
    CREATE TABLE IF NOT EXISTS digests (
      date        TEXT    PRIMARY KEY,
      data        TEXT    NOT NULL,
      created_at  INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `)

  return db
}

export function saveDigest(date: string, data: Digest): void {
  const database = getDb()
  database
    .prepare('INSERT OR REPLACE INTO digests (date, data, created_at) VALUES (?, ?, ?)')
    .run(date, JSON.stringify(data), Date.now())
}

export function getDigest(date: string): Digest | null {
  const database = getDb()
  const row = database
    .prepare('SELECT data FROM digests WHERE date = ?')
    .get(date) as { data: string } | undefined
  return row ? (JSON.parse(row.data) as Digest) : null
}

export function getAvailableDates(): string[] {
  const database = getDb()
  const rows = database
    .prepare('SELECT date FROM digests ORDER BY date DESC')
    .all() as { date: string }[]
  return rows.map(r => r.date)
}
