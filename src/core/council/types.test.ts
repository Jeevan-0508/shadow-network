import { describe, expect, it } from 'bun:test';
import { assertNoFabricatedReferences, FabricatedReferenceError, referencedIds } from './types';

describe('referencedIds', () => {
  it('finds carrier- and lane-shaped ids anywhere in a nested value', () => {
    expect(referencedIds({ a: ['CAR-0001'], b: { c: 'LN-003 looks tied to CAR-0002' } })).toEqual(['CAR-0001', 'CAR-0002', 'LN-003']);
  });

  it('ignores plain words and short codes that do not match the id shape', () => {
    expect(referencedIds({ text: 'This is fraud, not a fine, and not an ID.' })).toEqual([]);
  });
});

describe('assertNoFabricatedReferences', () => {
  it('rejects a value that references an id it was never given', () => {
    expect(() => assertNoFabricatedReferences({ reasoning: 'Linked to CAR-9999' }, ['CAR-0001'])).toThrow(FabricatedReferenceError);
  });

  it('accepts a value that only references ids it was given', () => {
    expect(() => assertNoFabricatedReferences({ reasoning: 'Linked to CAR-0001' }, ['CAR-0001'])).not.toThrow();
  });
});
