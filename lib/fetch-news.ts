import Parser from 'rss-parser'
import { saveDigest } from './db'
import type { Digest } from './types'

export function getPTDate(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })
}

interface RawArticle {
  title: string
  url: string
  description: string | null
}

const rssParser = new Parser({ timeout: 10_000 })

// ── RSS ──────────────────────────────────────────────────────────────────────

const RSS_FEEDS = [
  { url: 'https://feeds.reuters.com/reuters/CNtopNews',   name: 'Reuters China'  },
  { url: 'https://www.caixinglobal.com/feed/rss/',        name: 'Caixin Global'  },
]

async function fetchRSSFeed(url: string, name: string): Promise<RawArticle[]> {
  try {
    const feed = await rssParser.parseURL(url)
    return feed.items
      .filter(item => item.title && item.link)
      .map(item => ({
        title: item.title!,
        url:   item.link!,
        description: item.contentSnippet ?? null,
      }))
  } catch (err) {
    console.warn(`[fetch-news] RSS failed (${name}):`, err)
    return []
  }
}

// ── Guardian API ─────────────────────────────────────────────────────────────

async function fetchGuardianArticles(): Promise<RawArticle[]> {
  const apiKey = process.env.GUARDIAN_API_KEY
  if (!apiKey) {
    console.warn('[fetch-news] GUARDIAN_API_KEY not set — skipping Guardian')
    return []
  }

  const base = `https://content.guardianapis.com/search?api-key=${apiKey}&show-fields=trailText`
  const queries = [
    `${base}&section=world|business|technology|politics&page-size=50&order-by=newest`,
    `${base}&q=china&page-size=20&order-by=newest`,
  ]

  const seen = new Set<string>()
  const articles: RawArticle[] = []

  const results = await Promise.allSettled(
    queries.map(url => fetch(url, { cache: 'no-store' }).then(r => r.json()))
  )

  for (const result of results) {
    if (result.status === 'rejected') {
      console.warn('[fetch-news] Guardian request failed:', result.reason)
      continue
    }
    for (const item of result.value.response?.results ?? []) {
      if (item.webUrl && item.webTitle && !seen.has(item.webUrl)) {
        seen.add(item.webUrl)
        articles.push({
          title:       item.webTitle,
          url:         item.webUrl,
          description: item.fields?.trailText ?? null,
        })
      }
    }
  }

  return articles
}

// ── NewsAPI ──────────────────────────────────────────────────────────────────

async function fetchNewsAPIHeadlines(): Promise<RawArticle[]> {
  const apiKey = process.env.NEWSAPI_KEY
  if (!apiKey) throw new Error('NEWSAPI_KEY is not configured')

  const todayISO = getPTDate()
  const base = 'https://newsapi.org/v2'

  const endpoints = [
    `${base}/top-headlines?country=us&pageSize=100&apiKey=${apiKey}`,
    `${base}/top-headlines?category=technology&language=en&pageSize=50&apiKey=${apiKey}`,
    `${base}/top-headlines?category=business&language=en&pageSize=50&apiKey=${apiKey}`,
    `${base}/everything?q=China+politics+OR+Xi+Jinping&language=en&pageSize=20&sortBy=publishedAt&from=${todayISO}&apiKey=${apiKey}`,
    `${base}/everything?q=%22critical+minerals%22+OR+%22rare+earth%22&language=en&pageSize=20&sortBy=publishedAt&from=${todayISO}&apiKey=${apiKey}`,
    `${base}/everything?q=%22artificial+intelligence%22+OR+%22machine+learning%22&language=en&pageSize=20&sortBy=publishedAt&from=${todayISO}&apiKey=${apiKey}`,
    `${base}/everything?q=trade+tariffs+OR+%22trade+war%22&language=en&pageSize=20&sortBy=publishedAt&from=${todayISO}&apiKey=${apiKey}`,
  ]

  const seen = new Set<string>()
  const articles: RawArticle[] = []

  const results = await Promise.allSettled(
    endpoints.map(url => fetch(url, { cache: 'no-store' }).then(r => r.json()))
  )

  for (const result of results) {
    if (result.status === 'rejected') {
      console.warn('[fetch-news] NewsAPI request failed:', result.reason)
      continue
    }
    const data = result.value
    if (!Array.isArray(data.articles)) {
      console.warn('[fetch-news] Unexpected NewsAPI response:', data.status, data.message)
      continue
    }
    for (const a of data.articles) {
      if (a.url && a.title && a.title !== '[Removed]' && !seen.has(a.url)) {
        seen.add(a.url)
        articles.push({ title: a.title, url: a.url, description: a.description ?? null })
      }
    }
  }

  return articles
}

// ── Groq categorization ──────────────────────────────────────────────────────

