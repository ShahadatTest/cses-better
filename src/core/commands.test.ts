import { describe, expect, it } from 'vitest';
import { matchesShortcut, normalizeShortcut, resolveShortcutOverrides, validateShortcut } from './commands';

const keyEvent = (init: Partial<KeyboardEvent>) => ({ key: '', code: '', ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...init } as KeyboardEvent);

describe('command shortcuts', () => {
  it('normalizes aliases and recognizes platform Mod plus comma', () => {
    expect(normalizeShortcut('Ctrl + ,')).toBe('Mod+Comma');
    expect(matchesShortcut(keyEvent({ key: ',', code: 'Comma', ctrlKey: true }), 'Mod+Comma')).toBe(true);
  });
  it('matches ? with shift and ignores unwanted modifiers', () => {
    expect(matchesShortcut(keyEvent({ key: '?', shiftKey: true }), '?')).toBe(true);
    expect(matchesShortcut(keyEvent({ key: '?', shiftKey: true, ctrlKey: true }), '?')).toBe(false);
  });
  it('uses physical keys for Alt shortcuts when macOS Option changes the produced character', () => {
    expect(matchesShortcut(keyEvent({ key: '¡', code: 'Digit1', metaKey: true, altKey: true }), 'Mod+Alt+1')).toBe(true);
    expect(matchesShortcut(keyEvent({ key: 'Ω', code: 'KeyZ', metaKey: true, altKey: true }), 'Mod+Alt+Z')).toBe(true);
  });
  it('requires a modifier, rejects reserved or duplicate shortcuts, and preserves null disables', () => {
    expect(validateShortcut('A').valid).toBe(false);
    expect(validateShortcut('Mod+W').valid).toBe(false);
    expect(validateShortcut('Mod+K', 'run').valid).toBe(false);
    expect(resolveShortcutOverrides({ run: null }).run).toBeNull();
  });
});
