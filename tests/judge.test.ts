import { describe, it, expect, beforeEach } from 'vitest';
import {
  normalizeOutput,
  computeDiff,
  evaluateTestCase,
  batchEvaluate,
  summarizeTestResults,
  isLargeInput,
  MAX_COMPILER_INPUT_BYTES,
} from '../src/core/judge';
import {
  saveDraft,
  getDraft,
  saveSubmission,
  getSubmissions,
  getSolvedProblems,
  exportUserData,
  importUserData,
  clearAllStorage,
} from '../src/core/storage';
import { getLanguageConfig, SUPPORTED_LANGUAGES } from '../src/core/templates';
import {
  TestCase,
  ExecutionResponse,
  SubmissionRecord,
  TestResult,
} from '../src/core/types';

describe('judge: normalizeOutput', () => {
  it('handles exact matches without trailing whitespace', () => {
    expect(normalizeOutput('42')).toBe('42');
    expect(normalizeOutput('hello\nworld')).toBe('hello\nworld');
  });

  it('standardizes CRLF and CR to LF', () => {
    expect(normalizeOutput('line1\r\nline2\r\n')).toBe('line1\nline2');
    expect(normalizeOutput('line1\rline2')).toBe('line1\nline2');
  });

  it('trims trailing whitespace on each line', () => {
    expect(normalizeOutput('1 2 3   \n4 5 6   ')).toBe('1 2 3\n4 5 6');
    expect(normalizeOutput('1 2 \t \n3 4 \t ')).toBe('1 2\n3 4');
  });

  it('ignores trailing empty lines', () => {
    expect(normalizeOutput('ans\n\n\n\n')).toBe('ans');
    expect(normalizeOutput('ans\r\n\r\n   \r\n')).toBe('ans');
  });

  it('preserves empty lines in the middle', () => {
    expect(normalizeOutput('line1\n\nline2\n\n')).toBe('line1\n\nline2');
  });

  it('preserves leading indentation', () => {
    expect(normalizeOutput('  leading\n    more leading   ')).toBe(
      '  leading\n    more leading'
    );
  });

  it('handles empty or whitespace-only strings gracefully', () => {
    expect(normalizeOutput('')).toBe('');
    expect(normalizeOutput('   \n  \r\n\t\n  ')).toBe('');
  });
});

describe('judge: computeDiff', () => {
  it('returns null for identical outputs', () => {
    expect(computeDiff('1 2 3', '1 2 3')).toBeNull();
  });

  it('returns null for outputs that normalize identically', () => {
    expect(computeDiff('1 2 3\r\n', '1 2 3   \n\n')).toBeNull();
  });

  it('detects difference on the first line', () => {
    const diff = computeDiff('YES', 'NO');
    expect(diff).toEqual({
      lineIndex: 1,
      expectedLine: 'YES',
      actualLine: 'NO',
    });
  });

  it('detects difference on a later line', () => {
    const diff = computeDiff('1\n2\n3\n4', '1\n2\n99\n4');
    expect(diff).toEqual({
      lineIndex: 3,
      expectedLine: '3',
      actualLine: '99',
    });
  });

  it('handles actual output being shorter (EOF)', () => {
    const diff = computeDiff('line1\nline2', 'line1');
    expect(diff).toEqual({
      lineIndex: 2,
      expectedLine: 'line2',
      actualLine: '<EOF>',
    });
  });

  it('handles actual output being longer', () => {
    const diff = computeDiff('line1', 'line1\nline2');
    expect(diff).toEqual({
      lineIndex: 2,
      expectedLine: '<EOF>',
      actualLine: 'line2',
    });
  });
});

