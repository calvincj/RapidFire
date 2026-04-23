import type { Digest, Category, Bullet } from '@/lib/types'

const CATEGORIES = [
  { name: 'Headliner',             emoji: '⭐' },
  { name: 'International Affairs', emoji: '🌍' },
  { name: 'Trade',                 emoji: '🤝' },
  { name: 'Tech & AI',             emoji: '💻' },
  { name: 'US Politics',           emoji: '🏛️' },
  { name: 'China Politics',        emoji: '🐉' },
  { name: 'Finance',               emoji: '💰' },
  { name: 'Critical Minerals',     emoji: '⛏️' },
]

const ORDER = CATEGORIES.map(c => c.name)
const EMOJI = Object.fromEntries(CATEGORIES.map(c => [c.name, c.emoji]))

// Any name variants the model might return → canonical name
const ALIASES: Record<string, string> = {
  // Tech & AI variants
  'Tech':                    'Tech & AI',
  'AI':                      'Tech & AI',
  'Technology':              'Tech & AI',
  'Artificial Intelligence': 'Tech & AI',
  'Tech and AI':             'Tech & AI',
  'Technology & AI':         'Tech & AI',
  'Tech/AI':                 'Tech & AI',
  // China Politics variants
  'Chinese Politics':        'China Politics',
  'China Policy':            'China Politics',
  'China':                   'China Politics',
  'CCP':                     'China Politics',
  'China News':              'China Politics',
}

function normalize(categories: Category[]): Category[] {
  // 1. Merge alias categories into canonical names
  const merged = new Map<string, Bullet[]>()
  for (const cat of categories) {
    const name = ALIASES[cat.name] ?? cat.name
    const existing = merged.get(name)
    if (existing) existing.push(...cat.bullets)
    else merged.set(name, [...cat.bullets])
  }

  // 2. Remove duplicate URLs across all categories (process in display order)
  const seenUrls = new Set<string>()
  const result: Category[] = []

  const inOrder = Array.from(merged.entries()).sort(([a], [b]) => {
    return (ORDER.indexOf(a) === -1 ? 99 : ORDER.indexOf(a)) -
           (ORDER.indexOf(b) === -1 ? 99 : ORDER.indexOf(b))
  })

  for (const [name, bullets] of inOrder) {
    const unique = bullets.filter((b: Bullet) => {
      if (!b.url || seenUrls.has(b.url)) return false
      seenUrls.add(b.url)
      return true
    })

    // 3. Cap Headliner to 3
    const capped = name === 'Headliner' ? unique.slice(0, 3) : unique

    if (capped.length > 0) result.push({ name, bullets: capped })
  }

  return result
}

export default function DigestView({ digest }: { digest: Digest }) {
  const categories = normalize(digest.categories)

  return (
    <div className="space-y-4">
      {categories.map(cat => (
        <section
          key={cat.name}
          className="rounded-2xl border p-5"
          style={{
            borderColor: 'var(--color-border)',
            backgroundColor: 'var(--color-surface)',
          }}
        >
          <h2
            className="text-xs font-bold tracking-widest uppercase mb-4 flex items-center gap-2"
            style={{ color: cat.name === 'Headliner' ? 'var(--color-accent)' : 'var(--color-text-2)' }}
          >
            <span>{EMOJI[cat.name] ?? '📰'}</span>
            <span>{cat.name}</span>
          </h2>

          <ul className="space-y-3">
            {cat.bullets.map((bullet, i) => (
              <li key={i}>
                <a
                  href={bullet.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex gap-3 group"
                >
                  <span
                    className="shrink-0 mt-0.5 select-none"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    →
                  </span>
                  <span
                    className="text-base leading-snug transition-opacity group-hover:opacity-70"
                    style={{ color: 'var(--color-text)' }}
                  >
                    {bullet.text}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
