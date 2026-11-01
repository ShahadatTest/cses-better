'use client';

import React, { useState, useRef } from 'react';
import {
  X,
  Cpu,
  Code,
  Database,
  Download,
  Upload,
  RotateCcw,
  Check,
  AlertTriangle,
  Eye,
  EyeOff,
  Server,
  KeyRound,
  ExternalLink,
} from 'lucide-react';
import { AppSettings, DEFAULT_APP_SETTINGS } from '../core/types';
import { exportUserData, importUserData, clearAllStorage } from '../core/storage';

export interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (newSettings: AppSettings) => void;
}

export function SettingsModal({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
}: SettingsModalProps) {
  const [showApiKey, setShowApiKey] = useState(false);
  const [activeTab, setActiveTab] = useState<'compiler' | 'editor' | 'data'>('compiler');
  const [feedbackMessage, setFeedbackMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const showFeedback = (type: 'success' | 'error', text: string) => {
    setFeedbackMessage({ type, text });
    setTimeout(() => {
      setFeedbackMessage(null);
    }, 4000);
  };

  const handleExportData = () => {
    try {
      const dataStr = exportUserData();
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `cses_better_backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showFeedback('success', 'User data exported successfully.');
    } catch {
      showFeedback('error', 'Failed to export user data.');
    }
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const success = importUserData(content);
        if (success) {
          showFeedback('success', 'Data imported successfully! Reloading...');
          setTimeout(() => {
            window.location.reload();
          }, 1000);
        } else {
          showFeedback('error', 'Invalid JSON backup format.');
        }
      }
    };
    reader.readAsText(file);
    // Reset input
    e.target.value = '';
  };

  const handleResetData = () => {
    clearAllStorage();
    onUpdateSettings({ ...DEFAULT_APP_SETTINGS });
    setShowResetConfirm(false);
    showFeedback('success', 'All local drafts and submissions reset.');
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        className="w-full max-w-xl bg-surface-1 border border-border-muted rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle bg-surface-1">
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            Settings & Preferences
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-surface-2 transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Feedback Banner */}
        {feedbackMessage && (
          <div
            className={`px-6 py-2.5 text-xs flex items-center space-x-2 ${
              feedbackMessage.type === 'success'
                ? 'bg-emerald-500/15 text-emerald-300 border-b border-emerald-500/30'
                : 'bg-rose-500/15 text-rose-300 border-b border-rose-500/30'
            }`}
          >
            {feedbackMessage.type === 'success' ? (
              <Check className="w-4 h-4 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-400" />
            )}
            <span>{feedbackMessage.text}</span>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex border-b border-border-subtle px-6 pt-2 bg-surface-0/60">
          <button
            type="button"
            onClick={() => setActiveTab('compiler')}
            className={`pb-3 px-3 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'compiler'
                ? 'border-sky-400 text-sky-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>Compiler API</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('editor')}
            className={`pb-3 px-3 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'editor'
                ? 'border-sky-400 text-sky-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Code className="w-3.5 h-3.5" />
            <span>Editor</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('data')}
            className={`pb-3 px-3 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'data'
                ? 'border-sky-400 text-sky-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Data & Backup</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 space-y-5 flex-1 overflow-y-auto max-h-[60vh]">
          {/* TAB 1: COMPILER API */}
          {activeTab === 'compiler' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-slate-400" />
                  <span>Compiler API Key</span>
                </label>
                <div className="relative">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={settings.apiKey}
                    onChange={(e) =>
                      onUpdateSettings({ ...settings, apiKey: e.target.value })
                    }
                    placeholder="Enter your API key..."
                    className="w-full bg-surface-2 border border-border-muted rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 font-mono pr-10 focus:outline-none focus:border-sky-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                    title={showApiKey ? 'Hide API Key' : 'Show API Key'}
                  >
                    {showApiKey ? (
                      <EyeOff className="w-3.5 h-3.5" />
                    ) : (
                      <Eye className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  OnlineCompiler.io / Piston API Key used for fast code compilation and execution.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                  <span>Embed Widget Key (Optional)</span>
                </label>
                <input
                  type="text"
                  value={settings.widgetKey || ''}
                  onChange={(e) =>
                    onUpdateSettings({
                      ...settings,
                      widgetKey: e.target.value.trim(),
                    })
                  }
                  placeholder="Enter your widget key (e.g. wgt_abc123...)"
                  className="w-full bg-surface-2 border border-border-muted rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 font-mono focus:outline-none focus:border-sky-500"
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  Required only for the <code className="text-slate-400">OnlineCompiler.io Embed</code> tab. Separate from the execution API key. Generate under{' '}
                  <a
                    href="https://onlinecompiler.io/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sky-400 hover:underline"
                  >
                    OnlineCompiler.io Dashboard ➔ Widgets
                  </a>.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Server className="w-3.5 h-3.5 text-slate-400" />
                  <span>Execution Endpoint</span>
                </label>
                <input
                  type="text"
                  value={settings.compilerEndpoint}
                  onChange={(e) =>
                    onUpdateSettings({
                      ...settings,
                      compilerEndpoint: e.target.value,
                    })
                  }
                  placeholder="/api/compile"
                  className="w-full bg-surface-2 border border-border-muted rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 font-mono focus:outline-none focus:border-sky-500"
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  Default is Next.js proxy route <code className="text-slate-400">/api/compile</code>. You can also specify an external Piston instance.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() =>
                    onUpdateSettings({
                      ...settings,
                      apiKey: DEFAULT_APP_SETTINGS.apiKey,
                      compilerEndpoint: DEFAULT_APP_SETTINGS.compilerEndpoint,
                    })
                  }
                  className="text-xs text-sky-400 hover:underline flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset to default compiler settings
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: EDITOR PREFERENCES */}
          {activeTab === 'editor' && (
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-2">
                  Default Editor Workbench
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateSettings({ ...settings, defaultEditor: 'monaco' })
                    }
                    className={`p-3 rounded-lg border text-left transition-colors ${
                      settings.defaultEditor === 'monaco'
                        ? 'border-sky-500 bg-sky-500/10 text-white'
                        : 'border-border-subtle bg-surface-2/60 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="text-xs font-semibold text-slate-200">
                      Monaco Pro Editor
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      VS Code engine with keyboard shortcuts and syntax highlighting.
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      onUpdateSettings({ ...settings, defaultEditor: 'inbuilt' })
                    }
                    className={`p-3 rounded-lg border text-left transition-colors ${
                      settings.defaultEditor === 'inbuilt'
                        ? 'border-sky-500 bg-sky-500/10 text-white'
                        : 'border-border-subtle bg-surface-2/60 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="text-xs font-semibold text-slate-200">
                      OnlineCompiler Embed
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      Official OnlineCompiler.io iframe sandbox with gVisor container isolation.
                    </div>
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-slate-300">
                    Font Size
                  </label>
                  <span className="text-xs font-mono text-sky-400">
                    {settings.fontSize}px
                  </span>
                </div>
                <input
                  type="range"
                  min={12}
                  max={22}
                  step={1}
                  value={settings.fontSize}
                  onChange={(e) =>
                    onUpdateSettings({
                      ...settings,
                      fontSize: Number(e.target.value),
                    })
                  }
                  className="w-full accent-sky-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                  <span>12px</span>
                  <span>14px (default)</span>
                  <span>22px</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-2">
                  Tab Size
                </label>
                <div className="flex space-x-3">
                  {[2, 4].map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() =>
                        onUpdateSettings({
                          ...settings,
                          tabSize: tab as 2 | 4,
                        })
                      }
                      className={`flex-1 py-2 px-3 rounded-lg border text-xs font-mono font-medium transition-colors ${
                        settings.tabSize === tab
                          ? 'border-sky-500 bg-sky-500/10 text-sky-300'
                          : 'border-border-subtle bg-surface-2 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {tab} Spaces {tab === 4 && '(Standard CP)'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: DATA & BACKUP */}
          {activeTab === 'data' && (
            <div className="space-y-5">
              <div>
                <h3 className="text-xs font-medium text-slate-300 mb-1">
                  Local Storage Backup
                </h3>
                <p className="text-[11px] text-slate-500 mb-3">
                  Your problem drafts and submission history are saved locally in your browser.
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={handleExportData}
                    className="flex items-center justify-center space-x-2 px-3 py-2.5 rounded-lg bg-surface-2 hover:bg-surface-3 border border-border-muted text-xs text-slate-200 font-medium transition-colors"
                  >
                    <Download className="w-3.5 h-3.5 text-sky-400" />
                    <span>Export All Data (JSON)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center justify-center space-x-2 px-3 py-2.5 rounded-lg bg-surface-2 hover:bg-surface-3 border border-border-muted text-xs text-slate-200 font-medium transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Import Data (JSON)</span>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    onChange={handleImportFile}
                    className="hidden"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-border-subtle">
                <h3 className="text-xs font-medium text-rose-400 mb-1 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Danger Zone
                </h3>
                <p className="text-[11px] text-slate-500 mb-3">
                  Resetting storage will permanently delete all code drafts and saved submissions on this browser.
                </p>

                {showResetConfirm ? (
                  <div className="p-3 rounded-lg border border-rose-500/30 bg-rose-500/10 space-y-2">
                    <p className="text-xs text-rose-300 font-medium">
                      Are you completely sure? This action cannot be undone.
                    </p>
                    <div className="flex space-x-2">
                      <button
                        type="button"
                        onClick={handleResetData}
                        className="px-3 py-1.5 rounded bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white transition-colors"
                      >
                        Yes, Delete Everything
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowResetConfirm(false)}
                        className="px-3 py-1.5 rounded bg-surface-2 hover:bg-surface-3 text-xs text-slate-300 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowResetConfirm(true)}
                    className="flex items-center space-x-2 px-3 py-2 rounded-lg border border-rose-500/20 hover:border-rose-500/50 bg-rose-500/5 hover:bg-rose-500/10 text-xs text-rose-400 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset All Data</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-border-subtle bg-surface-0/80 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-xs font-semibold text-white transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
