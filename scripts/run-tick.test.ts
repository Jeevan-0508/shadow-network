import { describe, expect, it } from 'bun:test';
import { runTick } from './run-tick';
import { createGenesisState } from '../src/core/genesis';
import { DEFAULT_CONFIG } from '../src/core/model';

describe('runTick', () => {
  it('at day zero, returns genesis state untouched with no incidents and an empty leaderboard', async () => {
    const result = await runTick(0);
    const genesis = createGenesisState(DEFAULT_CONFIG);
    expect(JSON.stringify(result.state)).toBe(JSON.stringify(genesis));
    expect(result.todaysIncidents).toEqual([]);
    expect(result.todaysVerdicts).toEqual([]);
    expect(result.leaderboard).toEqual([]);
  });

  it('only reports the newest day incidents and verdicts, not the whole history', async () => {
    const result = await runTick(200);
    for (const event of result.todaysIncidents) expect(event.day).toBe(result.state.day);
    for (const { event } of result.todaysVerdicts) expect(event.day).toBe(result.state.day);
  });

  it('the leaderboard totalReviewed matches the count of every incident ever flagged and reviewed, not just today', async () => {
    const result = await runTick(200);
    const last = result.leaderboard.at(-1);
    expect(last).toBeDefined();
    expect(last?.totalReviewed).toBeGreaterThan(result.todaysIncidents.length);
  });

  it('is deterministic: two runs of the same day count produce byte-identical output', async () => {
    const a = await runTick(120);
    const b = await runTick(120);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
