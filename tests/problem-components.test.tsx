import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { KaTeXRenderer } from '../src/components/KaTeXRenderer';
import { LeaderboardTab } from '../src/components/LeaderboardTab';
import { SubmissionsTab } from '../src/components/SubmissionsTab';
import { NotesTab } from '../src/components/NotesTab';
import { ProblemPane } from '../src/components/ProblemPane';
import { Problem, SubmissionRecord, ProblemStats } from '../src/core/types';

describe('KaTeXRenderer Component', () => {
  it('renders inline math in HTML spans', () => {
    const html = renderToStaticMarkup(
      <KaTeXRenderer content={'Consider integer <span class="math math-inline">n</span>.'} />
    );
    expect(html).toContain('katex');
    expect(html).toContain('Consider integer');
  });

  it('renders display math in HTML spans', () => {
    const html = renderToStaticMarkup(
      <KaTeXRenderer content={'<span class="math math-display">3 \\rightarrow 10</span>'} />
    );
    expect(html).toContain('katex-display');
  });

  it('renders inline formula directly with inline prop', () => {
    const html = renderToStaticMarkup(
      <KaTeXRenderer content="1 \le n \le 10^6" inline />
    );
    expect(html).toContain('katex');
    expect(html).toContain('inline-flex');
  });

  it('handles empty content gracefully', () => {
    const html = renderToStaticMarkup(<KaTeXRenderer content="" />);
    expect(html).toBe('');
  });
});

describe('LeaderboardTab Component', () => {
  const mockStats: ProblemStats = {
    solvedBy: 182951,
    attemptedBy: 191022,
    successRate: '95.77%',
    fastest: [
      { rank: 1, user: 'mitcute', language: 'Pascal', score: '0.00 s' },
      { rank: 2, user: 'dtdungvnt', language: 'Pascal', score: '0.00 s' },
      { rank: 3, user: 'rickroll121', language: 'Pascal', score: '0.00 s' },
      { rank: 4, user: 'thaitp2009', language: 'Pascal', score: '0.00 s' },
      { rank: 5, user: 'phanlevu', language: 'Pascal', score: '0.00 s' },
    ],
    shortest: [
      { rank: 1, user: 'deodeo', language: 'Ruby', score: '16 ch.' },
      { rank: 2, user: 'cjtsai', language: 'Ruby', score: '16 ch.' },
      { rank: 3, user: 'Benutzer125', language: 'Ruby', score: '16 ch.' },
      { rank: 4, user: 'holaceitunA', language: 'Ruby', score: '16 ch.' },
      { rank: 5, user: 'michaelhan6', language: 'Ruby', score: '16 ch.' },
    ],
  };

  it('renders task summary cards with formatted numbers', () => {
    const html = renderToStaticMarkup(<LeaderboardTab stats={mockStats} />);
    expect(html).toContain('182,951');
    expect(html).toContain('191,022');
    expect(html).toContain('95.77%');
  });

  it('renders fastest code top 5 table', () => {
    const html = renderToStaticMarkup(<LeaderboardTab stats={mockStats} />);
    expect(html).toContain('Fastest Code');
    expect(html).toContain('mitcute');
    expect(html).toContain('Pascal');
    expect(html).toContain('0.00 s');
  });

  it('renders shortest code top 5 table', () => {
    const html = renderToStaticMarkup(<LeaderboardTab stats={mockStats} />);
    expect(html).toContain('Shortest Code');
    expect(html).toContain('deodeo');
    expect(html).toContain('Ruby');
    expect(html).toContain('16 ch.');
  });

  it('renders personal performance comparison card when user metrics are provided', () => {
    const html = renderToStaticMarkup(
      <LeaderboardTab
        stats={mockStats}
        userExecutionTimeMs={15}
        userCharCount={250}
        isSolved={true}
      />
    );
    expect(html).toContain('Personal Performance vs Hall of Fame');
    expect(html).toContain('15 ms');
    expect(html).toContain('250 chars');
    expect(html).toContain('Solved');
    expect(html).toContain('HOF #1: 0.00 s');
    expect(html).toContain('HOF #1: 16 ch.');
  });

  it('renders empty fallback when stats are not available', () => {
    const html = renderToStaticMarkup(<LeaderboardTab stats={undefined} />);
    expect(html).toContain('No Hall of Fame records');
  });
});

describe('SubmissionsTab Component', () => {
  const mockSubmissions: SubmissionRecord[] = [
    {
      id: 'sub-1',
      problemId: '1068',
      language: 'cpp',
      code: '#include <iostream>\nint main() {}',
      charCount: 35,
      timestamp: Date.now() - 60000,
      status: 'AC',
      passedCount: 15,
      totalCount: 15,
      maxTimeMs: 12,
      maxMemoryBytes: 2097152, // 2MB
    },
    {
      id: 'sub-2',
      problemId: '1068',
      language: 'python',
      code: 'print("hello")',
      charCount: 14,
      timestamp: Date.now() - 3600000,
      status: 'WA',
      passedCount: 8,
      totalCount: 15,
      maxTimeMs: 50,
      maxMemoryBytes: 4194304, // 4MB
    },
  ];

  it('renders submission cards with status pills and metrics', () => {
    const html = renderToStaticMarkup(
      <SubmissionsTab submissions={mockSubmissions} onSelectCode={() => {}} />
    );
    expect(html).toContain('Accepted');
    expect(html).toContain('Wrong Answer');
    expect(html).toContain('C++');
    expect(html).toContain('Python');
    expect(html).toContain('12 ms');
    expect(html).toContain('2.0 MB');
    expect(html).toContain('35 ch.');
    expect(html).toContain('Load Code');
  });

  it('renders empty state when no submissions exist', () => {
    const html = renderToStaticMarkup(
      <SubmissionsTab submissions={[]} onSelectCode={() => {}} />
    );
    expect(html).toContain('No submissions yet');
  });

  it('renders official CSES Queue tab and Submissions & Runs sub-filter toolbar', () => {
    const html = renderToStaticMarkup(
      <SubmissionsTab submissions={mockSubmissions} onSelectCode={() => {}} problemId="1068" />
    );
    expect(html).toContain('Official CSES Queue');
    expect(html).toContain('My Submissions &amp; Runs');
    expect(html).toContain('Official CSES.fi');
    expect(html).toContain('Local Workbench');
  });
});

