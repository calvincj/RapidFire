import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { saveReaction, getCategoryPreferences } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Sign in with Google to save your interests.' },
        { status: 401 }
      )
    }

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

    await saveReaction(session.user.id, url, category, reaction, digestDate)
    const preferences = await getCategoryPreferences(session.user.id)

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
    const session = await getServerSession(authOptions)
    const preferences = session?.user?.id
      ? await getCategoryPreferences(session.user.id)
      : {}
    return NextResponse.json({ preferences })
  } catch (err) {
    console.error('[api/reaction] Error:', err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err), preferences: {} },
      { status: 500 }
    )
  }
}
