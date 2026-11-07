import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { SplitPane } from '../src/components/SplitPane';
import { Header } from '../src/components/Header';
import { CommandPalette } from '../src/components/CommandPalette';
import { SettingsModal } from '../src/components/SettingsModal';
import { Problem, Category, DEFAULT_APP_SETTINGS } from '../src/core/types';
import { getSettings, saveSettings } from '../src/core/storage';

const mockProblem: Problem = {
  id: '1068',
  title: 'Weird Algorithm',
  category: 'Introductory Problems',
  timeLimit: '1.00 s',
  memoryLimit: '512 MB',
  statementHtml: '<p>Test statement</p>',
  testCases: [
    {
      id: 'sample-1',
      input: '3\n',
      expectedOutput: '3 10 5 16 8 4 2 1\n',
      isSample: true,
    },
  ],
};

const mockCategories: Category[] = [
  {
    id: 'introductory-problems',
    name: 'Introductory Problems',
    taskCount: 24,
    problemIds: ['1068', '1083'],
  },
];

describe('SplitPane Component', () => {
  it('renders horizontal split pane with two children and separator', () => {
    const html = renderToStaticMarkup(
      <SplitPane direction="horizontal" initialSize={40}>
        <div id="pane-1">Left Content</div>
        <div id="pane-2">Right Content</div>
      </SplitPane>
    );

    expect(html).toContain('Left Content');
    expect(html).toContain('Right Content');
    expect(html).toContain('role="separator"');
    expect(html).toContain('width:40%');
    expect(html).toContain('width:60%');
  });

  it('renders vertical split pane with two children and separator', () => {
    const html = renderToStaticMarkup(
      <SplitPane direction="vertical" initialSize={70}>
        <div id="pane-top">Top Content</div>
        <div id="pane-bottom">Bottom Content</div>
      </SplitPane>
    );

    expect(html).toContain('Top Content');
    expect(html).toContain('Bottom Content');
    expect(html).toContain('role="separator"');
    expect(html).toContain('height:70%');
    expect(html).toContain('height:30%');
  });

  it('renders only second child when firstCollapsed is true (Zen mode)', () => {
    const html = renderToStaticMarkup(
      <SplitPane direction="horizontal" firstCollapsed={true}>
        <div id="pane-1">Left Content</div>
        <div id="pane-2">Full Editor Content</div>
      </SplitPane>
    );

    expect(html).not.toContain('Left Content');
    expect(html).toContain('Full Editor Content');
    expect(html).not.toContain('role="separator"');
  });
});

describe('Header Component', () => {
  it('renders brand logo, problem breadcrumb, solved count, and action buttons', () => {
    const html = renderToStaticMarkup(
      <Header
        currentProblem={mockProblem}
        allProblems={[mockProblem]}
        categories={mockCategories}
        solvedCount={12}
        totalProblems={400}
        onSelectProblem={() => {}}
        onOpenCommandPalette={() => {}}
        zenMode={false}
        onToggleZenMode={() => {}}
        onOpenSettings={() => {}}
      />
    );

    // Brand
    expect(html).toContain('CSES');
    expect(html).toContain('Better');

    // Breadcrumb & Problem
    expect(html).toContain('Introductory Problems');
    expect(html).toContain('#1068');
    expect(html).toContain('Weird Algorithm');

    // Solved count
    expect(html).toContain('12/400');

    // Search trigger
    expect(html).toContain('Ctrl+K');
    expect(html).toContain('>Search</span>');
  });

  it('renders active zen mode button state when zenMode is true', () => {
    const html = renderToStaticMarkup(
      <Header
        currentProblem={mockProblem}
        allProblems={[mockProblem]}
        categories={mockCategories}
        solvedCount={0}
        totalProblems={400}
        onSelectProblem={() => {}}
        onOpenCommandPalette={() => {}}
        zenMode={true}
        onToggleZenMode={() => {}}
        onOpenSettings={() => {}}
      />
    );

    expect(html).toContain('Exit Zen Mode');
  });
});

describe('CommandPalette Component', () => {
  it('renders nothing when isOpen is false', () => {
    const html = renderToStaticMarkup(
      <CommandPalette
        isOpen={false}
        onClose={() => {}}
        problems={[mockProblem]}
        onSelectProblem={() => {}}
        solvedIds={new Set()}
      />
    );

    expect(html).toBe('');
  });

  it('renders dialog, search input, and problem results when isOpen is true', () => {
    const html = renderToStaticMarkup(
      <CommandPalette
        isOpen={true}
        onClose={() => {}}
        problems={[mockProblem]}
        onSelectProblem={() => {}}
        solvedIds={new Set(['1068'])}
      />
    );

    expect(html).toContain('role="dialog"');
    expect(html).toContain('Search problems by name, ID (#1068), or category');
    expect(html).toContain('Weird Algorithm');
    expect(html).toContain('#1068');
    expect(html).toContain('Total Solved: 1');
  });
});

describe('SettingsModal Component', () => {
  it('renders nothing when isOpen is false', () => {
    const html = renderToStaticMarkup(
      <SettingsModal
        isOpen={false}
        onClose={() => {}}
        settings={DEFAULT_APP_SETTINGS}
        onUpdateSettings={() => {}}
      />
    );

    expect(html).toBe('');
  });

  it('renders settings dialog with compiler API section when isOpen is true', () => {
    const html = renderToStaticMarkup(
      <SettingsModal
        isOpen={true}
        onClose={() => {}}
        settings={DEFAULT_APP_SETTINGS}
        onUpdateSettings={() => {}}
        initialTab="compiler"
      />
    );

    expect(html).toContain('Settings &amp; Preferences');
    expect(html).toContain('Compiler API');
    expect(html).toContain('Compiler API Key');
    expect(html).toContain('Execution Endpoint');
    expect(html).toContain('/api/compile');
  });
});

describe('Settings Storage Persistence', () => {
  it('persists and loads settings', () => {
    const customSettings = {
      ...DEFAULT_APP_SETTINGS,
      apiKey: 'custom_test_key_123',
      fontSize: 18,
      tabSize: 2 as const,
    };

    saveSettings(customSettings);
    const loaded = getSettings();

    expect(loaded.apiKey).toBe('custom_test_key_123');
    expect(loaded.fontSize).toBe(18);
    expect(loaded.tabSize).toBe(2);
  });
});
