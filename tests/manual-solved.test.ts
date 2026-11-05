import { describe, expect, it, beforeEach } from 'vitest';
import { clearAllStorage, getSolvedProblems, getSubmissions, removeSolvedProblem, saveSolvedProblem } from '../src/core/storage';
describe('manual solved state', () => {
  beforeEach(() => clearAllStorage());
  it('does not fabricate submissions and preserves real history when unmarked', () => {
    saveSolvedProblem('1068'); expect(getSolvedProblems().has('1068')).toBe(true); expect(getSubmissions()).toHaveLength(0);
    removeSolvedProblem('1068'); expect(getSolvedProblems().has('1068')).toBe(false);
    saveSolvedProblem('1068', 'cpp', 'real code'); expect(getSubmissions()).toHaveLength(1);
    removeSolvedProblem('1068'); expect(getSolvedProblems().has('1068')).toBe(false); expect(getSubmissions()[0].code).toBe('real code');
    saveSolvedProblem('1068'); expect(getSolvedProblems().has('1068')).toBe(true); expect(getSubmissions()).toHaveLength(1);
  });
});
