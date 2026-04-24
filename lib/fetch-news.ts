import Parser from 'rss-parser'
import { saveDigest, getCustomFeeds, getCategoryPreferences } from './db'
import type { Digest } from './types'

export function getPTDate(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })
}

interface RawArticle {
  title: string
  url: string
  description: string | null
  imageUrl: string | null
}

// rss-parser with media namespace fields
const rssParser = new Parser<
  Record<string, unknown>,
  { 'media:content'?: { $: { url?: string } }; 'media:thumbnail'?: { $: { url?: string } }; enclosure?: { url?: string } }
>({
  timeout: 10_000,
  customFields: {
    item: [
      ['media:content',   'media:content'],
      ['media:thumbnail', 'media:thumbnail'],
      ['enclosure',       'enclosure'],
    ],
  },
})

function extractRSSImage(item: {
  'media:content'?:   { $: { url?: string } }
  'media:thumbnail'?: { $: { url?: string } }
  enclosure?:         { url?: string }
}): string | null {
  return item['media:content']?.$?.url
      ?? item['media:thumbnail']?.$?.url
      ?? item.enclosure?.url
      ?? null
}

// ── RSS ──────────────────────────────────────────────────────────────────────

const RSS_FEEDS = [
  { url: 'https://www.scmp.com/rss/4/feed', name: 'SCMP China'  },  // South China Morning Post — China section
  { url: 'https://www.scmp.com/rss/5/feed', name: 'SCMP World'  },  // South China Morning Post — World section
]

