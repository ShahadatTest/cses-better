import { afterEach, describe, expect, it, vi } from 'vitest';
import sitemap from './sitemap';
import robots from './robots';
import { contestProblems } from '@/data/olympiad';

describe('SEO route maps', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('lists only canonical paths on the configured production origin', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://example.com');
    const entries = sitemap();
    const urls = entries.map((entry) => entry.url);

    expect(urls).toContain('https://example.com/');
    expect(urls).toContain('https://example.com/practice');
    expect(urls).toContain('https://example.com/privacy');
    expect(urls).toContain('https://example.com/practice/1068');
    expect(urls).toContain(`https://example.com/olympiad/${encodeURIComponent(contestProblems[0].id)}`);
    expect(new Set(urls).size).toBe(urls.length);
    expect(entries.every((entry) => entry.lastModified === undefined)).toBe(true);
    expect(urls.every((url) => url.startsWith('https://example.com/'))).toBe(true);
  });

  it('publishes the sitemap and excludes API and auth endpoints from crawling', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://example.com');
    const policy = robots();

    expect(policy.sitemap).toBe('https://example.com/sitemap.xml');
    expect(policy.rules).toMatchObject({ allow: '/', disallow: ['/api/', '/auth/'] });
  });
});
