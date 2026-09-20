# HANDOFF

Last updated: 2026-09-21, by shadow-network-builder (sub-agent of akisa).

## Exact state

Repo: `https://github.com/Jeevan-0508/shadow-network`, branch `main`. Working tree clean once this
commit lands. Repo's default workflow permissions set to "write" via the API (was "read", would have
silently made the Action's push fail otherwise, verified before and after with a GET).

Core engine and council: unchanged from the previous two handoffs, see git log.

New this session, the scheduled tick (slice 4 of the original numbering):
- `src/core/calendar.ts`: `daysSinceGenesis(genesisDateIso, now)`, pure UTC-calendar-day math, no
  persisted counter anywhere.
- `scripts/run-tick.ts`: `runTick(days)` (testable, pure aside from awaiting `reviewDay`) recomputes
  the whole history from `DEFAULT_CONFIG.seed` every run and reviews each day's incidents as they are
  produced. `main()` (guarded by `import.meta.main`, so importing the module for tests never triggers
  it) calls it with `daysSinceGenesis(GENESIS_DATE, new Date())` and writes `data/latest.json`, values
  rounded to 2 decimals for readable diffs.
- `GENESIS_DATE = '2026-09-21'`, today. The sim's day 0 is today; the Action will start producing real
  incidents once enough days pass for carriers to drift below the corruption threshold (`DEFAULT_CONFIG`
  puts that a handful of days out for the carriers that start corrupt-leaning).
- `.github/workflows/tick.yml`: daily cron (`17 3 * * *`, an arbitrary off-the-hour time) plus
  `workflow_dispatch` for manual runs. Runs `bun test` before `bun run tick`, so a broken engine fails
  the workflow instead of committing bad data. Commits as `github-actions[bot]` with the real bot id
  email, never an invented `<name>@users.noreply.github.com` (a past session found that pattern can
  collide with a real unrelated GitHub account, see `reference/github-profile-readme.md` in memory).

Tests: 74 passing (`bun test`), typecheck clean. Verified by running both, and by actually running
`bun run tick` locally and inspecting `data/latest.json`'s shape and precision before committing it.

**Not yet verified**: that the Action runs unattended on GitHub's own infrastructure, only that the
same script works locally. Next action below is to prove that before touching the UI, per the brief's
explicit instruction not to build more on top of the Action until it is seen to actually run.

**Not started**: any UI, network graph, playable mode, multi-model council.

## Next action

1. After this commit is pushed, trigger `.github/workflows/tick.yml` once via `workflow_dispatch`
   (`POST /repos/Jeevan-0508/shadow-network/actions/workflows/tick.yml/dispatches` with `{"ref":"main"}`,
   using the same `gho_` token pattern, scope `workflow` covers this) and confirm the run goes green and
   actually commits `data/latest.json` (check `git log` on `main` afterward for a `github-actions[bot]`
   commit, not just that the workflow's own status shows success, since a green run that silently
   skipped the commit step would look identical from the workflow status alone).
2. Once that is proven, slice 5: the static site. Leaderboard trend chart reading `data/latest.json`'s
   `leaderboard` array, a case list from `todaysIncidents` (there will not be much real history until
   the Action has run for a number of days, which is fine and honest: an early README screenshot should
   say so rather than staging a fake multi-week history).
3. Slice 6 (network graph) and slice 7 (playable mode) come after the site's core views exist, per the
   brief's ordering. Do not gold-plate the leaderboard/case views before the network graph exists either,
   per "do not gold-plate early pieces before the core loop works end to end" (the core loop is now
   proven end to end computationally; the site is the next thing that has to actually be seen to work).

Add screenshots to the README the moment there is a running site to screenshot, not before.
