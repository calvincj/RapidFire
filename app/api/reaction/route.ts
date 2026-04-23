import { NextRequest, NextResponse } from 'next/server'
import { saveReaction, getCategoryPreferences } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { url, category, reaction, digestDate } = body as {
    url: string
    category: string
    reaction: 'like' | 'dislike'
    digestDate: string
  }

  if (!url || !category || !reaction || !digestDate) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  saveReaction(url, category, reaction, digestDate)
  const preferences = getCategoryPreferences()

  return NextResponse.json({ success: true, preferences })
}

export async function GET() {
  const preferences = getCategoryPreferences()
  return NextResponse.json({ preferences })
}
