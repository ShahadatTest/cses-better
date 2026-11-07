// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { clearAllStorage, getSettings, saveSettings } from '../src/core/storage';
import { DEFAULT_APP_SETTINGS } from '../src/core/types';

describe('appearance settings', () => {
  beforeEach(() => clearAllStorage());

  it('defaults to dark with blue accent', () => {
    expect(getSettings()).toMatchObject({ theme: 'dark', accent: 'blue' });
  });

  it('sanitizes invalid preferences and keeps compiler settings', () => {
    localStorage.setItem('cses_settings', JSON.stringify({ apiKey: 'saved-key', compilerEndpoint: '/custom', fontSize: 19, theme: 'ultraviolet', accent: 'red', shortcutOverrides: { 'editor.run': 5 } }));
    expect(getSettings()).toMatchObject({ ...DEFAULT_APP_SETTINGS, apiKey: 'saved-key', compilerEndpoint: '/custom', fontSize: 19, theme: 'dark', accent: 'blue' });
    expect(getSettings().shortcutOverrides).toEqual({});
  });

  it('persists validated appearance choices and shortcut overrides', () => {
    saveSettings({ ...DEFAULT_APP_SETTINGS, theme: 'dim', accent: 'teal', shortcutOverrides: { run: 'Mod+Shift+F9', submitCses: null } });
    expect(getSettings()).toMatchObject({ theme: 'dim', accent: 'teal', shortcutOverrides: { run: 'Mod+Shift+F9', submitCses: null } });
  });
});
