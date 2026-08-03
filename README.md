# Career: Football

A mobile-first, decision-based football career simulator. Create a player with
any of the 211 FIFA nationalities, sign for a real club, and steer a whole
career season by season — transfers, promotion and relegation, cups,
continental competition, international tournaments, injuries, media storms and
career twists — until retirement, a legacy score, and a trophy cabinet.

## Run it

```sh
npm install
npm run dev
```

Open the printed URL (default `http://localhost:5173`) — on a phone on the
same network, use the Network URL that Vite prints. Careers save automatically
to the browser's localStorage.

## Data

- `public/data/associations.json` — all 211 FIFA member associations.
- `public/data/leagues/<CODE>.json` — one file per association with its league
  pyramid (tiers 1–4 for England, Spain, Italy, Germany, France; tiers 1–2
  elsewhere where they exist). See `public/data/SCHEMA.md`.
- Every league entry carries `sources` (URLs consulted during research) and a
  `verified` flag. Entries that could not be verified are flagged
  `verified: false`; associations that could not be researched at all have an
  empty `leagues` array with an explanatory note — nothing is invented.
- `public/data/index.json` is generated: `npm run build:index`.

Club crests and league trophy images load at runtime from TheSportsDB's free
API, are cached in localStorage, and fall back to a generated initials badge
in club colours (or an original stylised SVG trophy) when unavailable.

## Checks

```sh
npm run check:data   # schema, sources, duplicates, coverage summary
npm run sim          # Monte-Carlo: 300 headless full careers, balance stats
npm run smoke        # Playwright: real-browser full career to retirement
```

`npm run smoke` expects a dev server on :5173 and a Chromium binary
(`CHROME_PATH` env var to override the default path).
