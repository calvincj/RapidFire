import { NextRequest, NextResponse } from 'next/server'
import { fetchAndSaveDigest, getPTDate } from '@/lib/fetch-news'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Prevent duplicate in-flight fetches for the same date
const inProgress = new Set<string>()

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const date = searchParams.get('date') ?? getPTDate()

  if (inProgress.has(date)) {
    return NextResponse.json(
      { success: false, error: 'A fetch for this date is already in progress. Please wait.' },
      { status: 429 }
    )
  }

  inProgress.add(date)
  try {
    const digest = await fetchAndSaveDigest(date)
    return NextResponse.json({ success: true, digest })
  } catch (err) {
    console.error('[api/fetch] Error:', err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  } finally {
    inProgress.delete(date)
  }
}
