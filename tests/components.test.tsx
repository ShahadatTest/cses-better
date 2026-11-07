import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { VerdictBadge } from '../src/components/VerdictBadge';
import { DiffViewer } from '../src/components/DiffViewer';
import { TestBench } from '../src/components/TestBench';
import { TestCase, TestResult } from '../src/core/types';

describe('VerdictBadge Component', () => {
  it('renders AC verdict with emerald styling', () => {
    const html = renderToStaticMarkup(<VerdictBadge status="AC" />);
    expect(html).toContain('Accepted');
    expect(html).toContain('text-verdict-ac');
    expect(html).toContain('bg-verdict-ac-soft');
  });

  it('renders WA verdict with rose styling', () => {
    const html = renderToStaticMarkup(<VerdictBadge status="WA" />);
    expect(html).toContain('Wrong Answer');
    expect(html).toContain('text-verdict-wa');
    expect(html).toContain('bg-verdict-wa-soft');
  });

  it('renders TLE verdict with amber styling', () => {
    const html = renderToStaticMarkup(<VerdictBadge status="TLE" />);
    expect(html).toContain('Time Limit Exceeded');
    expect(html).toContain('text-verdict-tle');
    expect(html).toContain('bg-verdict-tle-soft');
  });

  it('renders CE verdict with purple styling', () => {
    const html = renderToStaticMarkup(<VerdictBadge status="CE" />);
    expect(html).toContain('Compilation Error');
    expect(html).toContain('text-verdict-ce');
    expect(html).toContain('bg-verdict-ce-soft');
  });

  it('renders RE verdict with red styling', () => {
    const html = renderToStaticMarkup(<VerdictBadge status="RE" />);
    expect(html).toContain('Runtime Error');
    expect(html).toContain('text-verdict-wa');
    expect(html).toContain('bg-verdict-wa-soft');
  });

  it('renders RUNNING verdict with spinning animation', () => {
    const html = renderToStaticMarkup(<VerdictBadge status="RUNNING" />);
    expect(html).toContain('Running');
    expect(html).toContain('animate-spin');
    expect(html).toContain('text-accent');
  });

  it('renders IDLE verdict with slate styling', () => {
    const html = renderToStaticMarkup(<VerdictBadge status="IDLE" />);
    expect(html).toContain('Idle');
    expect(html).toContain('bg-surface-2');
    expect(html).toContain('text-text-muted');
  });

  it('supports size prop (sm, md, lg)', () => {
    const htmlSm = renderToStaticMarkup(<VerdictBadge status="AC" size="sm" />);
    const htmlLg = renderToStaticMarkup(<VerdictBadge status="AC" size="lg" />);
    expect(htmlSm).toContain('text-xs');
    expect(htmlLg).toContain('text-sm md:text-base');
  });

  it('hides icon when showIcon is false', () => {
    const html = renderToStaticMarkup(<VerdictBadge status="AC" showIcon={false} />);
    expect(html).toContain('Accepted');
    expect(html).not.toContain('<svg');
  });
});

describe('DiffViewer Component', () => {
  it('renders expected and actual outputs side by side', () => {
    const html = renderToStaticMarkup(
      <DiffViewer expected="42\n" actual="43\n" />
    );
    expect(html).toContain('Expected Output');
    expect(html).toContain('Actual Output');
    expect(html).toContain('42');
    expect(html).toContain('43');
  });

  it('highlights mismatched lines', () => {
    const html = renderToStaticMarkup(
      <DiffViewer
        expected="line 1\nline 2"
        actual="line 1\nline 3"
        diff={{ lineIndex: 2, expectedLine: 'line 2', actualLine: 'line 3' }}
      />
    );
    expect(html).toContain('First mismatch at line');
    expect(html).toContain('2');
    expect(html).toContain('border-rose-500');
  });

  it('indicates when outputs match identically', () => {
    const html = renderToStaticMarkup(
      <DiffViewer expected="1 2 3" actual="1 2 3" />
    );
    expect(html).toContain('Outputs match perfectly');
  });
});

