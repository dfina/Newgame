# Lessons

- **Egress policy blocks all research hosts; WebSearch is the only channel** — curl/WebFetch get 403 on wikipedia/thesportsdb/fifa.com (proxy CONNECT denials, confirmed via proxy status). All research must go through WebSearch; TheSportsDB IDs only obtainable when its URLs surface in results, so runtime crest lookup must work by club-name search with local caching, IDs optional enrichment.
- **Search backend ignores site: operator** — don't build agent strategies around site-scoped queries; use targeted natural queries ("<season> <league> teams list") instead.
- **It is August 2026** — European current season is 2026-27 (starting), calendar-year leagues are mid-2026. Agents record whichever season they verified per league.

- **Empty-repo git log exits 128** — `git log` on a commitless branch is a normal failure, not a broken repo; check `ls` output before concluding anything.
- **Data schema before agents** — all research subagents get one canonical SCHEMA.md so 211 association files stay mergeable without rework.
