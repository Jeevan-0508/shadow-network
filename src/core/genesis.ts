/**
 * Builds day-zero state: carriers, lanes, and nothing else yet, since relationships and incidents are
 * things that emerge from ticking, not facts of genesis. Every name, SCAC and id is generated from the
 * run's seed, so two runs with the same seed produce byte-identical rosters.
 */
import { createRng, rngInt, rngPick, rngRange } from './rng';
import type { CarrierAgent, Lane, SimConfig, SimState } from './model';

const NAME_PREFIXES = [
  'Northern', 'Atlantic', 'Iron', 'Silver', 'Meridian', 'Vanguard', 'Cascade', 'Harbor', 'Continental',
  'Summit', 'Union', 'Pioneer', 'Anchor', 'Crown', 'Falcon', 'Ridgeline', 'Coastal', 'Prairie', 'Ember',
  'Granite', 'Amber', 'Cobalt', 'Redwood', 'Copper', 'Sterling', 'Hazel', 'Windward', 'Highline',
];

const NAME_SUFFIXES = [
  'Freight', 'Logistics', 'Transport', 'Haulage', 'Carriers', 'Lines', 'Express', 'Shipping', 'Cargo', 'Trucking',
];

const LEGAL_SUFFIXES = ['GmbH', 'Ltd', 'Inc', 'SA', 'BV', 'AG', 'Spedition', 'Co'];

/**
 * Real logistics hub cities used only as plausible geography for a lane, never attached to a real
 * company or claim. EU and NA are kept separate so a lane's region tag matches its two endpoints.
 */
const EU_CITIES = ['Rotterdam', 'Antwerp', 'Duisburg', 'Hamburg', 'Gdansk', 'Lyon', 'Warsaw', 'Milan', 'Valencia', 'Bratislava', 'Vienna', 'Brno'];
const NA_CITIES = ['Chicago', 'Memphis', 'Dallas', 'Atlanta', 'Laredo', 'Columbus', 'Ontario', 'Toronto', 'Monterrey', 'Savannah', 'Louisville', 'Kansas City'];

function generateCarrierName(rng: () => number, usedNames: Set<string>): string {
  for (let attempt = 0; attempt < 50; attempt++) {
    const prefix = rngPick(rng, NAME_PREFIXES);
    const suffix = rngPick(rng, NAME_SUFFIXES);
    const legal = rngPick(rng, LEGAL_SUFFIXES);
    const name = `${prefix} ${suffix} ${legal}`;
    if (!usedNames.has(name)) {
      usedNames.add(name);
      return name;
    }
  }
  const fallback = `${rngPick(rng, NAME_PREFIXES)} ${rngPick(rng, NAME_SUFFIXES)} ${usedNames.size}`;
  usedNames.add(fallback);
  return fallback;
}

function generateScac(rng: () => number, usedScacs: Set<string>): string {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for (let attempt = 0; attempt < 50; attempt++) {
    let code = '';
    for (let i = 0; i < 4; i++) code += letters[rngInt(rng, 0, letters.length - 1)];
    if (!usedScacs.has(code)) {
      usedScacs.add(code);
      return code;
    }
  }
  throw new Error('generateScac: exhausted retries, SCAC space collided too often for this carrier count');
}

function generateLanes(rng: () => number, count: number): Lane[] {
  const lanes: Lane[] = [];
  const usedPairs = new Set<string>();
  for (let i = 0; i < count; i++) {
    const isEu = rngInt(rng, 0, 1) === 0;
    const cities = isEu ? EU_CITIES : NA_CITIES;
    let origin = rngPick(rng, cities);
    let destination = rngPick(rng, cities);
    let pairKey = `${origin}->${destination}`;
    let attempts = 0;
    while ((origin === destination || usedPairs.has(pairKey)) && attempts < 50) {
      origin = rngPick(rng, cities);
      destination = rngPick(rng, cities);
      pairKey = `${origin}->${destination}`;
      attempts++;
    }
    usedPairs.add(pairKey);
    lanes.push({
      id: `LN-${String(i + 1).padStart(3, '0')}`,
      origin,
      destination,
      region: isEu ? 'EU' : 'NA',
      riskBaseline: rngRange(rng, 0.2, 1),
    });
  }
  return lanes;
}

function generateCarriers(rng: () => number, config: SimConfig, lanes: Lane[]): CarrierAgent[] {
  const carriers: CarrierAgent[] = [];
  const usedNames = new Set<string>();
  const usedScacs = new Set<string>();
  for (let i = 0; i < config.carrierCount; i++) {
    const laneCount = rngInt(rng, 1, 3);
    const laneIds: string[] = [];
    for (let l = 0; l < laneCount; l++) {
      const lane = rngPick(rng, lanes);
      if (!laneIds.includes(lane.id)) laneIds.push(lane.id);
    }
    /**
     * Most carriers start clean and near-stable. A minority start already trending toward corrupt,
     * so the network has visible drift from day one instead of a long flat runway before anything
     * interesting happens.
     */
    const startsCorruptLeaning = rngInt(rng, 0, 9) === 0;
    const legitimacyScore = startsCorruptLeaning ? rngRange(rng, 40, 70) : rngRange(rng, 70, 98);
    const driftRate = startsCorruptLeaning ? rngRange(rng, -1.2, -0.1) : rngRange(rng, -0.15, 0.25);

    carriers.push({
      id: `CAR-${String(i + 1).padStart(4, '0')}`,
      name: generateCarrierName(rng, usedNames),
      scac: generateScac(rng, usedScacs),
      status: 'active',
      legitimacyScore,
      driftRate,
      laneIds,
      createdOnDay: 0,
    });
  }
  return carriers;
}

export function createGenesisState(config: SimConfig): SimState {
  const rng = createRng(`${config.seed}::genesis`);
  const lanes = generateLanes(rng, config.laneCount);
  const carriers = generateCarriers(rng, config, lanes);
  return { day: 0, config, carriers, lanes, relationships: [] };
}
