'use client'

import { useState, useEffect, useRef } from 'react'

interface Feed {
  id: number
  url: string
  title: string
}

interface Props {
  onClose: () => void
}

export default function FeedsModal({ onClose }: Props) {
  const [feeds, setFeeds]         = useState<Feed[]>([])
  const [url, setUrl]             = useState('')
  const [title, setTitle]         = useState('')
  const [adding, setAdding]       = useState(false)
  const [importing, setImporting] = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [importMsg, setImportMsg] = useState<string | null>(null)
  const overlayRef                = useRef<HTMLDivElement>(null)
  const fileRef                   = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/feeds').then(r => r.json()).then(d => setFeeds(d.feeds ?? []))
  }, [])

  async function add() {
    if (!url.trim()) return
    setAdding(true)
    setError(null)
    try {
      const res = await fetch('/api/feeds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), title: title.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to add feed')
      setFeeds(f => [data.feed, ...f])
      setUrl('')
      setTitle('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setAdding(false)
    }
  }

  async function remove(id: number) {
    await fetch(`/api/feeds/${id}`, { method: 'DELETE' })
    setFeeds(f => f.filter(x => x.id !== id))
  }

  async function importOPML(file: File) {
    setImporting(true)
    setImportMsg(null)
    setError(null)
    try {
      const text = await file.text()
      const doc = new DOMParser().parseFromString(text, 'text/xml')
      // OPML outlines with xmlUrl are feed entries
      const outlines = Array.from(
        doc.querySelectorAll('outline[xmlUrl], outline[type="rss"]')
      )
      if (outlines.length === 0) {
        setError('No RSS feeds found in this OPML file.')
        return
      }
      let added = 0
      for (const el of outlines) {
        const feedUrl = el.getAttribute('xmlUrl') ?? el.getAttribute('htmlUrl')
        const feedTitle = el.getAttribute('title') ?? el.getAttribute('text') ?? ''
        if (!feedUrl) continue
        const res = await fetch('/api/feeds', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: feedUrl.trim(), title: feedTitle.trim() }),
        })
        if (res.ok) added++
      }
      // Refresh list
      const listRes = await fetch('/api/feeds')
      const listData = await listRes.json()
      setFeeds(listData.feeds ?? [])
      setImportMsg(`Imported ${added} of ${outlines.length} feeds`)
    } catch {
      setError('Failed to parse OPML file.')
    } finally {
      setImporting(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={e => { if (e.target === overlayRef.current) onClose() }}
    >
      <div
        className="w-full max-w-md rounded-2xl border p-5 max-h-[85vh] flex flex-col"
        style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-base" style={{ color: 'var(--color-text)' }}>
            Custom RSS Feeds
          </h2>
          <button
            onClick={onClose}
            className="text-lg leading-none hover:opacity-60 transition-opacity"
            style={{ color: 'var(--color-text-muted)' }}
          >
            ✕
          </button>
        </div>

        <p className="text-xs mb-4" style={{ color: 'var(--color-text-muted)' }}>
          Add Substack, newsletter, or any RSS feed URL. Stories will be included in the next refresh and filtered by your swipe preferences.
        </p>

        {/* OPML import */}
        <div
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl border mb-3"
          style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)' }}
        >
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium" style={{ color: 'var(--color-text)' }}>
              Import from Feedly / OPML
            </p>
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              Export from Feedly → Organize → Import/Export
            </p>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".opml,.xml"
            className="hidden"
            onChange={e => {
              const f = e.target.files?.[0]
              if (f) importOPML(f)
            }}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={importing}
            className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40 transition-opacity"
            style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-accent-text)' }}
          >
            {importing ? 'Importing…' : 'Upload .opml'}
          </button>
        </div>

        {importMsg && (
          <p className="text-xs mb-2" style={{ color: '#22c55e' }}>{importMsg}</p>
        )}

        {/* Manual add form */}
        <div className="space-y-2 mb-4">
          <input
            type="url"
            placeholder="https://example.substack.com/feed"
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && add()}
            className="w-full text-sm px-3 py-2 rounded-xl border outline-none"
            style={{
              backgroundColor: 'var(--color-bg)',
              borderColor: 'var(--color-border)',
              color: 'var(--color-text)',
            }}
          />
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Label (optional)"
              value={title}
              onChange={e => setTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && add()}
              className="flex-1 text-sm px-3 py-2 rounded-xl border outline-none"
              style={{
                backgroundColor: 'var(--color-bg)',
                borderColor: 'var(--color-border)',
                color: 'var(--color-text)',
              }}
            />
            <button
              onClick={add}
              disabled={adding || !url.trim()}
              className="px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-40 transition-opacity"
              style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-accent-text)' }}
            >
              {adding ? '…' : 'Add'}
            </button>
          </div>
          {error && (
            <p className="text-xs" style={{ color: '#ef4444' }}>{error}</p>
          )}
        </div>

        {/* Feed list */}
        <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
          {feeds.length === 0 ? (
            <p className="text-sm text-center py-6" style={{ color: 'var(--color-text-muted)' }}>
              No custom feeds yet
            </p>
          ) : (
            feeds.map(feed => (
              <div
                key={feed.id}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl border"
                style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)' }}
              >
                <div className="flex-1 min-w-0">
                  {feed.title && (
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>
                      {feed.title}
                    </p>
                  )}
                  <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>
                    {feed.url}
                  </p>
                </div>
                <button
                  onClick={() => remove(feed.id)}
                  className="shrink-0 text-sm hover:opacity-60 transition-opacity"
                  style={{ color: '#ef4444' }}
                  title="Remove feed"
                >
                  ✕
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
