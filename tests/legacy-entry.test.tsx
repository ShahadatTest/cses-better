// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LegacyEntry } from '../src/components/LegacyEntry';

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const roots: Root[] = [];

function renderAt(url: string) {
  window.history.replaceState(null, '', url);
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  roots.push(root);
  const redirect = vi.fn();
  act(() => root.render(<LegacyEntry redirect={redirect} />));
  return redirect;
}

afterEach(() => {
  for (const root of roots.splice(0)) act(() => root.unmount());
  document.body.innerHTML = '';
});

describe('LegacyEntry browser routing', () => {
  it('moves numeric problem hash links to the practice workspace', () => {
    const redirect = renderAt('/#1142');
    expect(redirect).toHaveBeenCalledWith('/practice/1142');
  });

  it('preserves OAuth callback query parameters when routing to practice', () => {
    const redirect = renderAt('/?auth_error=expired%20link');
    expect(redirect).toHaveBeenCalledWith('/practice?auth_error=expired%20link');
  });

  it('moves successful OAuth callback parameters to the workspace', () => {
    const redirect = renderAt('/?auth_success=true');
    expect(redirect).toHaveBeenCalledWith('/practice?auth_success=true');
  });

  it('leaves valid landing section hashes on the landing page', () => {
    const redirect = renderAt('/#learn');
    expect(redirect).not.toHaveBeenCalled();
    expect(window.location.pathname).toBe('/');
    expect(window.location.hash).toBe('#learn');
  });
});
