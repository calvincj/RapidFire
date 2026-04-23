import { getDigest, getAvailableDates } from '@/lib/db'
import { isGoogleAuthEnabled } from '@/lib/auth'
import { getPTDate } from '@/lib/fetch-news'
import DigestClient from './components/DigestClient'

export const dynamic = 'force-dynamic'

export default function Home() {
  const today = getPTDate()
  const digest = getDigest(today)
  const availableDates = getAvailableDates()
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
