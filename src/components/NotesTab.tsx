'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  FileEdit,
  Eye,
  Columns,
  Check,
  Loader2,
  Trash2,
  Sparkles,
  Copy,
  BookOpen,
  Cloud,
  Download,
  Bold,
  Italic,
  Heading1,
  Heading2,
  Heading3,
  Code2,
  Terminal,
  Binary,
  List,
  ListOrdered,
  CheckSquare,
  Table as TableIcon,
  Quote,
  AlertCircle,
  ClipboardPaste,
  ChevronDown,
  Layers,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getNote, saveNote } from '@/core/storage';
import { saveUserNoteToCloud } from '@/core/supabase';
import { UserProfile } from '@/core/types';
import { compileGfmToHtml, normalizeLlmMarkdown } from '@/lib/markdown';
import { AllNotesModal } from './AllNotesModal';

export interface NotesTabProps {
  problemId: string;
  problemTitle?: string;
  problemCategory?: string;
  className?: string;
  currentUser?: UserProfile | null;
  onSelectProblem?: (id: string) => void;
  onOpenAllNotes?: () => void;
}

const COMPREHENSIVE_TEMPLATE = `# Solution & Complexity Analysis

## 1. Problem Intuition & Mathematical Model
- **Core Observation**: What is the key invariant, greedy choice, or monotonic property?
- **Archetype / Pattern**: Dynamic Programming, Two Pointers, Fenwick Tree, Monotonic Stack, etc.
- **Reduction**: How does the problem reduce to standard models?

## 2. Algorithm & Step-by-Step Approach
1. **Preprocessing**: Parse constraints and prepare base structures.
2. **Main Strategy**: Iterate or recurse through states.
3. **State Transitions**: Define the recurrence or event handling.
4. **Answer Extraction**: Output optimal answer fitting bounds.

## 3. Complexity Analysis
- **Time Complexity**: $O(N \\log N)$ — Fits within the $1.00\\text{ s}$ limit ($\\approx 10^8$ operations)
- **Auxiliary Space**: $O(N)$ — Memory required by DP tables, trees, or recursion call stack

## 4. Tricky Edge Cases & Invariants
- [ ] $N = 1$ (Minimum input bounds)
- [ ] Integer overflow: Values exceeding $2^{31}-1$ require \`long long\`
- [ ] Extreme boundary cases: Disconnected components, empty input, identical elements

## 5. Reference Implementation (C++)
\`\`\`cpp
#include <bits/stdc++.h>
using namespace std;

void solve() {
    int n;
    if (!(cin >> n)) return;
    // Implementation
}

int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    solve();
    return 0;
}
\`\`\`
`;

const DP_TEMPLATE = `# Dynamic Programming Formulation

## 1. State Definition
- Let $dp[i][j]$ represent:

## 2. Base Cases
- $dp[0][0] = 0$
- All invalid states initialized to $\\infty$ or $-\\infty$

## 3. Recurrence Relation
$$
dp[i][j] = \\min(dp[i-1][j], dp[i-1][j - w_i] + v_i)
$$

## 4. Space Optimization
- Transition depends only on row $i-1 \\implies$ 1D rolling array optimization ($O(M)$ space).

## 5. Complexity
- **Time**: $O(N \\cdot M)$
- **Space**: $O(M)$
`;

const GRAPH_TEMPLATE = `# Graph Algorithm Analysis

## 1. Graph Model
- **Vertices ($V$)**:
- **Edges ($E$)**: Directed / Undirected, Weighted / Unweighted
- **Representation**: Adjacency list \`vector<vector<pair<int, int>>> adj;\`

## 2. Selected Approach
- [ ] BFS / DFS (Unweighted paths / Connected components)
- [ ] Dijkstra with \`priority_queue\` ($O((V + E) \\log V)$)
- [ ] Bellman-Ford / SPFA (Negative edge detection)
- [ ] DSU / Kruskal's MST ($O(E \\alpha(V))$)

## 3. Invariants & Cycle Detection
- Visited states and topo-sort order
`;

