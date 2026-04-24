import { getDigest, getAvailableDates } from '@/lib/db'
import { isGoogleAuthEnabled } from '@/lib/auth'
import { getPTDate } from '@/lib/fetch-news'
import DigestClient from './components/DigestClient'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const today = getPTDate()
  const digest = await getDigest(today)
  const availableDates = await getAvailableDates()
  const authEnabled = isGoogleAuthEnabled()

  return (
    <DigestClient
      initialDigest={digest}
      initialDate={today}
      availableDates={availableDates}
      todayDate={today}
      authEnabled={authEnabled}
    />
  )
}