async function fetchRSSFeed(url: string, name: string): Promise<RawArticle[]> {
  try {
    const feed = await rssParser.parseURL(url)
    return feed.items
      .filter(item => item.title && item.link)
      .map(item => ({
        title:       item.title!,
        url:         item.link!,
        description: item.contentSnippet ?? null,
        imageUrl:    extractRSSImage(item),
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

  // Request both trailText and thumbnail
  const base = `https://content.guardianapis.com/search?api-key=${apiKey}&show-fields=trailText,thumbnail`
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
          description: item.fields?.trailText   ?? null,
          imageUrl:    item.fields?.thumbnail    ?? null,
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
        articles.push({
          title:       a.title,
          url:         a.url,
          description: a.description   ?? null,
          imageUrl:    a.urlToImage     ?? null,
        })
      }
    }
  }

  return articles
}

// ── LLM categorization ───────────────────────────────────────────────────────

function buildCategorizeInput(articles: RawArticle[]): { selected: RawArticle[]; headlinesText: string; systemPrompt: string } {
  // Keep input under 12k TPM free-tier limit: ~2k system + 60 articles×46t + 4k output ≈ 9k
  const selected = articles.slice(0, 60)

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
- Survey-based sentiment pieces, industry mood checks, think-tank commentary, and "confidence/optimism/pessimism" stories unless they contain a specific new policy, law, executive action, sanction, vote, military move, court ruling, or official statement by a major decision-maker
- Vague process stories with no concrete new development
- Routine corporate earnings, minor product launches, or press releases
- Anything with a clickbait or tabloid-style title
- Soft feature stories built around analysis, expectations, or anecdotal reactions instead of a clear factual event

PREFER stories with a concrete contemporary development:
- a law passed or proposed
- an executive order, ministry notice, or agency action
- sanctions, tariffs, export controls, or trade restrictions
- a court ruling
- a summit outcome or official diplomatic statement
- military action, ceasefire, or security incident
- a central bank, treasury, or regulator decision
- an official company action with public consequences such as layoffs, mergers, bans, recalls, or plant closures

AVOID choosing stories whose main news value is that someone "said", "warned", "signaled", "expects", "claims", or "feels" something unless the speaker is a head of state, central bank chief, cabinet minister, top regulator, or equivalent decision-maker and the statement itself moves policy, markets, law, diplomacy, or military posture.

FILTER OUT pure rhetoric stories with little factual value:
- campaign-style taunts, boasts, grievances, or fraud claims
- provocative quotes that do not announce a policy, order, sanction, vote, lawsuit, meeting outcome, or military move
- personality-driven political drama without a concrete consequence

STEP 2 — DEDUPLICATE before writing any summaries:
Scan all headlines for articles that describe the same real-world event. Two articles are duplicates if they cover the same action (announcement, ruling, vote, decision, military move, arrest, etc.) by the same actor at the same time — even if the wording is completely different.

For each group of 2 or more duplicate articles:
- Choose the single most specific or detailed URL as the canonical source
- You will write ONE bullet for the group (in STEP 3), combining the best details from all articles in the group
- All other URLs in the group are discarded — they must NOT appear anywhere in the output

Do NOT produce two bullets that describe the same underlying event under any circumstances, even if they would fall in different categories.

Examples of same-event pairs that MUST produce only ONE bullet:
- "Iran FM heads to Pakistan, downplaying US talks" + "Iran FM embarks on three-nation tour as US peace talks stall" → same diplomatic trip, ONE bullet using whichever URL is more detailed
- "DOJ drops criminal probe of Powell" + "US drops criminal investigation of Fed chair Powell, clearing way for Warsh" → same decision, ONE bullet
- "China raises tariffs on US goods to 125%" + "Beijing retaliates with 125% tariff on American imports" → same action, ONE bullet

STEP 3 — WRITE a 1–2 sentence summary for a smart college-aged reader who follows current events:
- Keep it readable, not minimal. Target roughly 22-40 words. Use a second sentence when needed for context, but every sentence must earn its place.
- Sentence 1: state the concrete development with names, numbers, and timing.
- Sentence 2, if used: explain what changed, why it matters, or what the disputed issue actually is.
- For bullets that merge multiple sources (from STEP 2), draw on all source articles to write a richer, more complete summary.
- Assume the reader knows basic international affairs and major countries, leaders, and institutions. Do NOT over-explain common concepts like Beijing, Taipei, NATO, the European Union, Congress, or tariffs.
- DO explain niche acronyms, obscure institutions, and lesser-known companies on first mention.
- ALWAYS define acronyms and jargon on first use when they are not broadly known. Example: write "M&A (mergers and acquisitions)" or "AmCham China, a business lobby for American companies in China."
- ONLY explain a term like "security", "pressure", "controls", or "support" when the article depends on that detail. If you use the term, name the specific issue.
- ALWAYS identify companies if they are not household names.
- NEVER write a summary so vague that a reader could ask "what policy?" or "what security issue?" Fill in the missing noun.
- NEVER use placeholder nouns without substance. Bad: "the tariff refund process has begun for businesses." Good: say who is refunding which tariffs to which businesses, under what ruling or policy change.
- Prefer one concrete noun over a vague bundle. Replace "issues" with the actual items: tariffs, chip export controls, visa restrictions, military talks, or whatever the story is really about.
- NEVER use filler phrases like "various issues, including", "in a move seen as", "has been seeking to", "amid ongoing tensions", or "according to observers".
- Prefer direct wording: use "praised" instead of "hailed", "said" instead of "signaled", "met" instead of "held talks" when that is what happened.
- Use "the" for a specific known event when appropriate, for example "the May summit", not "a May summit".
- Avoid obvious throat-clearing or scene-setting clauses unless they add essential new information.
- Avoid generic backstory the reader already knows unless it is necessary to understand the event.
- Do include enough context that the sentence stands on its own. The reader should not need the headline to understand what happened.
- If the underlying article is mostly opinion, vague analysis, or low-information commentary, do not include it.
- Use your own knowledge to add context, but keep it brief and concrete.
- Never start with: "Report:", "Sources say:", "Exclusive:", or similar hedges.
- No metaphors, dramatic phrasing, or creative titles ("Art of AI War", "Delicate Extraction", etc.).

STEP 4 — SELECT the 3 Headliners using this strict priority order (highest first):
  1. Active armed conflict, military strikes, or ceasefire agreements
  2. Decisions by heads of state, major legislation passed or signed into law
  3. Major diplomatic events: sanctions, treaty signings, ambassador expulsions, summits
  4. Significant economic events: central bank decisions, market crashes >3%, bank failures, sovereign debt crises
  5. Major trade policy changes: new tariffs, export bans, trade deal signings
  6. Critical technology or AI policy with broad national or global implications
  7. Serious supply chain disruptions for critical minerals or energy

STEP 5 — SORT into EXACTLY these 8 categories using these EXACT names and definitions:
- "Headliner" — the 3 most globally significant stories (selected in Step 4)
- "International Affairs" — geopolitics and foreign relations BETWEEN countries, excluding US domestic and China domestic stories
- "Trade" — tariffs, export controls, trade agreements, sanctions, import/export bans
- "Tech & AI" — technology industry, AI developments, cybersecurity, tech regulation (ONE combined category — never split into "Tech" and "AI" separately)
- "US Politics" — US domestic politics: Congress, White House, federal agencies, US elections, Supreme Court
- "China Politics" — CCP leadership decisions, Xi Jinping, Chinese domestic policy, Chinese government actions, Hong Kong; any story primarily about what China's government is doing internally goes here, NOT in International Affairs. THIS CATEGORY IS REQUIRED — the input always contains SCMP China articles, so you must always produce at least 3 China Politics bullets.
- "Finance" — stock markets, central bank policy, banking, currencies, corporate finance, economic indicators
- "Critical Minerals" — rare earth elements, lithium, cobalt, nickel, copper, uranium, mining, mineral supply chains

STRICT RULES:
- Headliner must have EXACTLY 3 bullets — no more, no fewer
- China Politics must always appear with at least 3 bullets
- NO URL may appear in more than one category — before outputting JSON, scan all bullets across all categories and remove any URL that appears a second time
- Every bullet must include the original source URL
- If a category (other than Headliner and China Politics) has no relevant stories today, omit it from the output entirely

Return ONLY valid JSON, no markdown, no explanation:
{ "date": "YYYY-MM-DD", "categories": [{ "name": "...", "bullets": [{ "text": "...", "url": "..." }] }] }`

  return { selected, headlinesText, systemPrompt }
}

function parseDigestJSON(raw: string): Digest {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
  return JSON.parse(cleaned) as Digest
}

async function categorizeWithGroq(articles: RawArticle[], date: string, apiKey: string): Promise<Digest> {
  const { headlinesText, systemPrompt } = buildCategorizeInput(articles)

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Date: ${date}\n\nHeadlines:\n\n${headlinesText}` },
      ],
      temperature: 0.2,
      max_tokens: 4000,
      response_format: { type: 'json_object' },
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Groq error ${response.status}: ${body}`)
  }

  const data = await response.json()
  const raw: string = data.choices?.[0]?.message?.content ?? ''
  if (!raw) throw new Error('Empty response from Groq')
  return parseDigestJSON(raw)
}

async function categorizeWithGemini(articles: RawArticle[], date: string, apiKey: string): Promise<Digest> {
  const { headlinesText, systemPrompt } = buildCategorizeInput(articles)

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: `Date: ${date}\n\nHeadlines:\n\n${headlinesText}` }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 8192,
          responseMimeType: 'application/json',
        },
      }),
    }
  )

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Gemini error ${response.status}: ${body}`)
  }

  const data = await response.json()
  const raw: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  if (!raw) throw new Error('Empty response from Gemini')
  return parseDigestJSON(raw)
}