describe('judge: evaluateTestCase', () => {
  it('returns AC on exact match', () => {
    const verdict = evaluateTestCase('10', '10', 0, '', 50, 1.0);
    expect(verdict).toBe('AC');
  });

  it('returns AC on outputs with trailing whitespace or CRLF difference', () => {
    const verdict = evaluateTestCase('10 \r\n', '10\n\n', 0, '', 50, 1.0);
    expect(verdict).toBe('AC');
  });

  it('returns WA on content mismatch', () => {
    const verdict = evaluateTestCase('YES', 'NO', 0, '', 50, 1.0);
    expect(verdict).toBe('WA');
  });

  it('returns TLE when wallTimeMs exceeds timeLimitSec', () => {
    const verdict = evaluateTestCase('10', '10', 0, '', 1050, 1.0);
    expect(verdict).toBe('TLE');
  });

  it('returns TLE when exitCode is 124 (timeout)', () => {
    const verdict = evaluateTestCase('10', '', 124, '', 200, 1.0);
    expect(verdict).toBe('TLE');
  });

  it('returns TLE when stderr mentions time limit exceeded', () => {
    const verdict = evaluateTestCase(
      '10',
      '',
      1,
      'Command timed out: Time Limit Exceeded',
      50,
      1.0
    );
    expect(verdict).toBe('TLE');
  });

  it('returns MLE when stderr mentions out of memory', () => {
    const verdict = evaluateTestCase(
      '10',
      '',
      1,
      'java.lang.OutOfMemoryError: Java heap space',
      50,
      1.0
    );
    expect(verdict).toBe('MLE');
  });

  it('returns CE when stderr contains syntax or compilation errors', () => {
    const verdict = evaluateTestCase(
      '10',
      '',
      1,
      'main.cpp:5:1: compilation error: expected semicolon',
      50,
      1.0
    );
    expect(verdict).toBe('CE');
  });

  it('returns RE on other non-zero exit codes', () => {
    const verdict = evaluateTestCase(
      '10',
      '',
      1,
      'Segmentation fault (core dumped)',
      50,
      1.0
    );
    expect(verdict).toBe('RE');
  });

  it('returns SKIPPED when stderr contains "Input exceeds maximum size"', () => {
    const verdict = evaluateTestCase(
      '10',
      '',
      0,
      'Input exceeds maximum size of 100KB supported by the compiler sandbox. Test case bypassed and marked as done.',
      0,
      1.0
    );
    expect(verdict).toBe('SKIPPED');
  });

  it('returns SKIPPED case-insensitively when stderr mentions input exceeds maximum size', () => {
    const verdict = evaluateTestCase(
      'ans',
      '',
      0,
      'error: input exceeds maximum size limit',
      0,
      2.0
    );
    expect(verdict).toBe('SKIPPED');
  });
});

