'use client';

import React, { useState, useRef, useEffect } from 'react';
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
  Palette,
  Keyboard,
  Search,
} from 'lucide-react';
import { AppSettings, DEFAULT_APP_SETTINGS } from '../core/types';
import { exportUserData, importUserData, clearAllStorage } from '../core/storage';
import { AppearanceSettings } from './AppearanceSettings';
import { COMMAND_CATALOG, formatShortcut, resolveShortcutOverrides, validateShortcut } from '../core/commands';

export interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (newSettings: AppSettings) => void;
  initialTab?: 'appearance' | 'shortcuts' | 'compiler' | 'editor' | 'data';
}

export function SettingsModal({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  initialTab = 'appearance',
}: SettingsModalProps) {
  const [showApiKey, setShowApiKey] = useState(false);
  const [activeTab, setActiveTab] = useState<'appearance' | 'shortcuts' | 'compiler' | 'editor' | 'data'>(initialTab);
  const [shortcutQuery, setShortcutQuery] = useState('');
  const [recordingShortcut, setRecordingShortcut] = useState<string | null>(null);
  const [shortcutError, setShortcutError] = useState<string | null>(null);
  const [confirmResetShortcuts, setConfirmResetShortcuts] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const deploymentWidgetKey = process.env.NEXT_PUBLIC_ONLINECOMPILER_WIDGET_KEY || '';
  const widgetKeyManagedByDeployment =
    process.env.NODE_ENV === 'production' && Boolean(deploymentWidgetKey);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      restoreFocusRef.current = document.activeElement as HTMLElement;
      closeButtonRef.current?.focus();
    } else {
      restoreFocusRef.current?.focus();
    }
  }, [isOpen, initialTab]);

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
  const handleDialogKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') { event.preventDefault(); onClose(); return; }
    if (event.key !== 'Tab' || !dialogRef.current) return;
    const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), [href], [tabindex]:not([tabindex="-1"])'));
    if (!focusable.length) return;
    const first = focusable[0]; const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };

  const saveShortcut = (id: string, value: string | null) => {
    onUpdateSettings({ ...settings, shortcutOverrides: { ...settings.shortcutOverrides, [id]: value } });
    setShortcutError(null);
    setRecordingShortcut(null);
  };
  const handleShortcutKey = (event: React.KeyboardEvent<HTMLButtonElement>, id: string) => {
    if (event.key === 'Escape') { event.preventDefault(); setRecordingShortcut(null); setShortcutError(null); return; }
    event.preventDefault(); event.stopPropagation();
    if (event.key === '?') {
      const result = validateShortcut('?', id, settings.shortcutOverrides);
      if (!result.valid || !result.normalized) { setShortcutError(result.error || 'Invalid shortcut.'); return; }
      saveShortcut(id, result.normalized);
      return;
    }
    const physicalKey = event.altKey && /^Key[A-Z]$/.test(event.code)
      ? event.code.slice(3)
      : event.altKey && /^Digit\d$/.test(event.code)
        ? event.code.slice(5)
        : event.key;
    const key = physicalKey === ' ' ? 'Space' : physicalKey;
    if (['Control', 'Meta', 'Alt', 'Shift'].includes(key)) return;
    const parts = [event.ctrlKey || event.metaKey ? 'Mod' : '', event.altKey ? 'Alt' : '', event.shiftKey ? 'Shift' : '', key].filter(Boolean);
    const result = validateShortcut(parts.join('+'), id, settings.shortcutOverrides);
    if (!result.valid || !result.normalized) { setShortcutError(result.error || 'Invalid shortcut.'); return; }
    saveShortcut(id, result.normalized);
  };
  const overrides = resolveShortcutOverrides(settings.shortcutOverrides);
  const filteredCommands = COMMAND_CATALOG.filter((command) => `${command.label} ${command.description} ${command.scope}`.toLowerCase().includes(shortcutQuery.toLowerCase()));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        role="dialog"
        ref={dialogRef}
        aria-modal="true"
        aria-label="Settings"
        className="w-full max-w-xl bg-surface-1 border border-border-muted rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleDialogKeyDown}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle bg-surface-1">
          <h2 className="text-base font-semibold text-text-primary flex items-center gap-2">
            Settings & Preferences
          </h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-2 transition-colors"
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
                ? 'bg-verdict-ac-soft text-verdict-ac border-b border-emerald-500/30'
                : 'bg-verdict-wa-soft text-verdict-wa border-b border-rose-500/30'
            }`}
          >
            {feedbackMessage.type === 'success' ? (
              <Check className="w-4 h-4 text-verdict-ac" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-verdict-wa" />
            )}
            <span>{feedbackMessage.text}</span>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex overflow-x-auto border-b border-border-subtle px-3 pt-2 bg-surface-0/60 sm:px-6" role="tablist" aria-label="Settings sections">
          {([['appearance', Palette, 'Appearance'], ['shortcuts', Keyboard, 'Shortcuts'], ['compiler', Cpu, 'Compiler API'], ['editor', Code, 'Editor'], ['data', Database, 'Data & Backup']] as const).map(([tab, Icon, label]) => (
            <button key={tab} type="button" role="tab" aria-selected={activeTab === tab} onClick={() => setActiveTab(tab)}
              className={`shrink-0 pb-3 px-2.5 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${activeTab === tab ? 'border-accent text-accent' : 'border-transparent text-text-secondary hover:text-text-primary'}`}>
              <Icon className="w-3.5 h-3.5" /><span>{label}</span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="p-6 space-y-5 flex-1 overflow-y-auto max-h-[60vh]">
          {activeTab === 'appearance' && <AppearanceSettings />}
          {activeTab === 'shortcuts' && (
            <section className="space-y-4" aria-label="Keyboard shortcuts">
              <div><h3 className="text-sm font-semibold text-text-primary">Keyboard shortcuts</h3><p className="mt-1 text-xs text-text-secondary">Record a replacement shortcut. Use Ctrl or ⌘, optionally with Alt or Shift.</p></div>
              <label className="relative block"><Search aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"/><input type="search" value={shortcutQuery} onChange={(event) => setShortcutQuery(event.target.value)} placeholder="Search shortcuts" className="w-full rounded-lg border border-border-muted bg-surface-2 py-2 pl-9 pr-3 text-sm text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" /></label>
              {shortcutError && <p role="alert" className="rounded-lg border border-rose-500/40 bg-verdict-wa-soft px-3 py-2 text-xs text-verdict-wa">{shortcutError}</p>}
              <div className="divide-y divide-border-subtle rounded-lg border border-border-subtle">
                {filteredCommands.map((command) => {
                  const effective = overrides[command.id];
                  const overridden = settings.shortcutOverrides && Object.prototype.hasOwnProperty.call(settings.shortcutOverrides, command.id);
                  return <div key={command.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-3">
                    <div className="min-w-0"><p className="text-sm font-medium text-text-primary">{command.label}</p><p className="text-xs text-text-muted">{command.description}</p></div>
                    <div className="flex items-center gap-2">
                      {recordingShortcut === command.id ? <button type="button" data-shortcut-recording="true" autoFocus onKeyDown={(event) => handleShortcutKey(event, command.id)} onBlur={() => setRecordingShortcut(null)} className="min-h-10 min-w-32 rounded-lg border border-accent bg-accent/10 px-3 text-xs text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">Press keys…</button> : <span className="min-w-24 rounded-md bg-surface-2 px-2.5 py-2 text-center font-mono text-xs text-text-secondary">{formatShortcut(effective)}</span>}
                      <button type="button" onClick={() => { setShortcutError(null); setRecordingShortcut(command.id); }} className="min-h-10 rounded-lg border border-border-muted px-3 text-xs text-text-secondary hover:border-accent hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">{recordingShortcut === command.id ? 'Listening' : 'Record'}</button>
                      {overridden && <button type="button" onClick={() => { const next = { ...settings.shortcutOverrides }; delete next[command.id]; onUpdateSettings({ ...settings, shortcutOverrides: next }); }} className="min-h-10 rounded-lg px-2 text-xs text-text-muted hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" aria-label={`Reset ${command.label}`}>Reset</button>}
                      {effective && <button type="button" onClick={() => saveShortcut(command.id, null)} className="min-h-10 rounded-lg px-2 text-xs text-text-muted hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" aria-label={`Disable ${command.label}`}>Disable</button>}
                    </div>
                  </div>;
                })}
                {!filteredCommands.length && <p className="px-3 py-6 text-center text-sm text-text-muted">No shortcuts match “{shortcutQuery}”.</p>}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle pt-4">
                <p className="text-xs text-text-muted">Unassigned commands have no active shortcut.</p>
                {confirmResetShortcuts ? <div className="flex items-center gap-2"><span className="text-xs text-text-secondary">Reset all shortcut changes?</span><button type="button" onClick={() => { onUpdateSettings({ ...settings, shortcutOverrides: {} }); setConfirmResetShortcuts(false); setShortcutError(null); }} className="min-h-10 rounded-lg bg-accent px-3 text-xs font-semibold text-accent-foreground">Reset all</button><button type="button" onClick={() => setConfirmResetShortcuts(false)} className="min-h-10 rounded-lg px-3 text-xs text-text-secondary hover:text-text-primary">Cancel</button></div> : <button type="button" onClick={() => setConfirmResetShortcuts(true)} className="min-h-10 rounded-lg border border-border-muted px-3 text-xs text-text-secondary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">Reset all shortcuts</button>}
              </div>
            </section>
          )}
          {/* TAB 1: COMPILER API */}
          {activeTab === 'compiler' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-text-muted" />
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
                    className="w-full bg-surface-2 border border-border-muted rounded-lg px-3 py-2 text-xs text-text-primary placeholder-slate-500 font-mono pr-10 focus:outline-none focus:border-accent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
                    title={showApiKey ? 'Hide API Key' : 'Show API Key'}
                  >
                    {showApiKey ? (
                      <EyeOff className="w-3.5 h-3.5" />
                    ) : (
                      <Eye className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
                <p className="mt-1 text-[11px] text-text-muted">
                  OnlineCompiler.io / Piston API Key used for fast code compilation and execution.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5 flex items-center gap-1.5">
                  <ExternalLink className="w-3.5 h-3.5 text-text-muted" />
                  <span>Embed Widget Key (Optional)</span>
                </label>
                <input
                  type="text"
                  value={widgetKeyManagedByDeployment ? deploymentWidgetKey : settings.widgetKey || ''}
                  disabled={widgetKeyManagedByDeployment}
                  onChange={(e) =>
                    onUpdateSettings({
                      ...settings,
                      widgetKey: e.target.value.trim(),
                    })
                  }
                  placeholder="Enter your widget key (e.g. wgt_abc123...)"
                  className="w-full bg-surface-2 border border-border-muted rounded-lg px-3 py-2 text-xs text-text-primary placeholder-slate-500 font-mono focus:outline-none focus:border-accent disabled:cursor-not-allowed disabled:opacity-70"
                />
                <p className="mt-1 text-[11px] text-text-muted">
                  {widgetKeyManagedByDeployment
                    ? 'This production deployment uses its host-restricted widget key. '
                    : <>Required only for the <code className="text-text-muted">OnlineCompiler.io Embed</code> tab. Separate from the execution API key. Generate under{' '}</>}
                  <a
                    href="https://onlinecompiler.io/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:underline"
                  >
                    OnlineCompiler.io Dashboard ➔ Widgets
                  </a>.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5 flex items-center gap-1.5">
                  <Server className="w-3.5 h-3.5 text-text-muted" />
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
                  className="w-full bg-surface-2 border border-border-muted rounded-lg px-3 py-2 text-xs text-text-primary placeholder-slate-500 font-mono focus:outline-none focus:border-accent"
                />
                <p className="mt-1 text-[11px] text-text-muted">
                  Default is Next.js proxy route <code className="text-text-muted">/api/compile</code>. You can also specify an external Piston instance.
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
                  className="text-xs text-accent hover:underline flex items-center gap-1"
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
                <label className="block text-xs font-medium text-text-secondary mb-2">
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
                        ? 'border-accent bg-accent/10 text-accent'
                        : 'border-border-subtle bg-surface-2/60 text-text-muted hover:text-text-primary'
                    }`}
                  >
                    <div className="text-xs font-semibold text-text-primary">
                      Monaco Pro Editor
                    </div>
                    <div className="text-[11px] text-text-muted mt-1">
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
                        ? 'border-accent bg-accent/10 text-accent'
                        : 'border-border-subtle bg-surface-2/60 text-text-muted hover:text-text-primary'
                    }`}
                  >
                    <div className="text-xs font-semibold text-text-primary">
                      OnlineCompiler Embed
                    </div>
                    <div className="text-[11px] text-text-muted mt-1">
                      Official OnlineCompiler.io iframe sandbox with gVisor container isolation.
                    </div>
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-text-secondary">
                    Font Size
                  </label>
                  <span className="text-xs font-mono text-accent">
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
                  className="w-full accent-accent cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-text-muted mt-1">
                  <span>12px</span>
                  <span>14px (default)</span>
                  <span>22px</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-2">
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
                          ? 'border-accent bg-accent/10 text-accent'
                          : 'border-border-subtle bg-surface-2 text-text-muted hover:text-text-primary'
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
                <h3 className="text-xs font-medium text-text-secondary mb-1">
                  Local Storage Backup
                </h3>
                <p className="text-[11px] text-text-muted mb-3">
                  Your problem drafts and submission history are saved locally in your browser.
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={handleExportData}
                    className="flex items-center justify-center space-x-2 px-3 py-2.5 rounded-lg bg-surface-2 hover:bg-surface-3 border border-border-muted text-xs text-text-primary font-medium transition-colors"
                  >
                    <Download className="w-3.5 h-3.5 text-accent" />
                    <span>Export All Data (JSON)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center justify-center space-x-2 px-3 py-2.5 rounded-lg bg-surface-2 hover:bg-surface-3 border border-border-muted text-xs text-text-primary font-medium transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5 text-verdict-ac" />
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
                <h3 className="text-xs font-medium text-verdict-wa mb-1 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Danger Zone
                </h3>
                <p className="text-[11px] text-text-muted mb-3">
                  Resetting storage will permanently delete all code drafts and saved submissions on this browser.
                </p>

                {showResetConfirm ? (
                  <div className="p-3 rounded-lg border border-rose-500/30 bg-verdict-wa-soft space-y-2">
                    <p className="text-xs text-verdict-wa font-medium">
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
                        className="px-3 py-1.5 rounded bg-surface-2 hover:bg-surface-3 text-xs text-text-secondary transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowResetConfirm(true)}
                    className="flex items-center space-x-2 px-3 py-2 rounded-lg border border-rose-500/20 hover:border-rose-500/50 bg-verdict-wa-soft hover:bg-verdict-wa-soft text-xs text-verdict-wa transition-colors"
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
            className="px-4 py-1.5 rounded-lg bg-accent hover:opacity-90 text-xs font-semibold text-accent-foreground transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
