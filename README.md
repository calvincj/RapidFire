# Daily Digest

A personal AI-curated news dashboard. Every day it pulls fresh headlines from NewsAPI, sends them to Groq's Llama 3.3 70B model for categorization and summarization, and presents them in a clean mobile-first interface organized into 9 topic sections.

## How it works

1. **NewsAPI** fetches headlines across US politics, business, tech, China, trade, critical minerals, and AI
2. **Groq (llama-3.3-70b-versatile)** sorts them into 9 categories and writes a one-sentence summary per story
3. Results are saved to a local SQLite database (`data/digest.db`), keyed by date in America/Los_Angeles timezone
4. A `node-cron` job fires automatically at midnight PT each day

## Prerequisites

- Node.js 18.17 or later
- A [NewsAPI.org](https://newsapi.org) API key for the app owner
- A [Groq](https://console.groq.com) API key for the app owner

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Copy env file and fill in your keys
cp .env.example .env
```

Open `.env` and set:

```
NEWSAPI_KEY=your_newsapi_key_here
GROQ_API_KEY=your_groq_api_key_here
GUARDIAN_API_KEY=your_guardian_api_key_here
```

Google sign-in is optional. If you want saved per-user preferences in a hosted copy, also set:

```
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
NEXTAUTH_SECRET=...
```

## Running

```bash
# Development
npm run dev

# Production
npm run build
npm start
```

Open [http://localhost:3000](http://localhost:3000).

On first load, today's digest is fetched automatically if it isn't cached yet. This takes roughly 20 seconds (7 NewsAPI calls + 1 Groq inference). Subsequent page loads are instant.

## Shared Hosted Setup

To let friends use RapidFire without managing their own API keys:

- Deploy one shared copy of the app that you control.
- Put your keys in the deployment's server-side environment variables.
- Keep all third-party API calls on the server.
- Optionally add Google OAuth if you want users to save their own preferences.
- If Google OAuth is not configured, the app still works; the sign-in button is simply hidden.

## Features

| Feature | Details |
|---|---|
| **9 categories** | Headliner · International Affairs · Trade · Tech · US Politics · China Politics · Finance · Critical Minerals · AI |
| **Daily auto-fetch** | node-cron fires at midnight America/Los_Angeles |
| **First-load auto-fetch** | If today has no cached digest, the client triggers one automatically |
| **Calendar** | Browse any past day; dates with no data are grayed out |
| **Refresh button** | Manually re-fetch any day |
| **Mobile-first** | Large text, generous padding, tap-friendly targets |

## Notes

- The free NewsAPI plan allows ~100 requests/day. Each digest run uses 7 requests, leaving plenty of headroom for manual refreshes.
- Digests are stored in `data/digest.db` (excluded from git). Back up this file to preserve history.
- Groq's free tier rate limits are generous and easily handle one request per day.
