import type { Metadata } from 'next';

export const DEFAULT_SITE_URL = 'https://cses-better.vercel.app';
export const DEFAULT_SITE_TITLE = 'CSES Better — A focused CSES practice workspace';
export const DEFAULT_SITE_DESCRIPTION =
  'Practice CSES problems with an integrated editor, test runner, notes, and progress tracking.';
export const DEFAULT_OG_IMAGE = '/opengraph-image';

/** Resolve one canonical deployment origin for metadata, sitemap, robots, and social cards. */
export function getSiteUrl(value = process.env.NEXT_PUBLIC_APP_URL): URL {
  const candidate = value?.trim() || DEFAULT_SITE_URL;
  const url = new URL(candidate);
  if (url.protocol !== 'https:' && url.hostname !== 'localhost') {
    throw new Error('NEXT_PUBLIC_APP_URL must use HTTPS outside localhost.');
  }
  return new URL(url.origin);
}

export function absoluteSiteUrl(path: string, siteUrl = getSiteUrl()): string {
  return new URL(path.replace(/^\//, ''), `${siteUrl.origin}/`).toString();
}

export function pageMetadata({
  title,
  description,
  path,
}: {
  title: string;
  description: string;
  path: string;
}): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: 'website',
      siteName: 'CSES Better',
      title,
      description,
      url: path,
      images: [{ url: DEFAULT_OG_IMAGE, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [DEFAULT_OG_IMAGE],
    },
  };
}