export const NotesTab: React.FC<NotesTabProps> = ({
  problemId,
  problemTitle,
  problemCategory,
  className,
  currentUser,
  onSelectProblem,
  onOpenAllNotes,
}) => {
  const [content, setContent] = useState<string>('');
  const [mode, setMode] = useState<'edit' | 'preview' | 'split'>('edit');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'cloud-saved' | 'idle'>('idle');
  const [copied, setCopied] = useState<boolean>(false);
  const [templateMenuOpen, setTemplateMenuOpen] = useState<boolean>(false);
  const [isInternalAllNotesOpen, setIsInternalAllNotesOpen] = useState<boolean>(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastBlurSyncRef = useRef<number>(0);

  // Load note from storage when problemId changes
  useEffect(() => {
    try {
      const saved = getNote(problemId);
      setContent(saved ?? '');
      setSaveStatus('idle');
    } catch {
      setContent('');
    }
  }, [problemId]);

  // Fast, local-only note persistence to localStorage (never sends Supabase requests)
  const saveNoteLocally = useCallback(
    (text: string) => {
      try {
        setSaveStatus('saving');
        saveNote(problemId, text);
        setSaveStatus('saved');
        setTimeout(() => {
          setSaveStatus('idle');
        }, 1500);
      } catch {
        setSaveStatus('idle');
      }
    },
    [problemId]
  );

  // Syncs note to Supabase cloud only once on blur or explicit save if authenticated & 60s cooldown passed
  const syncNoteToCloudIfEligible = useCallback(
    async (text: string) => {
      if (!currentUser?.id) return;
      const now = Date.now();
      if (now - lastBlurSyncRef.current < 60000) {
        return; // Throttled under 1-minute cooldown
      }
      lastBlurSyncRef.current = now;
      try {
        const cloudOk = await saveUserNoteToCloud(currentUser.id, problemId, text);
        if (cloudOk) {
          setSaveStatus('cloud-saved');
          setTimeout(() => {
            setSaveStatus('idle');
          }, 1500);
        }
      } catch {
        // Silently preserve local note
      }
    },
    [currentUser, problemId]
  );

  // Handle changes with debounce - strictly local, zero network requests
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const nextVal = e.target.value;
    setContent(nextVal);
    setSaveStatus('saving');

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveNoteLocally(nextVal);
    }, 600);
  };

  // Immediate save on blur: local write + single throttled cloud sync if eligible
  const handleBlur = () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveNoteLocally(content);
    syncNoteToCloudIfEligible(content);
  };

  // Keyboard shortcut Ctrl+S, Ctrl+B, Ctrl+I
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const isCtrl = isMac ? e.metaKey : e.ctrlKey;

    if (isCtrl && e.key === 's') {
      e.preventDefault();
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveNoteLocally(content);
      syncNoteToCloudIfEligible(content);
    } else if (isCtrl && e.key === 'b') {
      e.preventDefault();
      applyWrapFormat('**', '**', 'bold text');
    } else if (isCtrl && e.key === 'i') {
      e.preventDefault();
      applyWrapFormat('*', '*', 'italic text');
    }
  };

  // Formatting helpers
  const applyWrapFormat = (before: string, after: string = '', defaultText: string = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = content.slice(start, end);
    const textToInsert = selected || defaultText;
    const replacement = `${before}${textToInsert}${after}`;

    const nextVal = content.slice(0, start) + replacement + content.slice(end);
    setContent(nextVal);
    saveNoteLocally(nextVal);

    setTimeout(() => {
      textarea.focus();
      if (selected) {
        textarea.setSelectionRange(start + before.length, end + before.length);
      } else {
        const cursor = start + before.length + defaultText.length;
        textarea.setSelectionRange(cursor, cursor);
      }
    }, 0);
  };

  const applyLinePrefix = (prefix: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const lineStart = content.lastIndexOf('\n', start - 1) + 1;
    const selected = content.slice(start, end);

    if (selected && selected.includes('\n')) {
      const lines = selected.split('\n');
      const prefixed = lines.map((l) => `${prefix}${l}`).join('\n');
      const nextVal = content.slice(0, start) + prefixed + content.slice(end);
      setContent(nextVal);
      saveNoteLocally(nextVal);
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start, start + prefixed.length);
      }, 0);
    } else {
      const nextVal = content.slice(0, lineStart) + prefix + content.slice(lineStart);
      setContent(nextVal);
      saveNoteLocally(nextVal);
      setTimeout(() => {
        textarea.focus();
        const cursor = start + prefix.length;
        textarea.setSelectionRange(cursor, cursor);
      }, 0);
    }
  };

  const insertTableTemplate = () => {
    const tableMd = `\n| State / Case | Time Complexity | Space Complexity | Description |
| :--- | :--- | :--- | :--- |
| Baseline | $O(N^2)$ | $O(1)$ | Brute force simulation |
| Optimal | $O(N \\log N)$ | $O(N)$ | Monotonic stack & coordinate compression |\n`;
    applyWrapFormat(tableMd);
  };

  const insertCalloutAlert = (type: 'NOTE' | 'TIP' | 'IMPORTANT' | 'WARNING' | 'CAUTION') => {
    const alertMd = `\n> [!${type}]\n> Insert ${type.toLowerCase()} guidance or algorithmic invariant here.\n`;
    applyWrapFormat(alertMd);
  };

  const insertTemplate = (templateText: string) => {
    const nextContent = content ? `${content.trim()}\n\n---\n\n${templateText}` : templateText;
    setContent(nextContent);
    saveNoteLocally(nextContent);
    setTemplateMenuOpen(false);
  };

  const handlePasteLlm = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) return;
      const normalized = normalizeLlmMarkdown(text);
      const nextContent = content ? `${content.trim()}\n\n${normalized}` : normalized;
      setContent(nextContent);
      saveNoteLocally(nextContent);
    } catch {
      // Fallback: prompt user
      const pasted = window.prompt('Paste markdown or math solution from ChatGPT / Claude / DeepSeek / Gemini:');
      if (pasted) {
        const normalized = normalizeLlmMarkdown(pasted);
        const nextContent = content ? `${content.trim()}\n\n${normalized}` : normalized;
        setContent(nextContent);
        saveNoteLocally(nextContent);
      }
    }
  };

  const handleClear = () => {
    if (content && window.confirm('Clear all notes for this problem?')) {
      setContent('');
      saveNoteLocally('');
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const handleDownload = () => {
    const titleSlug = problemTitle ? problemTitle.toLowerCase().replace(/[^a-z0-9]/g, '-') : problemId;
    const filename = `cses-${problemId}-${titleSlug}.md`;
    const header = `# CSES #${problemId}${problemTitle ? `: ${problemTitle}` : ''}\n\n`;
    const blob = new Blob([header + content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleOpenAllNotes = () => {
    if (onOpenAllNotes) {
      onOpenAllNotes();
    } else {
      setIsInternalAllNotesOpen(true);
    }
  };

  // Preview container event delegation for code block copy buttons
  const handlePreviewClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const copyBtn = target.closest('.code-copy-btn');
    if (copyBtn) {
      const codeBlock = copyBtn.closest('.code-block');
      const codeElem = codeBlock?.querySelector('code');
      if (codeElem?.textContent) {
        navigator.clipboard.writeText(codeElem.textContent);
        const span = copyBtn.querySelector('.copy-text');
        if (span) {
          const original = span.textContent;
          span.textContent = 'Copied!';
          setTimeout(() => {
            span.textContent = original;
          }, 1500);
        }
      }
    }
  };

  // Compute stats
  const trimmed = content.trim();
  const wordCount = trimmed ? trimmed.split(/\s+/).length : 0;
  const charCount = content.length;
  const readingTime =
    wordCount === 0 ? '0 min read' : wordCount < 100 ? '< 1 min read' : `~${Math.ceil(wordCount / 200)} min read`;

  // Pre-compiled HTML preview
  const compiledHtml = useMemo(() => {
    return compileGfmToHtml(content);
  }, [content]);

  return (
    <div className={cn('flex flex-col h-full space-y-2.5', className)}>
      {/* Top Bar: View Mode Switcher + Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-border-subtle">
        {/* Left: View Mode Toggle */}
        <div className="flex items-center gap-1 p-0.5 rounded-lg bg-surface-2/70 border border-border-subtle">
          <button
            type="button"
            onClick={() => setMode('edit')}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer',
              mode === 'edit'
                ? 'bg-surface-0 text-text-primary shadow-xs'
                : 'text-text-muted hover:text-text-primary'
            )}
            title="Editor only"
          >
            <FileEdit className="w-3.5 h-3.5" />
            <span>Write</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('preview')}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer',
              mode === 'preview'
                ? 'bg-surface-0 text-text-primary shadow-xs'
                : 'text-text-muted hover:text-text-primary'
            )}
            title="Compiled GitHub Markdown and Math preview"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Preview Math</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('split')}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer',
              mode === 'split'
                ? 'bg-surface-0 text-text-primary shadow-xs'
                : 'text-text-muted hover:text-text-primary'
            )}
            title="Side-by-side live editor & real-time compiled preview"
          >
            <Columns className="w-3.5 h-3.5" />
            <span>Split</span>
          </button>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1.5 text-xs">
          {/* Auto-save status badge */}
          <div className="flex items-center gap-1.5 text-[11px] font-mono px-2 py-0.5 rounded bg-surface-2/40 text-text-muted border border-border-subtle">
            {saveStatus === 'saving' ? (
              <>
                <Loader2 className="w-3 h-3 text-accent animate-spin" />
                <span>Saving...</span>
              </>
            ) : saveStatus === 'cloud-saved' ? (
              <>
                <Cloud className="w-3 h-3 text-emerald-400" />
                <span className="text-emerald-400 font-medium">Synced to Cloud</span>
              </>
            ) : saveStatus === 'saved' ? (
              <>
                <Check className="w-3 h-3 text-emerald-400" />
                <span className="text-emerald-400">Saved locally</span>
              </>
            ) : currentUser ? (
              <span className="flex items-center gap-1 text-text-muted">
                <Cloud className="w-3 h-3 text-accent" />
                <span>Cloud Sync ON</span>
              </span>
            ) : (
              <span>Local storage</span>
            )}
          </div>

          {/* Solution Templates Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setTemplateMenuOpen((prev) => !prev)}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-surface-2 hover:bg-surface-3 text-text-primary border border-border-subtle transition-colors text-xs font-medium cursor-pointer"
              title="Insert CSES Solution & Complexity Templates"
            >
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>Template</span>
              <ChevronDown className="w-3 h-3 text-text-muted" />
            </button>

            {templateMenuOpen && (
              <div className="absolute right-0 mt-1 w-64 rounded-lg bg-surface-1 border border-border-subtle shadow-xl p-1 z-30">
                <button
                  type="button"
                  onClick={() => insertTemplate(COMPREHENSIVE_TEMPLATE)}
                  className="w-full text-left px-3 py-2 rounded text-xs text-text-primary hover:bg-surface-2 hover:text-text-primary transition-colors"
                >
                  <div className="font-semibold text-accent">Comprehensive Analysis</div>
                  <div className="text-[10px] text-text-muted">
                    Intuition, Step-by-Step, $O(N \\log N)$, Invariants &amp; C++ Snippet
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => insertTemplate(DP_TEMPLATE)}
                  className="w-full text-left px-3 py-2 rounded text-xs text-text-primary hover:bg-surface-2 hover:text-text-primary transition-colors"
                >
                  <div className="font-semibold text-emerald-400">Dynamic Programming</div>
                  <div className="text-[10px] text-text-muted">
                    States, Recurrences, Transitions &amp; Rolling Array Optimization
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => insertTemplate(GRAPH_TEMPLATE)}
                  className="w-full text-left px-3 py-2 rounded text-xs text-text-primary hover:bg-surface-2 hover:text-text-primary transition-colors"
                >
                  <div className="font-semibold text-purple-400">Graph Theory &amp; Trees</div>
                  <div className="text-[10px] text-text-muted">
                    Adjacency lists, Dijkstra, Topo-sort, and Cycle Invariants
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* Paste LLM Solution Button */}
          <button
            type="button"
            onClick={handlePasteLlm}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-surface-2 hover:bg-surface-3 text-text-primary border border-border-subtle transition-colors text-xs font-medium cursor-pointer"
            title="Paste & auto-format response from ChatGPT, Claude, DeepSeek, or Gemini"
          >
            <ClipboardPaste className="w-3 h-3 text-accent" />
            <span>Paste LLM</span>
          </button>

          {/* View All Notes Button */}
          <button
            type="button"
            onClick={handleOpenAllNotes}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-surface-2 hover:bg-surface-3 text-text-primary border border-border-subtle transition-colors text-xs font-medium cursor-pointer"
            title="Open CSES Notebook (All Problem Notes)"
          >
            <Layers className="w-3 h-3 text-purple-400" />
            <span>View All Notes</span>
          </button>

          {/* Download Note Button */}
          {content && (
            <button
              type="button"
              onClick={handleDownload}
              className="p-1 rounded hover:bg-surface-2 text-text-muted hover:text-text-primary transition-colors cursor-pointer"
              title="Download Note (.md)"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Copy Markdown Button */}
          {content && (
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1 p-1 rounded hover:bg-surface-2 text-text-muted hover:text-text-primary transition-colors cursor-pointer"
              title="Copy Markdown"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          )}

          {/* Clear Button */}
          {content && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 rounded hover:bg-rose-500/10 text-text-muted hover:text-rose-400 transition-colors cursor-pointer"
              title="Clear note"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Rich Markdown & Formatting Toolbar (Shown in 'edit' or 'split' modes) */}
      {(mode === 'edit' || mode === 'split') && (
        <div className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-surface-1 border border-border-subtle text-xs text-text-secondary">
          {/* Headings */}
          <button
            type="button"
            onClick={() => applyLinePrefix('# ')}
            className="p-1.5 rounded hover:bg-surface-2 hover:text-text-primary transition-colors"
            title="Heading 1 (# text)"
          >
            <Heading1 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => applyLinePrefix('## ')}
            className="p-1.5 rounded hover:bg-surface-2 hover:text-text-primary transition-colors"
            title="Heading 2 (## text)"
          >
            <Heading2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => applyLinePrefix('### ')}
            className="p-1.5 rounded hover:bg-surface-2 hover:text-text-primary transition-colors"
            title="Heading 3 (### text)"
          >
            <Heading3 className="w-3.5 h-3.5" />
          </button>

          <div className="w-[1px] h-4 bg-border-subtle mx-0.5" />

          {/* Inline Styles */}
          <button
            type="button"
            onClick={() => applyWrapFormat('**', '**', 'bold text')}
            className="p-1.5 rounded hover:bg-surface-2 hover:text-text-primary transition-colors font-bold"
            title="Bold (**text**) — Ctrl+B"
          >
            <Bold className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => applyWrapFormat('*', '*', 'italic text')}
            className="p-1.5 rounded hover:bg-surface-2 hover:text-text-primary transition-colors italic"
            title="Italic (*text*) — Ctrl+I"
          >
            <Italic className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => applyWrapFormat('`', '`', 'code')}
            className="p-1.5 rounded hover:bg-surface-2 hover:text-text-primary transition-colors font-mono"
            title="Inline Code (`code`)"
          >
            <Code2 className="w-3.5 h-3.5 text-amber-300" />
          </button>

          <div className="w-[1px] h-4 bg-border-subtle mx-0.5" />

          {/* Math KaTeX */}
          <button
            type="button"
            onClick={() => applyWrapFormat('$', '$', 'O(N \\log N)')}
            className="flex items-center gap-0.5 px-1.5 py-1 rounded hover:bg-surface-2 hover:text-text-primary transition-colors font-mono text-[11px]"
            title="Inline LaTeX Math ($formula$)"
          >
            <span className="font-serif italic font-bold text-accent">$</span>
            <span>Math</span>
          </button>
          <button
            type="button"
            onClick={() =>
              applyWrapFormat('\n$$\n', '\n$$\n', 'dp[i][j] = \\min(dp[i-1][j], dp[i][j-w_i] + v_i)')
            }
            className="flex items-center gap-0.5 px-1.5 py-1 rounded hover:bg-surface-2 hover:text-text-primary transition-colors font-mono text-[11px]"
            title="Block LaTeX Math ($$formula$$)"
          >
            <span className="font-serif italic font-bold text-accent">$$</span>
            <span>Block</span>
          </button>

          <div className="w-[1px] h-4 bg-border-subtle mx-0.5" />

          {/* Code Block */}
          <button
            type="button"
            onClick={() =>
              applyWrapFormat(
                '\n```cpp\n// C++ Solution Snippet\n#include <bits/stdc++.h>\nusing namespace std;\n\n',
                '\n```\n',
                'int main() {\n    return 0;\n}'
              )
            }
            className="p-1.5 rounded hover:bg-surface-2 hover:text-text-primary transition-colors font-mono"
            title="Fenced Code Block (```cpp ... ```)"
          >
            <Terminal className="w-3.5 h-3.5 text-emerald-400" />
          </button>

          {/* Lists & Tasks */}
          <button
            type="button"
            onClick={() => applyLinePrefix('- ')}
            className="p-1.5 rounded hover:bg-surface-2 hover:text-text-primary transition-colors"
            title="Bullet List (- item)"
          >
            <List className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => applyLinePrefix('1. ')}
            className="p-1.5 rounded hover:bg-surface-2 hover:text-text-primary transition-colors"
            title="Numbered List (1. item)"
          >
            <ListOrdered className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => applyLinePrefix('- [ ] ')}
            className="p-1.5 rounded hover:bg-surface-2 hover:text-text-primary transition-colors"
            title="Task Checklist (- [ ] item)"
          >
            <CheckSquare className="w-3.5 h-3.5 text-accent" />
          </button>

          <div className="w-[1px] h-4 bg-border-subtle mx-0.5" />

          {/* Table & Quotes */}
          <button
            type="button"
            onClick={insertTableTemplate}
            className="p-1.5 rounded hover:bg-surface-2 hover:text-text-primary transition-colors"
            title="Insert Markdown Table"
          >
            <TableIcon className="w-3.5 h-3.5 text-amber-400" />
          </button>
          <button
            type="button"
            onClick={() => applyLinePrefix('> ')}
            className="p-1.5 rounded hover:bg-surface-2 hover:text-text-primary transition-colors"
            title="Blockquote (> quote)"
          >
            <Quote className="w-3.5 h-3.5" />
          </button>

          {/* GitHub Callouts */}
          <button
            type="button"
            onClick={() => insertCalloutAlert('NOTE')}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-surface-2 hover:text-text-primary text-[11px] text-accent transition-colors"
            title="GitHub Callout Note (> [!NOTE])"
          >
            <AlertCircle className="w-3 h-3" />
            <span>Note</span>
          </button>
          <button
            type="button"
            onClick={() => insertCalloutAlert('WARNING')}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-surface-2 hover:text-text-primary text-[11px] text-amber-400 transition-colors"
            title="GitHub Callout Warning (> [!WARNING])"
          >
            <span>Warn</span>
          </button>
        </div>
      )}

      {/* Editor / Preview Area */}
      <div className="flex-1 min-h-[340px]">
        {mode === 'edit' && (
          <div className="h-full flex flex-col">
            <textarea
              ref={textareaRef}
              value={content}
              onChange={handleChange}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              placeholder="Jot down algorithm ideas, mathematical observations, recurrence relations like $dp[i] = dp[i-1] + ...$, or tricky corner cases here. Notes persist automatically across all your devices when signed in."
              className="w-full h-full min-h-[340px] p-3.5 rounded-lg bg-surface-0 border border-border-subtle text-text-primary placeholder-slate-500 text-sm font-mono leading-relaxed focus:outline-hidden focus:border-accent/50 resize-y"
            />
          </div>
        )}

        {mode === 'preview' && (
          <div
            onClick={handlePreviewClick}
            className="h-full min-h-[340px] p-4 rounded-lg bg-surface-0/70 border border-border-subtle overflow-y-auto"
          >
            {content.trim() ? (
              <div
                className="prose prose-invert max-w-none text-text-primary text-sm leading-relaxed"
                dangerouslySetInnerHTML={{ __html: compiledHtml }}
              />
            ) : (
              <div className="py-12 text-center text-text-muted text-xs">
                <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-40 text-text-muted" />
                No notes to preview yet. Switch to "Write" to start typing.
              </div>
            )}
          </div>
        )}

        {mode === 'split' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 h-full min-h-[340px]">
            {/* Left: Live Textarea */}
            <div className="h-full flex flex-col">
              <textarea
                ref={textareaRef}
                value={content}
                onChange={handleChange}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                placeholder="Type markdown or paste LLM solution..."
                className="w-full h-full min-h-[340px] p-3.5 rounded-lg bg-surface-0 border border-border-subtle text-text-primary placeholder-slate-500 text-sm font-mono leading-relaxed focus:outline-hidden focus:border-accent/50 resize-y"
              />
            </div>

            {/* Right: Real-time Compiled GFM + Math Preview */}
            <div
              onClick={handlePreviewClick}
              className="h-full min-h-[340px] p-4 rounded-lg bg-surface-0/70 border border-border-subtle overflow-y-auto"
            >
              {content.trim() ? (
                <div
                  className="prose prose-invert max-w-none text-text-primary text-sm leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: compiledHtml }}
                />
              ) : (
                <div className="py-12 text-center text-text-muted text-xs">
                  <BookOpen className="w-7 h-7 mx-auto mb-2 opacity-40 text-text-muted" />
                  Live preview will render here as you type.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Stats & Info Footer */}
      <div className="flex items-center justify-between text-[11px] text-text-muted pt-1 border-t border-border-subtle">
        <div className="flex items-center gap-3 font-mono">
          <span>
            {wordCount} words · {charCount} chars
          </span>
          <span className="text-text-muted">•</span>
          <span className="text-text-muted">{readingTime}</span>
        </div>
        <span className="text-[11px] text-text-muted">
          Markdown and LaTeX ($formula$) supported
        </span>
      </div>

      {/* Internal All Notes Modal fallback if no external opener provided */}
      {!onOpenAllNotes && (
        <AllNotesModal
          isOpen={isInternalAllNotesOpen}
          onClose={() => setIsInternalAllNotesOpen(false)}
          onSelectProblem={onSelectProblem}
          currentProblemId={problemId}
        />
      )}
    </div>
  );
};

export default NotesTab;
