'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Digest } from '@/lib/types'
import Calendar from './Calendar'
import DigestView from './DigestView'

interface Props {
  initialDigest: Digest | null
  initialDate: string
  availableDates: string[]
  todayDate: string
}

const THEMES = [
  { id: 'jade',      label: 'Jade Pebble Morning',        dot: '#2D6A4F' },
  { id: 'slate',     label: 'Urban Slate',                dot: '#6B8EC7' },
  { id: 'sandstone', label: 'Sandstone Aquamarine',       dot: '#009990' },
] as const

type ThemeId = typeof THEMES[number]['id']

export default function DigestClient({
  initialDigest,
  initialDate,
  availableDates,
  todayDate,
}: Props) {
  const [digest, setDigest] = useState<Digest | null>(initialDigest)
  const [currentDate, setCurrentDate] = useState(initialDate)
  const [dates, setDates] = useState(availableDates)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [theme, setTheme] = useState<ThemeId>('jade')

  // Load saved theme on mount
  useEffect(() => {
    const saved = (localStorage.getItem('theme') ?? 'jade') as ThemeId
    applyTheme(saved)
    setTheme(saved)
  }, [])

  function applyTheme(t: ThemeId) {
    document.documentElement.className = `theme-${t}`
    localStorage.setItem('theme', t)
  }

  const changeTheme = (t: ThemeId) => {
    setTheme(t)
    applyTheme(t)
  }

  const triggerFetch = useCallback(async (date: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/fetch?date=${date}`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Fetch failed')
      setDigest(data.digest as Digest)
      const dRes = await fetch(`/api/digest?date=${date}`)
      const dData = await dRes.json()
      setDates(dData.availableDates as string[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch news')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadDate = useCallback(async (date: string) => {
    setCurrentDate(date)
    setCalendarOpen(false)
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/digest?date=${date}`)
      const data = await res.json()
      setDigest(data.digest as Digest | null)
    } catch {
      setError('Failed to load digest')
    } finally {
      setLoading(false)
    }
  }, [])

  // Auto-fetch today's digest if missing
  useEffect(() => {
    if (!initialDigest && initialDate === todayDate) {
      triggerFetch(initialDate)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg)' }}>

      {/* ── Header ─────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-20 backdrop-blur border-b"
        style={{
          backgroundColor: 'var(--color-header)',
          borderColor: 'var(--color-border)',
        }}
      >
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1
              className="text-xl font-bold tracking-tight leading-none"
              style={{ color: 'var(--color-text)' }}
            >
              Daily Digest
            </h1>
            <p className="text-xs mt-1" style={{ color: 'var(--color-text-2)' }}>
              {formatDate(currentDate)}
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Theme picker */}
            <div className="flex items-center gap-1.5">
              {THEMES.map(t => (
                <button
                  key={t.id}
                  onClick={() => changeTheme(t.id)}
                  title={t.label}
                  className="w-5 h-5 rounded-full transition-transform active:scale-90"
                  style={{
                    backgroundColor: t.dot,
                    outline: theme === t.id ? `2px solid ${t.dot}` : '2px solid transparent',
                    outlineOffset: '2px',
                  }}
                />
              ))}
            </div>

            {/* Refresh */}
            <button
              onClick={() => triggerFetch(currentDate)}
              disabled={loading}
              className="px-3 py-2 rounded-xl text-sm font-semibold disabled:opacity-40 active:scale-95 transition-transform"
              style={{
                backgroundColor: 'var(--color-accent)',
                color: 'var(--color-accent-text)',
              }}
            >
              {loading ? 'Loading…' : 'Refresh'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 pb-16">

        {/* ── Collapsible calendar ──────────────────────────── */}
        <div
          className="mt-4 mb-5 rounded-xl border overflow-hidden"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <button
            onClick={() => setCalendarOpen(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium"
            style={{
              backgroundColor: 'var(--color-surface)',
              color: 'var(--color-text)',
            }}
          >
            <span>📅 Browse past dates</span>
            <span style={{ color: 'var(--color-text-muted)' }}>
              {calendarOpen ? '▴' : '▾'}
            </span>
          </button>

          {calendarOpen && (
            <div
              className="px-3 pb-3"
              style={{ backgroundColor: 'var(--color-surface)' }}
            >
              <Calendar
                availableDates={dates}
                selectedDate={currentDate}
                todayDate={todayDate}
                onSelectDate={loadDate}
              />
            </div>
          )}
        </div>

        {/* ── Error ────────────────────────────────────────── */}
        {error && (
          <div className="mb-5 p-4 rounded-xl border text-sm leading-relaxed"
            style={{
              backgroundColor: 'var(--color-surface)',
              borderColor: '#e57373',
              color: '#c62828',
            }}
          >
            {error}
          </div>
        )}

        {/* ── Loading (no content yet) ──────────────────────── */}
        {loading && !digest && (
          <div className="py-20 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
            {currentDate === todayDate
              ? "Fetching today's news… this takes about 20 seconds"
              : 'Loading…'}
          </div>
        )}

        {/* ── Digest ───────────────────────────────────────── */}
        {digest && <DigestView digest={digest} />}

        {/* ── Empty state ───────────────────────────────────── */}
        {!loading && !digest && !error && (
          <div className="py-20 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
            No digest available for this date.
          </div>
        )}
      </main>
    </div>
  )
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}
