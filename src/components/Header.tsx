'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Code2,
  Search,
  Settings,
  Github,
  Maximize2,
  Minimize2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Check,
  Layers,
  User as UserIcon,
  KeyRound,
  Star,
  MoreHorizontal,
  HelpCircle,
} from 'lucide-react';
import { Problem, Category, UserProfile } from '../core/types';
import { getStoredCsesCredentials } from '../core/cses-client';
import { getStarredProblems, toggleStarredProblem } from '../core/storage';
import { cn } from '../lib/utils';
import StreakIndicator from './StreakIndicator';

export interface HeaderProps {
  currentProblem: Problem;
  allProblems: Problem[];
  categories: Category[];
  solvedCount: number;
  totalProblems: number;
  solvedProblemIds?: Set<string>;
  onToggleSolved?: (problemId: string) => void;
  starredProblemIds?: Set<string>;
  onToggleStarred?: (problemId: string) => void;
  onSelectProblem: (id: string) => void;
  onOpenCommandPalette: () => void;
  zenMode: boolean;
  onToggleZenMode: () => void;
  onOpenSettings: () => void;
  currentUser?: UserProfile | null;
  onOpenAuth?: () => void;
  onOpenArchive?: () => void;
  onOpenAllNotes?: () => void;
  onOpenLists?: () => void;
  onOpenContestBank?: () => void;
  onOpenCsesProfile?: (nick?: string) => void;
  onOpenCsesAccount?: () => void;
  onOpenHelp?: () => void;
  onCopyProblemLink?: () => void;
  syncStatus?: 'idle' | 'pending' | 'synced' | 'failed';
  onRetrySync?: () => void;
  initialProblemOpen?: boolean;
  commandPaletteShortcut?: string | null;
}

