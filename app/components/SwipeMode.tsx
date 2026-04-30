'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import type { Digest } from '@/lib/types'

const EMOJI: Record<string, string> = {
  'Headliner':             '⭐',
  'International Affairs': '🌍',
  'Trade':                 '🤝',
  'Tech & AI':             '💻',
  'US Politics':           '🏛️',
  'China Politics':        '🐉',
  'Finance':               '💰',
  'Critical Minerals':     '⛏️',
}

interface Story {
  text: string
  url: string
  category: string
  emoji: string
  imageUrl?: string
}

interface Preference {
  likes: number
  dislikes: number
  total: number
  score: number
}

interface Props {
  digest: Digest
  digestDate: string
  onExit: () => void
}

// ── Burn effect ───────────────────────────────────────────────────────────────

// Ash chunks: large dark flakes that fall downward
const ASH = [
  { tx: -55, ty: 130, size: 14, rot: 200 }, { tx: 25,  ty: 155, size: 18, rot: -160 },
  { tx: -20, ty: 110, size: 10, rot: 120  }, { tx: 65,  ty: 140, size: 16, rot: -220 },
  { tx: -75, ty: 100, size: 12, rot: 180  }, { tx: 40,  ty: 125, size: 20, rot: -140 },
  { tx: 5,   ty: 160, size: 11, rot: 240  }, { tx: -45, ty: 105, size: 15, rot: -190 },
  { tx: 70,  ty: 115, size: 13, rot: 160  }, { tx: -10, ty: 145, size: 17, rot: -170 },
]
const ASH_COLORS = ['#1f2937', '#374151', '#4b5563', '#111827', '#6b7280']

// Embers: small bright sparks that fly upward
const EMBERS = [
  { tx: -28, ty: -95  }, { tx: 18,  ty: -105 }, { tx: -52, ty: -72 },
  { tx: 44,  ty: -85  }, { tx: 2,   ty: -115 }, { tx: -68, ty: -58 },
  { tx: 58,  ty: -62  }, { tx: -18, ty: -100 }, { tx: 48,  ty: -78 },
  { tx: -38, ty: -88  },
]
const EMBER_COLORS = ['#ef4444', '#f97316', '#fbbf24', '#dc2626', '#fed7aa']

function BurnEffect() {
  return (
    <>
      <style>{`
        @keyframes rfFlame {
          0%   { opacity: 0; }
          18%  { opacity: 0.75; }
          100% { opacity: 0; }
        }
        @keyframes rfAsh {
          0%   { transform: translate(0,0) rotate(0deg) scale(1); opacity: 0.95; }
          100% { transform: translate(var(--rf-tx), var(--rf-ty)) rotate(var(--rf-rot)) scale(0.25); opacity: 0; }
        }
        @keyframes rfEmber {
          0%   { transform: translate(0,0) scale(1); opacity: 1; }
          65%  { opacity: 0.7; }
          100% { transform: translate(var(--rf-tx), var(--rf-ty)) scale(0); opacity: 0; }
        }
      `}</style>

      {/* Fire overlay — covers the card exactly */}
      <div style={{
        position: 'absolute', inset: 0, borderRadius: '16px', pointerEvents: 'none', zIndex: 10,
        background: 'linear-gradient(to top, rgba(239,68,68,0.85) 0%, rgba(249,115,22,0.6) 45%, rgba(251,191,36,0.35) 75%, transparent 100%)',
        animation: 'rfFlame 310ms ease-out forwards',
      }} />

      {/* Ash particles — originate from card center, fall down */}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', zIndex: 11 }}>
        {ASH.map((p, i) => (
          <div key={i} style={{
            position: 'absolute',
            width: p.size, height: p.size * 0.55,
            borderRadius: '35%',
            backgroundColor: ASH_COLORS[i % ASH_COLORS.length],
            '--rf-tx': `${p.tx}px`, '--rf-ty': `${p.ty}px`, '--rf-rot': `${p.rot}deg`,
            animation: `rfAsh ${360 + i * 22}ms ease-in ${i * 18}ms forwards`,
          } as React.CSSProperties} />
        ))}
      </div>

      {/* Ember sparks — fly upward like escaping fire */}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', zIndex: 11 }}>
        {EMBERS.map((p, i) => (
          <div key={i} style={{
            position: 'absolute',
            width: 3 + (i % 3) * 2, height: 3 + (i % 3) * 2,
            borderRadius: '50%',
            backgroundColor: EMBER_COLORS[i % EMBER_COLORS.length],
            boxShadow: `0 0 ${6 + (i % 3) * 3}px ${EMBER_COLORS[i % EMBER_COLORS.length]}`,
            '--rf-tx': `${p.tx}px`, '--rf-ty': `${p.ty}px`,
            animation: `rfEmber ${260 + i * 18}ms ease-out ${i * 12}ms forwards`,
          } as React.CSSProperties} />
        ))}
      </div>
    </>
  )
}

