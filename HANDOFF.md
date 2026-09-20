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

**Verified live, not just locally**: dispatched `.github/workflows/tick.yml` manually via the API
right after pushing it. Run `35530866320` went green, and `github-actions[bot]` actually pushed commit
`f417900` ("Daily tick: day 0") to `main`, confirmed by reading `GET /repos/.../commits` afterward, not
just trusting the workflow's own success status (a green run that silently skipped the commit step
would have looked identical from status alone).

**Caught and fixed a real bug from that same verification run**: the commit-skip check compared the
whole `data/latest.json` file, including `generatedAt`, which changes every run. That made the "skip if
nothing changed" branch dead code: it would commit a noisy timestamp-only diff on every manual
re-dispatch of the same sim day. Fixed by comparing the `day` field specifically, read before and after
the tick step.

**Re-verified live after the fix**: dispatched run `35531018075` on the fixed workflow. All steps
succeeded, including the commit step, and `GET /repos/.../commits` afterward confirmed no new commit
landed on top of the fix commit itself (`9ce8f27`), meaning the day-0-to-day-0 re-run correctly produced
no push. Both the "commit on a real advance" and "skip on no advance" paths are now proven live, not
just locally.

**Not started**: any UI, network graph, playable mode, multi-model council.

## Next action

1. Slice 5: the static site. Leaderboard trend chart reading `data/latest.json`'s
   `leaderboard` array, a case list from `todaysIncidents` (there will not be much real history until
   the Action has run for a number of days, which is fine and honest: an early README screenshot should
   say so rather than staging a fake multi-week history).
2. Slice 6 (network graph) and slice 7 (playable mode) come after the site's core views exist, per the
   brief's ordering. Do not gold-plate the leaderboard/case views before the network graph exists either,
   per "do not gold-plate early pieces before the core loop works end to end" (the core loop is now
   proven end to end, live on GitHub, both the commit and the skip path; the site is the next thing that
   has to actually be seen to work).

Add screenshots to the README the moment there is a running site to screenshot, not before.
