# HANDOFF

Last updated: 2026-09-21, by shadow-network-builder (sub-agent of akisa).

## Exact state

Repo scaffolded at workspace root `shadow-network/`, git initialized on branch `main`, no remote set
yet (repo does not exist on GitHub, see decision point below). Local commits only so far.

Core engine complete and tested, in `src/core/`:
- `rng.ts`: deterministic seeded PRNG (`createRng`, `dayRng`, plus `rngInt`/`rngRange`/`rngChance`/
  `rngPick`/`rngWeightedPick` helpers). No dependencies.
- `taxonomy.ts`: metadata (id, name, category, severity, prevalence) for the 12 real patterns from
  `freight-fraud-taxonomy`, plus which 4 are collusion-only (`RING_PATTERNS`).
- `model.ts`: domain types (`CarrierAgent`, `Lane`, `RelationshipEdge`, `FlaggedEvent`, `SimConfig`,
  `SimState`) and `DEFAULT_CONFIG`.
- `genesis.ts`: `createGenesisState(config)` builds day-zero carriers and lanes from a seed. Synthetic
  company names, SCAC-style codes, real EU/NA hub cities for lane geography.
- `tick.ts`: `tickDay(state, config)` is the pure, deterministic one-day step (drift, ring formation,
  fraud incidents with causal trace, benign anomalies, carrier exit on legitimacy collapse).
  `runSimulation(genesis, days)` loops it and accumulates the full incident log.

Tests: 31 passing (`bun test`), `bun run typecheck` clean. Test counts verified by actually running the
suite just before writing this, not estimated.

**Not started**: AI council (BYOK), leaderboard/scoring, GitHub Action, any UI, network graph, playable
mode. No screenshots yet since there is nothing visual to screenshot.

## Verified claims

- 31 tests pass, 0 fail, 0 typecheck errors (ran directly, output captured).
- Ring-pattern invariant (a pattern in `RING_PATTERNS` only ever fires with exactly 2 carrier ids, both
  holding a real relationship edge) is tested positively under a tuned high-collision config, not just
  asserted as an untested loop.

## Real decision point: GitHub remote

The brief says either create `github.com/Jeevan-0508/shadow-network` via the `gho_` token pattern used
for his other repos, or leave the remote unset and ask him to create it. Not yet done either way,
deferred until there is something worth pushing (core loop end to end, not just the tick engine). Ask
Jeevan which he prefers before the first push, or default to creating it via the token if no reply by
the time slice 4 (AI council + leaderboard wiring) is done.

## Next action

Slice 3 is effectively folded into what already exists (fraud injection with causal trace is done in
`tick.ts`). Next real work is **slice 4**: a minimal BYOK AI council hook. Concretely:
1. Add `src/core/council/` with a `Verdict` type (per incident: `caught` | `missed` | `false_positive`,
   plus the model's reasoning) and a pure `deriveOutcome(event, verdict)` function that compares the
   verdict against `event.groundTruthFraud` without ever letting the caller pass ground truth into the
   prompt itself.
2. One real BYOK call path (reuse `risk-swarm`'s pattern at `src/core/reasoner/llm.ts` for the client-
   side, user-supplied-key shape), reviewing one day's flagged events and returning a verdict per event.
   Start with a single model, not the full four-seat council; the multi-model disagreement layer is a
   later slice once the single-model path is proven end to end.
3. A `leaderboard.ts` that folds `deriveOutcome` results into a running AI-vs-fraud score, computed the
   same recompute-from-log way as everything else (no separate mutable counter to keep in sync).
4. Unit tests first, same standard as `tick.test.ts`: deterministic where possible, and where an LLM
   call is involved, tests should exercise `deriveOutcome`/`leaderboard.ts` against fixture verdicts
   rather than hitting a real API (no key is available in CI or in this sandbox).

Do not start the GitHub Action, the site or the network graph before slice 4's outcome-scoring is real
and tested, per the brief's "smallest full loop first" instruction.
