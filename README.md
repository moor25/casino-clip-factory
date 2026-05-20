# Casino Clip Factory

Monitors live Kick.com casino streams and uses Claude AI to score them for big win potential.

## Setup

```bash
npm install
cp .env.example .env
# Fill in ANTHROPIC_API_KEY in .env
npm start
```

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/streams` | List live casino streams |
| GET | `/api/streams/categories?q=casino` | Browse Kick categories |
| GET | `/api/streams/:slug` | Get a specific channel |
| GET | `/api/analyze/scan` | Fetch + analyze streams for big wins |
| GET | `/api/analyze/:slug` | Analyze one channel |
| POST | `/api/analyze` | Analyze custom stream array |
| GET | `/api/latest` | Last scheduled scan results |

## Quick scan

```bash
curl http://localhost:3000/api/analyze/scan?threshold=7&limit=20
```

Response:
```json
{
  "scanned": 18,
  "bigWinsFound": 3,
  "threshold": 7,
  "bigWins": [
    {
      "meta": { "streamer": "example", "title": "MEGA WIN x1500!! 🔥", "viewers": 4200 },
      "analysis": {
        "score": 9,
        "reason": "Title contains explicit mega win claim with multiplier",
        "highlights": ["MEGA WIN", "x1500"],
        "clipWorthy": true,
        "suggestedClipTitle": "MEGA WIN x1500 on Book of Dead — Absolute Madness"
      }
    }
  ]
}
```

## Config (`.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | — | Required |
| `PORT` | `3000` | Server port |
| `KICK_CATEGORIES` | `slots-casino` | Comma-separated Kick category slugs |
| `MIN_VIEWERS` | `50` | Skip streams below this viewer count |
| `BIGWIN_THRESHOLD` | `7` | Claude score cutoff (1–10) for big win flag |
| `SCAN_INTERVAL_MINUTES` | `5` | Auto-scan interval (0 = disabled) |
