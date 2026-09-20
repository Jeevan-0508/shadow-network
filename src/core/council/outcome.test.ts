import { describe, expect, it } from 'bun:test';
import { deriveOutcome, isWin } from './outcome';
import type { FlaggedEvent } from '../model';
import type { Verdict } from './verdict';

function event(groundTruthFraud: boolean): FlaggedEvent {
  return { id: 'INC-1-1', day: 1, kind: groundTruthFraud ? 'fraud' : 'anomaly', severity: 'medium', carrierIds: ['CAR-0001'], laneId: 'LN-001', groundTruthFraud, causalTrace: ['x'] };
}

function verdict(decision: Verdict['decision']): Verdict {
  return { eventId: 'INC-1-1', decision, confidence: 0.7, reasoning: 'because' };
}

describe('deriveOutcome', () => {
  it('is a catch when real fraud is called fraud', () => {
    expect(deriveOutcome(event(true), verdict('fraud'))).toBe('catch');
  });

  it('is a miss when real fraud is called clear', () => {
    expect(deriveOutcome(event(true), verdict('clear'))).toBe('miss');
  });

  it('is a false positive when a benign anomaly is called fraud', () => {
    expect(deriveOutcome(event(false), verdict('fraud'))).toBe('false_positive');
  });

  it('is a correct clear when a benign anomaly is called clear', () => {
    expect(deriveOutcome(event(false), verdict('clear'))).toBe('correct_clear');
  });
});

describe('isWin', () => {
  it('counts catch and correct_clear as wins, miss and false_positive as losses', () => {
    expect(isWin('catch')).toBe(true);
    expect(isWin('correct_clear')).toBe(true);
    expect(isWin('miss')).toBe(false);
    expect(isWin('false_positive')).toBe(false);
  });
});
