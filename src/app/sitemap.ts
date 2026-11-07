import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_APP_URL || 'https://cses-better.vercel.app';
  return ['/', '/practice', '/privacy'].map((path) => ({ url: `${base}${path}`, lastModified: new Date() }));
}
