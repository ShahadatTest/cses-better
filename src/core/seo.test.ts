import { afterEach, describe, expect, it, vi } from 'vitest';
import { absoluteSiteUrl, getSiteUrl, pageMetadata } from './seo';

describe('SEO helpers', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('uses the documented Vercel origin by default and normalizes configured origins', () => {
    expect(getSiteUrl('').toString()).toBe('https://cses-better.vercel.app/');
    expect(getSiteUrl('https://example.com/path/').toString()).toBe('https://example.com/');
    expect(absoluteSiteUrl('/practice/1068', getSiteUrl('https://example.com'))).toBe(
      'https://example.com/practice/1068',
    );
  });

  it('rejects non-HTTPS production origins', () => {
    expect(() => getSiteUrl('http://example.com')).toThrow('must use HTTPS');
    expect(getSiteUrl('http://localhost:3000').toString()).toBe('http://localhost:3000/');
  });

  it('builds page metadata with matching canonical and social URLs', () => {
    const metadata = pageMetadata({ title: 'Practice Weird Algorithm', description: 'CSES practice', path: '/practice/1068' });
    expect(metadata.alternates?.canonical).toBe('/practice/1068');
    expect(metadata.openGraph).toMatchObject({ title: 'Practice Weird Algorithm', url: '/practice/1068' });
    expect(metadata.twitter).toMatchObject({ card: 'summary_large_image', title: 'Practice Weird Algorithm' });
  });
});
