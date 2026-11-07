import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  STARRED_PROBLEMS_KEY,
  getStarredProblems,
  saveStarredProblem,
  removeStarredProblem,
  toggleStarredProblem,
  persistStarredProblems,
  getPendingStarredChanges,
  acknowledgeStarredChange,
  claimGuestStars,
  clearAllStorage,
  exportUserData,
  importUserData,
} from '../src/core/storage';
import * as CoreExports from '../src/core';
import { ProblemPane } from '../src/components/ProblemPane';
import { Header } from '../src/components/Header';
import { ArchiveExplorerModal } from '../src/components/ArchiveExplorerModal';
import { Problem, Category } from '../src/core/types';
import * as SupabaseModule from '../src/core/supabase';

const mockProblem: Problem = {
  id: '1068',
  title: 'Weird Algorithm',
  category: 'Introductory Problems',
  timeLimit: '1.00 s',
  memoryLimit: '512 MB',
  statementHtml: '<p>Consider an algorithm...</p>',
  testCases: [
    {
      id: 'sample-1',
      input: '3\n',
      expectedOutput: '3 10 5 16 8 4 2 1\n',
      isSample: true,
    },
  ],
};

const mockProblem2: Problem = {
  id: '1083',
  title: 'Missing Number',
  category: 'Introductory Problems',
  timeLimit: '1.00 s',
  memoryLimit: '512 MB',
  statementHtml: '<p>You are given all numbers except one...</p>',
  testCases: [],
};

const mockCategories: Category[] = [
  {
    id: 'introductory-problems',
    name: 'Introductory Problems',
    taskCount: 2,
    problemIds: ['1068', '1083'],
  },
];

describe('Starred Problems Storage Unit Tests', () => {
  beforeEach(() => {
    clearAllStorage();
  });

  it('exports STARRED_PROBLEMS_KEY and functions from core', () => {
    expect(STARRED_PROBLEMS_KEY).toBe('cses_starred_problem_ids');
    expect(CoreExports.STARRED_PROBLEMS_KEY).toBe('cses_starred_problem_ids');
    expect(typeof CoreExports.getStarredProblems).toBe('function');
    expect(typeof CoreExports.saveStarredProblem).toBe('function');
    expect(typeof CoreExports.removeStarredProblem).toBe('function');
    expect(typeof CoreExports.toggleStarredProblem).toBe('function');
  });

  it('manages starred problems in local storage correctly', () => {
    expect(getStarredProblems().size).toBe(0);

    saveStarredProblem('1068');
    expect(getStarredProblems().has('1068')).toBe(true);
    expect(getStarredProblems().size).toBe(1);

    saveStarredProblem('1083');
    expect(getStarredProblems().has('1083')).toBe(true);
    expect(getStarredProblems().size).toBe(2);

    removeStarredProblem('1068');
    expect(getStarredProblems().has('1068')).toBe(false);
    expect(getStarredProblems().has('1083')).toBe(true);
    expect(getStarredProblems().size).toBe(1);
  });

  it('toggles starred problems and returns new status', () => {
    // Unstarred -> Starred returns true
    const result1 = toggleStarredProblem('1068');
    expect(result1).toBe(true);
    expect(getStarredProblems().has('1068')).toBe(true);

    // Starred -> Unstarred returns false
    const result2 = toggleStarredProblem('1068');
    expect(result2).toBe(false);
    expect(getStarredProblems().has('1068')).toBe(false);
  });

  it('persists multiple problem IDs with persistStarredProblems', () => {
    persistStarredProblems(['1068', '1069', '1070']);
    const starred = getStarredProblems();
    expect(starred.has('1068')).toBe(true);
    expect(starred.has('1069')).toBe(true);
    expect(starred.has('1070')).toBe(true);
    expect(starred.size).toBe(3);
  });

  it('scopes stars by account and only acknowledges the exact pending operation', () => {
    saveStarredProblem('1068', 'account-a');
    const add = getPendingStarredChanges('account-a')['1068'];
    expect(getStarredProblems('account-a').has('1068')).toBe(true);
    expect(getStarredProblems('account-b').has('1068')).toBe(false);
    removeStarredProblem('1068', 'account-a');
    const remove = getPendingStarredChanges('account-a')['1068'];
    expect(remove.starred).toBe(false);
    acknowledgeStarredChange('account-a', '1068', add.operation);
    expect(getPendingStarredChanges('account-a')['1068']).toEqual(remove);
    acknowledgeStarredChange('account-a', '1068', remove.operation);
    expect(getPendingStarredChanges('account-a')['1068']).toBeUndefined();
  });

  it('moves guest stars to only the first claimed account', () => {
    saveStarredProblem('guest-star', 'guest');
    claimGuestStars('account-a');
    claimGuestStars('account-b');
    expect(getStarredProblems('account-a').has('guest-star')).toBe(true);
    expect(getStarredProblems('account-b').has('guest-star')).toBe(false);
    expect(getStarredProblems('guest').has('guest-star')).toBe(false);
  });

  it('exports and imports starred problems seamlessly in UserDataExport', () => {
    saveStarredProblem('1068');
    saveStarredProblem('1083');

    const json = exportUserData();
    const parsed = JSON.parse(json);
    expect(parsed.starredIds).toBeDefined();
    expect(parsed.starredIds).toContain('1068');
    expect(parsed.starredIds).toContain('1083');

    clearAllStorage();
    expect(getStarredProblems().size).toBe(0);

    const ok = importUserData(json);
    expect(ok).toBe(true);
    expect(getStarredProblems().has('1068')).toBe(true);
    expect(getStarredProblems().has('1083')).toBe(true);
  });

  it('clears starred problems on clearAllStorage', () => {
    saveStarredProblem('1068');
    expect(getStarredProblems().size).toBe(1);
    clearAllStorage();
    expect(getStarredProblems().size).toBe(0);
  });
});

