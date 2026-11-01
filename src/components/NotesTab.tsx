'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  FileEdit,
  Eye,
  Check,
  Loader2,
  Trash2,
  Sparkles,
  Copy,
  BookOpen,
} from 'lucide-react';
import { KaTeXRenderer } from './KaTeXRenderer';
import { cn } from '@/lib/utils';

export interface NotesTabProps {
  problemId: string;
  className?: string;
}

const TEMPLATE = `### Approach & Algorithm
- Core Idea: 
- Data Structures: 

### Complexity Analysis
- Time Complexity: $O(n)$
- Auxiliary Space: $O(1)$

### Edge Cases & Pitfalls
- [ ] $n = 1$
- [ ] Large bounds / integer overflow ($x > 2^{31}-1$)
- [ ] Empty or boundary input
`;

export const NotesTab: React.FC<NotesTabProps> = ({ problemId, className }) => {
  const [content, setContent] = useState<string>('');
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'idle'>('idle');
  const [copied, setCopied] = useState<boolean>(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const storageKey = `cses_notes_${problemId}`;

  // Load note from localStorage when problemId changes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const saved = window.localStorage.getItem(storageKey);
      setContent(saved ?? '');
      setSaveStatus('idle');
    } catch {
      setContent('');
    }
  }, [problemId, storageKey]);

  // Persist content to localStorage
  const persistNote = useCallback(
    (text: string) => {
      if (typeof window === 'undefined') return;
      try {
        setSaveStatus('saving');
        if (text.trim() === '') {
          window.localStorage.removeItem(storageKey);
        } else {
          window.localStorage.setItem(storageKey, text);
        }
        setTimeout(() => {
          setSaveStatus('saved');
        }, 300);
      } catch {
        setSaveStatus('idle');
      }
    },
    [storageKey]
  );

  // Handle changes with debounce
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const nextVal = e.target.value;
    setContent(nextVal);
    setSaveStatus('saving');

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      persistNote(nextVal);
    }, 500);
  };

  // Immediate save on blur
  const handleBlur = () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    persistNote(content);
  };

  // Keyboard shortcut Ctrl+S
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      persistNote(content);
    }
  };

  const handleInsertTemplate = () => {
    const nextContent = content ? `${content}\n\n${TEMPLATE}` : TEMPLATE;
    setContent(nextContent);
    persistNote(nextContent);
  };

  const handleClear = () => {
    if (content && window.confirm('Clear all notes for this problem?')) {
      setContent('');
      persistNote('');
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  // Convert basic markdown checkboxes and headers for preview if needed
  const previewHtml = content
    .replace(/^### (.*$)/gim, '<h3 class="text-sm font-semibold text-slate-200 mt-4 mb-2 pb-1 border-b border-border-subtle">$1</h3>')
    .replace(/^## (.*$)/gim, '<h2 class="text-sm font-bold text-slate-100 mt-5 mb-2">$1</h2>')
    .replace(/^# (.*$)/gim, '<h1 class="text-base font-bold text-slate-100 mt-6 mb-2">$1</h1>')
    .replace(/^- \[ \] (.*$)/gim, '<div class="flex items-center gap-2 my-1 text-slate-300"><input type="checkbox" disabled class="rounded border-border-subtle bg-surface-2" /> <span>$1</span></div>')
    .replace(/^- \[x\] (.*$)/gim, '<div class="flex items-center gap-2 my-1 text-slate-400 line-through"><input type="checkbox" checked disabled class="rounded border-border-subtle bg-surface-2" /> <span>$1</span></div>')
    .replace(/^- (.*$)/gim, '<li class="text-slate-300 ml-4 list-disc">$1</li>')
    .replace(/\n\n/g, '<p class="my-2"></p>');

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const charCount = content.length;

  return (
    <div className={cn('flex flex-col h-full space-y-3', className)}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-border-subtle">
        {/* Left: Mode switcher */}
        <div className="flex items-center gap-1 p-0.5 rounded-lg bg-surface-2/60 border border-border-subtle">
          <button
            onClick={() => setMode('edit')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-colors',
              mode === 'edit'
                ? 'bg-surface-0 text-slate-100 shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            )}
          >
            <FileEdit className="w-3.5 h-3.5" />
            <span>Write</span>
          </button>
          <button
            onClick={() => setMode('preview')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-colors',
              mode === 'preview'
                ? 'bg-surface-0 text-slate-100 shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            )}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Preview Math</span>
          </button>
        </div>

        {/* Right: Actions & Status */}
        <div className="flex items-center gap-2 text-xs">
          {/* Auto-save status */}
          <div className="flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded bg-surface-2/40 text-slate-400 border border-border-subtle">
            {saveStatus === 'saving' ? (
              <>
                <Loader2 className="w-3 h-3 text-sky-400 animate-spin" />
                <span>Saving...</span>
              </>
            ) : saveStatus === 'saved' ? (
              <>
                <Check className="w-3 h-3 text-emerald-400" />
                <span className="text-emerald-400">Auto-saved</span>
              </>
            ) : (
              <span>Local sync</span>
            )}
          </div>

          {/* Quick template button */}
          <button
            onClick={handleInsertTemplate}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-surface-2 hover:bg-surface-3 text-slate-300 hover:text-white border border-border-subtle transition-colors text-xs font-medium"
            title="Insert Algorithm & Complexity Scratchpad Template"
          >
            <Sparkles className="w-3 h-3 text-amber-400" />
            <span>Template</span>
          </button>

          {/* Copy button */}
          {content && (
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 p-1 rounded hover:bg-surface-2 text-slate-400 hover:text-slate-200 transition-colors"
              title="Copy notes to clipboard"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          )}

          {/* Clear button */}
          {content && (
            <button
              onClick={handleClear}
              className="p-1 rounded hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 transition-colors"
              title="Clear notes"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Editor / Preview Area */}
      <div className="flex-1 min-h-[300px]">
        {mode === 'edit' ? (
          <div className="h-full flex flex-col">
            <textarea
              value={content}
              onChange={handleChange}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              placeholder="Jot down algorithm ideas, mathematical observations, recurrence relations like $dp[i] = dp[i-1] + ...$, or tricky corner cases here. Notes persist automatically in browser localStorage."
              className="w-full h-full min-h-[320px] p-3.5 rounded-lg bg-surface-0 border border-border-subtle text-slate-200 placeholder-slate-500 text-sm font-mono leading-relaxed focus:outline-hidden focus:border-sky-500/50 resize-y"
            />
          </div>
        ) : (
          <div className="h-full min-h-[320px] p-4 rounded-lg bg-surface-0/70 border border-border-subtle overflow-y-auto">
            {content.trim() ? (
              <KaTeXRenderer content={previewHtml} />
            ) : (
              <div className="py-12 text-center text-slate-500 text-xs">
                <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-500" />
                No notes to preview yet. Switch to "Write" to start typing.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-border-subtle">
        <span className="font-mono">
          {wordCount} words · {charCount} chars
        </span>
        <span className="text-[11px] text-slate-400">
          Markdown and LaTeX ($formula$) supported
        </span>
      </div>
    </div>
  );
};

export default NotesTab;
