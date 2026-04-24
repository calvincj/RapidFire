import path from 'path'
import { createClient } from '@libsql/client'
import type { Digest } from './types'

type SqlValue = string | number | null

function resolveDbUrl(): string {
  if (process.env.TURSO_DATABASE_URL) {
    return process.env.TURSO_DATABASE_URL
  }

  const localPath = process.env.RAPIDFIRE_DB_PATH ?? path.join(process.cwd(), 'data', 'digest.db')
  return `file:${localPath}`
}

const client = createClient({
  url: resolveDbUrl(),
  authToken: process.env.TURSO_AUTH_TOKEN,
})

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS digests (
    date        TEXT    PRIMARY KEY,
    data        TEXT    NOT NULL,
    created_at  INTEGER NOT NULL DEFAULT (unixepoch())
  )`,
  `CREATE TABLE IF NOT EXISTS user_reactions (
    user_id     TEXT    NOT NULL,
    url         TEXT    NOT NULL,
    category    TEXT    NOT NULL,
    reaction    TEXT    NOT NULL CHECK(reaction IN ('like', 'dislike')),
    digest_date TEXT    NOT NULL,
    created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
    PRIMARY KEY (user_id, url)
  )`,
  `CREATE INDEX IF NOT EXISTS user_reactions_user_category ON user_reactions(user_id, category)`,
  `CREATE TABLE IF NOT EXISTS custom_feeds (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    url         TEXT    NOT NULL UNIQUE,
    title       TEXT    NOT NULL DEFAULT '',
    created_at  INTEGER NOT NULL DEFAULT (unixepoch())
  )`,
  `CREATE TABLE IF NOT EXISTS user_prefs (
    user_id  TEXT PRIMARY KEY,
    theme    TEXT NOT NULL DEFAULT 'jade',
    font     TEXT NOT NULL DEFAULT 'inter'
  )`,
] as const

let initPromise: Promise<void> | null = null

async function ensureDb(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      for (const sql of schemaStatements) {
        await client.execute(sql)
      }
    })()
  }

  await initPromise
}

async function execute(sql: string, args: SqlValue[] = []) {
  await ensureDb()
  return client.execute({ sql, args })
}

function num(value: unknown): number {
  return typeof value === 'number' ? value : Number(value)
}

// Digests

export async function saveDigest(date: string, data: Digest): Promise<void> {
  await execute(
    'INSERT OR REPLACE INTO digests (date, data, created_at) VALUES (?, ?, ?)',
    [date, JSON.stringify(data), Date.now()]
  )
}

export async function getDigest(date: string): Promise<Digest | null> {
  const result = await execute('SELECT data FROM digests WHERE date = ?', [date])
  const row = result.rows[0] as { data?: string } | undefined
  return row?.data ? (JSON.parse(row.data) as Digest) : null
}

export async function getAvailableDates(): Promise<string[]> {
  const result = await execute('SELECT date FROM digests ORDER BY date DESC')
  return result.rows.map(row => String(row.date))
}

// Reactions

export async function saveReaction(
  userId: string,
  url: string,
  category: string,
  reaction: 'like' | 'dislike',
  digestDate: string
): Promise<void> {
  await execute(
    `INSERT INTO user_reactions (user_id, url, category, reaction, digest_date)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id, url) DO UPDATE SET
       reaction = excluded.reaction,
       category = excluded.category,
       digest_date = excluded.digest_date,
       created_at = unixepoch()`,
    [userId, url, category, reaction, digestDate]
  )
}

export interface CategoryPreference {
  likes: number
  dislikes: number
  total: number
  score: number
}

// Custom feeds

export interface CustomFeed {
  id: number
  url: string
  title: string
  created_at: number
}

export async function getCustomFeeds(): Promise<CustomFeed[]> {
  const result = await execute(
    'SELECT id, url, title, created_at FROM custom_feeds ORDER BY created_at DESC'
  )

  return result.rows.map(row => ({
    id: num(row.id),
    url: String(row.url),
    title: String(row.title),
    created_at: num(row.created_at),
  }))
}

export async function addCustomFeed(url: string, title: string): Promise<CustomFeed> {
  await execute('INSERT OR IGNORE INTO custom_feeds (url, title) VALUES (?, ?)', [url, title])
  const result = await execute(
    'SELECT id, url, title, created_at FROM custom_feeds WHERE url = ?',
    [url]
  )
  const row = result.rows[0]
  if (!row) throw new Error('Failed to create custom feed')

  return {
    id: num(row.id),
    url: String(row.url),
    title: String(row.title),
    created_at: num(row.created_at),
  }
}

export async function deleteCustomFeed(id: number): Promise<void> {
  await execute('DELETE FROM custom_feeds WHERE id = ?', [id])
}

// User preferences

export async function getUserPrefs(userId: string): Promise<{ theme: string; font: string }> {
  const result = await execute('SELECT theme, font FROM user_prefs WHERE user_id = ?', [userId])
  const row = result.rows[0] as { theme?: string; font?: string } | undefined
  return {
    theme: row?.theme ? String(row.theme) : 'jade',
    font: row?.font ? String(row.font) : 'inter',
  }
}

export async function setUserPrefs(userId: string, theme: string, font: string): Promise<void> {
  await execute(
    'INSERT OR REPLACE INTO user_prefs (user_id, theme, font) VALUES (?, ?, ?)',
    [userId, theme, font]
  )
}

export async function getCategoryPreferences(userId?: string): Promise<Record<string, CategoryPreference>> {
  const result = userId
    ? await execute(
        `SELECT category, reaction, COUNT(*) as count
         FROM user_reactions
         WHERE user_id = ?
         GROUP BY category, reaction`,
        [userId]
      )
    : await execute(
        `SELECT category, reaction, COUNT(*) as count
         FROM user_reactions
         GROUP BY category, reaction`
      )

  const prefs: Record<string, CategoryPreference> = {}

  for (const row of result.rows as unknown as Array<{ category: unknown; reaction: unknown; count: unknown }>) {
    const category = String(row.category)
    if (!prefs[category]) {
      prefs[category] = { likes: 0, dislikes: 0, total: 0, score: 50 }
    }
    if (String(row.reaction) === 'like') prefs[category].likes = num(row.count)
    else prefs[category].dislikes = num(row.count)
  }

  for (const cat of Object.values(prefs)) {
    cat.total = cat.likes + cat.dislikes
    cat.score = cat.total > 0 ? Math.round((cat.likes / cat.total) * 100) : 50
  }

  return prefs
}