function flattenDigest(digest: Digest): Story[] {
  return digest.categories.flatMap(cat =>
    cat.bullets.map(b => ({
      text:     b.text,
      url:      b.url,
      category: cat.name,
      emoji:    EMOJI[cat.name] ?? '📰',
      imageUrl: b.imageUrl,
    }))
  )
}

function localSwipedKey(digestDate: string) { return `rapidfire:swiped:${digestDate}` }

function getLocalSwiped(digestDate: string): Set<string> {
  try {
    const raw = localStorage.getItem(localSwipedKey(digestDate))
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch { return new Set() }
}

function addLocalSwiped(digestDate: string, url: string) {
  try {
    const key = localSwipedKey(digestDate)
    const existing = JSON.parse(localStorage.getItem(key) ?? '[]') as string[]
    localStorage.setItem(key, JSON.stringify([...existing, url]))
  } catch {}
}

export default function SwipeMode({ digest, digestDate, onExit }: Props) {
  const [{ stories, totalStories, startOffset }] = useState(() => {
    const all = flattenDigest(digest)
    const swiped = getLocalSwiped(digestDate)
    const filtered = swiped.size > 0 ? all.filter(s => !swiped.has(s.url)) : all
    return { stories: filtered, totalStories: all.length, startOffset: all.length - filtered.length }
  })
  const [index, setIndex]           = useState(0)
  const [history, setHistory]       = useState<number[]>([])
  const [slide, setSlide]           = useState<'like' | 'dislike' | null>(null)
  const [preferences, setPreferences] = useState<Record<string, Preference>>({})
  const [done, setDone]             = useState(false)

  const current = stories[index]

  const react = useCallback(async (reaction: 'like' | 'dislike') => {
    if (slide || !current) return
    setSlide(reaction)
    addLocalSwiped(digestDate, current.url)

    try {
      const res = await fetch('/api/reaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: current.url, category: current.category, reaction, digestDate }),
      })

      const data = await res.json()
      if (data.preferences) setPreferences(data.preferences)
    } catch (err) {
      console.error('[swipe-mode] Failed to save reaction:', err)
    }

    setTimeout(() => {
      setHistory(h => [...h, index])
      setSlide(null)
      if (index + 1 >= stories.length) setDone(true)
      else setIndex(i => i + 1)
    }, 280)
  }, [slide, current, index, stories.length, digestDate])

  const goBack = useCallback(() => {
    if (history.length === 0 || slide) return
    const prev = history[history.length - 1]
    setHistory(h => h.slice(0, -1))
    setDone(false)
    setIndex(prev)
  }, [history, slide])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'l') react('like')
      if (e.key === 'ArrowLeft'  || e.key === 'h') react('dislike')
      if (e.key === 'ArrowUp'    || e.key === 'b') goBack()
      if (e.key === 'Escape') onExit()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [react, goBack, onExit])

  // Load preferences on mount (localStorage already filtered stories synchronously)
  useEffect(() => {
    fetch('/api/reaction').then(r => r.json()).then(d => {
      if (d.preferences) setPreferences(d.preferences)
    }).catch(() => {})
  }, [])

  if (done || stories.length === 0) {
    return (
      <Summary
        preferences={preferences}
        total={history.length}
        onExit={onExit}
        onBack={history.length > 0 ? goBack : undefined}
      />
    )
  }

  const globalIndex = startOffset + index
  const progress = Math.round((globalIndex / totalStories) * 100)

  return (
    <div className="flex flex-col h-[calc(100vh-56px)]">

      {/* Progress bar */}
      <div className="h-1 w-full" style={{ backgroundColor: 'var(--color-surface)' }}>
        <div
          className="h-full transition-all duration-300"
          style={{ width: `${progress}%`, backgroundColor: 'var(--color-accent)' }}
        />
      </div>

      {/* Top bar */}
      <div
        className="flex items-center justify-between px-4 py-3 text-sm"
        style={{ color: 'var(--color-text-muted)' }}
      >
        <button
          onClick={onExit}
          className="font-medium hover:opacity-60 transition-opacity"
          style={{ color: 'var(--color-text-2)' }}
        >
          ← Read view
        </button>

        <span>{globalIndex + 1} / {totalStories}</span>

        {/* Back button */}
        <button
          onClick={goBack}
          disabled={history.length === 0}
          className="font-medium transition-opacity disabled:opacity-25 hover:opacity-60"
          style={{ color: 'var(--color-text-2)' }}
          title="Go back (↑)"
        >
          ↩ Back
        </button>
      </div>

      {/* Card */}
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-sm relative">
          {slide === 'dislike' && <BurnEffect />}
        <div
          className="w-full rounded-2xl border overflow-hidden transition-all duration-[280ms]"
          style={{
            borderColor: slide === 'dislike' ? '#ef4444' : 'var(--color-border)',
            backgroundColor: 'var(--color-surface)',
            boxShadow: slide === 'dislike' ? '0 0 40px rgba(239,68,68,0.55)' : 'none',
            transform: slide === 'like'
              ? 'translateX(80px) rotate(4deg) scale(0.95)'
              : slide === 'dislike'
              ? 'translateX(-80px) rotate(-4deg) scale(0.95)'
              : 'none',
            opacity: slide ? 0 : 1,
          }}
        >
          {/* key resets failed state when story changes */}
          <CardImage key={current.url} imageUrl={current.imageUrl} emoji={current.emoji} />

          <div className="p-5">
            <div
              className="inline-flex items-center gap-1.5 text-xs font-bold tracking-widest uppercase mb-3 px-2.5 py-1 rounded-lg"
              style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-accent)' }}
            >
              <span>{current.emoji}</span>
              <span>{current.category}</span>
            </div>

            <p className="text-base leading-relaxed mb-4" style={{ color: 'var(--color-text)' }}>
              {current.text}
            </p>

            <a
              href={current.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium transition-opacity hover:opacity-60"
              style={{ color: 'var(--color-text-muted)' }}
            >
              Read article →
            </a>
          </div>
        </div>
        </div>
      </div>

      <p className="hidden md:block text-center text-xs pb-2" style={{ color: 'var(--color-text-muted)' }}>
        ← dislike · → like · ↑ back · Esc exit
      </p>

      {/* Action buttons */}
      <div className="flex justify-center gap-8 px-4 pb-10">
        <button
          onClick={() => react('dislike')}
          disabled={!!slide}
          className="w-16 h-16 rounded-full text-2xl font-bold flex items-center justify-center border-2 transition-transform active:scale-90 disabled:opacity-40"
          style={{ borderColor: '#ef4444', color: '#ef4444', backgroundColor: 'var(--color-surface)' }}
          title="Not interested (← arrow)"
        >
          ✕
        </button>
        <button
          onClick={() => react('like')}
          disabled={!!slide}
          className="w-16 h-16 rounded-full text-2xl font-bold flex items-center justify-center border-2 transition-transform active:scale-90 disabled:opacity-40"
          style={{ borderColor: '#22c55e', color: '#22c55e', backgroundColor: 'var(--color-surface)' }}
          title="Interested (→ arrow)"
        >
          ✓
        </button>
      </div>
    </div>
  )
}

