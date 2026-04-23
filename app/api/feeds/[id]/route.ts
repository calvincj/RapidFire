import { NextRequest, NextResponse } from 'next/server'
import { deleteCustomFeed } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = parseInt(params.id, 10)
  if (isNaN(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  deleteCustomFeed(id)
  return NextResponse.json({ success: true })
}
