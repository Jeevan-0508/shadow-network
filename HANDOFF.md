# HANDOFF

Last updated: 2026-09-21, by shadow-network-builder (sub-agent of akisa).

## Exact state

Repo: `https://github.com/Jeevan-0508/shadow-network`, branch `main`. Working tree clean once this
commit lands.

Core engine, council, and scheduled tick: unchanged from the previous handoff (see git log), all
verified live in that session (both the "commit on real advance" and "skip on no advance" paths on
`.github/workflows/tick.yml`).

New this session, the static dashboard (triggered by a direct user request to see the sim visually and
get a data report, not by the original slice ordering, which had this after the network graph in the
brief; the ordering note about "do not gold-plate before the core loop works" no longer applies since
the core loop is already proven live):

- `scripts/build-site.ts`: `buildSiteData(snapshot, config)`, a pure function tested in
  `build-site.test.ts` (6 tests: stat computation, histogram bucketing, per-lane carrier counts, the
  null-win-rate-with-no-history case, the real-win-rate case, and outcome derivation on a synthetic
  incident/verdict pair). `main()` reads `data/latest.json` and writes `docs/data.js` as a plain
  `window.SHADOW_DATA = {...}` assignment, not a `.json` file, so `docs/index.html` can load it via
  `<script src="data.js">` and work identically double-clicked locally (file:// blocks `fetch()` of a
  sibling JSON file under CORS) or served by GitHub Pages.
- `docs/index.html`: dark/terminal-styled dashboard (Tailwind CDN + Chart.js CDN, matching the
  `WORD//WORD` naming convention's implied aesthetic from the rest of the portfolio). Stat cards,
  a plain-language data-report list, a legitimacy-score histogram, the leaderboard trend line chart
  (with an honest empty state, not an empty chart, when there is no reviewed history yet), today's
  incidents and verdicts tables (same honest empty state), and a lanes-by-risk table. No em-dashes even
  as UI placeholder characters for "n/a": used the literal string `n/a` instead, per the hard rule.
- `package.json`: added `"build-site": "bun run scripts/build-site.ts"`.
- `.github/workflows/tick.yml`: added a `bun run build-site` step right after `bun run tick`, and
  `docs/data.js` to the commit's `git add` alongside `data/latest.json`, so the dashboard is never more
  than a day stale.
- GitHub Pages: created via the API (`POST /repos/.../pages`, `{"source":{"branch":"main","path":"/docs"}}`),
  confirmed `404` beforehand (no prior Pages config) and `201` on creation, live URL
  `https://jeevan-0508.github.io/shadow-network/`.
- README: added the live dashboard link at top, a "How the dashboard works" section, and updated the
  roadmap's slice 5 to **Done** (case-detail/replay view and the network graph are explicitly still not
  done, do not imply otherwise).

Tests: 80 passing (`bun test`, up from 74), typecheck clean.

**Verified functionally, not by screenshot**: the `browser` tool's screenshot capture returned the
desktop wallpaper instead of the browser panel's actual content in this environment (tried twice, both
times identical unrelated wallpaper image, not a rendering failure of the page itself). Verified instead
via `browser content` (full rendered text matched the real day-0 data: 120/120 carriers, avg legitimacy
80.5, all empty states correctly showing "no incidents/verdicts/reviewed events yet") and `browser eval`
(confirmed `Chart` is defined, `window.SHADOW_DATA` loaded, the incidents table's `hidden` class is
applied, and exactly 24 lane rows rendered, matching `laneCount: 24`). Ran a local Bun static server on
`localhost:8934` serving `docs/` to do this, then killed that background task once done; it is not part
of the shipped repo.

**Not yet verified**: whether the actual GitHub Pages deployment (as opposed to the local file content)
serves correctly. Do this immediately after pushing: GitHub Pages builds typically take under a minute;
poll `GET /repos/Jeevan-0508/shadow-network/pages/builds/latest` once, then `curl` the live URL and grep
for a real data value (e.g. `"totalCarriers": 120`) in the response, not just a 200 status, since a
stale cached or default Pages placeholder page would also 200.

## Next action

1. Push this commit, then verify the live Pages URL serves real content (see above), not just local
   `docs/index.html`.
2. Take an actual screenshot once a working capture method is confirmed (try again in a future session;
   the tool may work in a different environment/session even though it did not here), and add it to the
   README per the existing convention ("add screenshots the moment there is a running site to
   screenshot").
3. Message the lead (thread `1789928915465-49`) with the live dashboard URL once step 1 confirms it
   actually works, not before.
4. After that: case-detail view with full replay/lineage (click an incident, see its `causalTrace`,
   the brief the council actually saw, and the verdict), then the force-directed network graph for
   collusion rings, per the original roadmap ordering, unless the user's next message points somewhere
   else first (this session already deviated from the brief's ordering once, on direct request, and
   that is the correct call to make again if asked).

## Standing constraints, unchanged

- `GENESIS_DATE = '2026-09-21'` in `scripts/run-tick.ts`: never change once live.
- `DEFAULT_CONFIG.seed = 'shadow-network-genesis'` in `src/core/model.ts`: never change once live.
- Zero em dashes anywhere, including generated UI strings (grep for the em dash character after every doc/UI edit).
- `github-actions[bot]` commit identity: never invent a different bot email.
- Always `rm -f tsconfig.tsbuildinfo` after `bun run typecheck`, before committing.