export function Header({
  currentProblem,
  allProblems,
  categories,
  solvedCount,
  totalProblems,
  solvedProblemIds,
  onToggleSolved,
  starredProblemIds,
  onToggleStarred,
  onSelectProblem,
  onOpenCommandPalette,
  zenMode,
  onToggleZenMode,
  onOpenSettings,
  currentUser,
  onOpenAuth,
  onOpenArchive,
  onOpenAllNotes,
  onOpenLists,
  onOpenContestBank,
  onOpenCsesProfile,
  onOpenCsesAccount,
  onOpenHelp,
  onCopyProblemLink,
  syncStatus = 'idle',
  onRetrySync,
  initialProblemOpen,
  commandPaletteShortcut = 'Mod+K',
}: HeaderProps) {
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [isProblemOpen, setIsProblemOpen] = useState(initialProblemOpen ?? false);
  const [isMac, setIsMac] = useState(false);
  const [savedCsesNick, setSavedCsesNick] = useState<string | null>(null);
  const [savedCsesUserId, setSavedCsesUserId] = useState<string | null>(null);
  const activeStarredIds = starredProblemIds ?? getStarredProblems();
  const paletteShortcutLabel = commandPaletteShortcut
    ? commandPaletteShortcut.split('+').map((part) => part === 'Mod' ? (isMac ? '⌘' : 'Ctrl') : part).join(isMac ? '' : '+')
    : 'Unassigned';

  useEffect(() => {
    const updateCreds = () => {
      const creds = getStoredCsesCredentials();
      if (creds?.nick && creds.sessionCookie) {
        setSavedCsesNick(creds.nick);
        if (creds.userId) setSavedCsesUserId(creds.userId);
      } else {
        setSavedCsesNick(null);
        setSavedCsesUserId(null);
      }
    };
    updateCreds();
    window.addEventListener('storage', updateCreds);
    window.addEventListener('cses-account-changed', updateCreds);
    return () => {
      window.removeEventListener('storage', updateCreds);
      window.removeEventListener('cses-account-changed', updateCreds);
    };
  }, []);

  const categoryRef = useRef<HTMLDivElement>(null);
  const problemRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLDetailsElement>(null);
  const accountRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const dismiss = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent && event.key === 'Escape' && moreRef.current?.open) {
        const hadFocusInside = moreRef.current.contains(document.activeElement);
        moreRef.current.removeAttribute('open');
        if (hadFocusInside) moreRef.current.querySelector('summary')?.focus();
      }
      if (event instanceof KeyboardEvent && event.key === 'Escape' && accountRef.current?.open) {
        const hadFocusInside = accountRef.current.contains(document.activeElement);
        accountRef.current.removeAttribute('open');
        if (hadFocusInside) accountRef.current.querySelector('summary')?.focus();
      }
      if (event instanceof MouseEvent && !moreRef.current?.contains(event.target as Node)) moreRef.current?.removeAttribute('open');
      if (event instanceof MouseEvent && !accountRef.current?.contains(event.target as Node)) accountRef.current?.removeAttribute('open');
    };
    document.addEventListener('mousedown', dismiss);
    document.addEventListener('keydown', dismiss);
    return () => {
      document.removeEventListener('mousedown', dismiss);
      document.removeEventListener('keydown', dismiss);
    };
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsMac(/(Mac|iPhone|iPod|iPad)/i.test(navigator.userAgent));
    }
  }, []);

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        categoryRef.current &&
        !categoryRef.current.contains(event.target as Node)
      ) {
        setIsCategoryOpen(false);
      }
      if (
        problemRef.current &&
        !problemRef.current.contains(event.target as Node)
      ) {
        setIsProblemOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Determine current category object
  const currentCategoryObj = useMemo(() => {
    return (
      categories.find((c) => c.name.toLowerCase() === currentProblem.category.toLowerCase()) ||
      categories.find((c) => c.problemIds.includes(currentProblem.id))
    );
  }, [categories, currentProblem]);

  // Problems in current category
  const problemsInCurrentCategory = useMemo(() => {
    if (!currentCategoryObj) return allProblems;
    if (currentCategoryObj.problemIds.length > 0) {
      const idMap = new Map(allProblems.map((p) => [p.id, p]));
      return currentCategoryObj.problemIds
        .map((id) => idMap.get(id))
        .filter((p): p is Problem => Boolean(p));
    }
    return allProblems.filter((p) => p.category === currentProblem.category);
  }, [currentCategoryObj, allProblems, currentProblem.category]);

  // Find index of current problem for prev/next navigation
  const currentIndex = useMemo(() => {
    return problemsInCurrentCategory.findIndex((p) => p.id === currentProblem.id);
  }, [problemsInCurrentCategory, currentProblem.id]);

  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < problemsInCurrentCategory.length - 1;

  const handlePrevProblem = () => {
    if (hasPrev) {
      onSelectProblem(problemsInCurrentCategory[currentIndex - 1].id);
    }
  };

  const handleNextProblem = () => {
    if (hasNext) {
      onSelectProblem(problemsInCurrentCategory[currentIndex + 1].id);
    }
  };

  return (
    <header className="h-14 border-b border-border-subtle bg-surface-1/90 backdrop-blur-md px-3.5 flex items-center justify-between z-30 select-none">
      {/* Left: Brand + Breadcrumb Navigation */}
      <div className="flex items-center space-x-3.5 min-w-0">
        {/* Brand Logo & Name */}
        <div className="flex items-center space-x-2.5 flex-shrink-0 mr-1">
          <div className="w-8 h-8 rounded-lg bg-surface-3 p-0.5 shadow-md shadow-accent/10 flex items-center justify-center">
            <div className="w-full h-full bg-surface-0 rounded-[7px] flex items-center justify-center">
              <Code2 className="w-4 h-4 text-accent" />
            </div>
          </div>
          <div className="hidden xl:flex items-baseline space-x-1.5">
            <span className="font-extrabold tracking-tight text-text-primary text-base">
              CSES
            </span>
            <span className="text-xs font-semibold  text-text-secondary">
              Better
            </span>
          </div>
        </div>

        {/* Divider */}
        <span className="text-slate-600 hidden sm:inline">/</span>

        {/* Category Dropdown */}
        <div className="relative hidden 2xl:block" ref={categoryRef}>
          <button
            type="button"
            onClick={() => {
              setIsCategoryOpen(!isCategoryOpen);
              setIsProblemOpen(false);
            }}
            className="flex items-center space-x-1.5 text-xs text-text-secondary hover:text-text-primary px-2 py-1 rounded-md hover:bg-surface-2/80 transition-colors"
            title="Browse Categories"
          >
            <Layers className="w-3.5 h-3.5 text-text-muted" />
            <span className="font-medium truncate max-w-[150px]">
              {currentCategoryObj ? currentCategoryObj.name : currentProblem.category}
            </span>
            <ChevronDown className="w-3 h-3 text-text-muted" />
          </button>

          {isCategoryOpen && (
            <div className="absolute left-0 mt-1.5 w-64 max-h-80 overflow-y-auto rounded-lg bg-surface-1 border border-border-muted shadow-2xl py-1.5 z-50">
              <div className="px-3 py-1.5 text-[11px] font-semibold text-text-muted  border-b border-border-subtle">
                Categories ({categories.filter((c) => c.taskCount > 0).length})
              </div>
              {categories
                .filter((cat) => cat.taskCount > 0)
                .map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      setIsCategoryOpen(false);
                      if (cat.problemIds.length > 0) {
                        onSelectProblem(cat.problemIds[0]);
                      }
                    }}
                    className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-surface-2 transition-colors ${
                      currentCategoryObj?.id === cat.id
                        ? 'text-accent bg-accent/10 font-semibold'
                        : 'text-text-primary'
                    }`}
                  >
                    <span className="truncate">{cat.name}</span>
                    <span className="text-[11px] text-text-muted font-mono ml-2">
                      {cat.taskCount}
                    </span>
                  </button>
                ))}
            </div>
          )}
        </div>

        <span className="text-slate-600 hidden xl:inline">›</span>

        {/* Problem Selector Dropdown + Prev/Next buttons */}
        <div className="flex items-center space-x-1 min-w-0" ref={problemRef}>
          <button
            type="button"
            onClick={handlePrevProblem}
            disabled={!hasPrev}
            className="p-1 rounded hover:bg-surface-2 text-text-muted hover:text-text-primary disabled:opacity-30 disabled:hover:bg-transparent"
            title="Previous Problem"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setIsProblemOpen(!isProblemOpen);
                setIsCategoryOpen(false);
              }}
              className="flex items-center space-x-1.5 text-xs text-text-primary px-2 py-1 rounded-md bg-surface-2/60 hover:bg-surface-2 border border-border-subtle transition-colors max-w-[110px] sm:max-w-[200px] 2xl:max-w-[280px]"
              title="Switch problem in this section"
            >
              {activeStarredIds.has(currentProblem.id) && (
                <Star className="w-3 h-3 text-amber-400 fill-amber-400 shrink-0" />
              )}
              <span className="text-accent font-mono font-medium">
                #{currentProblem.id}
              </span>
              <span className="truncate font-medium">{currentProblem.title}</span>
              <ChevronDown className="w-3 h-3 text-text-muted flex-shrink-0" />
            </button>

            {isProblemOpen && (
              <div className="absolute left-0 mt-1.5 w-84 max-h-80 overflow-y-auto rounded-lg bg-surface-1 border border-border-muted shadow-2xl py-1.5 z-50">
                <div className="px-3 py-1.5 text-[11px] font-semibold text-text-muted  border-b border-border-subtle">
                  {currentCategoryObj?.name || 'Category'} Tasks (
                  {problemsInCurrentCategory.length})
                </div>
                {problemsInCurrentCategory.map((prob) => {
                  const isSolved = solvedProblemIds?.has(prob.id);
                  const isStarred = activeStarredIds.has(prob.id);
                  return (
                    <button
                      key={prob.id}
                      type="button"
                      onClick={() => {
                        setIsProblemOpen(false);
                        onSelectProblem(prob.id);
                      }}
                      className={`w-full text-left px-3 py-2 text-xs flex items-center space-x-2.5 hover:bg-surface-2 transition-colors group ${
                        currentProblem.id === prob.id
                          ? 'text-accent bg-accent/10 font-semibold'
                          : 'text-text-primary'
                      }`}
                    >
                      {/* Interactive completion tick box */}
                      <span
                        role="checkbox"
                        aria-checked={isSolved}
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleSolved?.(prob.id);
                        }}
                        className={cn(
                          'w-4 h-4 rounded flex items-center justify-center shrink-0 transition-colors border cursor-pointer',
                          isSolved
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50 hover:bg-emerald-500/30'
                            : 'border-slate-700 bg-surface-2/40 hover:border-slate-500 hover:bg-surface-2'
                        )}
                        title={isSolved ? 'Mark as unsolved' : 'Mark as solved'}
                      >
                        {isSolved && <Check className="w-3 h-3 stroke-[3]" />}
                      </span>

                      {/* Interactive Star Bookmark */}
                      <span
                        role="button"
                        aria-label={isStarred ? 'Unstar problem' : 'Star problem'}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onToggleStarred) {
                            onToggleStarred(prob.id);
                          } else {
                            toggleStarredProblem(prob.id);
                          }
                        }}
                        className={cn(
                          'p-0.5 rounded transition-colors cursor-pointer shrink-0',
                          isStarred
                            ? 'text-amber-400 hover:text-amber-300'
                            : 'text-slate-600 hover:text-amber-400 opacity-40 group-hover:opacity-100'
                        )}
                        title={isStarred ? 'Unstar problem' : 'Star this problem'}
                      >
                        <Star
                          className={cn(
                            'w-3.5 h-3.5',
                            isStarred ? 'text-amber-400 fill-amber-400' : 'text-text-muted'
                          )}
                        />
                      </span>

                      <span className="font-mono text-text-muted text-[11px] w-10 shrink-0">
                        #{prob.id}
                      </span>
                      <span className="truncate flex-1">{prob.title}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleNextProblem}
            disabled={!hasNext}
            className="p-1 rounded hover:bg-surface-2 text-text-muted hover:text-text-primary disabled:opacity-30 disabled:hover:bg-transparent"
            title="Next Problem"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Center / Right: Search Bar Button */}
      <div className="flex shrink-0 items-center gap-1 sm:gap-2 whitespace-nowrap">
        {/* Command Palette Trigger */}
        <button
          type="button"
          onClick={onOpenCommandPalette}
          className="flex items-center space-x-2 text-xs text-text-muted hover:text-text-primary bg-surface-2/60 hover:bg-surface-2 border border-border-subtle rounded-lg px-2.5 py-1.5 transition-colors group"
          title="Search all 400 CSES problems"
        >
          <Search className="w-3.5 h-3.5 text-text-muted group-hover:text-accent transition-colors" />
          <span className="hidden md:inline">Search</span>
          <kbd className="hidden 2xl:inline-flex items-center gap-0.5 rounded border border-border-muted bg-surface-0 px-1.5 py-0.5 text-[11px] font-mono text-text-muted font-semibold shadow-sm">
            {paletteShortcutLabel}
          </kbd>
        </button>

        {/* Solved Count Badge */}
        <div
          className="hidden xl:flex items-center space-x-1.5 bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 px-2.5 py-1 rounded-full text-xs font-medium"
          title={`${solvedCount} of ${totalProblems} problems solved`}
        >
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
          <span className="font-mono">
            {solvedCount}/{totalProblems}
          </span>
          <span className="hidden lg:inline text-emerald-300/80 text-[11px]">
            Solved
          </span>
        </div>

        <div className="hidden 2xl:block"><StreakIndicator owner={currentUser?.id || 'guest'} onConnect={onOpenCsesAccount} /></div>
        {onOpenLists && <button type="button" onClick={onOpenLists} className="hidden lg:block text-xs text-text-primary border border-border-muted rounded px-2.5 py-1.5 hover:bg-surface-2">Lists</button>}
        {(onOpenAuth || onOpenCsesAccount || onOpenCsesProfile) && (
          <details className="relative" ref={accountRef} onClick={(event) => {
            if ((event.target as HTMLElement).closest('button')) {
              accountRef.current?.removeAttribute('open');
              accountRef.current?.querySelector('summary')?.focus();
            }
          }}>
            <summary aria-label="Account options" title={currentUser ? `Signed in as ${currentUser.username ? `@${currentUser.username}` : currentUser.displayName}` : 'Account options'} className="list-none cursor-pointer flex items-center gap-1.5 text-xs rounded-lg px-2 py-1.5 border border-border-muted bg-surface-2 hover:bg-surface-3 text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
              {currentUser?.avatarUrl ? <img src={currentUser.avatarUrl} alt="" className="w-5 h-5 rounded-full object-cover" /> : <UserIcon className="w-3.5 h-3.5 text-accent" />}
              <span>Account</span>
              <ChevronDown className="w-3 h-3 text-text-muted" />
            </summary>
            <div className="absolute right-0 top-full mt-2 z-50 w-56 rounded-md border border-border-muted bg-surface-1 p-1 shadow-xl">
              {onOpenAuth && <button type="button" onClick={onOpenAuth} className="w-full flex items-center gap-2 text-left px-3 py-2 text-xs text-text-primary hover:bg-surface-2 rounded"><Github className="w-4 h-4" />{currentUser ? 'GitHub account' : 'Sign in with GitHub'}</button>}
              {(onOpenCsesAccount || onOpenCsesProfile) && <button type="button" onClick={onOpenCsesAccount || (() => onOpenCsesProfile?.(savedCsesUserId || savedCsesNick || undefined))} className="w-full flex items-center gap-2 text-left px-3 py-2 text-xs text-text-primary hover:bg-surface-2 rounded"><KeyRound className="w-4 h-4" />{savedCsesNick ? `CSES: @${savedCsesNick}` : 'Connect CSES account'}</button>}
            </div>
          </details>
        )}
        <button type="button" onClick={onToggleZenMode} className={`hidden xl:block p-1.5 rounded-lg border transition-all ${zenMode ? 'bg-accent/15 border-accent/40 text-accent' : 'text-text-muted hover:text-text-primary border-transparent hover:bg-surface-2'}`} title={zenMode ? 'Exit Zen Mode' : 'Zen Mode'}>
          {zenMode ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
        <details className="relative" ref={moreRef} onClick={(event) => {
          if ((event.target as HTMLElement).closest('button, a')) {
            moreRef.current?.removeAttribute('open');
            moreRef.current?.querySelector('summary')?.focus();
          }
        }}>
          <summary className="list-none cursor-pointer rounded-md border border-border-muted p-1.5 text-text-secondary hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" aria-label="More workspace actions" title="More"><MoreHorizontal className="w-4 h-4" /></summary>
          <div className="absolute right-0 top-full mt-2 z-50 w-52 rounded-md border border-border-muted bg-surface-1 p-1 shadow-xl">
            {onOpenArchive && <button type="button" onClick={onOpenArchive} className="w-full text-left px-3 py-2 text-xs text-text-primary hover:bg-surface-2 rounded">Archive</button>}
            {onOpenAllNotes && <button type="button" onClick={onOpenAllNotes} className="w-full text-left px-3 py-2 text-xs text-text-primary hover:bg-surface-2 rounded">Notes</button>}
            {onOpenContestBank && <button type="button" onClick={onOpenContestBank} className="w-full text-left px-3 py-2 text-xs text-text-primary hover:bg-surface-2 rounded">Contest bank</button>}
            <button type="button" onClick={onOpenSettings} className="w-full text-left px-3 py-2 text-xs text-text-primary hover:bg-surface-2 rounded"><Settings className="inline w-3.5 h-3.5 mr-2"/>Settings &amp; appearance</button>
            {onOpenHelp && <button type="button" onClick={onOpenHelp} className="w-full text-left px-3 py-2 text-xs text-text-primary hover:bg-surface-2 rounded"><HelpCircle className="inline w-3.5 h-3.5 mr-2"/>Keyboard shortcuts</button>}
            {onCopyProblemLink && <button type="button" onClick={onCopyProblemLink} className="w-full text-left px-3 py-2 text-xs text-text-primary hover:bg-surface-2 rounded">Copy problem link</button>}
            <a href="https://github.com/codewithpom/cses-better" target="_blank" rel="noopener noreferrer" className="block px-3 py-2 text-xs text-text-primary hover:bg-surface-2 rounded"><Github className="inline w-3.5 h-3.5 mr-2"/>GitHub</a>
            <a href="https://github.com/codewithpom/cses-better/issues/new" target="_blank" rel="noopener noreferrer" className="block px-3 py-2 text-xs text-text-primary hover:bg-surface-2 rounded">Feedback</a>
            <div className="px-3 py-2 text-[11px] text-text-muted">
              {currentUser ? `Progress sync: ${syncStatus === 'pending' ? 'waiting' : syncStatus === 'synced' ? 'synced' : syncStatus === 'failed' ? 'needs retry' : 'not started'}` : 'Drafts and results saved on this device'}
              {currentUser && syncStatus === 'failed' && onRetrySync && <button type="button" onClick={onRetrySync} className="ml-2 text-accent hover:text-accent">Retry</button>}
            </div>
          </div>
        </details>
      </div>
    </header>
  );
}
