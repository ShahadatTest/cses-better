// @vitest-environment jsdom
import React, { act } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createRoot, Root } from 'react-dom/client';

vi.mock('../src/core/appearance-provider', () => ({
  useAppearance: () => ({ theme: 'dark', accent: 'blue', resolvedTheme: 'dark', setAppearance: vi.fn() }),
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

import { AppearanceSettings } from '../src/components/AppearanceSettings';
import { SettingsModal } from '../src/components/SettingsModal';
import { DEFAULT_APP_SETTINGS } from '../src/core/types';

describe('appearance and shortcut settings UI', () => {
  it('exposes accessible theme and accent choices', () => {
    const html = renderToStaticMarkup(<AppearanceSettings />);
    expect(html).toContain('radiogroup" aria-label="Color theme"');
    expect(html).toContain('radiogroup" aria-label="Accent color"');
    expect(html.match(/role="radio"/g)).toHaveLength(9);
    expect(html).toContain('Appearance changes apply immediately');
    expect(html).toContain('embedded OnlineCompiler editor keeps its own theme');
  });

  it('offers appearance and shortcut settings tabs by default', () => {
    const html = renderToStaticMarkup(<SettingsModal isOpen onClose={() => {}} settings={DEFAULT_APP_SETTINGS} onUpdateSettings={() => {}} />);
    expect(html).toContain('aria-label="Settings sections"');
    expect(html).toContain('Appearance</span>');
    expect(html).toContain('Shortcuts</span>');
    expect(html).toContain('aria-label="Color theme"');
  });

  it('records a valid replacement and rejects an existing shortcut conflict', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root: Root = createRoot(container);
    const onUpdateSettings = vi.fn();
    act(() => root.render(<SettingsModal isOpen onClose={() => {}} initialTab="shortcuts" settings={DEFAULT_APP_SETTINGS} onUpdateSettings={onUpdateSettings} />));
    const buttons = () => Array.from(container.querySelectorAll('button'));
    const recordPalette = () => buttons().find((button) => button.textContent === 'Record');
    const recordRun = () => buttons().find((button) => button.textContent === 'Record' && button.parentElement?.parentElement?.textContent?.includes('Run selected test'));
    act(() => recordPalette()?.click());
    let recorder = container.querySelector('[data-shortcut-recording="true"]');
    act(() => recorder?.dispatchEvent(new KeyboardEvent('keydown', { key: 'p', ctrlKey: true, altKey: true, bubbles: true, cancelable: true })));
    expect(onUpdateSettings).toHaveBeenLastCalledWith(expect.objectContaining({ shortcutOverrides: { palette: 'Mod+Alt+P' } }));

    act(() => recordRun()?.click());
    recorder = container.querySelector('[data-shortcut-recording="true"]');
    act(() => recorder?.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true, cancelable: true })));
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('already assigned');
    expect(onUpdateSettings).toHaveBeenCalledTimes(1);
    act(() => root.unmount());
    container.remove();
  });

  it('resets a binding and confirms reset all before clearing overrides', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const onUpdateSettings = vi.fn();
    const settings = { ...DEFAULT_APP_SETTINGS, shortcutOverrides: { palette: 'Mod+P' } };
    act(() => root.render(<SettingsModal isOpen onClose={() => {}} initialTab="shortcuts" settings={settings} onUpdateSettings={onUpdateSettings} />));
    act(() => buttonsWithText(container, 'Reset').at(0)?.click());
    expect(onUpdateSettings).toHaveBeenLastCalledWith(expect.objectContaining({ shortcutOverrides: {} }));
    act(() => buttonsWithText(container, 'Reset all shortcuts')[0]?.click());
    expect(container.textContent).toContain('Reset all shortcut changes?');
    act(() => buttonsWithText(container, 'Reset all')[0]?.click());
    expect(onUpdateSettings).toHaveBeenLastCalledWith(expect.objectContaining({ shortcutOverrides: {} }));
    act(() => root.unmount());
    container.remove();
  });
});

function buttonsWithText(container: HTMLElement, text: string) {
  return Array.from(container.querySelectorAll('button')).filter((button) => button.textContent?.trim() === text);
}
