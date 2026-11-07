export type CommandId = 'palette' | 'run' | 'runAll' | 'submitCses' | 'settings' | 'help' | 'focusStatement' | 'focusEditor' | 'focusTests' | 'zen' | 'cleanCode' | 'learn' | 'lists' | 'notes' | 'copyLink' | 'appearance' | 'previous' | 'next';
export interface CommandDefinition { id: CommandId; label: string; description: string; defaultShortcut: string | null; scope: 'global' | 'editor'; availableIn: ('practice' | 'contest')[]; }
export const COMMAND_CATALOG: CommandDefinition[] = [
  { id: 'palette', label: 'Open command palette', description: 'Search workspace commands', defaultShortcut: 'Mod+K', scope: 'global', availableIn: ['practice', 'contest'] },
  { id: 'run', label: 'Run selected test', description: 'Run the current test input', defaultShortcut: 'Mod+Enter', scope: 'editor', availableIn: ['practice', 'contest'] },
  { id: 'runAll', label: 'Run all tests', description: 'Run all loaded tests', defaultShortcut: 'Mod+Shift+Enter', scope: 'editor', availableIn: ['practice'] },
  { id: 'submitCses', label: 'Submit to CSES', description: 'Open official CSES submission confirmation', defaultShortcut: 'Mod+Alt+Enter', scope: 'editor', availableIn: ['practice'] },
  { id: 'settings', label: 'Open settings', description: 'Open workspace settings', defaultShortcut: 'Mod+Comma', scope: 'global', availableIn: ['practice', 'contest'] },
  { id: 'help', label: 'Show keyboard shortcuts', description: 'Show keyboard help', defaultShortcut: '?', scope: 'global', availableIn: ['practice', 'contest'] },
  { id: 'focusStatement', label: 'Focus statement', description: 'Focus the problem statement pane', defaultShortcut: 'Mod+Alt+1', scope: 'global', availableIn: ['practice'] },
  { id: 'focusEditor', label: 'Focus editor', description: 'Focus the code editor', defaultShortcut: 'Mod+Alt+2', scope: 'global', availableIn: ['practice', 'contest'] },
  { id: 'focusTests', label: 'Focus tests', description: 'Focus the tests pane', defaultShortcut: 'Mod+Alt+3', scope: 'global', availableIn: ['practice'] },
  { id: 'zen', label: 'Toggle zen mode', description: 'Expand the editor workspace', defaultShortcut: 'Mod+Alt+Z', scope: 'global', availableIn: ['practice', 'contest'] },
  { id: 'appearance', label: 'Open appearance settings', description: 'Change workspace appearance', defaultShortcut: null, scope: 'global', availableIn: ['practice', 'contest'] },
  { id: 'cleanCode', label: 'Clean LLM Markdown code', description: 'Remove Markdown fences or paste clean code', defaultShortcut: 'Mod+Alt+V', scope: 'editor', availableIn: ['practice', 'contest'] },
  ...([['learn','Open learning roadmap'],['lists','Open lists'],['notes','Open notes'],['copyLink','Copy problem link'],['previous','Previous problem'],['next','Next problem']] as [CommandId,string][]).map(([id,label]) => ({ id, label, description: label, defaultShortcut: null, scope: 'global' as const, availableIn: ['practice'] as ('practice'|'contest')[] })),
];