describe('judge: batchEvaluate and summarizeTestResults', () => {
  const testCases: TestCase[] = [
    { id: '1', input: '1', expectedOutput: '2' },
    { id: '2', input: '2', expectedOutput: '4' },
    { id: '3', input: '3', expectedOutput: '6' },
  ];

  it('evaluates all test cases correctly', () => {
    const results: ExecutionResponse[] = [
      {
        output: '2\n',
        stderr: '',
        exitCode: 0,
        wallTimeMs: 40,
        memoryBytes: 1024,
        status: 'success',
      },
      {
        output: '5\n',
        stderr: '',
        exitCode: 0,
        wallTimeMs: 60,
        memoryBytes: 2048,
        status: 'success',
      },
      {
        output: '',
        stderr: 'runtime error',
        exitCode: 1,
        wallTimeMs: 30,
        memoryBytes: 1024,
        status: 'error',
      },
    ];

    const batch = batchEvaluate(testCases, results, 1.0);
    expect(batch).toHaveLength(3);
    expect(batch[0].status).toBe('AC');
    expect(batch[1].status).toBe('WA');
    expect(batch[1].diff).toBeDefined();
    expect(batch[2].status).toBe('RE');

    const summary = summarizeTestResults(batch);
    expect(summary.passedCount).toBe(1);
    expect(summary.totalCount).toBe(3);
    expect(summary.maxTimeMs).toBe(60);
    expect(summary.status).toBe('WA');
  });

  it('counts SKIPPED as passed alongside AC, and if all tests are AC or SKIPPED, the overall verdict is AC', () => {
    const testResults: TestResult[] = [
      {
        testCaseId: '1',
        status: 'AC',
        executionTimeMs: 40,
        memoryBytes: 1024,
        actualOutput: '2',
        expectedOutput: '2',
      },
      {
        testCaseId: '2',
        status: 'SKIPPED',
        executionTimeMs: 0,
        memoryBytes: 0,
        actualOutput: '',
        expectedOutput: '4',
        stderr: 'Input exceeds maximum size',
      },
      {
        testCaseId: '3',
        status: 'AC',
        executionTimeMs: 50,
        memoryBytes: 2048,
        actualOutput: '6',
        expectedOutput: '6',
      },
    ];

    const summary = summarizeTestResults(testResults);
    expect(summary.passedCount).toBe(3);
    expect(summary.totalCount).toBe(3);
    expect(summary.status).toBe('AC');
  });

  it('sets overall verdict to AC when all tests are SKIPPED', () => {
    const testResults: TestResult[] = [
      {
        testCaseId: '1',
        status: 'SKIPPED',
        executionTimeMs: 0,
        memoryBytes: 0,
        actualOutput: '',
        expectedOutput: '2',
      },
      {
        testCaseId: '2',
        status: 'SKIPPED',
        executionTimeMs: 0,
        memoryBytes: 0,
        actualOutput: '',
        expectedOutput: '4',
      },
    ];

    const summary = summarizeTestResults(testResults);
    expect(summary.passedCount).toBe(2);
    expect(summary.totalCount).toBe(2);
    expect(summary.status).toBe('AC');
  });

  it('returns overall verdict of WA, TLE, etc., even if some tests are SKIPPED', () => {
    const testResultsWithWA: TestResult[] = [
      {
        testCaseId: '1',
        status: 'AC',
        executionTimeMs: 40,
        memoryBytes: 1024,
        actualOutput: '2',
        expectedOutput: '2',
      },
      {
        testCaseId: '2',
        status: 'SKIPPED',
        executionTimeMs: 0,
        memoryBytes: 0,
        actualOutput: '',
        expectedOutput: '4',
      },
      {
        testCaseId: '3',
        status: 'WA',
        executionTimeMs: 50,
        memoryBytes: 2048,
        actualOutput: '99',
        expectedOutput: '6',
      },
    ];

    const summaryWA = summarizeTestResults(testResultsWithWA);
    expect(summaryWA.passedCount).toBe(2);
    expect(summaryWA.totalCount).toBe(3);
    expect(summaryWA.status).toBe('WA');

    const testResultsWithTLE: TestResult[] = [
      {
        testCaseId: '1',
        status: 'SKIPPED',
        executionTimeMs: 0,
        memoryBytes: 0,
        actualOutput: '',
        expectedOutput: '2',
      },
      {
        testCaseId: '2',
        status: 'TLE',
        executionTimeMs: 2050,
        memoryBytes: 2048,
        actualOutput: '',
        expectedOutput: '4',
      },
    ];

    const summaryTLE = summarizeTestResults(testResultsWithTLE);
    expect(summaryTLE.passedCount).toBe(1);
    expect(summaryTLE.totalCount).toBe(2);
    expect(summaryTLE.status).toBe('TLE');

    const testResultsWithRE: TestResult[] = [
      {
        testCaseId: '1',
        status: 'SKIPPED',
        executionTimeMs: 0,
        memoryBytes: 0,
        actualOutput: '',
        expectedOutput: '2',
      },
      {
        testCaseId: '2',
        status: 'RE',
        executionTimeMs: 30,
        memoryBytes: 1024,
        actualOutput: '',
        expectedOutput: '4',
      },
    ];

    const summaryRE = summarizeTestResults(testResultsWithRE);
    expect(summaryRE.passedCount).toBe(1);
    expect(summaryRE.totalCount).toBe(2);
    expect(summaryRE.status).toBe('RE');
  });
});

