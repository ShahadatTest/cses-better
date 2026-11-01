import { NextRequest, NextResponse } from 'next/server';
import { csesRequest, extractCsrfToken, CSES_BASE_URL } from '@/core/cses-network';
import { ProblemStats, LeaderboardEntry } from '@/core/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface CacheEntry {
  stats: ProblemStats;
  timestamp: number;
}

// In-memory cache for stats (TTL: 60 seconds)
const statsCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60 * 1000;

// Shared server-side CSES session for stats scraping
let cachedCsesCookie = '';
let cookieExpiresAt = 0;

async function getCsesSession(): Promise<string> {
  const now = Date.now();
  if (cachedCsesCookie && now < cookieExpiresAt) {
    return cachedCsesCookie;
  }

  try {
    const loginPage = await csesRequest(`${CSES_BASE_URL}/login`);
    const csrfToken = extractCsrfToken(loginPage.body);
    const initialCookie = loginPage.cookies;

    if (csrfToken) {
      const postBody = new URLSearchParams({
        csrf_token: csrfToken,
        nick: 'csesbetter99',
        pass: 'SecretPass12345!',
      }).toString();

      const authRes = await csesRequest(`${CSES_BASE_URL}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postBody).toString(),
        },
        body: postBody,
        cookie: initialCookie,
      });

      const sessionCookie = authRes.cookies || initialCookie;
      cachedCsesCookie = sessionCookie;
      cookieExpiresAt = now + 45 * 60 * 1000; // 45 min TTL
      return cachedCsesCookie;
    }
  } catch (err) {
    console.warn('[CSES Stats Session] Auth handshake notice:', err);
  }

  return '';
}

function parseStatsHtml(html: string): ProblemStats {
  let solvedBy = 0;
  let attemptedBy = 0;
  let successRate = '0.0%';

  const solvedMatch = html.match(/Solved by:<\/td>\s*<td\s*>([\d,]+)<\/td>/i);
  if (solvedMatch) solvedBy = parseInt(solvedMatch[1].replace(/,/g, ''), 10);

  const attemptedMatch = html.match(/Attempted by:<\/td>\s*<td\s*>([\d,]+)<\/td>/i);
  if (attemptedMatch) attemptedBy = parseInt(attemptedMatch[1].replace(/,/g, ''), 10);

  const successMatch = html.match(/Success rate:<\/td>\s*<td\s*>([^<]+)<\/td>/i);
  if (successMatch) successRate = successMatch[1].trim();

  function parseTable(headingRegex: RegExp): LeaderboardEntry[] {
    const headingMatch = html.match(headingRegex);
    if (!headingMatch) return [];
    const tableStart = html.indexOf('<table', headingMatch.index);
    if (tableStart === -1) return [];
    const tableEnd = html.indexOf('</table>', tableStart);
    if (tableEnd === -1) return [];
    const tableHtml = html.slice(tableStart, tableEnd + 8);

    const rows = [
      ...tableHtml.matchAll(
        /<tr>\s*<td\s*>#?(\d+)<\/td>\s*<td\s*>(?:<a[^>]*>)?([^<]+)(?:<\/a>)?<\/td>\s*<td\s*>([^<]+)<\/td>\s*<td\s*>([^<]+)<\/td>\s*<\/tr>/gi
      ),
    ];

    return rows.map((r) => ({
      rank: parseInt(r[1], 10),
      user: r[2].trim(),
      language: r[3].trim(),
      score: r[4].trim(),
    }));
  }

  const fastest = parseTable(/<h3>Fastest code/i);
  const shortest = parseTable(/<h3>Shortest code/i);

  return {
    solvedBy,
    attemptedBy,
    successRate,
    fastest,
    shortest,
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const problemId = params.id;
  if (!problemId || !/^\d+$/.test(problemId)) {
    return NextResponse.json({ error: 'Valid numeric Problem ID is required' }, { status: 400 });
  }

  const searchParams = request.nextUrl.searchParams;
  const forceRefresh = searchParams.get('refresh') === 'true';

  const now = Date.now();
  const cached = statsCache.get(problemId);

  // Return from cache if valid and not force-refreshing
  if (!forceRefresh && cached && now - cached.timestamp < CACHE_TTL_MS) {
    return NextResponse.json({
      problemId,
      source: 'cache',
      cachedAt: cached.timestamp,
      ageSeconds: Math.round((now - cached.timestamp) / 1000),
      stats: cached.stats,
    });
  }

  try {
    const sessionCookie = await getCsesSession();
    const url = `${CSES_BASE_URL}/problemset/stats/${problemId}/`;
    const res = await csesRequest(url, {
      cookie: sessionCookie,
    });

    if (res.statusCode === 200 && !res.body.includes('Please login')) {
      const stats = parseStatsHtml(res.body);
      statsCache.set(problemId, { stats, timestamp: now });

      return NextResponse.json({
        problemId,
        source: 'live',
        cachedAt: now,
        ageSeconds: 0,
        stats,
      });
    }

    // If session expired, invalidate cookie and try once more
    if (res.body.includes('Please login')) {
      cachedCsesCookie = '';
      const retryCookie = await getCsesSession();
      const retryRes = await csesRequest(url, { cookie: retryCookie });
      if (retryRes.statusCode === 200 && !retryRes.body.includes('Please login')) {
        const stats = parseStatsHtml(retryRes.body);
        statsCache.set(problemId, { stats, timestamp: now });
        return NextResponse.json({
          problemId,
          source: 'live',
          cachedAt: now,
          ageSeconds: 0,
          stats,
        });
      }
    }

    // Fallback to cached if available
    if (cached) {
      return NextResponse.json({
        problemId,
        source: 'stale-cache',
        cachedAt: cached.timestamp,
        stats: cached.stats,
      });
    }

    return NextResponse.json(
      { error: `CSES stats returned HTTP ${res.statusCode}` },
      { status: res.statusCode || 502 }
    );
  } catch (err: any) {
    console.error(`[CSES Stats ${problemId}] Fetch error:`, err);
    if (cached) {
      return NextResponse.json({
        problemId,
        source: 'stale-cache',
        cachedAt: cached.timestamp,
        stats: cached.stats,
      });
    }
    return NextResponse.json(
      { error: err?.message || 'Failed to fetch CSES live stats' },
      { status: 500 }
    );
  }
}
