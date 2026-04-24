import { NextRequest, NextResponse } from 'next/server'
import { getDigest, getAvailableDates } from '@/lib/db'
import { getPTDate } from '@/lib/fetch-news'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const date = searchParams.get('date') ?? getPTDate()

  const digest = await getDigest(date)
  const availableDates = await getAvailableDates()

  return NextResponse.json({ digest, availableDates, date })
}
