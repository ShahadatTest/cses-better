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
  Database,
  User as UserIcon,
  Award,
  KeyRound,
  Star,
  BookOpen,
} from 'lucide-react';
import { Problem, Category, UserProfile } from '../core/types';
import { getStoredCsesCredentials } from '../core/cses-client';
import { getStarredProblems, toggleStarredProblem } from '../core/storage';
import { cn } from '../lib/utils';

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
  onOpenCsesProfile?: (nick?: string) => void;
  onOpenCsesAccount?: () => void;
  initialProblemOpen?: boolean;
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
  onOpenCsesProfile,
  onOpenCsesAccount,
  initialProblemOpen,
}: HeaderProps) {
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [isProblemOpen, setIsProblemOpen] = useState(initialProblemOpen ?? false);
  const [isMac, setIsMac] = useState(false);
  const [savedCsesNick, setSavedCsesNick] = useState<string | null>(null);
  const [savedCsesUserId, setSavedCsesUserId] = useState<string | null>(null);
  const activeStarredIds = starredProblemIds ?? getStarredProblems();

  useEffect(() => {
    const updateCreds = () => {
      const creds = getStoredCsesCredentials();
      if (creds?.nick) {
        setSavedCsesNick(creds.nick);
        if (creds.userId) setSavedCsesUserId(creds.userId);
      } else {
        setSavedCsesNick(null);
        setSavedCsesUserId(null);
      }
    };
    updateCreds();
    window.addEventListener('storage', updateCreds);
    return () => window.removeEventListener('storage', updateCreds);
  }, []);

  const categoryRef = useRef<HTMLDivElement>(null);
  const problemRef = useRef<HTMLDivElement>(null);

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
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-500 via-indigo-600 to-violet-600 p-0.5 shadow-md shadow-sky-500/10 flex items-center justify-center">
            <div className="w-full h-full bg-surface-0 rounded-[7px] flex items-center justify-center">
              <Code2 className="w-4 h-4 text-sky-400" />
            </div>
          </div>
          <div className="flex items-baseline space-x-1.5">
            <span className="font-extrabold tracking-tight text-white text-base">
              CSES
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider bg-gradient-to-r from-sky-400 to-emerald-400 bg-clip-text text-transparent">
              Better
            </span>
          </div>
        </div>

        {/* Divider */}
        <span className="text-slate-600 hidden sm:inline">/</span>

        {/* Category Dropdown */}
        <div className="relative hidden md:block" ref={categoryRef}>
          <button
            type="button"
            onClick={() => {
              setIsCategoryOpen(!isCategoryOpen);
              setIsProblemOpen(false);
            }}
            className="flex items-center space-x-1.5 text-xs text-slate-300 hover:text-white px-2 py-1 rounded-md hover:bg-surface-2/80 transition-colors"
            title="Browse Categories"
          >
            <Layers className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-medium truncate max-w-[150px]">
              {currentCategoryObj ? currentCategoryObj.name : currentProblem.category}
            </span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>

          {isCategoryOpen && (
            <div className="absolute left-0 mt-1.5 w-64 max-h-80 overflow-y-auto rounded-lg bg-surface-1 border border-border-muted shadow-2xl py-1.5 z-50">
              <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-border-subtle">
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
                        ? 'text-sky-400 bg-sky-500/10 font-semibold'
                        : 'text-slate-200'
                    }`}
                  >
                    <span className="truncate">{cat.name}</span>
                    <span className="text-[11px] text-slate-400 font-mono ml-2">
                      {cat.taskCount}
                    </span>
                  </button>
                ))}
            </div>
          )}
        </div>

        <span className="text-slate-600 hidden md:inline">›</span>

        {/* Problem Selector Dropdown + Prev/Next buttons */}
        <div className="flex items-center space-x-1 min-w-0" ref={problemRef}>
          <button
            type="button"
            onClick={handlePrevProblem}
            disabled={!hasPrev}
            className="p-1 rounded hover:bg-surface-2 text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:hover:bg-transparent"
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
              className="flex items-center space-x-1.5 text-xs text-white px-2 py-1 rounded-md bg-surface-2/60 hover:bg-surface-2 border border-border-subtle transition-colors max-w-[220px] sm:max-w-[280px]"
              title="Switch problem in this section"
            >
              {activeStarredIds.has(currentProblem.id) && (
                <Star className="w-3 h-3 text-amber-400 fill-amber-400 shrink-0" />
              )}
              <span className="text-sky-400 font-mono font-medium">
                #{currentProblem.id}
              </span>
              <span className="truncate font-medium">{currentProblem.title}</span>
              <ChevronDown className="w-3 h-3 text-slate-400 flex-shrink-0" />
            </button>

            {isProblemOpen && (
              <div className="absolute left-0 mt-1.5 w-72 max-h-80 overflow-y-auto rounded-lg bg-surface-1 border border-border-muted shadow-2xl py-1.5 z-50">
                <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-border-subtle">
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
                          ? 'text-sky-400 bg-sky-500/10 font-semibold'
                          : 'text-slate-200'
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
                            isStarred ? 'text-amber-400 fill-amber-400' : 'text-slate-500'
                          )}
                        />
                      </span>

                      <span className="font-mono text-slate-400 text-[11px] w-10 shrink-0">
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
            className="p-1 rounded hover:bg-surface-2 text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:hover:bg-transparent"
            title="Next Problem"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Center / Right: Search Bar Button */}
      <div className="flex items-center space-x-2 sm:space-x-3">
        {/* Command Palette Trigger */}
        <button
          type="button"
          onClick={onOpenCommandPalette}
          className="flex items-center space-x-2 text-xs text-slate-400 hover:text-slate-200 bg-surface-2/60 hover:bg-surface-2 border border-border-subtle rounded-lg px-2.5 py-1.5 transition-colors group"
          title="Search all 400 CSES problems"
        >
          <Search className="w-3.5 h-3.5 text-slate-400 group-hover:text-sky-400 transition-colors" />
          <span className="hidden sm:inline">Search 400 problems...</span>
          <kbd className="inline-flex items-center gap-0.5 rounded border border-border-muted bg-surface-0 px-1.5 py-0.5 text-[10px] font-mono text-slate-400 font-semibold shadow-sm">
            {isMac ? '⌘K' : 'Ctrl+K'}
          </kbd>
        </button>

        {/* Solved Count Badge */}
        <div
          className="flex items-center space-x-1.5 bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 px-2.5 py-1 rounded-full text-xs font-medium"
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

        {/* Archive Button */}
        {onOpenArchive && (
          <button
            type="button"
            onClick={onOpenArchive}
            className="hidden md:flex items-center space-x-1.5 text-xs text-purple-400 hover:text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/25 rounded-lg px-2.5 py-1.5 transition-colors"
            title="Browse CSES Continuous Mirror & Archive"
          >
            <Database className="w-3.5 h-3.5" />
            <span>Archive</span>
          </button>
        )}

        {/* Notebook / All Notes Button */}
        {onOpenAllNotes && (
          <button
            type="button"
            onClick={onOpenAllNotes}
            className="hidden md:flex items-center space-x-1.5 text-xs text-sky-400 hover:text-sky-300 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/25 rounded-lg px-2.5 py-1.5 transition-colors cursor-pointer"
            title="Open CSES Notebook (All Problem Notes)"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Notes</span>
          </button>
        )}

        {/* CSES Account & Solves Sync Button */}
        {(onOpenCsesAccount || onOpenCsesProfile) && (
          <button
            type="button"
            onClick={onOpenCsesAccount || (() => onOpenCsesProfile?.(savedCsesUserId || savedCsesNick || undefined))}
            className={cn(
              'hidden sm:flex items-center space-x-1.5 text-xs rounded-lg px-2.5 py-1.5 transition-colors border',
              savedCsesNick
                ? 'text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/30'
                : 'text-zinc-400 hover:text-zinc-200 bg-zinc-800/80 hover:bg-zinc-800 border-zinc-700/60'
            )}
            title={
              savedCsesNick
                ? `Connected to CSES: @${savedCsesNick}${savedCsesUserId ? ` (#${savedCsesUserId})` : ''} - Click to sync completed problems`
                : 'Connect official CSES account to sync solved problems and unlock queues'
            }
          >
            {savedCsesNick ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="font-mono font-medium">CSES: @{savedCsesNick}</span>
              </>
            ) : (
              <>
                <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                <span>Connect CSES</span>
              </>
            )}
          </button>
        )}

        {/* User Account / Auth Modal Trigger */}
        {onOpenAuth && (
          <button
            type="button"
            onClick={onOpenAuth}
            className="flex items-center space-x-1.5 text-xs rounded-lg px-2.5 py-1 transition-all border border-zinc-700/80 bg-zinc-800 hover:bg-zinc-700 text-zinc-200"
            title={
              currentUser
                ? `Signed in as ${currentUser.username ? `@${currentUser.username}` : currentUser.displayName}`
                : 'Sign in with GitHub'
            }
          >
            {currentUser?.avatarUrl ? (
              <img
                src={currentUser.avatarUrl}
                alt={currentUser.displayName || 'User'}
                className="w-5 h-5 rounded-full object-cover border border-blue-500/50"
              />
            ) : (
              <UserIcon className="w-3.5 h-3.5 text-blue-400" />
            )}
            <span className="max-w-[130px] truncate font-medium">
              {currentUser
                ? currentUser.username
                  ? `@${currentUser.username}`
                  : currentUser.displayName
                : 'Sign In'}
            </span>
          </button>
        )}

        {/* Vertical divider */}
        <div className="w-px h-5 bg-border-subtle" />

        {/* Right Action Icons: Zen Mode, Settings, GitHub */}
        <div className="flex items-center space-x-1">
          {/* Zen Mode */}
          <button
            type="button"
            onClick={onToggleZenMode}
            className={`p-1.5 rounded-lg border transition-all ${
              zenMode
                ? 'bg-sky-500/15 border-sky-500/40 text-sky-300'
                : 'text-slate-400 hover:text-white border-transparent hover:bg-surface-2'
            }`}
            title={zenMode ? 'Exit Zen Mode (Show Problem Pane)' : 'Zen Mode (Maximize Editor)'}
          >
            {zenMode ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </button>

          {/* Settings Modal Button */}
          <button
            type="button"
            onClick={onOpenSettings}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-surface-2 transition-colors"
            title="Open Settings"
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* GitHub Link */}
          <a
            href="https://github.com/codewithpom/cses-better"
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-surface-2 transition-colors"
            title="View on GitHub"
          >
            <Github className="w-4 h-4" />
          </a>
        </div>
      </div>
    </header>
  );
}
