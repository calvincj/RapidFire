export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { setupCron } = await import('./lib/cron')
    setupCron()
  }
}
