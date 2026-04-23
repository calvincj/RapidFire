'use client'

import { useState, useEffect, useCallback } from 'react'
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

export default function SwipeMode({ digest, digestDate, onExit }: Props) {
  const [stories]  = useState<Story[]>(() => flattenDigest(digest))
  const [index, setIndex]           = useState(0)
  const [history, setHistory]       = useState<number[]>([])
  const [slide, setSlide]           = useState<'like' | 'dislike' | null>(null)
  const [preferences, setPreferences] = useState<Record<string, Preference>>({})
  const [done, setDone]             = useState(false)

  const current = stories[index]

  const react = useCallback(async (reaction: 'like' | 'dislike') => {
    if (slide || !current) return
    setSlide(reaction)

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

  // Load existing preferences on mount
  useEffect(() => {
    fetch('/api/reaction').then(r => r.json()).then(d => {
      if (d.preferences) setPreferences(d.preferences)
    })
  }, [])

  if (done) {
    return (
      <Summary
        preferences={preferences}
        total={stories.length}
        onExit={onExit}
        onBack={history.length > 0 ? goBack : undefined}
      />
    )
  }

  const progress = Math.round((index / stories.length) * 100)

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

        <span>{index + 1} / {stories.length}</span>

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
        <div
          className="w-full max-w-sm rounded-2xl border overflow-hidden transition-all duration-[280ms]"
          style={{
            borderColor: 'var(--color-border)',
            backgroundColor: 'var(--color-surface)',
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

      <p className="text-center text-xs pb-2" style={{ color: 'var(--color-text-muted)' }}>
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
