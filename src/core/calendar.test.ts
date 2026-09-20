import { describe, expect, it } from 'bun:test';
import { daysSinceGenesis } from './calendar';

describe('daysSinceGenesis', () => {
  it('is zero on genesis day itself, any time of day', () => {
    expect(daysSinceGenesis('2026-09-21', new Date('2026-09-21T00:00:00Z'))).toBe(0);
    expect(daysSinceGenesis('2026-09-21', new Date('2026-09-21T23:59:59Z'))).toBe(0);
  });

  it('counts exactly one full UTC calendar day after genesis', () => {
    expect(daysSinceGenesis('2026-09-21', new Date('2026-09-22T00:00:01Z'))).toBe(1);
    expect(daysSinceGenesis('2026-09-21', new Date('2026-09-22T23:00:00Z'))).toBe(1);
  });

  it('counts a full non-leap year as 365 days', () => {
    expect(daysSinceGenesis('2027-01-01', new Date('2028-01-01T12:00:00Z'))).toBe(365);
  });

  it('counts a span crossing a real leap day (2028-02-29) as 366 days', () => {
    expect(daysSinceGenesis('2027-06-01', new Date('2028-06-01T12:00:00Z'))).toBe(366);
  });

  it('never goes negative if now is before genesis (clock skew, or genesis moved later)', () => {
    expect(daysSinceGenesis('2026-09-21', new Date('2026-09-01T00:00:00Z'))).toBe(0);
  });

  it('ignores time of day, only the calendar date matters', () => {
    const a = daysSinceGenesis('2026-09-21', new Date('2026-10-05T01:00:00Z'));
    const b = daysSinceGenesis('2026-09-21', new Date('2026-10-05T23:00:00Z'));
    expect(a).toBe(b);
    expect(a).toBe(14);
  });
});
