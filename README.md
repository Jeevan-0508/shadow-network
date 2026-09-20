# SHADOW//NETWORK

[![Daily tick](https://github.com/Jeevan-0508/shadow-network/actions/workflows/tick.yml/badge.svg)](https://github.com/Jeevan-0508/shadow-network/actions/workflows/tick.yml)

**Live dashboard:** [jeevan-0508.github.io/shadow-network](https://jeevan-0508.github.io/shadow-network/)
**Repo:** [github.com/Jeevan-0508/shadow-network](https://github.com/Jeevan-0508/shadow-network)
**Live tick data:** [data/latest.json](https://github.com/Jeevan-0508/shadow-network/blob/main/data/latest.json)
commits automatically once a day, badge above tracks whether that run is currently green, and the
dashboard rebuilds from it every run.

A persistent, synthetic freight-carrier economy that advances one day at a time. Carrier agents drift
corrupt over time, some form collusion rings and commit incidents drawn from a real fraud taxonomy, and
a BYOK AI investigator council reviews the flagged activity and opens cases. A public leaderboard tracks
AI vs fraud win rate across the sim's whole history.

Status: core simulation engine, BYOK AI council, scheduled daily tick and a static dashboard are all
working end to end and verified live on GitHub. The sim just went live today (day 0), so the dashboard
is honestly quiet: no incidents, no collusion rings, no reviewed cases yet. That fills in over the
coming days as carriers drift. See `HANDOFF.md` for exact state and next action.

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

## How the council works

- `buildCaseBrief(event, state)` redacts a flagged event down to what a real investigator would see:
  legitimacy signal, severity, relationship-graph membership. It never carries the sim's own
  `groundTruthFraud`, `kind`, `patternId` or `causalTrace` into the brief, so the council is genuinely
  deciding, not reading the answer key.
- `ruleBasedVerdict(brief)` is the always-available, zero-cost reviewer: a small rule-based heuristic
  that needs no API key and produces a `Verdict` (`fraud` or `clear`, with confidence and reasoning).
- `createLlmReasoner(options)` is the optional BYOK layer: supply your own API key and endpoint, and a
  real model call can override the rule-based verdict. Any failure (no key, timeout, bad JSON, a
  fabricated reference to a carrier the brief never gave it) degrades safely back to the rule-based
  verdict, so a bad or missing key can only slow a review down, never break it or cost money by
  default.
- `reviewDay(events, state, options)` runs the whole thing for one day's events, defaulting to the
  zero-cost reviewer.
- `deriveOutcome(event, verdict)` is the only place ground truth and a verdict ever meet: it scores the
  verdict as a catch, a miss, a false positive, or a correct clear, strictly after the verdict exists.
- `buildLeaderboard(reviewed)` folds outcomes into a cumulative, day-by-day "AI vs fraud" win rate, the
  same pure-recompute architecture as `runSimulation`.

Run the tests: `bun test`. Typecheck: `bun run typecheck`.

## How the daily tick works

`scripts/run-tick.ts` is what `.github/workflows/tick.yml` runs once a day. It never persists mutable
state: `daysSinceGenesis` (in `src/core/calendar.ts`) turns today's UTC date into a day count against a
fixed genesis date, and the whole history is recomputed from `DEFAULT_CONFIG.seed` up to that day count
every single run. Losing `data/latest.json` costs nothing but one script run to regenerate it. The
committed snapshot is rounded to 2 decimal places purely for readable git diffs, the engine's internal
math stays full precision.

## How the dashboard works

`scripts/build-site.ts` turns `data/latest.json` into `docs/data.js`, a plain `window.SHADOW_DATA = {...}`
assignment rather than a `.json` file, so `docs/index.html` can pull it in with a `<script>` tag and
work identically double-clicked locally or served by GitHub Pages. It computes display-only summary
data on top of what the engine already produced: a legitimacy-score histogram, per-lane carrier counts,
and a short plain-language "data report" (carrier counts, drift, incidents, win rate, collusion links),
plus the leaderboard trend and today's incidents/verdicts tables straight from the snapshot. The daily
tick Action runs this after `bun run tick` and commits `docs/data.js` alongside `data/latest.json`, so
the dashboard is never more than a day stale. Run it locally: `bun run build-site`.

## Roadmap

1. Data model and deterministic tick engine, with unit tests. **Done.**
2. Fraud injection with full causal trace per incident. **Done**, folded into the tick engine.
3. BYOK AI council reviews a day's flagged incidents and returns verdicts. Leaderboard wired to real
   outcomes (catch, miss, false positive, correct clear). **Done**, single-model reviewer, not yet the
   full multi-model council.
4. Scheduled GitHub Action runs the tick daily and commits the new snapshot. **Done.**
5. Static dashboard: stat cards, plain-language data report, legitimacy histogram, leaderboard trend,
   today's incidents/verdicts tables, lanes by risk. **Done**, deployed to GitHub Pages. Not yet done:
   a case-detail view with full replay/lineage, and a force-directed network graph for collusion rings.
6. Force-directed network graph for collusion rings.
7. Playable "step into a past day as analyst" mode.
