import { getDigest, getAvailableDates } from '@/lib/db'
import { getPTDate } from '@/lib/fetch-news'
import DigestClient from './components/DigestClient'

export const dynamic = 'force-dynamic'

export default function Home() {
  const today = getPTDate()
  const digest = getDigest(today)
  const availableDates = getAvailableDates()

  return (
    <DigestClient
      initialDigest={digest}
      initialDate={today}
      availableDates={availableDates}
      todayDate={today}
    />
  )
}