describe('TestBench Component', () => {
  const sampleTestCases: TestCase[] = [
    { id: 'tc-1', input: '5\n', expectedOutput: '25\n', isSample: true },
    { id: 'tc-2', input: '10\n', expectedOutput: '100\n', isSample: true },
    { id: 'tc-3', input: '2\n', expectedOutput: '4\n', isSample: false },
  ];

  const results: Record<string, TestResult> = {
    'tc-1': {
      testCaseId: 'tc-1',
      status: 'AC',
      executionTimeMs: 14,
      memoryBytes: 2097152, // 2MB
      actualOutput: '25\n',
      expectedOutput: '25\n',
    },
    'tc-2': {
      testCaseId: 'tc-2',
      status: 'WA',
      executionTimeMs: 18,
      memoryBytes: 2097152,
      actualOutput: '99\n',
      expectedOutput: '100\n',
      diff: { lineIndex: 1, expectedLine: '100', actualLine: '99' },
    },
  };

  it('renders tabs with Sample 1, Sample 2, Custom 1', () => {
    const html = renderToStaticMarkup(
      <TestBench
        testCases={sampleTestCases}
        results={results}
        activeTestCaseId="tc-1"
        onSelectTestCase={() => {}}
        onAddCustomTestCase={() => {}}
        onDeleteCustomTestCase={() => {}}
      />
    );

    expect(html).toContain('Sample 1');
    expect(html).toContain('Sample 2');
    expect(html).toContain('Custom 1');
    expect(html).toContain('Add Custom');
  });

  it('renders performance bar and output when result exists', () => {
    const html = renderToStaticMarkup(
      <TestBench
        testCases={sampleTestCases}
        results={results}
        activeTestCaseId="tc-1"
        onSelectTestCase={() => {}}
        onAddCustomTestCase={() => {}}
        onDeleteCustomTestCase={() => {}}
      />
    );

    expect(html).toContain('14 ms');
    expect(html).toContain('2.00 MB');
    expect(html).toContain('Exit Code:');
  });

  it('renders compilation error stderr box when CE occurs', () => {
    const ceResults: Record<string, TestResult> = {
      'tc-1': {
        testCaseId: 'tc-1',
        status: 'CE',
        executionTimeMs: 0,
        memoryBytes: 0,
        actualOutput: '',
        expectedOutput: '25\n',
        stderr: 'error: unknown type name ‘x’',
      },
    };

    const html = renderToStaticMarkup(
      <TestBench
        testCases={sampleTestCases}
        results={ceResults}
        activeTestCaseId="tc-1"
        onSelectTestCase={() => {}}
        onAddCustomTestCase={() => {}}
        onDeleteCustomTestCase={() => {}}
      />
    );

    expect(html).toContain('Compilation Diagnostic');
    expect(html).toContain('error: unknown type name ‘x’');
  });

  it('renders submission matrix when submissionResults are provided', () => {
    const submissionResults: TestResult[] = [
      {
        testCaseId: 'sub-1',
        status: 'AC',
        executionTimeMs: 12,
        memoryBytes: 1048576,
        actualOutput: '42',
        expectedOutput: '42',
      },
      {
        testCaseId: 'sub-2',
        status: 'AC',
        executionTimeMs: 15,
        memoryBytes: 1048576,
        actualOutput: '100',
        expectedOutput: '100',
      },
    ];

    const html = renderToStaticMarkup(
      <TestBench
        testCases={sampleTestCases}
        results={results}
        activeTestCaseId="tc-1"
        onSelectTestCase={() => {}}
        onAddCustomTestCase={() => {}}
        onDeleteCustomTestCase={() => {}}
        submissionResults={submissionResults}
      />
    );

    expect(html).toContain('Submission Test Matrix');
    expect(html).toContain('Test #1');
    expect(html).toContain('Test #2');
    expect(html).toContain('All Tests Passed! 🎉');
  });
});
