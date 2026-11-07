import type { MetadataRoute } from 'next';
import problems from '@/data/problems.json';
import { contestProblems } from '@/data/olympiad';
import { absoluteSiteUrl } from '@/core/seo';

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPaths = ['/', '/practice', '/privacy'];
  const practicePaths = problems.map((problem) => `/practice/${encodeURIComponent(problem.id)}`);
  const contestPaths = contestProblems.map((problem) => `/olympiad/${encodeURIComponent(problem.id)}`);
  const paths = [...staticPaths, ...practicePaths, ...contestPaths];
  return [...new Set(paths)].map((path) => ({ url: absoluteSiteUrl(path) }));
}
