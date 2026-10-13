# Getting started

SHADOW//NETWORK is a deterministic synthetic freight-carrier economy. The simulation advances a day at a time, records incidents and reviews, and publishes a static dashboard from the latest snapshot. It is a research and portfolio instrument, not a live carrier-monitoring service.

## View the dashboard

Open the [live dashboard](https://jeevan-0508.github.io/shadow-network/). The page reads the checked-in `docs/data.js` bundle and presents the current simulation state, legitimacy distribution, reviewer history, incidents and lane risk.

## Run the tests and typecheck

Install Bun, then run from the repository root:

```bash
bun install
bun test
bun run typecheck
```

## Build the dashboard locally

The dashboard builder turns `data/latest.json` into the browser-safe `docs/data.js` assignment:

```bash
bun run build-site
```

Serve `docs/` with any static server, or open `docs/index.html` directly. The generated bundle is intentionally plain JavaScript so the static page also works when opened from `file://`.

## Advance the simulation

The scheduled workflow runs the tick and rebuilds the site. For a local run, use the repository's script after reviewing its configuration and deterministic seed:

```bash
bun run tick
```

Do not change the genesis date or default seed without treating that as a new simulation, because the public history depends on those invariants.

## Synthetic-data boundary

The carriers, incidents, collusion behaviour, reviewer council and scoreboard are simulated. BYOK model calls, when configured, review synthetic case material. Nothing in the dashboard should be read as a real carrier assessment, a live feed, or evidence of a real incident.