// ── Card image — key prop from parent resets failed state per story ────────────

function CardImage({ imageUrl, emoji }: { imageUrl?: string; emoji: string }) {
  const [failed, setFailed] = useState(false)

  if (imageUrl && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt=""
        onError={() => setFailed(true)}
        className="w-full object-cover"
        style={{ height: '180px' }}
      />
    )
  }

  return (
    <div
      className="w-full flex items-center justify-center text-5xl"
      style={{ height: '120px', backgroundColor: 'var(--color-bg)' }}
    >
      {emoji}
    </div>
  )
}

// ── Summary ───────────────────────────────────────────────────────────────────

function Summary({
  preferences,
  total,
  onExit,
  onBack,
}: {
  preferences: Record<string, Preference>
  total: number
  onExit: () => void
  onBack?: () => void
}) {
  const ORDER = [
    'Headliner', 'International Affairs', 'Trade', 'Tech & AI',
    'US Politics', 'China Politics', 'Finance', 'Critical Minerals',
  ]

  const cats = ORDER
    .filter(c => preferences[c]?.total > 0)
    .sort((a, b) => preferences[b].score - preferences[a].score)

  const totalLikes = Object.values(preferences).reduce((s, p) => s + p.likes, 0)

  return (
    <div className="max-w-sm mx-auto px-4 pt-8 pb-16">
      <div className="text-center mb-8">
        <div className="text-4xl mb-3">🎉</div>
        <h2 className="text-xl font-bold mb-1" style={{ color: 'var(--color-text)' }}>
          All caught up!
        </h2>
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          {total} stories reviewed · {totalLikes} liked
        </p>
      </div>

      {cats.length > 0 && (
        <div
          className="rounded-2xl border p-5 mb-4"
          style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
        >
          <h3 className="text-xs font-bold tracking-widest uppercase mb-4"
            style={{ color: 'var(--color-text-2)' }}>
            Your interests
          </h3>
          <div className="space-y-3">
            {cats.map(cat => {
              const p = preferences[cat]
              return (
                <div key={cat}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span style={{ color: 'var(--color-text)' }}>
                      {EMOJI[cat] ?? '📰'} {cat}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      {p.likes}✓ {p.dislikes}✕
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full overflow-hidden"
                    style={{ backgroundColor: 'var(--color-bg)' }}>
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${p.score}%`,
                        backgroundColor: p.score >= 60 ? '#22c55e' : p.score >= 40 ? 'var(--color-accent)' : '#ef4444',
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="flex gap-3">
        {onBack && (
          <button
            onClick={onBack}
            className="flex-1 py-3 rounded-xl text-sm font-semibold border"
            style={{
              borderColor: 'var(--color-border)',
              backgroundColor: 'var(--color-surface)',
              color: 'var(--color-text)',
            }}
          >
            ↩ Go back
          </button>
        )}
        <button
          onClick={onExit}
          className="flex-1 py-3 rounded-xl text-sm font-semibold"
          style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-accent-text)' }}
        >
          Back to digest
        </button>
      </div>
    </div>
  )
}