export function normalizeShortcut(input: string): string | null {
  if (typeof input !== 'string') return null;
  if (input.trim() === '?') return '?';
  const parts = input.trim().replace(/\s+/g, '').split(/[+-]/).filter(Boolean);
  if (!parts.length) return null;
  const mods = new Set<string>(); let key = '';
  for (const raw of parts) {
    const p = raw.toLowerCase();
    if (['mod','ctrl','control','cmd','meta'].includes(p)) mods.add('Mod');
    else if (p === 'alt' || p === 'option') mods.add('Alt');
    else if (p === 'shift') mods.add('Shift');
    else if (!key) key = p === 'comma' || p === ',' ? 'Comma' : ['left','right','up','down'].includes(p) ? `Arrow${p[0].toUpperCase()}${p.slice(1)}` : p.length === 1 ? p.toUpperCase() : p[0].toUpperCase()+p.slice(1);
    else return null;
  }
  if (!key || new Set([...mods, key]).size !== mods.size + 1) return null;
  const allowed = new Set(['Enter','Escape','Tab','Space','Comma','Period','Slash','Backslash','BracketLeft','BracketRight','Minus','Equal','Backquote','Semicolon','Quote','ArrowUp','ArrowDown','ArrowLeft','ArrowRight', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789']);
  if (!allowed.has(key) && !/^F(?:[1-9]|1[0-2])$/.test(key)) return null;
  return [...['Mod','Alt','Shift'].filter(m => mods.has(m)), key].join('+');
}
const RESERVED = new Set(['Mod+W','Mod+Q','Mod+R','Mod+T','Mod+N','Mod+L','Mod+P','Mod+S','Mod+F','Mod+G','Mod+H','Mod+J','Mod+U','Mod+O','Mod+I','Mod+D','Mod+E','Mod+X','Mod+C','Mod+V','Mod+A','Mod+Z','Mod+Y','Mod+Tab','Mod+Shift+Z','Mod+Shift+T','Alt+F4','Alt+ArrowLeft','Alt+ArrowRight','Mod+Alt+Delete','Mod+Shift+I','Mod+Shift+J','Mod+Shift+C']);
export function resolveShortcutOverrides(overrides?: Record<string,string|null>): Record<string,string|null> {
  return Object.fromEntries(COMMAND_CATALOG.map(c => [c.id, overrides && Object.prototype.hasOwnProperty.call(overrides,c.id) ? overrides[c.id] : c.defaultShortcut]));
}
export function validateShortcut(value: string, ignoredId?: string, overrides?: Record<string,string|null>): { valid: boolean; normalized?: string; error?: string } {
  const normalized = normalizeShortcut(value);
  if (!normalized) return { valid: false, error: 'Enter a key with Mod or Alt (or ?).' };
  if (normalized !== '?' && !normalized.split('+').some(m => ['Mod','Alt'].includes(m))) return { valid: false, error: 'A shortcut needs Mod or Alt.' };
  if (normalized === '?' || /^[A-Z]$/.test(normalized)) { if (normalized !== '?') return { valid: false, error: 'A shortcut needs Mod or Alt.' }; }
  if (RESERVED.has(normalized)) return { valid: false, error: 'That shortcut is reserved by the browser or operating system.' };
  const current = resolveShortcutOverrides(overrides);
  if (Object.entries(current).some(([id,shortcut]) => id !== ignoredId && shortcut === normalized)) return { valid: false, error: 'That shortcut is already assigned.' };
  return { valid: true, normalized };
}
export function formatShortcut(shortcut: string | null): string {
  if (!shortcut) return 'Unassigned';
  if (shortcut === '?') return '?';
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
  return shortcut.split('+').map(part => part === 'Mod' ? (isMac ? '⌘' : 'Ctrl') : part === 'Alt' ? (isMac ? 'Option' : 'Alt') : part === 'Comma' ? ',' : part).join(isMac ? ' ' : '+');
}
export function isEditableTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el && (el.isContentEditable || !!el.closest?.('input, textarea, select, [contenteditable="true"], [role="textbox"]'));
}
export function isDialogOpen(): boolean { return !!document.querySelector('[role="dialog"][aria-modal="true"]'); }
export function isShortcutRecordingTarget(target: EventTarget | null): boolean { return !!(target as HTMLElement | null)?.closest?.('[data-shortcut-recording="true"]'); }
export function matchesShortcut(event: KeyboardEvent, shortcut: string | null): boolean {
  if (!shortcut) return false;
  if (shortcut === '?') return event.key === '?' && !event.ctrlKey && !event.metaKey && !event.altKey;
  const parts = shortcut.split('+'); const key = parts[parts.length-1];
  const wantsMod = parts.includes('Mod');
  const codeKey = /^Key[A-Z]$/.test(event.code) ? event.code.slice(3) : /^Digit[0-9]$/.test(event.code) ? event.code.slice(5) : null;
  const keyMatches = key === 'Comma' ? event.code === 'Comma' : (parts.includes('Alt') && codeKey ? codeKey.toLowerCase() === key.toLowerCase() : event.key.toLowerCase() === key.toLowerCase());
  return keyMatches && (wantsMod ? (event.ctrlKey || event.metaKey) : (!event.ctrlKey && !event.metaKey)) && event.altKey === parts.includes('Alt') && event.shiftKey === parts.includes('Shift');
}
