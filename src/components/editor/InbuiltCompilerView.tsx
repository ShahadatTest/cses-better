'use client';

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  RefreshCw,
  ExternalLink,
  Loader2,
  KeyRound,
  AlertCircle,
  Code2,
  Check,
} from 'lucide-react';
import { LanguageId, DEFAULT_APP_SETTINGS } from '@/core/types';

export interface InbuiltCompilerViewProps {
  code: string;
  language: LanguageId;
  apiKey?: string;
  widgetKey?: string;
  onSwitchToMonaco?: () => void;
  onSaveWidgetKey?: (key: string) => void;
  className?: string;
}

export const ONLINE_COMPILER_LANG_MAP: Record<LanguageId, string> = {
  cpp: 'g++-15',
  python: 'python-3.14',
  java: 'openjdk-25',
  rust: 'rust-1.93',
  go: 'go-1.26',
  javascript: 'nodejs-24',
  typescript: 'typescript-deno',
  c: 'gcc-15',
};

export function getOnlineCompilerLang(lang: LanguageId): string {
  return ONLINE_COMPILER_LANG_MAP[lang] || lang;
}

export const InbuiltCompilerView: React.FC<InbuiltCompilerViewProps> = ({
  code,
  language,
  apiKey,
  widgetKey,
  onSwitchToMonaco,
  onSaveWidgetKey,
  className = '',
}) => {
  const [reloadKey, setReloadKey] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [localWidgetKey, setLocalWidgetKey] = useState<string>('');
  const [keyInput, setKeyInput] = useState<string>('');
  const [isEditingKey, setIsEditingKey] = useState<boolean>(false);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  // Load widget key from prop or localStorage on mount
  useEffect(() => {
    if (widgetKey) {
      setLocalWidgetKey(widgetKey);
    } else if (typeof window !== 'undefined') {
      const stored =
        localStorage.getItem('cses_widget_key') ||
        DEFAULT_APP_SETTINGS.widgetKey ||
        '';
      setLocalWidgetKey(stored);
    }
  }, [widgetKey]);

  // Determine active widget key
  const activeWidgetKey = (
    widgetKey ||
    localWidgetKey ||
    (typeof process !== 'undefined'
      ? process.env.NEXT_PUBLIC_ONLINECOMPILER_WIDGET_KEY
      : '') ||
    DEFAULT_APP_SETTINGS.widgetKey ||
    ''
  ).trim();
  const hasValidWidgetKey = activeWidgetKey.length > 0;

  const embedLang = getOnlineCompilerLang(language);
  const iframeUrl = `https://api.onlinecompiler.io/embed/?key=${encodeURIComponent(
    activeWidgetKey
  )}&lang=${embedLang}&theme=dark#code=${encodeURIComponent(code)}`;

  const handleRefresh = () => {
    setIsLoading(true);
    setReloadKey((prev) => prev + 1);
  };

  const handleApplyKey = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = keyInput.trim();
    if (!clean) return;

    setLocalWidgetKey(clean);
    if (typeof window !== 'undefined') {
      localStorage.setItem('cses_widget_key', clean);
    }
    if (onSaveWidgetKey) {
      onSaveWidgetKey(clean);
    }

    setIsEditingKey(false);
    setIsLoading(true);
    setReloadKey((prev) => prev + 1);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div
      className={`flex flex-col h-full w-full bg-[#18181b] border border-surface-2 rounded-lg overflow-hidden ${className}`}
    >
      {/* Top Header bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-surface-1 border-b border-surface-2 select-none shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-xs font-medium text-slate-200 truncate">
            OnlineCompiler.io Embedded Sandbox
          </span>
          {hasValidWidgetKey ? (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hidden sm:inline">
              Widget Active
            </span>
          ) : (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 hidden sm:inline">
              Widget Key Required
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {hasValidWidgetKey && (
            <>
              <button
                type="button"
                onClick={() => setIsEditingKey(!isEditingKey)}
                title="Change or update your widget key"
                className="flex items-center gap-1 px-2 py-1 text-xs text-slate-400 hover:text-slate-200 hover:bg-surface-2 rounded transition-colors"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Change Key</span>
              </button>

              <button
                type="button"
                onClick={handleRefresh}
                title="Reload sandbox with current editor code"
                className="flex items-center gap-1 px-2 py-1 text-xs text-slate-400 hover:text-slate-200 hover:bg-surface-2 rounded transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Sync Code</span>
              </button>

              <a
                href={iframeUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="Open in external browser window"
                className="flex items-center gap-1 px-2 py-1 text-xs text-slate-400 hover:text-sky-400 hover:bg-surface-2 rounded transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Pop Out</span>
              </a>
            </>
          )}

          {onSwitchToMonaco && (
            <button
              type="button"
              onClick={onSwitchToMonaco}
              title="Switch back to Monaco Pro Editor"
              className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-sky-400 hover:text-sky-300 hover:bg-sky-500/10 rounded border border-sky-500/30 transition-colors"
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>Monaco Pro</span>
            </button>
          )}
        </div>
      </div>

      {/* Informational Hint Bar */}
      {hasValidWidgetKey && !isEditingKey && (
        <div className="flex items-center justify-between px-3 py-1 bg-amber-950/20 border-b border-amber-900/30 text-[11px] text-amber-300/80">
          <span>
            💡 <strong>Self-contained sandbox:</strong> Use the orange <strong>Run</strong> button inside the widget above. Switch to <strong>Monaco Pro</strong> to grade against CSES Test Bench & submit.
          </span>
          {onSwitchToMonaco && (
            <button
              type="button"
              onClick={onSwitchToMonaco}
              className="text-amber-400 hover:text-amber-200 underline font-medium ml-2 shrink-0"
            >
              Switch to Monaco Pro →
            </button>
          )}
        </div>
      )}

      {/* Main Content Area */}
      <div className="relative flex-1 w-full min-h-0 bg-[#1e1e1e]">
        {/* State A: Key is Missing or User is Editing Key */}
        {!hasValidWidgetKey || isEditingKey ? (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 bg-surface-1/95 backdrop-blur-sm overflow-y-auto">
            <div className="max-w-md w-full bg-surface-0 border border-border-muted rounded-xl p-5 shadow-2xl space-y-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 shrink-0">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    OnlineCompiler.io Embed Widget Key
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    OnlineCompiler.io uses separate keys for <strong>REST API execution</strong> and <strong>Embed Widgets</strong>:
                  </p>
                </div>
              </div>

              <div className="space-y-2 text-xs bg-surface-1/80 border border-border-subtle rounded-lg p-3 text-slate-300">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">REST API Key:</span>
                  <span className="font-mono text-emerald-400 text-[11px] bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/30">
                    Active (Run & Submit work!)
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Widget Key:</span>
                  <span className="font-mono text-amber-300 text-[11px] bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/30">
                    {hasValidWidgetKey ? 'Configured' : 'Missing for iframe embed'}
                  </span>
                </div>
              </div>

              {/* Input Form */}
              <form onSubmit={handleApplyKey} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-slate-400" />
                    <span>Enter your Widget Key:</span>
                  </label>
                  <input
                    type="text"
                    value={keyInput}
                    onChange={(e) => setKeyInput(e.target.value)}
                    placeholder="Paste Widget Key from onlinecompiler.io..."
                    className="w-full bg-surface-2 border border-border-muted rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 font-mono focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="submit"
                    disabled={!keyInput.trim()}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium bg-sky-600 hover:bg-sky-500 text-white rounded-lg transition-colors disabled:opacity-40 disabled:pointer-events-none shadow-sm"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Activate Embed Widget</span>
                  </button>

                  {isEditingKey && hasValidWidgetKey && (
                    <button
                      type="button"
                      onClick={() => setIsEditingKey(false)}
                      className="px-3 py-2 text-xs text-slate-400 hover:text-slate-200 hover:bg-surface-2 rounded-lg border border-border-subtle transition-colors"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>

              {/* Helpful links */}
              <div className="pt-2 border-t border-border-subtle/80 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
                <a
                  href="https://onlinecompiler.io/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sky-400 hover:underline"
                >
                  <span>OnlineCompiler.io Dashboard ➔ Widgets</span>
                  <ExternalLink className="w-3 h-3" />
                </a>

                {onSwitchToMonaco && (
                  <button
                    type="button"
                    onClick={onSwitchToMonaco}
                    className="inline-flex items-center gap-1 text-slate-300 hover:text-white font-medium"
                  >
                    <span>Use Monaco Pro Editor Instead →</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* State B: Valid Widget Key Active -> Render Iframe */
          <>
            {isLoading && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#1e1e1e] text-slate-400 gap-3">
                <Loader2 className="w-6 h-6 animate-spin text-sky-400" />
                <span className="text-xs font-mono">Initializing secure compiler sandbox...</span>
              </div>
            )}

            <iframe
              key={`${language}-${reloadKey}`}
              src={iframeUrl}
              title="OnlineCompiler.io Embedded Sandbox"
              className="w-full h-full border-0 rounded-b-lg"
              allow="clipboard-read; clipboard-write; execution-while-out-of-viewport"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads"
              onLoad={() => setIsLoading(false)}
            />
          </>
        )}
      </div>
    </div>
  );
};

export default InbuiltCompilerView;