async function categorize(articles: RawArticle[], date: string): Promise<Digest> {
  const groqKey = process.env.GROQ_API_KEY
  const geminiKey = process.env.GEMINI_API_KEY

  if (groqKey) {
    try {
      console.log('[fetch-news] Categorizing with Groq…')
      return await categorizeWithGroq(articles, date, groqKey)
    } catch (err) {
      console.warn('[fetch-news] Groq failed, trying Gemini fallback:', err)
      if (!geminiKey) throw err
    }
  }

  if (!geminiKey) throw new Error('No LLM API key configured. Set GROQ_API_KEY or GEMINI_API_KEY.')

  console.log('[fetch-news] Categorizing with Gemini…')
  return await categorizeWithGemini(articles, date, geminiKey)
}

// ── OG image scraping ────────────────────────────────────────────────────────

async function fetchOGImage(url: string): Promise<string | null> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 6000)
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RapidFire/1.0; +https://github.com)' },
    })
    clearTimeout(timer)
    if (!res.ok) return null
    // Read only the first 20 KB — enough to find the <head> og:image tag
    const reader = res.body?.getReader()
    if (!reader) return null
    let html = ''
    while (html.length < 20_000) {
      const { done, value } = await reader.read()
      if (done || !value) break
      html += new TextDecoder().decode(value)
    }
    reader.cancel()
    const m =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ??
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)
    return m?.[1] ?? null
  } catch {
    return null
  }
}

async function enrichWithOGImages(digest: Digest): Promise<void> {
  const bullets = digest.categories.flatMap(c => c.bullets).filter(b => !b.imageUrl)
  if (bullets.length === 0) return
  console.log(`[fetch-news] Scraping OG images for ${bullets.length} articles…`)
  const results = await Promise.allSettled(bullets.map(b => fetchOGImage(b.url)))
  let found = 0
  bullets.forEach((b, i) => {
    const r = results[i]
    if (r.status === 'fulfilled' && r.value) { b.imageUrl = r.value; found++ }
  })
  console.log(`[fetch-news] OG images found: ${found}/${bullets.length}`)
}

