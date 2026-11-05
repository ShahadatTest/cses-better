'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Code2,
  Terminal,
  Play,
  Pause,
  Square,
  Send,
  Sparkles,
  Copy,
  Check,
  RotateCcw,
  Maximize2,
  Minimize2,
  Loader2,
  Columns,
  ChevronDown,
  FileDown,
  Bot,
} from 'lucide-react';
import { LanguageId } from '@/core/types';
import { cn } from '@/lib/utils';
import { SUPPORTED_LANGUAGES, getLanguageConfig } from '@/core/templates';
import { extractCodeFromMarkdown } from '@/core/markdown-code';
import MonacoEditorView from './MonacoEditorView';
import InbuiltCompilerView from './InbuiltCompilerView';

export interface EditorWorkbenchProps {
  code: string;
  onChange: (code: string) => void;
  language: LanguageId;
  onLanguageChange: (lang: LanguageId) => void;
  onResetTemplate: () => void;
  onRun: () => void;
  onSubmit: () => void;
  onSubmitCses?: () => void;
  problemId?: string;
  problemTitle?: string;
  isRunning?: boolean;
  isSubmitting?: boolean;
  isPaused?: boolean;
  onPauseResume?: () => void;
  onCancel?: () => void;
  fontSize?: number;
  apiKey?: string;
  widgetKey?: string;
  onSaveWidgetKey?: (key: string) => void;
  isVimMode?: boolean;
  className?: string;
  defaultEditorMode?: 'monaco' | 'embed';
}

