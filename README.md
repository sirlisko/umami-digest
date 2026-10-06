# umami-digest

[![CI](https://github.com/sirlisko/umami-digest/actions/workflows/ci.yml/badge.svg)](https://github.com/sirlisko/umami-digest/actions/workflows/ci.yml)

A tiny analytics email digest for [Umami Analytics](https://umami.is/) v3+, running as a scheduled [Cloudflare Worker](https://developers.cloudflare.com/workers/) and sent via [Resend](https://resend.com/). No server to run, no container, no cron box - a single Cloudflare Cron Trigger does the scheduling. Send daily, weekly, monthly, or any combination, all at the same time of day.

Each report includes:

- Visitors, pageviews, average time on site, and bounce rate
- Top pages, referrers, browsers, devices, and countries (5 of each by default, configurable)
- Top custom events and UTM sources/campaigns, shown only when the period has any

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
REPORT_TOP_N = 5

REPORT_PERIODS = ["daily", "weekly", "monthly"]
REPORT_TIME = "08:00"
REPORT_WEEKLY_DAY = "mon"
REPORT_MONTHLY_DAY = 1
```

`SITE_NAME` shows up in the email header, subject line, and avatar initial. The website UUID is in the URL when you open the site in Umami's Settings → Websites screen. `REPORT_TOP_N` controls how many entries appear in each ranked list (pages, events, referrers, UTM sources/campaigns, browsers, devices, countries) - default 5 if omitted.

`REPORT_PERIODS` picks which digests you want, out of `daily`/`weekly`/`monthly`, in any combination. All of them share `REPORT_TIME` (`"HH:MM"`, UTC) and run from a single daily Cron Trigger; the worker itself decides which digests are due each time it fires (daily always, weekly only on `REPORT_WEEKLY_DAY` - `sun`-`sat` or `0`-`6` - monthly only on `REPORT_MONTHLY_DAY`, `1`-`31`). This is deliberate: Cloudflare silently coalesces multiple Cron Triggers landing on the same minute into one invocation, so giving each period its own trigger risks a dropped digest whenever two coincide. `[triggers].crons` is *generated* from these vars - `npm run dev`/`deploy` regenerate it automatically, `npm run sync-crons` on demand. Don't hand-edit `crons`.

Then redeploy.

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

Confirm the cron trigger in the Cloudflare dashboard under Workers → umami-digest → Settings → Triggers - you should see exactly one. `npm run tail` streams logs from the live worker.

## Development

```bash
npm run typecheck
npm test
```

Both run in CI on every push and pull request against `main`.

## How it works

- `src/index.ts` - the Worker's `scheduled` entrypoint; wires the pieces below together
- `src/schedule.ts` - decides which digest periods (`daily`/`weekly`/`monthly`) are due on the date the Cron Trigger fired
- `src/umami.ts` - logs in against `/api/auth/login` for a bearer token, then fetches `/stats` and `/metrics` (`type=path`, `referrer`, `browser`, `device`, `country`, each limited to `REPORT_TOP_N`) for the configured window
- `src/email.ts` - the HTML email template (`render()`) and its formatting helpers
- `src/resend.ts` - sends the rendered email through the Resend API
- `src/types.ts` - the shared `Env`/`Stats`/`Collected` types
- `scripts/sync-crons.mjs` - regenerates `[triggers].crons` in `wrangler.toml` from `REPORT_TIME`/`REPORT_PERIODS`; runs automatically via the `predev`/`predeploy` npm hooks

Self-hosted Umami v3's `/stats` response is flat current-period numbers plus a `comparison` sibling object holding the prior period's numbers - deltas are computed from that, not a per-field `{ value, prev }` shape. Country codes are resolved to names via the runtime's built-in `Intl.DisplayNames` (Cloudflare Workers ships full ICU), not a hand-maintained table.
