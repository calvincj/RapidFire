import { NextRequest, NextResponse } from 'next/server'
import { fetchAndSaveDigest, getPTDate } from '@/lib/fetch-news'

// Triggered by Vercel Cron (see vercel.json) every morning.
// Vercel automatically sends `Authorization: Bearer $CRON_SECRET` on cron
// requests when the CRON_SECRET env var is set — reject anything else so
// this (paid, LLM-backed) endpoint can't be triggered by randoms hitting the URL.

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = request.headers.get('authorization')
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }
  }

  const date = getPTDate()
  console.log(`[cron] Daily digest fetch for ${date}`)
  try {
    const digest = await fetchAndSaveDigest(date)
    console.log(`[cron] Done — ${date}`)
    return NextResponse.json({ success: true, digest })
  } catch (err) {
    console.error('[cron] Failed:', err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
