'use client'

import { useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'

const THEMES = ['jade', 'slate', 'sandstone'] as const

export default function AboutPage() {
  useEffect(() => {
    const saved = localStorage.getItem('theme') ?? 'jade'
    const el = document.documentElement
    THEMES.forEach(t => el.classList.remove(`theme-${t}`))
    el.classList.add(`theme-${saved}`)
  }, [])

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg)' }}>
      <header
        className="sticky top-0 z-20 backdrop-blur border-b"
        style={{ backgroundColor: 'var(--color-header)', borderColor: 'var(--color-border)' }}
      >
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="group flex items-center gap-2">
            <Image src="/images/logo.png" alt="RapidFire" width={30} height={28} className="rounded-md" />
            <span
              className="text-xl font-bold tracking-tight group-hover:opacity-75 transition-opacity"
              style={{ color: 'var(--color-text)' }}
            >
              RapidFire
            </span>
          </Link>
          <Link
            href="/"
            className="text-sm font-medium px-3 py-1.5 rounded-lg transition-opacity hover:opacity-70"
            style={{ color: 'var(--color-text-2)' }}
          >
            ← Back
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-12">
        <div className="mb-10">
          <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--color-text)' }}>
            About
          </h1>
        </div>

        <div
          className="rounded-2xl border p-6 mb-6"
          style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
        >
          <h2 className="text-base font-semibold mb-3" style={{ color: 'var(--color-text)' }}>
            Why I built this
          </h2>
          <div className="space-y-3 text-sm leading-relaxed" style={{ color: 'var(--color-text-2)' }}>
            <p>
              I wanted to stay up to date with the news without having to sort through opinion
              pieces and stuff I don't care about. So I built something that just shows me the
              important stories.
            </p>
            <p>
              If you have feedback, feel free to reach out at{' '}
              <a
                href="mailto:calvinc7028@gmail.com"
                className="underline hover:opacity-70 transition-opacity"
                style={{ color: 'var(--color-text)' }}
              >
                calvinc7028@gmail.com
              </a>
              .
            </p>
          </div>
        </div>

        <div
          className="rounded-2xl border p-6 mb-6"
          style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
        >
          <h2 className="text-base font-semibold mb-3" style={{ color: 'var(--color-text)' }}>
            What it covers
          </h2>
          <div className="space-y-3 text-sm leading-relaxed" style={{ color: 'var(--color-text-2)' }}>
            <p>
              Every day it pulls headlines from a bunch of sources, runs them through an AI that
              acts as an editor, and organizes them into a briefing. The categories are things like
              geopolitics, trade, US politics, China, tech and AI, finance, and critical minerals.
            </p>
            <p>
              Each story gets a 1 to 2 sentence summary. The goal is that you can read the whole
              thing over breakfast and actually know what's going on.
            </p>
          </div>
        </div>

        <div
          className="rounded-2xl border p-6 mb-6"
          style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
        >
          <h2 className="text-base font-semibold mb-3" style={{ color: 'var(--color-text)' }}>
            What gets filtered out
          </h2>
          <div className="space-y-3 text-sm leading-relaxed" style={{ color: 'var(--color-text-2)' }}>
            <p>
              This is mostly a hard news feed. The AI is specifically set up to skip opinion
              columns, editorials, analysis pieces, and anything that's basically just someone
              sharing their thoughts. It also skips sports, entertainment, and celebrity stuff.
            </p>
            <p>
              A story only makes it in if something concrete actually happened. If the whole
              news value is that someone "said" or "warned" about something, it usually gets cut.
            </p>
            <p>
              The result is that the feed is smaller than most news apps but hopefully more
              signal and less noise.
            </p>
          </div>
        </div>

        <div
          className="rounded-2xl border p-6"
          style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
        >
          <h2 className="text-base font-semibold mb-3" style={{ color: 'var(--color-text)' }}>
            Sources
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-2)' }}>
            Headlines come from the New York Times, BBC News, Al Jazeera, The Guardian, NewsAPI,
            and South China Morning Post. You can also add your own RSS feeds in the settings
            and they get mixed into the daily digest.
          </p>
        </div>
      </main>
    </div>
  )
}