// ── Custom feed fetching ──────────────────────────────────────────────────────

async function fetchCustomFeeds(): Promise<RawArticle[]> {
  const feeds = await getCustomFeeds()
  if (feeds.length === 0) return []

  const results = await Promise.allSettled(
    feeds.map(f => fetchRSSFeed(f.url, f.title || f.url))
  )

  return results.flatMap(r => r.status === 'fulfilled' ? r.value : [])
}

// Score articles from custom feeds using existing category preferences.
// Articles from high-liked categories bubble to the top; others are deprioritized.
async function rankCustomArticles(articles: RawArticle[]): Promise<RawArticle[]> {
  if (articles.length === 0) return []
  const prefs = await getCategoryPreferences()

  // Average preference score across all rated categories (default 50 = neutral)
  const avgScore = Object.values(prefs).length > 0
    ? Object.values(prefs).reduce((s, p) => s + p.score, 0) / Object.values(prefs).length
    : 50

  // Keep articles whose category scores (if known) are above average, plus unknowns
  // Since we don't know the category yet, we use the overall avg as a soft gate:
  // return top 30 articles from custom feeds (Groq will categorize & filter them)
  return articles.slice(0, 30)
}

// ── Main entry point ─────────────────────────────────────────────────────────

export async function fetchAndSaveDigest(date?: string): Promise<Digest> {
  const targetDate = date ?? getPTDate()

  console.log('[fetch-news] Fetching from all sources in parallel…')

  const [newsAPIResult, guardianResult, scmpChinaResult, scmpWorldResult, customResult] =
    await Promise.allSettled([
      fetchNewsAPIHeadlines(),
      fetchGuardianArticles(),
      ...RSS_FEEDS.map(f => fetchRSSFeed(f.url, f.name)),
      fetchCustomFeeds(),
    ])

  // Per-source caps guarantee China coverage and prevent NewsAPI from crowding out all other sources.
  // SCMP China is added first so its articles are never cut off by the 60-article Groq limit.
  const sourceBatches: Array<{ result: PromiseSettledResult<RawArticle[]>; cap: number; label: string }> = [
    { result: scmpChinaResult,  cap: 12, label: 'SCMP China'  },
    { result: newsAPIResult,    cap: 28, label: 'NewsAPI'     },
    { result: guardianResult,   cap: 14, label: 'Guardian'    },
    { result: scmpWorldResult,  cap: 6,  label: 'SCMP World'  },
  ]

  const seen = new Set<string>()
  const all: RawArticle[] = []
  const imageMap = new Map<string, string>()

  for (const { result, cap, label } of sourceBatches) {
    if (result.status !== 'fulfilled') continue
    let added = 0
    for (const a of result.value) {
      if (added >= cap) break
      if (!seen.has(a.url)) {
        seen.add(a.url)
        all.push(a)
        added++
      }
      if (a.imageUrl && !imageMap.has(a.url)) imageMap.set(a.url, a.imageUrl)
    }
    console.log(`[fetch-news] ${label}: ${added} articles`)
  }

  if (customResult.status === 'fulfilled') {
    const ranked = await rankCustomArticles(customResult.value)
    let added = 0
    for (const a of ranked) {
      if (!seen.has(a.url)) { seen.add(a.url); all.push(a); added++ }
      if (a.imageUrl && !imageMap.has(a.url)) imageMap.set(a.url, a.imageUrl)
    }
    console.log(`[fetch-news] Custom feeds: ${added} articles`)
  }

  console.log(`[fetch-news] ${all.length} unique articles · ${imageMap.size} with images`)

  const digest = await categorize(all, targetDate)

  // Server-side dedup: remove any URL that appears in more than one category
  const seenBulletUrls = new Set<string>()
  for (const cat of digest.categories) {
    cat.bullets = cat.bullets.filter(b => {
      if (!b.url || seenBulletUrls.has(b.url)) return false
      seenBulletUrls.add(b.url)
      return true
    })
  }
  digest.categories = digest.categories.filter(c => c.bullets.length > 0)

  // Enrich bullets with images from source feeds first, then OG scraping for the rest
  for (const cat of digest.categories) {
    for (const bullet of cat.bullets) {
      const img = imageMap.get(bullet.url)
      if (img) bullet.imageUrl = img
    }
  }

  await enrichWithOGImages(digest)

  await saveDigest(targetDate, digest)
  console.log(`[fetch-news] Saved digest for ${targetDate}`)

  return digest
}
