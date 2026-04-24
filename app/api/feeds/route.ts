import { NextRequest, NextResponse } from 'next/server'
import { getCustomFeeds, addCustomFeed } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({ feeds: await getCustomFeeds() })
}

export async function POST(request: NextRequest) {
  const { url, title } = await request.json() as { url?: string; title?: string }

  if (!url || !url.startsWith('http')) {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
  }

  const feed = await addCustomFeed(url.trim(), (title ?? '').trim())
  return NextResponse.json({ feed })
}
