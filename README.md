# SHADOW//NETWORK

A persistent, synthetic freight-carrier economy that advances one day at a time. Carrier agents drift
corrupt over time, some form collusion rings and commit incidents drawn from a real fraud taxonomy, and
a BYOK AI investigator council reviews the flagged activity and opens cases. A public leaderboard tracks
AI vs fraud win rate across the sim's whole history.

Status: core simulation engine only. No AI council, no site and no scheduled tick yet. See `HANDOFF.md`
for exact state and next action.

## What is simulated vs what is real

Everything an agent does here is synthetic: carrier names, SCAC-style codes, legitimacy scores and
relationship data are all generated from a seed, never scraped or inferred from a real company. The
fraud patterns an agent can commit are real, drawn from
[freight-fraud-taxonomy](https://github.com/Jeevan-0508/freight-fraud-taxonomy), so the *categories* of
fraud are grounded in professional experience even though the *carriers* and *incidents* are not.

## How the engine works

- `createGenesisState(config)` builds day zero: a roster of carriers and lanes from a seed. No
  relationships or incidents exist yet, since those emerge from ticking.
- `tickDay(state, config)` advances the world by exactly one day: pure and deterministic, seeded by
  `(config.seed, day)`. Given the same seed, a run replays identically forever, which is what lets a
  scheduled job "just recompute today" and what will let a visitor step into any past day later.
- `runSimulation(genesis, days)` calls `tickDay` in a loop and accumulates the full incident log, for
  tests and for the eventual daily-tick script.

Run the tests: `bun test`. Typecheck: `bun run typecheck`.

## Roadmap

1. Data model and deterministic tick engine, with unit tests. **Done.**
2. Fraud injection with full causal trace per incident. **Done**, folded into the tick engine.
3. BYOK AI council reviews a day's flagged incidents and returns verdicts. Leaderboard wired to real
   outcomes (catch, miss, false positive) from day one.
4. Scheduled GitHub Action runs the tick daily and commits the new snapshot.
5. Static site: leaderboard trend, case list, case detail with replay/lineage.
6. Force-directed network graph for collusion rings.
7. Playable "step into a past day as analyst" mode.
