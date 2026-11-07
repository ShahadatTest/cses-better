import type { MetadataRoute } from 'next';
import { absoluteSiteUrl } from '@/core/seo';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/api/', '/auth/'] },
    sitemap: absoluteSiteUrl('/sitemap.xml'),
    host: absoluteSiteUrl('/'),
  };
}
