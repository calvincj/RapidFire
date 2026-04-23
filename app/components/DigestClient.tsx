'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { useSession, signIn, signOut } from 'next-auth/react'
import type { Digest } from '@/lib/types'
import Calendar from './Calendar'
import DigestView from './DigestView'
import SwipeMode from './SwipeMode'
import FeedsModal from './FeedsModal'

interface Props {
  initialDigest: Digest | null
  initialDate: string
  availableDates: string[]
  todayDate: string
  authEnabled: boolean
}

const THEMES = [
  { id: 'jade',      label: 'Jade Pebble Morning',   dot: '#7CBB94' },
  { id: 'slate',     label: 'Urban Slate',            dot: '#243352' },
  { id: 'sandstone', label: 'Sandstone Aquamarine',   dot: '#C4894F' },
] as const

type ThemeId = typeof THEMES[number]['id']
type Mode    = 'read' | 'swipe'

export default function DigestClient({
  initialDigest,
  initialDate,
  availableDates,
  todayDate,
  authEnabled,
}: Props) {
  const [digest, setDigest]           = useState<Digest | null>(initialDigest)
  const [currentDate, setCurrentDate] = useState(initialDate)
  const [dates, setDates]             = useState(availableDates)
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [theme, setTheme]             = useState<ThemeId>('jade')
  const [mode, setMode]               = useState<Mode>('read')
  const [feedsOpen, setFeedsOpen]     = useState(false)
  const { data: session, status }     = useSession()

  function applyTheme(t: ThemeId) {
    const el = document.documentElement
    THEMES.forEach(th => el.classList.remove(`theme-${th.id}`))
    el.classList.add(`theme-${t}`)
    localStorage.setItem('theme', t)
  }

  function savePrefs(t: ThemeId) {
    localStorage.setItem('theme', t)
    if (session?.user) {
      fetch('/api/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: t }),
      })
    }
  }

  // Load prefs: from DB when signed in, localStorage when not
  useEffect(() => {
    if (status === 'loading') return
    if (session?.user) {
      fetch('/api/preferences')
        .then(r => r.json())
        .then(({ theme: t }) => {
          applyTheme(t as ThemeId)
          setTheme(t as ThemeId)
        })
    } else {
      const savedTheme = (localStorage.getItem('theme') ?? 'jade') as ThemeId
      applyTheme(savedTheme)
      setTheme(savedTheme)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, session?.user?.id])

  const changeTheme = (t: ThemeId) => { setTheme(t); applyTheme(t); savePrefs(t) }

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
    setMode('read')
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/digest?date=${date}`)
      const data = await res.json()
      setDigest(data.digest as Digest | null)
      // Always sync available dates so calendar stays accurate
      setDates(data.availableDates as string[])
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

  // Swipe mode takes over the full screen below the header
  if (mode === 'swipe' && digest) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg)' }}>
        <Header
          currentDate={currentDate}
          theme={theme}
          authEnabled={authEnabled}
          session={session}
          loading={loading}
          mode={mode}
          onChangeTheme={changeTheme}
          onRefresh={() => triggerFetch(currentDate)}
          onToggleMode={() => setMode('read')}
          onOpenFeeds={() => setFeedsOpen(true)}
        />
        <SwipeMode
          digest={digest}
          digestDate={currentDate}
          onExit={() => setMode('read')}
        />
        {feedsOpen && <FeedsModal onClose={() => setFeedsOpen(false)} />}
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg)' }}>
      <Header
        currentDate={currentDate}
        theme={theme}
        authEnabled={authEnabled}
        session={session}
        loading={loading}
        mode={mode}
        onChangeTheme={changeTheme}
        onRefresh={() => triggerFetch(currentDate)}
        onToggleMode={() => digest && setMode('swipe')}
        swipeDisabled={!digest}
        onOpenFeeds={() => setFeedsOpen(true)}
      />
      {feedsOpen && <FeedsModal onClose={() => setFeedsOpen(false)} />}

      <main className="max-w-2xl mx-auto px-4 pb-16">

        {/* ── Collapsible calendar ──────────────────────────── */}
        <div
          className="mt-4 mb-5 rounded-xl border overflow-hidden"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <button
            onClick={() => setCalendarOpen(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium"
            style={{ backgroundColor: 'var(--color-surface)', color: 'var(--color-text)' }}
          >
            <span>📅 Browse past dates</span>
            <span style={{ color: 'var(--color-text-muted)' }}>
              {calendarOpen ? '•' : '◦'}
            </span>
          </button>

          {calendarOpen && (
            <div className="px-3 pb-3" style={{ backgroundColor: 'var(--color-surface)' }}>
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
          <div
            className="mb-5 p-4 rounded-xl border text-sm leading-relaxed"
            style={{ backgroundColor: 'var(--color-surface)', borderColor: '#ef4444', color: '#c62828' }}
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

// ── Shared header ─────────────────────────────────────────────────────────────

interface HeaderProps {
  currentDate: string
  theme: ThemeId
  authEnabled: boolean
  session: ReturnType<typeof useSession>['data']
  loading: boolean
  mode: Mode
  swipeDisabled?: boolean
  onChangeTheme: (t: ThemeId) => void
  onRefresh: () => void
  onToggleMode: () => void
  onOpenFeeds: () => void
}

function Header({
  currentDate,
  theme,
  authEnabled,
  session,
  loading,
  mode,
  swipeDisabled,
  onChangeTheme,
  onRefresh,
  onToggleMode,
  onOpenFeeds,
}: HeaderProps) {
  const [avatarOpen, setAvatarOpen] = useState(false)

  return (
    <header
      className="sticky top-0 z-20 backdrop-blur border-b"
      style={{ backgroundColor: 'var(--color-header)', borderColor: 'var(--color-border)' }}
    >
      <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1
            className="text-xl font-bold tracking-tight leading-none flex items-center gap-2"
            style={{ color: 'var(--color-text)' }}
          >
            <Image src="/images/logo.png" alt="RapidFire" width={30} height={28} className="rounded-md" />
            RapidFire
          </h1>
          <p className="text-xs mt-1" style={{ color: 'var(--color-text-2)' }}>
            {formatDate(currentDate)}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Theme dots */}
          <div className="flex items-center gap-1.5">
            {THEMES.map(t => (
              <button
                key={t.id}
                onClick={() => onChangeTheme(t.id)}
                title={t.label}
                className="w-4 h-4 rounded-full transition-transform active:scale-90"
                style={{
                  backgroundColor: t.dot,
                  outline: theme === t.id ? `2px solid ${t.dot}` : '2px solid transparent',
                  outlineOffset: '2px',
                }}
              />
            ))}
          </div>

          {/* Swipe mode toggle */}
          <div className="relative group">
            <button
              onClick={onToggleMode}
              disabled={swipeDisabled}
              className="w-8 h-8 flex items-center justify-center rounded-xl text-base transition-colors disabled:opacity-30"
              style={{
                backgroundColor: mode === 'swipe' ? 'var(--color-accent)' : 'var(--color-surface)',
                color:           mode === 'swipe' ? 'var(--color-accent-text)' : 'var(--color-text-2)',
              }}
            >
              {mode === 'swipe' ? '☰' : '⟐'}
            </button>
            <span className="pointer-events-none absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1 text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap"
              style={{ backgroundColor: 'var(--color-text)', color: 'var(--color-bg)' }}>
              {mode === 'swipe' ? 'Read view' : 'Swipe mode'}
            </span>
          </div>

          {/* Feeds settings */}
          <div className="relative group">
            <button
              onClick={onOpenFeeds}
              className="w-8 h-8 flex items-center justify-center rounded-xl text-base transition-colors"
              style={{ backgroundColor: 'var(--color-surface)', color: 'var(--color-text-2)' }}
            >
              ⚙
            </button>
            <span className="pointer-events-none absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1 text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap"
              style={{ backgroundColor: 'var(--color-text)', color: 'var(--color-bg)' }}>
              Custom feeds
            </span>
          </div>

          {/* Refresh — hidden in swipe mode */}
          {mode === 'read' && (
            <button
              onClick={onRefresh}
              disabled={loading}
              className="px-3 py-2 rounded-xl text-sm font-semibold disabled:opacity-40 active:scale-95 transition-transform"
              style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-accent-text)' }}
            >
              {loading ? 'Loading…' : 'Refresh'}
            </button>
          )}

          {/* Auth */}
          {session?.user ? (
            <div className="relative">
              <button
                onClick={() => setAvatarOpen(v => !v)}
                className="w-7 h-7 rounded-full overflow-hidden border-2 transition-opacity hover:opacity-80 shrink-0"
                style={{ borderColor: 'var(--color-accent)' }}
                title={session.user.name ?? 'Account'}
              >
                {session.user.image
                  ? <Image src={session.user.image} alt="avatar" width={28} height={28} />
                  : <span className="w-full h-full flex items-center justify-center text-xs font-bold"
                      style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-accent-text)' }}>
                      {session.user.name?.[0] ?? '?'}
                    </span>
                }
              </button>
              {avatarOpen && (
                <div
                  className="absolute right-0 top-full mt-2 w-48 rounded-xl border shadow-lg p-3 z-30 flex flex-col gap-2"
                  style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
                >
                  <p className="text-xs font-medium truncate" style={{ color: 'var(--color-text)' }}>
                    {session.user.name}
                  </p>
                  <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>
                    {session.user.email}
                  </p>
                  <button
                    onClick={() => signOut()}
                    className="mt-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-opacity hover:opacity-80"
                    style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-accent-text)' }}
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          ) : authEnabled ? (
            <button
              onClick={() => signIn('google')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-opacity hover:opacity-80 shrink-0"
              style={{ backgroundColor: 'var(--color-surface)', color: 'var(--color-text-2)' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Sign in
            </button>
          ) : null}
        </div>
      </div>
    </header>
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
