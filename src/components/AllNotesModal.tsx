'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Search,
  X,
  FileText,
  BookOpen,
  Download,
  ExternalLink,
  Trash2,
  Copy,
  Check,
  Calendar,
  Filter,
  Clock,
  Sparkles,
  Edit3,
  Eye,
  FileDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getAllNotesList, saveNote } from '@/core/storage';
import { Problem, NoteEntry } from '@/core/types';
import problemsData from '@/data/problems.json';
import { compileGfmToHtml } from '@/lib/markdown';

export interface AllNotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectProblem?: (problemId: string) => void;
  currentProblemId?: string;
  allProblems?: Problem[];
}

interface NoteWithMeta extends NoteEntry {
  problemTitle: string;
  category: string;
  wordCount: number;
  charCount: number;
}

export const AllNotesModal: React.FC<AllNotesModalProps> = ({
  isOpen,
  onClose,
  onSelectProblem,
  currentProblemId,
  allProblems,
}) => {
  const [notes, setNotes] = useState<NoteEntry[]>(() => {
    try {
      return getAllNotesList();
    } catch {
      return [];
    }
  });
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [activeViewMode, setActiveViewMode] = useState<'preview' | 'edit'>('preview');
  const [editContent, setEditContent] = useState<string>('');
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [exportDropdownOpen, setExportDropdownOpen] = useState<boolean>(false);

  // Problem metadata mapping
  const problemMap = useMemo(() => {
    const list = (allProblems && allProblems.length > 0 ? allProblems : (problemsData as Problem[]));
    const map = new Map<string, Problem>();
    for (const p of list) {
      map.set(p.id, p);
    }
    return map;
  }, [allProblems]);

  // Load all notes whenever modal opens
  const refreshNotes = useCallback(() => {
    try {
      const all = getAllNotesList();
      setNotes(all);
      if (all.length > 0) {
        if (currentProblemId && all.some((n) => n.problemId === currentProblemId)) {
          setActiveNoteId(currentProblemId);
        } else if (!activeNoteId || !all.some((n) => n.problemId === activeNoteId)) {
          setActiveNoteId(all[0].problemId);
        }
      } else {
        setActiveNoteId(null);
      }
    } catch {
      setNotes([]);
      setActiveNoteId(null);
    }
  }, [currentProblemId, activeNoteId]);

  useEffect(() => {
    if (isOpen) {
      refreshNotes();
      setActiveViewMode('preview');
      setExportDropdownOpen(false);
    }
  }, [isOpen, refreshNotes]);

  // Sync editContent when active note changes
  useEffect(() => {
    if (activeNoteId) {
      const active = notes.find((n) => n.problemId === activeNoteId);
      if (active) {
        setEditContent(active.content);
      }
    }
  }, [activeNoteId, notes]);

  // Escape key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Enrich notes with problem titles and categories
  const enrichedNotes: NoteWithMeta[] = useMemo(() => {
    return notes.map((n) => {
      const prob = problemMap.get(n.problemId);
      const text = n.content.trim();
      const wordCount = text ? text.split(/\s+/).length : 0;
      return {
        ...n,
        problemTitle: prob?.title || `Problem #${n.problemId}`,
        category: prob?.category || 'General',
        wordCount,
        charCount: n.content.length,
      };
    });
  }, [notes, problemMap]);

  // Categories list
  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    for (const n of enrichedNotes) {
      if (n.category) set.add(n.category);
    }
    return Array.from(set).sort();
  }, [enrichedNotes]);

  // Filtered notes
  const filteredNotes = useMemo(() => {
    return enrichedNotes.filter((n) => {
      if (selectedCategory !== 'all' && n.category !== selectedCategory) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesId = n.problemId.toLowerCase().includes(q);
        const matchesTitle = n.problemTitle.toLowerCase().includes(q);
        const matchesCategory = n.category.toLowerCase().includes(q);
        const matchesContent = n.content.toLowerCase().includes(q);
        return matchesId || matchesTitle || matchesCategory || matchesContent;
      }
      return true;
    });
  }, [enrichedNotes, selectedCategory, searchQuery]);

  const activeNote = useMemo(() => {
    return enrichedNotes.find((n) => n.problemId === activeNoteId) || filteredNotes[0] || null;
  }, [enrichedNotes, activeNoteId, filteredNotes]);

  const handleSaveInlineEdit = () => {
    if (!activeNote) return;
    saveNote(activeNote.problemId, editContent);
    refreshNotes();
    setActiveViewMode('preview');
  };

  const handleDeleteNote = (problemId: string, title: string) => {
    if (window.confirm(`Are you sure you want to delete notes for "${title}" (#${problemId})?`)) {
      saveNote(problemId, '');
      refreshNotes();
    }
  };

  const handleCopyNote = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const handleDownloadSingleNote = (note: NoteWithMeta) => {
    const filename = `cses-${note.problemId}-${note.problemTitle.toLowerCase().replace(/[^a-z0-9]/g, '-')}.md`;
    const header = `# CSES #${note.problemId}: ${note.problemTitle}\nCategory: ${note.category}\n\n---\n\n`;
    const fullText = header + note.content;
    const blob = new Blob([fullText], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportDigestMarkdown = () => {
    if (enrichedNotes.length === 0) return;
    const dateStr = new Date().toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });

    let doc = `# CSES Problem Set — Master Solutions Notebook\n`;
    doc += `*Generated on ${dateStr} • Total Notes: ${enrichedNotes.length}*\n\n`;
    doc += `---\n\n`;

    for (const n of enrichedNotes) {
      doc += `## Problem #${n.problemId}: ${n.problemTitle}\n`;
      doc += `**Category:** ${n.category}  \n`;
      doc += `**Words:** ${n.wordCount}  \n\n`;
      doc += `${n.content.trim()}\n\n`;
      doc += `---\n\n`;
    }

    const blob = new Blob([doc], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cses-notes-digest-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
    setExportDropdownOpen(false);
  };

  const handleExportJson = () => {
    if (enrichedNotes.length === 0) return;
    const exportData = {
      exportedAt: new Date().toISOString(),
      totalNotes: enrichedNotes.length,
      notes: enrichedNotes.map((n) => ({
        problemId: n.problemId,
        problemTitle: n.problemTitle,
        category: n.category,
        content: n.content,
        wordCount: n.wordCount,
        charCount: n.charCount,
        updatedAt: n.updatedAt,
      })),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cses-notes-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setExportDropdownOpen(false);
  };

  // Preview click delegator for copy buttons inside code blocks
  const handlePreviewContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
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

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="all-notes-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div
        className="relative flex flex-col w-full max-w-6xl h-[90vh] rounded-xl bg-surface-0 border border-border-subtle shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border-subtle bg-surface-1/90">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-accent/10 border border-accent/20 text-accent">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h2 id="all-notes-modal-title" className="text-sm font-semibold text-text-primary flex items-center gap-2">
                <span>CSES Notebook — All Problem Notes</span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-mono bg-surface-2 text-text-secondary border border-border-subtle">
                  {enrichedNotes.length} {enrichedNotes.length === 1 ? 'note' : 'notes'}
                </span>
              </h2>
              <p className="text-[11px] text-text-muted">
                Browse, search, edit, and export your personal algorithm analyses and KaTeX mathematical models.
              </p>
            </div>
          </div>

          {/* Right Header: Export & Close */}
          <div className="flex items-center gap-2">
            {enrichedNotes.length > 0 && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setExportDropdownOpen((prev) => !prev)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-2 hover:bg-surface-3 text-text-primary border border-border-subtle text-xs font-medium transition-colors"
                >
                  <Download className="w-3.5 h-3.5 text-accent" />
                  <span>Export Notes</span>
                </button>

                {exportDropdownOpen && (
                  <div className="absolute right-0 mt-1.5 w-56 rounded-lg bg-surface-1 border border-border-subtle shadow-xl p-1 z-20">
                    <button
                      type="button"
                      onClick={handleExportDigestMarkdown}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded text-xs text-text-primary hover:bg-surface-2 hover:text-white transition-colors text-left"
                    >
                      <FileDown className="w-3.5 h-3.5 text-emerald-400" />
                      <div>
                        <div className="font-medium">Markdown Digest (.md)</div>
                        <div className="text-[10px] text-text-muted">One comprehensive cheatsheet</div>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={handleExportJson}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded text-xs text-text-primary hover:bg-surface-2 hover:text-white transition-colors text-left"
                    >
                      <FileText className="w-3.5 h-3.5 text-amber-400" />
                      <div>
                        <div className="font-medium">Raw Backup (.json)</div>
                        <div className="text-[10px] text-text-muted">Machine-readable JSON data</div>
                      </div>
                    </button>
                  </div>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-2 transition-colors"
              title="Close modal (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter & Search Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-2.5 border-b border-border-subtle bg-surface-1/40 text-xs">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search across title, problem ID, category, or note content..."
              className="w-full pl-9 pr-8 py-1.5 rounded-lg bg-surface-0 border border-border-subtle text-text-primary placeholder-slate-500 text-xs focus:outline-hidden focus:border-accent/50"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-text-muted" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg bg-surface-0 border border-border-subtle text-text-primary text-xs focus:outline-hidden focus:border-accent/50"
            >
              <option value="all">All Categories ({enrichedNotes.length})</option>
              {availableCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Main Body: Split View (List on Left, Reader/Editor on Right) */}
        <div className="flex-1 flex overflow-hidden">
          {enrichedNotes.length === 0 ? (
            /* Empty State: No Notes */
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-surface-2 border border-border-subtle text-text-muted mb-4">
                <BookOpen className="w-7 h-7 stroke-[1.5]" />
              </div>
              <h3 className="text-base font-semibold text-text-primary mb-1">No notes recorded yet</h3>
              <p className="text-xs text-text-muted max-w-md mb-5 leading-relaxed">
                Take notes on your approaches, mathematical recurrences, and edge cases in the "Notes" tab of any problem pane. All notes automatically persist and sync here.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-accent hover:bg-accent text-white text-xs font-medium transition-colors shadow-xs"
              >
                Return to Problem Set
              </button>
            </div>
          ) : filteredNotes.length === 0 ? (
            /* Empty State: Filter matched nothing */
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <Search className="w-8 h-8 text-text-muted mb-2 opacity-50" />
              <p className="text-sm font-medium text-text-secondary">No notes matched your search</p>
              <p className="text-xs text-text-muted mt-1">Try searching for a different keyword or category.</p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('all');
                }}
                className="mt-4 px-3 py-1.5 rounded-lg bg-surface-2 hover:bg-surface-3 text-text-secondary text-xs border border-border-subtle transition-colors"
              >
                Clear Filters
              </button>
            </div>
          ) : (
            <>
              {/* Left Column: Note Cards List */}
              <div className="w-80 sm:w-96 shrink-0 border-r border-border-subtle overflow-y-auto p-3 space-y-2.5 bg-surface-1/30">
                <div className="text-[11px] font-medium text-text-muted px-1 flex items-center justify-between">
                  <span>
                    Showing {filteredNotes.length} of {enrichedNotes.length} notes
                  </span>
                </div>

                {filteredNotes.map((note) => {
                  const isSelected = activeNote?.problemId === note.problemId;
                  const snippet = note.content
                    .replace(/^[#>\s\-*`]+/gm, '')
                    .replace(/\n+/g, ' ')
                    .slice(0, 110);

                  return (
                    <div
                      key={note.problemId}
                      onClick={() => {
                        setActiveNoteId(note.problemId);
                        setActiveViewMode('preview');
                      }}
                      className={cn(
                        'group p-3 rounded-lg border text-left cursor-pointer transition-all',
                        isSelected
                          ? 'bg-surface-2 border-accent/60 shadow-xs ring-1 ring-accent/30'
                          : 'bg-surface-0/60 hover:bg-surface-2/60 border-border-subtle hover:border-slate-600'
                      )}
                    >
                      {/* Top Badges */}
                      <div className="flex items-center justify-between gap-1.5 mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-semibold text-xs text-accent">
                            #{note.problemId}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-3/80 text-text-secondary font-medium">
                            {note.category}
                          </span>
                        </div>
                        <span className="text-[10px] text-text-muted font-mono">
                          {note.wordCount} w
                        </span>
                      </div>

                      {/* Title */}
                      <h4 className="text-xs font-semibold text-text-primary line-clamp-1 mb-1 group-hover:text-white">
                        {note.problemTitle}
                      </h4>

                      {/* Snippet */}
                      <p className="text-[11px] text-text-muted line-clamp-2 leading-relaxed">
                        {snippet || 'No written content.'}
                      </p>

                      {/* Footer Actions */}
                      <div className="flex items-center justify-between pt-2 mt-2 border-t border-border-subtle/50 text-[10px] text-text-muted">
                        <span className="flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />
                          <span>
                            {note.updatedAt
                              ? new Date(note.updatedAt).toLocaleDateString(undefined, {
                                  month: 'short',
                                  day: 'numeric',
                                })
                              : 'Saved'}
                          </span>
                        </span>

                        {onSelectProblem && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectProblem(note.problemId);
                              onClose();
                            }}
                            className="flex items-center gap-1 text-text-muted hover:text-accent transition-colors"
                            title="Jump to problem"
                          >
                            <span>Open</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Right Column: Full Reader & Editor */}
              <div className="flex-1 flex flex-col overflow-hidden bg-surface-0">
                {activeNote ? (
                  <>
                    {/* Active Note Top Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 border-b border-border-subtle bg-surface-1/50">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-sm text-accent">
                            #{activeNote.problemId}
                          </span>
                          <h3 className="text-sm font-semibold text-text-primary">
                            {activeNote.problemTitle}
                          </h3>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-text-muted mt-0.5">
                          <span className="text-text-muted">{activeNote.category}</span>
                          <span>•</span>
                          <span>{activeNote.wordCount} words</span>
                          <span>•</span>
                          <span>{activeNote.charCount} characters</span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1.5 text-xs">
                        {/* View Mode Toggle */}
                        <div className="flex items-center p-0.5 rounded-lg bg-surface-2 border border-border-subtle">
                          <button
                            type="button"
                            onClick={() => setActiveViewMode('preview')}
                            className={cn(
                              'flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors',
                              activeViewMode === 'preview'
                                ? 'bg-surface-0 text-text-primary shadow-xs'
                                : 'text-text-muted hover:text-text-primary'
                            )}
                          >
                            <Eye className="w-3 h-3" />
                            <span>Preview</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveViewMode('edit')}
                            className={cn(
                              'flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors',
                              activeViewMode === 'edit'
                                ? 'bg-surface-0 text-text-primary shadow-xs'
                                : 'text-text-muted hover:text-text-primary'
                            )}
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>Edit</span>
                          </button>
                        </div>

                        {/* Copy Markdown */}
                        <button
                          type="button"
                          onClick={() => handleCopyNote(activeNote.content)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded bg-surface-2 hover:bg-surface-3 text-text-secondary border border-border-subtle transition-colors"
                          title="Copy markdown text"
                        >
                          {isCopied ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                          <span>Copy</span>
                        </button>

                        {/* Download Single Note */}
                        <button
                          type="button"
                          onClick={() => handleDownloadSingleNote(activeNote)}
                          className="p-1.5 rounded hover:bg-surface-2 text-text-muted hover:text-text-primary transition-colors"
                          title="Download note as .md"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete Note */}
                        <button
                          type="button"
                          onClick={() => handleDeleteNote(activeNote.problemId, activeNote.problemTitle)}
                          className="p-1.5 rounded hover:bg-rose-500/10 text-text-muted hover:text-rose-400 transition-colors"
                          title="Delete note"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>

                        {/* Jump to Problem Button */}
                        {onSelectProblem && (
                          <button
                            type="button"
                            onClick={() => {
                              onSelectProblem(activeNote.problemId);
                              onClose();
                            }}
                            className="flex items-center gap-1 px-3 py-1 rounded bg-accent hover:bg-accent text-white font-medium transition-colors shadow-xs ml-1"
                          >
                            <span>Open Problem</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Content Pane */}
                    <div className="flex-1 overflow-y-auto p-5">
                      {activeViewMode === 'preview' ? (
                        <div
                          onClick={handlePreviewContainerClick}
                          className="prose prose-invert max-w-none text-text-primary text-sm leading-relaxed"
                          dangerouslySetInnerHTML={{
                            __html: compileGfmToHtml(activeNote.content),
                          }}
                        />
                      ) : (
                        <div className="flex flex-col h-full space-y-3">
                          <textarea
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            className="w-full flex-1 min-h-[350px] p-4 rounded-lg bg-surface-1 border border-border-subtle text-text-primary font-mono text-xs leading-relaxed focus:outline-hidden focus:border-accent/50 resize-y"
                          />
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setEditContent(activeNote.content);
                                setActiveViewMode('preview');
                              }}
                              className="px-3 py-1.5 rounded-lg bg-surface-2 hover:bg-surface-3 text-text-secondary text-xs border border-border-subtle transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={handleSaveInlineEdit}
                              className="px-4 py-1.5 rounded-lg bg-accent hover:bg-accent text-white text-xs font-medium transition-colors shadow-xs"
                            >
                              Save Changes
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-text-muted text-xs">
                    Select a note from the left to view details.
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AllNotesModal;
