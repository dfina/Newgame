# Lessons

- **Egress policy blocks all research hosts; WebSearch is the only channel** — curl/WebFetch get 403 on wikipedia/thesportsdb/fifa.com (proxy CONNECT denials, confirmed via proxy status). All research must go through WebSearch; TheSportsDB IDs only obtainable when its URLs surface in results, so runtime crest lookup must work by club-name search with local caching, IDs optional enrichment.
- **Search backend ignores site: operator** — don't build agent strategies around site-scoped queries; use targeted natural queries ("<season> <league> teams list") instead.
- **It is August 2026** — European current season is 2026-27 (starting), calendar-year leagues are mid-2026. Agents record whichever season they verified per league.
- **WebSearch is capped at 200 calls per session, shared across ALL subagents** — 13 parallel research agents exhausted it in minutes; only ~35 of 211 associations got real data before the wall. Next time: run research agents sequentially with explicit per-agent budgets, or ask the user to raise CLAUDE_CODE_MAX_WEB_SEARCHES_PER_SESSION first.
- **npm/PyPI registries bypass the egress proxy** (noProxy allowlist) — but the only football dataset found there (football.json 1.0.0) is a 2015 snapshot; rejected as stale rather than passing it off as current.
- **Monte-Carlo the engine, don't eyeball it** — 300 headless careers (scripts/sim-career.mjs) exposed a 25% career-ending-injury rate and an event-pool exhaustion crash that a single browser playthrough missed. Run it after every engine change.
- **Node resolves imports from the script's path, not cwd** — test scripts using project deps must live inside the repo, not the scratchpad.
- **Playwright chromium lives at /opt/pw-browsers/chromium-1194/chrome-linux/chrome** — the bare /opt/pw-browsers/chromium dir is empty; don't trust the folder name.
- **Missing TSDB IDs in data are recoverable at runtime** — the player's browser is unrestricted, and TheSportsDB's all_leagues.php allows one cached name→id map covering leagues, cups and continental competitions, so trophy artwork works even though research-time ID harvesting was blocked.
- **Repo push blocked: GitHub App integration has no write access to dfina/Newgame** — both the git relay and the contents API return 403 ("Resource not accessible by integration"); needs the user to grant write permission.

- **Empty-repo git log exits 128** — `git log` on a commitless branch is a normal failure, not a broken repo; check `ls` output before concluding anything.
- **Data schema before agents** — all research subagents get one canonical SCHEMA.md so 211 association files stay mergeable without rework.
