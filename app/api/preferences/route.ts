import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getUserPrefs, setUserPrefs } from '@/lib/db'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return Response.json({ theme: 'jade' })
  }
  const { theme } = await getUserPrefs(session.user.id)
  return Response.json({ theme })
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { theme } = await req.json()
  const { font } = await getUserPrefs(session.user.id)
  await setUserPrefs(session.user.id, theme, font)
  return Response.json({ ok: true })
}