export const EditorWorkbench: React.FC<EditorWorkbenchProps> = ({
  code,
  onChange,
  language,
  onLanguageChange,
  onResetTemplate,
  onRun,
  onSubmit,
  onSubmitCses,
  problemId,
  problemTitle,
  isRunning = false,
  isSubmitting = false,
  isPaused = false,
  onPauseResume,
  onCancel,
  fontSize: initialFontSize = 14,
  apiKey,
  widgetKey,
  onSaveWidgetKey,
  isVimMode = false,
  className = '',
  defaultEditorMode = 'monaco',
}) => {
  const [editorMode, setEditorMode] = useState<'monaco' | 'embed'>(defaultEditorMode);
  const [isZenMode, setIsZenMode] = useState(false);
  const [minimap, setMinimap] = useState(false);
  const [copied, setCopied] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [currentFontSize, setCurrentFontSize] = useState(initialFontSize);
  const [llmNotice, setLlmNotice] = useState<string | null>(null);

  const editorInstanceRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Cleans LLM markdown fences or extracts pure code from clipboard
  const handleCleanLlmMarkdown = async () => {
    // 1. If current editor already contains markdown fences, clean in place
    const currentExtracted = extractCodeFromMarkdown(code, language);
    if (currentExtracted.wasMarkdown && currentExtracted.code) {
      onChange(currentExtracted.code);
      if (currentExtracted.detectedLanguage && currentExtracted.detectedLanguage !== language) {
        onLanguageChange(currentExtracted.detectedLanguage);
      }
      setLlmNotice(
        `✨ Cleaned Markdown fences! Extracted pure ${currentExtracted.detectedLanguage || language} code.`
      );
      setTimeout(() => setLlmNotice(null), 4000);
      return;
    }

    // 2. Otherwise read from clipboard
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        const text = await navigator.clipboard.readText();
        if (text) {
          const clipExtracted = extractCodeFromMarkdown(text, language);
          if (clipExtracted.wasMarkdown && clipExtracted.code) {
            onChange(clipExtracted.code);
            if (clipExtracted.detectedLanguage && clipExtracted.detectedLanguage !== language) {
              onLanguageChange(clipExtracted.detectedLanguage);
            }
            setLlmNotice(
              `✨ Pasted from LLM! Extracted pure ${clipExtracted.detectedLanguage || language} code.`
            );
            setTimeout(() => setLlmNotice(null), 4000);
            return;
          } else if (text.trim()) {
            onChange(text);
            setLlmNotice('Pasted code from clipboard');
            setTimeout(() => setLlmNotice(null), 3000);
            return;
          }
        }
      }
    } catch {
      // Clipboard access blocked
    }

    setLlmNotice('No LLM Markdown code detected in editor or clipboard');
    setTimeout(() => setLlmNotice(null), 3000);
  };

  // Compute filename based on problem and language
  const downloadFilename = useMemo(() => {
    const config = getLanguageConfig(language);
    const ext = config.extension;
    if (language === 'java') {
      // CSES standard requires Main.java for Java submissions
      return 'Main.java';
    }
    const cleanTitle = problemTitle
      ? problemTitle
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '_')
          .replace(/^_+|_+$/g, '')
      : 'solution';
    return problemId ? `${problemId}_${cleanTitle}${ext}` : `${cleanTitle}${ext}`;
  }, [language, problemId, problemTitle]);

  // Download code file handler
  const handleDownloadCode = () => {
    try {
      const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = downloadFilename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setDownloaded(true);
      setTimeout(() => setDownloaded(false), 2000);
    } catch (err) {
      console.error('Failed to download file', err);
    }
  };

  // Sync font size if parent changes it
  useEffect(() => {
    if (initialFontSize) {
      setCurrentFontSize(initialFontSize);
    }
  }, [initialFontSize]);

  // Handle keyboard shortcuts globally when workbench has focus
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape exits Zen mode
      if (e.key === 'Escape' && isZenMode) {
        setIsZenMode(false);
        return;
      }

      // Check for Ctrl+Enter or Cmd+Enter
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (e.shiftKey) {
          if (!isRunning && !isSubmitting) {
            onSubmit();
          }
        } else {
          if (!isRunning && !isSubmitting) {
            onRun();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isZenMode, isRunning, isSubmitting, onRun, onSubmit]);

  // Copy code handler with feedback
  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard fallback
      const textarea = document.createElement('textarea');
      textarea.value = code;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Format code handler using Monaco action
  const handleFormatCode = async () => {
    if (editorMode !== 'monaco' || !editorInstanceRef.current) return;
    try {
      const formatAction = editorInstanceRef.current.getAction('editor.action.formatDocument');
      if (formatAction) {
        await formatAction.run();
      }
    } catch (e) {
      console.warn('Formatting failed:', e);
    }
  };

  // Reset to template handler
  const handleReset = () => {
    if (
      code.trim().length > 0 &&
      window.confirm('Reset current solution back to the language starting template?')
    ) {
      onResetTemplate();
    } else if (code.trim().length === 0) {
      onResetTemplate();
    }
  };

  // Calculate lines and character metrics
  const lineCount = useMemo(() => code.split('\n').length, [code]);

  return (
    <div
      ref={containerRef}
      className={`flex flex-col bg-surface-0 border border-surface-2 rounded-lg transition-all ${
        isZenMode
          ? 'fixed inset-0 z-50 w-screen h-screen rounded-none border-0'
          : 'relative h-full w-full overflow-hidden min-h-[450px]'
      } ${className}`}
    >
      {/* ── Toolbar at the Top ── */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-surface-1 border-b border-surface-2 select-none shrink-0">
        {/* Left: Mode Switcher & Language Selector */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {/* Mode Switcher Button Group */}
          <div className="inline-flex items-center gap-1">
            <button
              type="button"
              onClick={() => setEditorMode('monaco')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 ${
                editorMode === 'monaco'
                  ? 'bg-surface-2 text-sky-400 font-semibold'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-surface-2/60'
              }`}
              title="Monaco Code Editor Pro (with VS Code features & shortcuts)"
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>Monaco Pro</span>
            </button>

            <button
              type="button"
              onClick={() => setEditorMode('embed')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60 ${
                editorMode === 'embed'
                  ? 'bg-surface-2 text-amber-400 font-semibold'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-surface-2/60'
              }`}
              title="OnlineCompiler.io Embedded Sandbox Widget"
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>OnlineCompiler.io Embed</span>
            </button>
          </div>

          {/* Language Selector Dropdown */}
          <div className="relative inline-flex items-center">
            <select
              value={language}
              onChange={(e) => onLanguageChange(e.target.value as LanguageId)}
              className="appearance-none bg-surface-2 hover:bg-surface-3/80 text-slate-200 text-xs font-mono font-medium rounded-md pl-2.5 pr-7 py-1.5 border border-surface-3/60 focus:outline-none focus:ring-1 focus:ring-sky-500 cursor-pointer transition-colors"
              title="Select Programming Language"
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang.id} value={lang.id} className="bg-surface-1 text-slate-200">
                  {lang.name}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 pointer-events-none absolute right-2" />
          </div>
        </div>

        {/* Right: Quick Tools & Zen Toggle */}
        <div className="flex items-center gap-1 sm:gap-1.5">
          {/* Minimap Toggle (Monaco mode only) */}
          {editorMode === 'monaco' && (
            <button
              type="button"
              onClick={() => setMinimap((prev) => !prev)}
              className={`p-1.5 rounded-md text-xs transition-colors ${
                minimap
                  ? 'text-sky-400 bg-surface-2'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-surface-2'
              }`}
              title={minimap ? 'Hide Minimap' : 'Show Minimap'}
            >
              <Columns className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Format Code */}
          <button
            type="button"
            onClick={handleFormatCode}
            disabled={editorMode !== 'monaco'}
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-200 hover:bg-surface-2 transition-colors disabled:opacity-30 disabled:pointer-events-none"
            title="Format Code (Alt+Shift+F)"
          >
            <Sparkles className="w-3.5 h-3.5" />
          </button>

          {/* Clean LLM Markdown / Paste from ChatGPT/Claude */}
          <button
            type="button"
            onClick={handleCleanLlmMarkdown}
            className="p-1.5 rounded-md text-slate-400 hover:text-amber-400 hover:bg-surface-2 transition-colors relative"
            title="Clean LLM Code (Strips markdown backticks & preamble from ChatGPT, Claude, DeepSeek)"
          >
            <Bot className="w-3.5 h-3.5" />
          </button>

          {/* Copy Code */}
          <button
            type="button"
            onClick={handleCopyCode}
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-200 hover:bg-surface-2 transition-colors relative"
            title={copied ? 'Copied to clipboard!' : 'Copy Code'}
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Download Source Code File */}
          <button
            type="button"
            onClick={handleDownloadCode}
            className="p-1.5 rounded-md text-slate-400 hover:text-sky-400 hover:bg-surface-2 transition-colors relative"
            title={
              downloaded
                ? `Downloaded ${downloadFilename}!`
                : `Download ${downloadFilename} to upload on official CSES`
            }
          >
            {downloaded ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <FileDown className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Reset Template */}
          <button
            type="button"
            onClick={handleReset}
            className="p-1.5 rounded-md text-slate-400 hover:text-rose-400 hover:bg-surface-2 transition-colors"
            title="Reset to Language Template"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <div className="h-4 w-[1px] bg-surface-3/50 mx-0.5" />

          {/* Zen Mode / Fullscreen Toggle */}
          <button
            type="button"
            onClick={() => setIsZenMode((prev) => !prev)}
            className={`p-1.5 rounded-md text-xs transition-colors ${
              isZenMode
                ? 'text-amber-400 bg-surface-2'
                : 'text-slate-400 hover:text-slate-200 hover:bg-surface-2'
            }`}
            title={isZenMode ? 'Exit Zen Mode (Esc)' : 'Enter Zen Mode / Fullscreen'}
          >
            {isZenMode ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* ── Main Editor Canvas ── */}
      <div className="relative flex-1 w-full min-h-0 bg-[#1e1e1e]">
        {/* Floating LLM Markdown notification */}
        {llmNotice && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-40 px-3.5 py-1.5 rounded-lg bg-indigo-950/95 border border-indigo-500/40 text-indigo-200 text-xs shadow-2xl flex items-center gap-2 backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-200">
            <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0 animate-pulse" />
            <span className="font-medium">{llmNotice}</span>
          </div>
        )}

        {editorMode === 'monaco' ? (
          <MonacoEditorView
            code={code}
            onChange={onChange}
            language={language}
            fontSize={currentFontSize}
            isVimMode={isVimMode}
            minimap={minimap}
            onRun={onRun}
            onSubmit={onSubmit}
            editorRef={editorInstanceRef}
            onDetectedLanguage={onLanguageChange}
            onCleanNotification={(detectedLang) => {
              setLlmNotice(`✨ Auto-cleaned LLM Markdown: Extracted pure ${detectedLang} code`);
              setTimeout(() => setLlmNotice(null), 4000);
            }}
            onCleanLlmCode={handleCleanLlmMarkdown}
          />
        ) : (
          <InbuiltCompilerView
            code={code}
            language={language}
            apiKey={apiKey}
            widgetKey={widgetKey}
            onSwitchToMonaco={() => setEditorMode('monaco')}
            onSaveWidgetKey={onSaveWidgetKey}
          />
        )}
      </div>

      {/* ── Action Bar at the Bottom (Sticky & Integrated) ── */}
      <div className="flex items-center justify-between px-3 py-2 bg-surface-1 border-t border-surface-2 select-none shrink-0">
        {/* Left: Status indicator & Code metrics */}
        <div className="flex items-center gap-2 sm:gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] font-mono text-slate-300">Auto-saved</span>
          </div>

          <span className="text-surface-3">|</span>

          {editorMode === 'embed' ? (
            <span className="text-[11px] font-medium text-amber-400 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-800/50">
              Embed Active: Run in sandbox above, or switch to Monaco Pro for Test Bench
            </span>
          ) : (
            <span className="text-[11px] font-mono text-slate-400">
              {lineCount} {lineCount === 1 ? 'line' : 'lines'}, {code.length} chars
            </span>
          )}

          {isZenMode && (
            <>
              <span className="text-surface-3 hidden sm:inline">|</span>
              <span className="text-[11px] font-mono text-amber-400/90 hidden sm:inline">
                Zen Mode (Esc to exit)
              </span>
            </>
          )}
        </div>

        {/* Right: Run, Submit and Download Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Download Solution File Button */}
          <button
            type="button"
            onClick={handleDownloadCode}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-surface-2 hover:bg-surface-3 text-slate-300 hover:text-white border border-surface-3/80 shadow-xs transition-all active:scale-95"
            title={`Download ${downloadFilename} to upload and submit manually on official CSES`}
          >
            {downloaded ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <FileDown className="w-3.5 h-3.5 text-sky-400" />
            )}
            <span className="hidden md:inline">
              {downloaded ? 'Downloaded!' : 'Download File'}
            </span>
            <span className="md:hidden">{downloaded ? 'Saved' : 'Export'}</span>
          </button>

          {editorMode === 'embed' ? (
            <button
              type="button"
              onClick={() => setEditorMode('monaco')}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white shadow-sm border border-sky-400/40 transition-all active:scale-95"
              title="Switch to Monaco Pro to run tests and submit"
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>Switch to Monaco Pro for Test Bench</span>
            </button>
          ) : (
            <>
              {/* Run Button (Ctrl+Enter) */}
              <button
                type="button"
                onClick={onRun}
                disabled={isRunning || isSubmitting}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-surface-2 hover:bg-surface-3 text-slate-200 border border-surface-3/80 shadow-sm transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
                title="Run Code against Sample Test Cases (Ctrl+Enter)"
              >
                {isRunning ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                ) : (
                  <Play className="w-3.5 h-3.5 fill-current text-sky-400" />
                )}
                <span>{isRunning ? 'Running...' : 'Run'}</span>
                <kbd className="hidden sm:inline-block ml-1 px-1 py-0.5 text-[11px] text-slate-400 bg-surface-0/60 rounded border border-surface-3 font-mono">
                  Ctrl+↵
                </kbd>
              </button>

              {/* Test Cases Button + Pause / Resume / Stop Controls */}
              {isSubmitting ? (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={onPauseResume}
                    className={cn(
                      'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold border shadow-sm transition-all active:scale-95 cursor-pointer',
                      isPaused
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                        : 'bg-surface-2 text-amber-400 border-amber-500/30 hover:bg-surface-3'
                    )}
                    title={isPaused ? 'Resume test execution' : 'Pause test execution'}
                  >
                    {isPaused ? (
                      <>
                        <Play className="w-3.5 h-3.5 fill-current text-amber-400" />
                        <span>Resume</span>
                      </>
                    ) : (
                      <>
                        <Pause className="w-3.5 h-3.5 fill-current text-amber-400" />
                        <span>Pause</span>
                      </>
                    )}
                  </button>

                  {onCancel && (
                    <button
                      type="button"
                      onClick={onCancel}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 transition-all active:scale-95 cursor-pointer"
                      title="Stop remaining test cases"
                    >
                      <Square className="w-3 h-3 fill-current" />
                      <span>Stop</span>
                    </button>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={onSubmit}
                  disabled={isRunning}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-surface-2 hover:bg-surface-3 text-emerald-400 hover:text-emerald-300 border border-emerald-500/30 shadow-sm transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                  title="Run all test cases in parallel according to rate limits (Ctrl+Shift+Enter)"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Test Cases</span>
                  <kbd className="hidden sm:inline-block ml-1 px-1 py-0.5 text-[11px] text-emerald-300/80 bg-emerald-950/60 rounded border border-emerald-800/60 font-mono">
                    Ctrl+Shift+↵
                  </kbd>
                </button>
              )}

              {/* Official CSES Submit Button */}
              {onSubmitCses && (
                <button
                  type="button"
                  onClick={onSubmitCses}
                  disabled={isRunning || isSubmitting}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-semibold bg-sky-700 hover:bg-sky-600 text-white shadow-sm shadow-emerald-950/40 border border-emerald-500/50 transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
                  title="Submit Solution directly to official CSES.fi Judge"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Submit to CSES</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default EditorWorkbench;
