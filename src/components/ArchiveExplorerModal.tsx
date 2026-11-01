'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Database,
  Search,
  Filter,
  ArrowUpDown,
  Download,
  ExternalLink,
  Flame,
  CheckCircle,
  FileCode,
  Loader2,
} from 'lucide-react';
import { CsesArchiveEntry } from '@/core/types';
import { categories } from '@/data/categories';

interface ArchiveExplorerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectProblem?: (problemId: string) => void;
}

export function ArchiveExplorerModal({
  isOpen,
  onClose,
  onSelectProblem,
}: ArchiveExplorerModalProps) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [sortBy, setSortBy] = useState<'id' | 'solved' | 'rate'>('id');
  const [items, setItems] = useState<CsesArchiveEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const fetchArchive = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set('q', query.trim());
      if (category) params.set('category', category);
      params.set('sort', sortBy);
      params.set('limit', '60');

      const res = await fetch(`/api/archive?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
        setTotal(data.total || 0);
      }
    } catch (err) {
      console.error('[Archive Explorer] Error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchArchive();
    }
  }, [isOpen, category, sortBy]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchArchive();
  };

  const handleDownloadArchive = () => {
    const jsonStr = JSON.stringify(items, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cses_archive_export_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl bg-zinc-900 border border-zinc-700/80 rounded-2xl shadow-2xl overflow-hidden text-zinc-100 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/90 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-purple-500/10 text-purple-400 rounded-lg border border-purple-500/20">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-base text-zinc-100 flex items-center gap-2">
                CSES Continuous Mirror & Archive
                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 font-mono">
                  GitHub Synchronized
                </span>
              </h3>
              <p className="text-xs text-zinc-400">
                Explore historical stats, record holders, and limits for all problems
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadArchive}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-lg text-xs font-medium border border-zinc-700 transition-colors"
              title="Export query results as JSON"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export JSON</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filters & Search Toolbar */}
        <div className="p-4 border-b border-zinc-800 bg-zinc-900/50 flex flex-wrap items-center gap-3">
          <form onSubmit={handleSearchSubmit} className="flex-1 min-w-[200px] relative">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search problem title or ID..."
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl pl-9 pr-4 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-purple-500 transition-colors"
            />
          </form>

          {/* Category Dropdown */}
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-purple-500"
          >
            <option value="">All Categories ({categories.length})</option>
            {categories.map((c) => (
              <option key={c.id} value={c.name.toLowerCase()}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Sort Dropdown */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-purple-500"
          >
            <option value="id">Sort: Problem ID</option>
            <option value="solved">Sort: Most Solved</option>
            <option value="rate">Sort: Success Rate</option>
          </select>

          <button
            onClick={fetchArchive}
            disabled={isLoading}
            className="px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-medium transition-colors"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
          </button>
        </div>

        {/* Items Grid */}
        <div className="p-6 overflow-y-auto space-y-3">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>Showing {items.length} of {total} archive records</span>
            <span>Continuous Mirror: Active</span>
          </div>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 text-zinc-500 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
              <p className="text-xs">Querying CSES archive database...</p>
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-16 text-zinc-500 text-xs">
              No matching archive records found.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {items.map((item) => (
                <div
                  key={item.problemId}
                  className="p-4 bg-zinc-800/40 hover:bg-zinc-800/70 border border-zinc-700/60 rounded-xl transition-all flex flex-col justify-between group"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-purple-400">
                            #{item.problemId}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-700/60 text-zinc-300">
                            {item.category}
                          </span>
                        </div>
                        <h4 className="font-semibold text-sm text-zinc-100 group-hover:text-purple-300 transition-colors mt-1">
                          {item.title}
                        </h4>
                      </div>

                      <button
                        onClick={() => {
                          if (onSelectProblem) {
                            onSelectProblem(item.problemId);
                            onClose();
                          }
                        }}
                        className="p-1.5 bg-zinc-700/50 hover:bg-purple-600 text-zinc-300 hover:text-white rounded-lg transition-colors text-xs font-medium"
                        title="Open in Workspace"
                      >
                        Solve
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-zinc-700/40 text-center text-xs">
                      <div className="p-1.5 bg-zinc-900/40 rounded-lg">
                        <div className="text-zinc-400 text-[10px]">Solved By</div>
                        <div className="font-semibold text-zinc-200">
                          {item.solvedBy ? item.solvedBy.toLocaleString() : 'N/A'}
                        </div>
                      </div>
                      <div className="p-1.5 bg-zinc-900/40 rounded-lg">
                        <div className="text-zinc-400 text-[10px]">Success Rate</div>
                        <div className="font-semibold text-emerald-400">
                          {item.successRate || '0.0%'}
                        </div>
                      </div>
                      <div className="p-1.5 bg-zinc-900/40 rounded-lg">
                        <div className="text-zinc-400 text-[10px]">Time Limit</div>
                        <div className="font-semibold text-amber-400">
                          {item.timeLimit}
                        </div>
                      </div>
                    </div>

                    {/* Fastest & Shortest champions if available */}
                    {(item.fastest?.length > 0 || item.shortest?.length > 0) && (
                      <div className="mt-2.5 pt-2 border-t border-zinc-700/30 flex items-center justify-between text-[11px] text-zinc-400">
                        {item.fastest?.[0] && (
                          <span className="truncate">
                            ⚡ Fastest: <strong className="text-zinc-200">{item.fastest[0].user}</strong> ({item.fastest[0].score})
                          </span>
                        )}
                        {item.shortest?.[0] && (
                          <span className="truncate ml-2 text-right">
                            ⛳ Shortest: <strong className="text-zinc-200">{item.shortest[0].user}</strong> ({item.shortest[0].score})
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
