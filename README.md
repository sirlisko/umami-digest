# umami-digest

[![CI](https://github.com/sirlisko/umami-digest/actions/workflows/ci.yml/badge.svg)](https://github.com/sirlisko/umami-digest/actions/workflows/ci.yml)

A tiny analytics email digest for [Umami Analytics](https://umami.is/) v3+, running as a scheduled [Cloudflare Worker](https://developers.cloudflare.com/workers/) and sent via [Resend](https://resend.com/). No server to run, no container, no cron box - Cloudflare's Cron Triggers do the scheduling. Runs daily or weekly.

Each report includes:

- Visitors, pageviews, average time on site, and bounce rate
- Top 5 pages and referrers
- Top browsers and devices
- Top 5 countries

## Requirements

- A self-hosted Umami v3+ instance with a login (username/password) - the worker authenticates via `/api/auth/login` and uses the returned bearer token
- A [Resend](https://resend.com/) account with a verified sending domain
- A [Cloudflare](https://dash.cloudflare.com/) account
- Node.js and `npx`

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure `wrangler.toml`

```bash
cp wrangler.toml.example wrangler.toml
```

`wrangler.toml` is gitignored - it holds your site name, website UUID, and recipient addresses, so it stays local instead of getting committed. Edit it:

```toml
[vars]
SITE_NAME = "example.com"
UMAMI_URL = "https://stats.example.com"
UMAMI_WEBSITE_ID = "your-website-uuid"
REPORT_TO = "you@example.com"
REPORT_FROM = "reports@example.com"
REPORT_PERIOD = "weekly" # "daily" or "weekly"

[triggers]
crons = ["0 8 * * 1"]
```

`SITE_NAME` shows up in the email header, subject line, and avatar initial. The website UUID is in the URL when you open the site in Umami's Settings → Websites screen. The cron schedule runs in UTC.

`REPORT_PERIOD` controls both the lookback window (1 day vs. 7 days) and the email copy - it doesn't change the schedule by itself, so keep it in sync with `crons`:

| Mode                   | `REPORT_PERIOD` | `crons`           |
|------------------------|-----------------|-------------------|
| Weekly, Monday 8am UTC | `"weekly"`      | `["0 8 * * 1"]`   |
| Daily, 8am UTC         | `"daily"`       | `["0 8 * * *"]`   |

Change both, then redeploy.

### 3. Add secrets

```bash
npx wrangler secret put UMAMI_USERNAME
npx wrangler secret put UMAMI_PASSWORD
npx wrangler secret put RESEND_API_KEY
```

Secrets go to Cloudflare, never into the repo or `wrangler.toml`.

### 4. Test locally

```bash
cp .dev.vars.example .dev.vars
# fill in UMAMI_USERNAME, UMAMI_PASSWORD, and RESEND_API_KEY in .dev.vars

npm run dev
# in another shell:
curl "http://localhost:8787/__scheduled?cron=0+8+*+*+1"
```

Point `REPORT_TO` at a throwaway address for the first couple of runs. A 401 on the `/api/auth/login` call means the username/password is wrong; a 401 on `/stats` or `/metrics` after a successful login usually means the account can't access that website; a 403 from Resend means the sending domain isn't verified yet.

### 5. Deploy

```bash
npm run deploy
```

Confirm the cron trigger in the Cloudflare dashboard under Workers → umami-digest → Settings → Triggers. `npm run tail` streams logs from the live worker.

## Development

```bash
npm run typecheck
npm test
```

Both run in CI on every push and pull request against `main`.

## How it works

- `src/index.ts` - the Worker's `scheduled` entrypoint; wires the pieces below together
- `src/umami.ts` - logs in against `/api/auth/login` for a bearer token, then fetches `/stats` and `/metrics` (`type=path`, `referrer`, `browser`, `device`, `country`) for the configured window
- `src/email.ts` - the HTML email template (`render()`) and its formatting helpers
- `src/resend.ts` - sends the rendered email through the Resend API
- `src/types.ts` - the shared `Env`/`Stats`/`Collected` types

Self-hosted Umami v3's `/stats` response is flat current-period numbers plus a `comparison` sibling object holding the prior period's numbers - deltas are computed from that, not a per-field `{ value, prev }` shape. Country codes are resolved to names via the runtime's built-in `Intl.DisplayNames` (Cloudflare Workers ships full ICU), not a hand-maintained table.
