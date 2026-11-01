'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, CheckCircle2, ArrowRight, CornerDownLeft, X, Layers } from 'lucide-react';
import { Problem } from '../core/types';

export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  problems: Problem[];
  onSelectProblem: (id: string) => void;
  solvedIds: Set<string>;
}

export function CommandPalette({
  isOpen,
  onClose,
  problems,
  onSelectProblem,
  solvedIds,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Reset and focus when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setActiveIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Filter problems by query (id, title, category)
  const filteredProblems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      // Default to first 40 problems if empty
      return problems.slice(0, 40);
    }

    return problems
      .filter((p) => {
        const matchId = p.id.toLowerCase().includes(q);
        const matchTitle = p.title.toLowerCase().includes(q);
        const matchCategory = p.category.toLowerCase().includes(q);
        return matchId || matchTitle || matchCategory;
      })
      .slice(0, 50); // limit to 50 for instantaneous rendering
  }, [problems, query]);

  // Keep active index in bounds
  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  // Auto-scroll highlighted item into view
  useEffect(() => {
    if (!listRef.current) return;
    const activeEl = listRef.current.children[activeIndex] as HTMLElement | undefined;
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) =>
        prev < filteredProblems.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) =>
        prev > 0 ? prev - 1 : filteredProblems.length - 1
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const selected = filteredProblems[activeIndex];
      if (selected) {
        onSelectProblem(selected.id);
        onClose();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search problems"
        className="w-full max-w-2xl bg-surface-1 border border-border-muted rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[75vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-border-subtle bg-surface-1">
          <Search className="w-5 h-5 text-slate-400 mr-3 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search problems by name, ID (#1068), or category..."
            className="w-full bg-transparent text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="p-1 rounded text-slate-500 hover:text-slate-300"
              title="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Results Count Header */}
        <div className="px-4 py-2 text-[11px] font-semibold text-slate-400 bg-surface-0/60 border-b border-border-subtle flex items-center justify-between">
          <span>
            {query.trim()
              ? `Found ${filteredProblems.length} matches`
              : `Showing top ${filteredProblems.length} of ${problems.length} problems`}
          </span>
          <span className="text-[10px] text-slate-500">CSES Problem Set</span>
        </div>

        {/* Results List */}
        <div
          ref={listRef}
          className="flex-1 overflow-y-auto divide-y divide-border-subtle/50 p-1.5 focus:outline-none"
          tabIndex={-1}
        >
          {filteredProblems.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500">
              No problems found matching &quot;{query}&quot;
            </div>
          ) : (
            filteredProblems.map((prob, idx) => {
              const isSelected = idx === activeIndex;
              const isSolved = solvedIds.has(prob.id);

              return (
                <div
                  key={prob.id}
                  onClick={() => {
                    onSelectProblem(prob.id);
                    onClose();
                  }}
                  onMouseEnter={() => setActiveIndex(idx)}
                  className={`group px-3 py-2.5 rounded-lg cursor-pointer flex items-center justify-between transition-colors ${
                    isSelected
                      ? 'bg-sky-500/15 text-white'
                      : 'text-slate-300 hover:bg-surface-2'
                  }`}
                >
                  {/* Left: Checkmark + Task ID + Title */}
                  <div className="flex items-center space-x-3 min-w-0">
                    <div className="flex-shrink-0 w-4 h-4 flex items-center justify-center">
                      {isSolved ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-600 group-hover:bg-slate-400" />
                      )}
                    </div>
                    <span
                      className={`font-mono text-xs ${
                        isSelected ? 'text-sky-300 font-semibold' : 'text-slate-400'
                      }`}
                    >
                      #{prob.id}
                    </span>
                    <span className="text-sm font-medium truncate">
                      {prob.title}
                    </span>
                  </div>

                  {/* Right: Category badge + Action hint */}
                  <div className="flex items-center space-x-2 flex-shrink-0 ml-3">
                    <span
                      className={`text-[11px] px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                        isSelected
                          ? 'border-sky-500/30 bg-sky-500/20 text-sky-200'
                          : 'border-slate-800 bg-surface-2 text-slate-400'
                      }`}
                    >
                      <Layers className="w-2.5 h-2.5 opacity-70" />
                      {prob.category}
                    </span>

                    {isSelected ? (
                      <CornerDownLeft className="w-3.5 h-3.5 text-sky-400" />
                    ) : (
                      <ArrowRight className="w-3.5 h-3.5 text-slate-600 opacity-0 group-hover:opacity-100" />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Keyboard Shortcuts Footer */}
        <div className="px-4 py-2.5 border-t border-border-subtle bg-surface-0/80 text-[11px] text-slate-400 flex items-center justify-between select-none">
          <div className="flex items-center space-x-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-surface-2 border border-border-muted text-slate-300 font-mono text-[10px]">
                ↑
              </kbd>
              <kbd className="px-1.5 py-0.5 rounded bg-surface-2 border border-border-muted text-slate-300 font-mono text-[10px]">
                ↓
              </kbd>
              <span>to navigate</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-surface-2 border border-border-muted text-slate-300 font-mono text-[10px]">
                ↵
              </kbd>
              <span>to select</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-surface-2 border border-border-muted text-slate-300 font-mono text-[10px]">
                ESC
              </kbd>
              <span>to close</span>
            </span>
          </div>

          <span className="text-[10px] text-slate-500">
            Total Solved: {solvedIds.size}
          </span>
        </div>
      </div>
    </div>
  );
}