describe('judge: isLargeInput and MAX_COMPILER_INPUT_BYTES', () => {
  it('defines MAX_COMPILER_INPUT_BYTES as 98KB (98 * 1024 bytes)', () => {
    expect(MAX_COMPILER_INPUT_BYTES).toBe(98 * 1024);
    expect(MAX_COMPILER_INPUT_BYTES).toBe(100352);
  });

  it('accurately returns false for inputs <= MAX_COMPILER_INPUT_BYTES (98KB)', () => {
    expect(isLargeInput(undefined)).toBe(false);
    expect(isLargeInput('')).toBe(false);
    expect(isLargeInput('hello world')).toBe(false);
    expect(isLargeInput('a'.repeat(MAX_COMPILER_INPUT_BYTES - 1))).toBe(false);
    expect(isLargeInput('a'.repeat(MAX_COMPILER_INPUT_BYTES))).toBe(false);
  });

  it('accurately returns true for inputs > MAX_COMPILER_INPUT_BYTES (98KB)', () => {
    expect(isLargeInput('a'.repeat(MAX_COMPILER_INPUT_BYTES + 1))).toBe(true);
    expect(isLargeInput('a'.repeat(MAX_COMPILER_INPUT_BYTES + 1024))).toBe(true);
    expect(isLargeInput('a'.repeat(100 * 1024))).toBe(true);
  });
});

describe('storage: drafts, submissions, and export/import', () => {
  beforeEach(() => {
    clearAllStorage();
  });

  it('saves and retrieves drafts', () => {
    expect(getDraft('1068', 'cpp')).toBeNull();

    saveDraft('1068', 'cpp', '#include <iostream>');
    expect(getDraft('1068', 'cpp')).toBe('#include <iostream>');

    // Deleting draft on empty code
    saveDraft('1068', 'cpp', '');
    expect(getDraft('1068', 'cpp')).toBeNull();
  });

  it('saves submissions and computes solved problems', () => {
    const sub1: SubmissionRecord = {
      id: 'sub-1',
      problemId: '1068',
      language: 'cpp',
      code: 'int main() {}',
      charCount: 14,
      timestamp: 1000,
      status: 'WA',
      passedCount: 2,
      totalCount: 5,
      maxTimeMs: 80,
      maxMemoryBytes: 4096,
    };

    saveSubmission(sub1);
    expect(getSubmissions()).toHaveLength(1);
    expect(getSolvedProblems().has('1068')).toBe(false);

    const sub2: SubmissionRecord = {
      id: 'sub-2',
      problemId: '1068',
      language: 'cpp',
      code: 'int main() { return 0; }',
      charCount: 24,
      timestamp: 2000,
      status: 'AC',
      passedCount: 5,
      totalCount: 5,
      maxTimeMs: 75,
      maxMemoryBytes: 4096,
    };

    saveSubmission(sub2);
    const subs = getSubmissions('1068');
    expect(subs).toHaveLength(2);
    // Should be sorted newest first
    expect(subs[0].id).toBe('sub-2');
    expect(getSolvedProblems().has('1068')).toBe(true);
  });

  it('exports and imports user data', () => {
    saveDraft('1068', 'python', 'print("hello")');
    saveSubmission({
      id: 'sub-export-1',
      problemId: '1068',
      language: 'python',
      code: 'print("hello")',
      charCount: 14,
      timestamp: 5000,
      status: 'AC',
      passedCount: 1,
      totalCount: 1,
      maxTimeMs: 30,
      maxMemoryBytes: 2000,
    });

    const exported = exportUserData();
    const parsedExport = JSON.parse(exported);
    expect(parsedExport.drafts['1068_python']).toBe('print("hello")');
    expect(parsedExport.submissions[0].id).toBe('sub-export-1');

    clearAllStorage();
    expect(getSubmissions()).toHaveLength(0);
    expect(getDraft('1068', 'python')).toBeNull();

    const success = importUserData(exported);
    expect(success).toBe(true);
    expect(getDraft('1068', 'python')).toBe('print("hello")');
    expect(getSubmissions()).toHaveLength(1);
    expect(getSolvedProblems().has('1068')).toBe(true);
  });
});

describe('templates: language configs', () => {
  it('provides configs for all 8 supported languages', () => {
    expect(SUPPORTED_LANGUAGES).toHaveLength(8);

    const expectedIds = [
      'cpp',
      'python',
      'java',
      'rust',
      'go',
      'javascript',
      'typescript',
      'c',
    ];

    for (const id of expectedIds) {
      const cfg = getLanguageConfig(id as any);
      expect(cfg.id).toBe(id);
      expect(cfg.defaultTemplate.length).toBeGreaterThan(10);
      expect(cfg.pistonLanguage).toBeDefined();
      expect(cfg.pistonVersion).toBeDefined();
    }
  });
});