describe('NotesTab Component', () => {
  it('renders note writing interface and template button', () => {
    const html = renderToStaticMarkup(<NotesTab problemId="1068" />);
    expect(html).toContain('Write');
    expect(html).toContain('Preview Math');
    expect(html).toContain('Template');
    expect(html).toContain('Markdown and LaTeX');
  });
});

describe('ProblemPane Component', () => {
  const mockProblem: Problem = {
    id: '1068',
    title: 'Weird Algorithm',
    category: 'Introductory Problems',
    timeLimit: '1.00 s',
    memoryLimit: '512 MB',
    statementHtml: `
      <p>Consider an algorithm with input <span class="math math-inline">n</span>.</p>
      <h1 id="input">Input</h1>
      <p>Single integer n.</p>
      <h1 id="output">Output</h1>
      <p>Sequence of numbers.</p>
      <h1 id="constraints">Constraints</h1>
      <ul><li><span class="math math-inline">1 \\le n \\le 10^6</span></li></ul>
      <h1 id="example">Example</h1>
      <p>Input:</p><pre>3</pre>
      <p>Output:</p><pre>3 10 5 16 8 4 2 1</pre>
    `,
    testCases: [
      {
        id: 'sample-1',
        input: '3\n',
        expectedOutput: '3 10 5 16 8 4 2 1\n',
        isSample: true,
      },
    ],
    constraints: ['1 \\le n \\le 10^6'],
    stats: {
      solvedBy: 182951,
      attemptedBy: 191022,
      successRate: '95.77%',
      fastest: [{ rank: 1, user: 'mitcute', language: 'Pascal', score: '0.00 s' }],
      shortest: [{ rank: 1, user: 'deodeo', language: 'Ruby', score: '16 ch.' }],
    },
  };

  it('renders header, badges, statement, constraints, and interactive samples', () => {
    const html = renderToStaticMarkup(
      <ProblemPane
        problem={mockProblem}
        submissions={[]}
        isSolved={true}
      />
    );

    // Breadcrumb and Title
    expect(html).toContain('CSES Problemset');
    expect(html).toContain('Introductory Problems');
    expect(html).toContain('Weird Algorithm');
    expect(html).toContain('#1068');

    // Badges
    expect(html).toContain('1.00 s');
    expect(html).toContain('512 MB');
    expect(html).toContain('Solved');

    // Navigation Tabs
    expect(html).toContain('Statement');
    expect(html).toContain('Leaderboard');
    expect(html).toContain('Submissions');
    expect(html).toContain('Notes');

    // Dedicated Constraints Card
    expect(html).toContain('Constraints');

    // Sample Test Cases with Copy buttons
    expect(html).toContain('Sample Test Cases');
    expect(html).toContain('Example 1');
    expect(html).toContain('Copy Input');
    expect(html).toContain('Copy Output');
    expect(html).toContain('3 10 5 16 8 4 2 1');
  });

  it('renders Leaderboard tab when activeTab is leaderboard', () => {
    const html = renderToStaticMarkup(
      <ProblemPane
        problem={mockProblem}
        activeTab="leaderboard"
        userExecutionTimeMs={10}
      />
    );
    expect(html).toContain('Solved By');
    expect(html).toContain('182,951');
    expect(html).toContain('mitcute');
  });

  it('renders Submissions tab when activeTab is submissions', () => {
    const mockSubs: SubmissionRecord[] = [
      {
        id: 'sub-1',
        problemId: '1068',
        language: 'cpp',
        code: 'int main(){}',
        charCount: 12,
        timestamp: Date.now(),
        status: 'AC',
        passedCount: 1,
        totalCount: 1,
        maxTimeMs: 10,
        maxMemoryBytes: 1024,
      },
    ];

    const html = renderToStaticMarkup(
      <ProblemPane
        problem={mockProblem}
        activeTab="submissions"
        submissions={mockSubs}
      />
    );
    expect(html).toContain('Accepted');
    expect(html).toContain('C++');
  });

  it('renders Notes tab when activeTab is notes', () => {
    const html = renderToStaticMarkup(
      <ProblemPane problem={mockProblem} activeTab="notes" />
    );
    expect(html).toContain('Write');
    expect(html).toContain('Preview Math');
  });

  it('renders Leaderboard with userId badge and inspect triggers', () => {
    const problemWithUserId = {
      ...mockProblem,
      stats: {
        ...mockProblem.stats!,
        fastest: [{ rank: 1, user: 'mitcute', userId: '134297', language: 'Pascal', score: '0.00 s' }],
      },
    };
    const html = renderToStaticMarkup(
      <ProblemPane problem={problemWithUserId} activeTab="leaderboard" onSelectUser={() => {}} />
    );
    expect(html).toContain('mitcute');
    expect(html).toContain('#134297');
    expect(html).toContain('Official CSES Live Standings');
  });
});
