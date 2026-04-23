import cron from 'node-cron'
import { fetchAndSaveDigest, getPTDate } from './fetch-news'

let started = false

export function setupCron(): void {
  if (started) return
  started = true

  cron.schedule(
    '0 0 * * *',
    async () => {
      const date = getPTDate()
      console.log(`[cron] Daily digest fetch for ${date}`)
      try {
        await fetchAndSaveDigest(date)
        console.log(`[cron] Done — ${date}`)
      } catch (err) {
        console.error('[cron] Failed:', err)
      }
    },
    { timezone: 'America/Los_Angeles' }
  )

  console.log('[cron] Midnight PT job scheduled')
}