describe('Supabase Cloud Sync with Starred Problems', () => {
  beforeEach(() => {
    clearAllStorage();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    SupabaseModule.setSupabaseInstance(null);
  });

  it('does not bulk upsert stars because desired state changes sync per problem', async () => {
    const mockUpsert = vi.fn().mockResolvedValue({ error: null });
    const mockFrom = vi.fn().mockReturnValue({
      upsert: mockUpsert,
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: [] }),
    });

    SupabaseModule.setSupabaseInstance({
      from: mockFrom,
    } as any);

    const res = await SupabaseModule.syncUserDataToCloud('user-123', {
      starredIds: ['1068', '1083'],
    });

    expect(res).toBe(true);
    expect(mockFrom).not.toHaveBeenCalledWith('user_starred');
  });

  it('pulls and restores starredIds in fetchUserDataFromCloud', async () => {
    const mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === 'user_starred') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [{ problem_id: '1068' }, { problem_id: '1083' }],
              error: null,
            }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      };
    });

    SupabaseModule.setSupabaseInstance({
      from: mockFrom,
    } as any);

    const result = await SupabaseModule.fetchUserDataFromCloud('user-123');
    expect(result).not.toBeNull();
    expect(result?.starredIds).toEqual(['1068', '1083']);
  });

  it('persists individual starred toggle to cloud with saveUserStarredToCloud', async () => {
    const mockUpsert = vi.fn().mockResolvedValue({ error: null });
    const mockDelete = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });

    const mockFrom = vi.fn().mockReturnValue({
      upsert: mockUpsert,
      delete: mockDelete,
    });

    SupabaseModule.setSupabaseInstance({
      from: mockFrom,
    } as any);

    // Test starring problem
    const okStar = await SupabaseModule.saveUserStarredToCloud('user-123', '1068', true);
    expect(okStar).toBe(true);
    expect(mockFrom).toHaveBeenCalledWith('user_starred');
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'user-123', problem_id: '1068' }),
      expect.any(Object)
    );

    // Test unstarring problem
    const okUnstar = await SupabaseModule.saveUserStarredToCloud('user-123', '1068', false);
    expect(okUnstar).toBe(true);
    expect(mockDelete).toHaveBeenCalled();
  });
});

describe('ProblemPane Star Button Component Tests', () => {
  beforeEach(() => {
    clearAllStorage();
  });

  it('renders prominent Star button with helpful tooltip in statement header', () => {
    const html = renderToStaticMarkup(
      <ProblemPane
        problem={mockProblem}
        isStarred={false}
      />
    );

    expect(html).toContain('Star this problem (bookmark)');
    expect(html).toContain('Star');
    expect(html).toContain('Weird Algorithm');
    expect(html).not.toContain('fill-amber-400');
  });

  it('renders gold/amber fill styling when starred', () => {
    const html = renderToStaticMarkup(
      <ProblemPane
        problem={mockProblem}
        isStarred={true}
      />
    );

    expect(html).toContain('Star this problem (bookmark)');
    expect(html).toContain('Starred');
    expect(html).toContain('text-amber-400 fill-amber-400');
  });
});

describe('Header Problem Dropdown Star Tests', () => {
  it('renders gold star icon on starred problems in problem dropdown', () => {
    const html = renderToStaticMarkup(
      <Header
        currentProblem={mockProblem}
        allProblems={[mockProblem, mockProblem2]}
        categories={mockCategories}
        solvedCount={0}
        totalProblems={2}
        starredProblemIds={new Set(['1068'])}
        initialProblemOpen={true}
        onSelectProblem={() => {}}
        onOpenCommandPalette={() => {}}
        zenMode={false}
        onToggleZenMode={() => {}}
        onOpenSettings={() => {}}
      />
    );

    // Current problem trigger has star
    expect(html).toContain('text-amber-400 fill-amber-400');
    // Dropdown contains Star aria label
    expect(html).toContain('aria-label="Unstar problem"');
    expect(html).toContain('aria-label="Star problem"');
  });
});

describe('ArchiveExplorerModal Starred Badge and Filter Tests', () => {
  it('renders Starred filter button and gold star badge for starred problems', () => {
    const html = renderToStaticMarkup(
      <ArchiveExplorerModal
        isOpen={true}
        onClose={() => {}}
        starredIds={new Set(['1068'])}
      />
    );

    // Filter pill & options
    expect(html).toContain('Starred');
    expect(html).toContain('All');
    expect(html).toContain('Solved');
    expect(html).toContain('CSES Continuous Mirror &amp; Archive');
  });
});
