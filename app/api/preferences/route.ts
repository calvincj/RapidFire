import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getUserPrefs, setUserPrefs } from '@/lib/db'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return Response.json({ theme: 'jade', font: 'inter' })
  }
  return Response.json(getUserPrefs(session.user.id))
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { theme, font } = await req.json()
  setUserPrefs(session.user.id, theme, font)
  return Response.json({ ok: true })
}
