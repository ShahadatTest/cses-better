import { describe, expect, it } from 'vitest';
import { isKnownQuestionId, questionPath, resolveInitialQuestionId } from './question-routing';

const knownIds = new Set(['1068', '1142', 'A+B']);

describe('question routing', () => {
  it('builds canonical, encoded question paths', () => {
    expect(questionPath('1142')).toBe('/practice/1142');
    expect(questionPath('A+B')).toBe('/practice/A%2BB');
  });

  it('accepts only known question IDs', () => {
    expect(isKnownQuestionId('1142', knownIds)).toBe(true);
    expect(isKnownQuestionId('missing', knownIds)).toBe(false);
    expect(isKnownQuestionId('', knownIds)).toBe(false);
  });

  it('prefers a valid explicit route over legacy hash and saved selection', () => {
    expect(resolveInitialQuestionId({
      explicitId: '1142', legacyHash: '1068', savedId: 'A+B', knownIds, fallbackId: '1068',
    })).toEqual({ id: '1142', invalidExplicit: false });
  });

  it('falls back and marks an invalid explicit route', () => {
    expect(resolveInitialQuestionId({
      explicitId: 'missing', legacyHash: '1142', savedId: 'A+B', knownIds, fallbackId: '1068',
    })).toEqual({ id: '1068', invalidExplicit: true });
  });

  it('prefers a valid legacy hash, then restores the saved question on the workspace root', () => {
    expect(resolveInitialQuestionId({ legacyHash: '1142', savedId: 'A+B', knownIds, fallbackId: '1068' })).toEqual({ id: '1142', invalidExplicit: false });
    expect(resolveInitialQuestionId({ savedId: 'A+B', knownIds, fallbackId: '1068' })).toEqual({ id: 'A+B', invalidExplicit: false });
  });
});
