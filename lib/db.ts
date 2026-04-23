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
    );

    CREATE TABLE IF NOT EXISTS reactions (
      url         TEXT    PRIMARY KEY,
      category    TEXT    NOT NULL,
      reaction    TEXT    NOT NULL CHECK(reaction IN ('like', 'dislike')),
      digest_date TEXT    NOT NULL,
      created_at  INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS reactions_category ON reactions(category);

    CREATE TABLE IF NOT EXISTS custom_feeds (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      url         TEXT    NOT NULL UNIQUE,
      title       TEXT    NOT NULL DEFAULT '',
      created_at  INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS user_prefs (
      user_id  TEXT PRIMARY KEY,
      theme    TEXT NOT NULL DEFAULT 'jade',
      font     TEXT NOT NULL DEFAULT 'inter'
    );
  `)

  return db
}

// ── Digests ──────────────────────────────────────────────────────────────────

export function saveDigest(date: string, data: Digest): void {
  getDb()
    .prepare('INSERT OR REPLACE INTO digests (date, data, created_at) VALUES (?, ?, ?)')
    .run(date, JSON.stringify(data), Date.now())
}

export function getDigest(date: string): Digest | null {
  const row = getDb()
    .prepare('SELECT data FROM digests WHERE date = ?')
    .get(date) as { data: string } | undefined
  return row ? (JSON.parse(row.data) as Digest) : null
}

export function getAvailableDates(): string[] {
  const rows = getDb()
    .prepare('SELECT date FROM digests ORDER BY date DESC')
    .all() as { date: string }[]
  return rows.map(r => r.date)
}

// ── Reactions ─────────────────────────────────────────────────────────────────

export function saveReaction(
  url: string,
  category: string,
  reaction: 'like' | 'dislike',
  digestDate: string
): void {
  getDb()
    .prepare(`
      INSERT INTO reactions (url, category, reaction, digest_date)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(url) DO UPDATE SET reaction = excluded.reaction, created_at = unixepoch()
    `)
    .run(url, category, reaction, digestDate)
}

export interface CategoryPreference {
  likes: number
  dislikes: number
  total: number
  score: number  // 0–100, higher = more liked
}

// ── Custom feeds ──────────────────────────────────────────────────────────────

export interface CustomFeed {
  id: number
  url: string
  title: string
  created_at: number
}

export function getCustomFeeds(): CustomFeed[] {
  return getDb()
    .prepare('SELECT id, url, title, created_at FROM custom_feeds ORDER BY created_at DESC')
    .all() as CustomFeed[]
}

export function addCustomFeed(url: string, title: string): CustomFeed {
  const db = getDb()
  const stmt = db.prepare('INSERT OR IGNORE INTO custom_feeds (url, title) VALUES (?, ?)')
  stmt.run(url, title)
  return db.prepare('SELECT id, url, title, created_at FROM custom_feeds WHERE url = ?').get(url) as CustomFeed
}

export function deleteCustomFeed(id: number): void {
  getDb().prepare('DELETE FROM custom_feeds WHERE id = ?').run(id)
}

// ── User preferences ──────────────────────────────────────────────────────────

export function getUserPrefs(userId: string): { theme: string; font: string } {
  const row = getDb()
    .prepare('SELECT theme, font FROM user_prefs WHERE user_id = ?')
    .get(userId) as { theme: string; font: string } | undefined
  return row ?? { theme: 'jade', font: 'inter' }
}

export function setUserPrefs(userId: string, theme: string, font: string): void {
  getDb()
    .prepare('INSERT OR REPLACE INTO user_prefs (user_id, theme, font) VALUES (?, ?, ?)')
    .run(userId, theme, font)
}

export function getCategoryPreferences(): Record<string, CategoryPreference> {
  const rows = getDb()
    .prepare(`
      SELECT category, reaction, COUNT(*) as count
      FROM reactions
      GROUP BY category, reaction
    `)
    .all() as { category: string; reaction: string; count: number }[]

  const prefs: Record<string, CategoryPreference> = {}

  for (const row of rows) {
    if (!prefs[row.category]) {
      prefs[row.category] = { likes: 0, dislikes: 0, total: 0, score: 50 }
    }
    if (row.reaction === 'like') prefs[row.category].likes = row.count
    else prefs[row.category].dislikes = row.count
  }

  for (const cat of Object.values(prefs)) {
    cat.total = cat.likes + cat.dislikes
    cat.score = cat.total > 0 ? Math.round((cat.likes / cat.total) * 100) : 50
  }

  return prefs
}
