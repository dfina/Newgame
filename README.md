# Career: Football

A mobile-first, decision-based football career simulator. Create a player with
any of the 211 FIFA nationalities, pick the position you play from a pitch —
striker, wing-back, holding midfielder, keeper — sign for a real club, and
steer a whole career season by season: transfers, promotion and relegation,
cups, continental competition, international tournaments, injuries, media
storms and career twists, until retirement, a legacy score and a trophy
cabinet.

Your overall rating is earned on the pitch. Appearances, goals, assists (or
clean sheets and saves in goal) and match ratings drive it, measured against
what your role and your division make a normal season — and weighted by where
you played it, so the same numbers in a great league move you further than in
a fourth division. A division also sets how far it can carry you: dominate a
small league and you reach the top of it, and the only way past that ceiling
is to go and play somewhere harder. Careers rise fastest to about 22, plateau
around 30 and fall away from 33.

Decision cards are rare: roughly one season in three turns on one. Each offers
exactly two options, shows the odds it is gambling with and the OVR each side
carries, and the same roll decides the outcome you read and the number you
get. Some of them are transfers — force the move or sign the new deal, take
the loan or fight for your place.

Clubs carry their quality between seasons rather than inheriting their
division's average, so a promoted side arrives as a promoted side, a fourth-tier
club cannot reach the top flight in three years, and the teams that win
continental trophies are the ones good enough to. The best-known clubs are
rated for what they are (`STATURE` in `src/engine/data.js`), so Real Madrid
win La Liga more often than Getafe do — and the clubs that come calling in a
transfer window match the player: the standard they have reached, the form
they are in, and, if they are young with headroom and a rising line, the
player a big club thinks they are about to become.

## Play it

Published to GitHub Pages on every push to the default branch:
**https://dfina.github.io/Newgame/**

On a phone, open that URL and add it to the home screen (Safari: Share → Add to
Home Screen; Chrome: menu → Add to Home screen) for a full-screen, app-like
launch. Careers save to that browser's localStorage, so each device keeps its
own save.

## Run it locally

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
- Coverage: 203 of the 211 associations have at least one playable league
  (a league needs 6+ confirmed clubs to be used by the game), across 239
  leagues and roughly 3,330 clubs. The 8 without one each have a documented
  reason — a suspended competition, no published current roster, or, in
  Liechtenstein's case, no domestic league at all by design.
- Some leagues are still short of their full complement: a league whose club
  list could not be completed from published sources carries only the clubs
  that were confirmed, and `verified: false`. Nothing is padded to reach a
  league's official size.
- Every league entry carries `sources` (URLs consulted during research) and a
  `verified` flag. Entries that could not be verified are flagged
  `verified: false`; associations that could not be researched at all have an
  empty `leagues` array with an explanatory note — nothing is invented.
- `public/data/index.json` is generated: `npm run build:index`.

Club crests and league trophy images load at runtime from TheSportsDB's free
API, are cached in localStorage, and fall back to a generated initials badge
in club colours (or an original stylised SVG trophy) when unavailable.
Competitions resolve by curated TheSportsDB id (`src/ui/tsdb-ids.js`) rather
than by name, because word matching cannot tell "Serie A" from "Serie D Girone
A"; clubs resolve inside their own division's squad list first, so a reserve
side or a same-named foreign club can never supply the crest.

## Checks

```sh
npm run check:data     # schema, sources, duplicates, coverage summary
npm run check:balance  # appearances stay realistic; OVR stays performance-led
npm run check:crests   # crest matching against canned TheSportsDB responses
npm run sim            # Monte-Carlo: 300 headless full careers, balance stats
npm run smoke          # Playwright: real-browser full career to retirement
```

`npm run smoke` expects a dev server on :5173 and a Chromium binary
(`CHROME_PATH` env var to override the default path).
