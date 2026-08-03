# League data schema

One JSON file per FIFA association at `public/data/leagues/<FIFA-3-letter-code>.json`.

```json
{
  "association": "ENG",
  "country": "England",
  "confederation": "UEFA",
  "season": "2025-26",
  "leagues": [
    {
      "tier": 1,
      "name": "Premier League",
      "tsdbLeagueId": 4328,
      "verified": true,
      "sources": ["https://example.com/source-used"],
      "clubs": [
        {
          "name": "Arsenal",
          "tsdbTeamId": 133604,
          "badge": "https://r2.thesportsdb.com/images/media/team/badge/....png",
          "colors": ["#EF0107", "#FFFFFF"]
        }
      ]
    }
  ]
}
```

Rules:
- `season`: the season researched (e.g. "2025-26" or "2026" for calendar-year leagues). Use the current season in progress or most recently completed.
- `tier`: integer, 1 = top flight. England/Spain/Italy/Germany/France cover tiers 1–4; all other associations tiers 1–2 only, and ONLY where such a tier genuinely exists as an organised league.
- `verified`: true only when the club list was confirmed against at least one real source fetched during research. If a composition could not be confirmed, either omit the league or include it with `verified: false` and whatever partial `sources` exist. NEVER invent clubs or leagues.
- `sources`: URLs actually consulted. Required, non-empty, for every league.
- `tsdbLeagueId` / `tsdbTeamId`: TheSportsDB numeric IDs (integers) when found, else null.
- `badge`: TheSportsDB badge URL when found, else null.
- `colors`: up to 2 hex colours for the club (from TheSportsDB or common knowledge of kit colours), else omit — used only for generated fallback badges.
- Associations with no organised national league: file still exists with `"leagues": []` and a `"note"` field explaining.
- Regionalised tiers (e.g. a second tier split into parallel groups): include all groups' clubs in one league entry, and add `"groups": true`.
