import { NextRequest, NextResponse } from 'next/server'
import { saveReaction, getCategoryPreferences } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
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
  } catch (err) {
    console.error('[api/reaction] Error:', err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const preferences = getCategoryPreferences()
    return NextResponse.json({ preferences })
  } catch (err) {
    console.error('[api/reaction] Error:', err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err), preferences: {} },
      { status: 500 }
    )
  }
}
