// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { matchesShortcut, normalizeShortcut, resolveShortcutOverrides, validateShortcut } from '../src/core/commands';

describe('keyboard binding compatibility', () => {
  it('matches the settings default and a shifted question mark', () => {
    const bindings = resolveShortcutOverrides();
    expect(matchesShortcut(new KeyboardEvent('keydown', { key: ',', code: 'Comma', ctrlKey: true }), bindings.settings)).toBe(true);
    expect(matchesShortcut(new KeyboardEvent('keydown', { key: '?', code: 'Slash', shiftKey: true }), bindings.help)).toBe(true);
    expect(validateShortcut('?', 'help', {}).normalized).toBe('?');
  });
  it('matches Option-modified physical keys on macOS', () => {
    expect(matchesShortcut(new KeyboardEvent('keydown', { key: '¡', code: 'Digit1', metaKey: true, altKey: true }), 'Mod+Alt+1')).toBe(true);
  });
  it('retains explicit disabled commands and rejects duplicate bindings', () => {
    expect(resolveShortcutOverrides({ run: null }).run).toBeNull();
    expect(validateShortcut('Mod+K', 'run', {}).valid).toBe(false);
    expect(normalizeShortcut('Ctrl + Shift + Enter')).toBe('Mod+Shift+Enter');
  });
  it.each(['Mod+R', 'Mod+W', 'Mod+Shift+Z', 'Alt+ArrowLeft'])('preserves native shortcut %s', value => {
    expect(validateShortcut(value, 'run', {}).valid).toBe(false);
  });
});
