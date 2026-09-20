# HANDOFF

Last updated: 2026-09-21, by shadow-network-builder (sub-agent of akisa).

## Exact state

Repo pushed: `https://github.com/Jeevan-0508/shadow-network`, branch `main`, working tree clean.

Core engine (`src/core/`): unchanged from the previous handoff. `rng.ts`, `taxonomy.ts`, `model.ts`,
`genesis.ts`, `tick.ts`. See git log / previous commit message for detail.

Council (`src/core/council/`), new this session:
- `types.ts`: the reasoning seam (`Reasoner`, `ReasonRequest`, `ReasonResult`), ported from
  risk-swarm's `reasoner/` with a provenance fence (`assertNoFabricatedReferences`) adapted to scan
  free text for carrier/lane-shaped ids, not just whole-string array items.
- `case.ts`: `buildCaseBrief(event, state)` redacts a `FlaggedEvent` to what a real investigator would
  see (legitimacy score, severity, relationship-graph membership). Deliberately excludes
  `groundTruthFraud`, `kind`, `patternId`, `category`, `causalTrace`.
- `verdict.ts`: `ruleBasedVerdict(brief)`, the always-available zero-cost heuristic reviewer.
- `deterministic.ts` / `llm.ts`: the two `Reasoner` implementations, mirroring risk-swarm's
  `reasoner/deterministic.ts` and `reasoner/llm.ts` almost exactly (same failure-degrades-safely
  discipline, same BYOK key-via-getter, never logged).
- `outcome.ts`: `deriveOutcome(event, verdict)`, the only place ground truth and a verdict ever meet.
- `leaderboard.ts`: `buildLeaderboard(reviewed)`, cumulative day-by-day "AI vs fraud" win rate, pure
  recompute like `runSimulation`.
- `review.ts`: `reviewDay(events, state, options)` orchestrates brief-building and reasoning for one
  day's events, defaulting to the zero-cost reviewer so the whole loop needs no API key.

**The full core loop now works end to end, locally, with zero cost**: `createGenesisState` ->
`tickDay`/`runSimulation` -> `reviewDay` (deterministic reviewer) -> `buildLeaderboard` produces a real,
moving AI-vs-fraud win rate number. Proven by `review.test.ts`'s day-by-day integration test, not just
asserted.

Tests: 64 passing (`bun test`), `bun run typecheck` clean. Verified by actually running both just
before this handoff was written.

**Not started**: GitHub Action, any UI, network graph, playable mode, the multi-model council (only a
single-reviewer path exists so far, by design, per the brief's "smallest full loop first").

## A real bug caught and fixed this session

The first draft of `review.test.ts`'s "end to end" test reviewed day-1 events against the day-200
final state, a state/event day mismatch that would have silently fed the reviewer stale legitimacy
scores. Fixed by writing a `tickAndReviewDays` test helper that ticks one day and reviews that day's
events immediately, which is also the correct shape for the real GitHub Action in slice 4 below: tick
once, review immediately, do not accumulate days before reviewing.

Also caught: `referencedIds`'s regex originally anchored `^...$`, which only matches a string that IS
entirely an id, not an id embedded inside a reasoning sentence like "Tied to CAR-9999...". Fixed to
scan substrings with a global, word-boundary pattern. Both caught by actually running the tests, not
by inspection.

## Next action

Slice 4 (from the original build brief numbering) is the scheduled GitHub Action:
1. Add a `scripts/run-tick.ts` (already referenced by `package.json`'s `tick` script, not yet written)
   that: loads or defines the persisted day count so far (start with a `data/state.json` holding just
   `{ day, config }`, or simplest of all for the first version, redefine `days` as "how many days since
   repo creation" computed from a fixed `genesisDate` in config, since the whole engine recomputes from
   seed + day count anyway and needs no persisted mutable state at all), runs `runSimulation` up to
   today's day count, runs `reviewDay` per day (or just the newest day, cheaper) with the deterministic
   reviewer (no key needed for the Action to run for free), builds the leaderboard, and writes a JSON
   snapshot to `data/` (exact shape not yet decided, keep it small: today's state, today's new
   incidents, today's leaderboard point, not the full history duplicated every day).
2. Add `.github/workflows/tick.yml`: `schedule: cron` once daily, checkout, setup bun, `bun install`,
   `bun run tick`, commit the new `data/` file with `github-actions[bot]` as the author (use
   `41898282+github-actions[bot]@users.noreply.github.com`, never invent a `<name>@users.noreply` email,
   see `reference/github-profile-readme.md` in memory for why), push.
3. Verify it actually runs unattended (manual `workflow_dispatch` trigger first, per the brief's "verify
   it actually runs unattended before building more UI on top of it") before touching the site.

Do not start the static site, the network graph or the playable mode before the Action is proven to
run and commit on its own, per the brief's slice ordering.