async function categorizeWithGroq(articles: RawArticle[], date: string): Promise<Digest> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) throw new Error('GROQ_API_KEY is not configured')

  // Title + URL only keeps the prompt under the 12k TPM free-tier limit
  const selected = articles.slice(0, 100)

  const headlinesText = selected
    .map((a, i) => `[${i + 1}] ${a.title}\n    URL: ${a.url}`)
    .join('\n\n')

  const systemPrompt = `You are a senior news editor curating a daily briefing for an informed reader who cares about geopolitics, economics, technology, and policy.

STEP 1 — FILTER OUT these entirely, do not include them under any category:
- Sports and athletics of any kind
- Celebrity gossip, entertainment, film, music, awards
- Academic or scientific research papers (e.g. journal articles, lab studies) — UNLESS the finding has immediate, major real-world policy, security, or health consequences
- Local or regional news with no national/international significance
- Opinion columns, editorials, or commentary pieces
- Routine corporate earnings, minor product launches, or press releases
- Anything with a clickbait or tabloid-style title

STEP 2 — WRITE each included story as one plain factual sentence:
- Structure: who did what, where, with what consequence. Example: "The Federal Reserve held rates steady at 4.25%, citing persistent inflation and a resilient labor market."
- Use specific numbers, names, countries, and dollar amounts when available
- Never start with: "Report:", "Sources say:", "Exclusive:", or similar hedges
- No metaphors, dramatic phrasing, or creative titles ("Art of AI War", "Delicate Extraction", etc.)
- If a technical story is included, explain it in plain English a non-expert would understand — translate jargon into consequences

STEP 3 — SELECT the 3 Headliners using this strict priority order (highest first):
  1. Active armed conflict, military strikes, or ceasefire agreements
  2. Decisions by heads of state, major legislation passed or signed into law
  3. Major diplomatic events: sanctions, treaty signings, ambassador expulsions, summits
  4. Significant economic events: central bank decisions, market crashes >3%, bank failures, sovereign debt crises
  5. Major trade policy changes: new tariffs, export bans, trade deal signings
  6. Critical technology or AI policy with broad national or global implications
  7. Serious supply chain disruptions for critical minerals or energy

STEP 4 — SORT into EXACTLY these 8 categories using these EXACT names and definitions:
- "Headliner" — the 3 most globally significant stories (selected in Step 3)
- "International Affairs" — geopolitics and foreign relations BETWEEN countries, excluding US domestic and China domestic stories
- "Trade" — tariffs, export controls, trade agreements, sanctions, import/export bans
- "Tech & AI" — technology industry, AI developments, cybersecurity, tech regulation (ONE combined category — never split into "Tech" and "AI" separately)
- "US Politics" — US domestic politics: Congress, White House, federal agencies, US elections, Supreme Court
- "China Politics" — CCP leadership decisions, Xi Jinping, Chinese domestic policy, Chinese government actions, Hong Kong; any story primarily about what China's government is doing internally goes here, NOT in International Affairs
- "Finance" — stock markets, central bank policy, banking, currencies, corporate finance, economic indicators
- "Critical Minerals" — rare earth elements, lithium, cobalt, nickel, copper, uranium, mining, mineral supply chains

STRICT RULES:
- Headliner must have EXACTLY 3 bullets — no more, no fewer
- Every story appears in EXACTLY ONE category — never repeat a URL
- Every bullet must include the original source URL
- If a category has no relevant stories today, omit it from the output entirely

Return ONLY valid JSON, no markdown, no explanation:
{ "date": "YYYY-MM-DD", "categories": [{ "name": "...", "bullets": [{ "text": "...", "url": "..." }] }] }`

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Date: ${date}\n\nHeadlines:\n\n${headlinesText}` },
      ],
      temperature: 0.2,
      max_tokens: 4000,
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Groq error ${response.status}: ${body}`)
  }

  const data = await response.json()
  const raw: string = data.choices?.[0]?.message?.content ?? ''
  if (!raw) throw new Error('Empty response from Groq')

  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()

  return JSON.parse(cleaned) as Digest
}

// ── Main entry point ─────────────────────────────────────────────────────────

export async function fetchAndSaveDigest(date?: string): Promise<Digest> {
  const targetDate = date ?? getPTDate()

  console.log('[fetch-news] Fetching from all sources in parallel…')

  const [newsAPIResult, guardianResult, reutersResult, caixinResult] = await Promise.allSettled([
    fetchNewsAPIHeadlines(),
    fetchGuardianArticles(),
    ...RSS_FEEDS.map(f => fetchRSSFeed(f.url, f.name)),
  ])

  // Merge, preserving source order, deduplicating by URL
  const seen = new Set<string>()
  const all: RawArticle[] = []

  for (const result of [newsAPIResult, guardianResult, reutersResult, caixinResult]) {
    if (result.status === 'fulfilled') {
      for (const a of result.value) {
        if (!seen.has(a.url)) {
          seen.add(a.url)
          all.push(a)
        }
      }
    }
  }

  console.log(`[fetch-news] ${all.length} unique articles across all sources`)

  console.log('[fetch-news] Categorizing with Groq…')
  const digest = await categorizeWithGroq(all, targetDate)

  saveDigest(targetDate, digest)
  console.log(`[fetch-news] Saved digest for ${targetDate}`)

  return digest
}
