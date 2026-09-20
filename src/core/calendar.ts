/**
 * Turns a wall-clock date into a day count since the sim's genesis, so the scheduled tick never needs
 * to persist "which day are we on" anywhere: it is always just today's UTC date minus the fixed
 * genesis date. Losing the whole `data/` directory would cost nothing but the incident history's
 * flavor text, the day count itself regenerates from the calendar alone.
 */

/** Both dates are read as UTC calendar days; time of day is ignored so this only ever advances once a day. */
export function daysSinceGenesis(genesisDateIso: string, now: Date): number {
  const parts = genesisDateIso.split('-').map(Number);
  const [year, month, day] = parts as [number, number, number];
  const genesisUtc = Date.UTC(year, month - 1, day);
  const nowUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.max(0, Math.round((nowUtc - genesisUtc) / 86_400_000));
}
