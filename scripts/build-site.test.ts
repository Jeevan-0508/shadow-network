import { describe, expect, test } from 'bun:test';
import { buildSiteData, type SimSnapshot } from './build-site';
import { DEFAULT_CONFIG } from '../src/core/model';

function baseSnapshot(overrides: Partial<SimSnapshot> = {}): SimSnapshot {
  return {
    day: 5,
    generatedAt: '2026-09-26T03:17:00.000Z',
    seed: 'test-seed',
    carriers: [
      { id: 'CAR-0001', name: 'A', scac: 'AAAA', status: 'active', legitimacyScore: 80, driftRate: 0.1, laneIds: ['LN-001'], createdOnDay: 0 },
      { id: 'CAR-0002', name: 'B', scac: 'BBBB', status: 'active', legitimacyScore: 20, driftRate: -0.5, laneIds: ['LN-001', 'LN-002'], createdOnDay: 0 },
      { id: 'CAR-0003', name: 'C', scac: 'CCCC', status: 'exited', legitimacyScore: 10, driftRate: -0.8, laneIds: [], createdOnDay: 0, exitedOnDay: 3 },
    ],
    lanes: [
      { id: 'LN-001', origin: 'Chicago', destination: 'Dallas', region: 'NA', riskBaseline: 0.4 },
      { id: 'LN-002', origin: 'Rotterdam', destination: 'Hamburg', region: 'EU', riskBaseline: 0.9 },
    ],
    relationships: [],
    todaysIncidents: [],
    todaysVerdicts: [],
    leaderboard: [],
    ...overrides,
  };
}

describe('buildSiteData', () => {
  test('computes carrier and lane stats without mutating the snapshot', () => {
    const snapshot = baseSnapshot();
    const site = buildSiteData(snapshot, DEFAULT_CONFIG);

    expect(site.stats.totalCarriers).toBe(3);
    expect(site.stats.activeCarriers).toBe(2);
    expect(site.stats.exitedCarriers).toBe(1);
    expect(site.stats.avgLegitimacy).toBeCloseTo((80 + 20 + 10) / 3, 1);
    expect(site.stats.corruptCount).toBe(2);
    expect(site.stats.totalLanes).toBe(2);
    expect(snapshot.carriers).toHaveLength(3);
  });

  test('buckets legitimacy scores into 10-wide histogram buckets', () => {
    const site = buildSiteData(baseSnapshot(), DEFAULT_CONFIG);
    const nonZero = site.legitimacyHistogram.filter((b) => b.count > 0);
    expect(nonZero).toEqual(
      expect.arrayContaining([
        { bucket: '80-89', count: 1 },
        { bucket: '20-29', count: 1 },
        { bucket: '10-19', count: 1 },
      ]),
    );
    expect(site.legitimacyHistogram.reduce((sum, b) => sum + b.count, 0)).toBe(3);
  });

  test('counts carriers per lane from laneIds, including the exited carrier for its former lane', () => {
    const site = buildSiteData(baseSnapshot(), DEFAULT_CONFIG);
    const ln001 = site.lanes.find((l) => l.id === 'LN-001');
    expect(ln001?.carrierCount).toBe(2);
    expect(site.lanes[0].id).toBe('LN-002');
  });

  test('reports null win rate and zero reviewed count with no leaderboard history yet', () => {
    const site = buildSiteData(baseSnapshot(), DEFAULT_CONFIG);
    expect(site.stats.totalReviewed).toBe(0);
    expect(site.stats.cumulativeWinRatePct).toBeNull();
    expect(site.reportText.some((line) => line.includes('No events have been reviewed yet'))).toBe(true);
  });

  test('surfaces the latest leaderboard point as the cumulative win rate', () => {
    const site = buildSiteData(
      baseSnapshot({
        leaderboard: [
          { day: 2, catches: 1, misses: 0, falsePositives: 0, correctClears: 0, totalReviewed: 1, cumulativeWins: 1, winRatePct: 100 },
          { day: 5, catches: 1, misses: 1, falsePositives: 0, correctClears: 0, totalReviewed: 2, cumulativeWins: 1, winRatePct: 50 },
        ],
      }),
      DEFAULT_CONFIG,
    );
    expect(site.stats.totalReviewed).toBe(2);
    expect(site.stats.cumulativeWinRatePct).toBe(50);
  });

  test('derives outcome per verdict and labels ground truth on incidents', () => {
    const incident = {
      id: 'EVT-1',
      day: 5,
      kind: 'fraud' as const,
      patternId: 'FFT-001',
      category: 'identity' as const,
      severity: 'high' as const,
      carrierIds: ['CAR-0002'],
      laneId: 'LN-001',
      groundTruthFraud: true,
      causalTrace: ['drifted below threshold'],
    };
    const site = buildSiteData(
      baseSnapshot({
        todaysIncidents: [incident],
        todaysVerdicts: [{ event: incident, verdict: { eventId: 'EVT-1', decision: 'clear', confidence: 0.6, reasoning: 'looked fine' } }],
      }),
      DEFAULT_CONFIG,
    );
    expect(site.incidents[0].groundTruthLabel).toBe('fraud');
    expect(site.verdicts[0].outcome).toBe('miss');
  });
});
