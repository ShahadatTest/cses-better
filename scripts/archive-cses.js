/**
 * Continuous CSES Archive Script
 * Runs in GitHub Actions or locally to mirror problem stats, limits, and leaderboards into an indexed archive.
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://cses.fi';
const USER_AGENT = 'CSES-Better-Archive-Bot/1.0 (+https://github.com/cses-better)';
const DELAY_MS = 150; // Respectful delay between requests

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function request(urlStr, options = {}, retries = 3) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const reqOptions = {
      family: 4, // Mandatory for cses.fi
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: options.method || 'GET',
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        ...options.headers,
      },
    };

    const req = https.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
    });

    req.on('error', (err) => {
      if (retries > 0) {
        setTimeout(() => request(urlStr, options, retries - 1).then(resolve).catch(reject), 500);
      } else {
        reject(err);
      }
    });

    req.setTimeout(15000, () => req.destroy(new Error(`Timeout fetching ${urlStr}`)));
    req.end();
  });
}

function parseStats(html) {
  let solvedBy = 0;
  let attemptedBy = 0;
  let successRate = '0.0%';

  const solvedMatch = html.match(/Solved by:<\/td>\s*<td\s*>([\d,]+)<\/td>/i);
  if (solvedMatch) solvedBy = parseInt(solvedMatch[1].replace(/,/g, ''), 10);

  const attemptedMatch = html.match(/Attempted by:<\/td>\s*<td\s*>([\d,]+)<\/td>/i);
  if (attemptedMatch) attemptedBy = parseInt(attemptedMatch[1].replace(/,/g, ''), 10);

  const successMatch = html.match(/Success rate:<\/td>\s*<td\s*>([^<]+)<\/td>/i);
  if (successMatch) successRate = successMatch[1].trim();

  function parseTable(headingRegex) {
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

    return rows.slice(0, 10).map((r) => ({
      rank: parseInt(r[1], 10),
      user: r[2].trim(),
      language: r[3].trim(),
      score: r[4].trim(),
    }));
  }

  return {
    solvedBy,
    attemptedBy,
    successRate,
    fastest: parseTable(/<h3>Fastest code/i),
    shortest: parseTable(/<h3>Shortest code/i),
  };
}

async function main() {
  console.log('[CSES Archive] Starting archive generation...');
  const limitArg = process.argv.find((a) => a.startsWith('--limit='));
  const maxProblems = limitArg ? parseInt(limitArg.split('=')[1], 10) : Infinity;

  // 1. Load existing problems data to minimize network scraping
  const problemsPath = path.join(__dirname, '../src/data/problems.json');
  let baseProblems = [];
  if (fs.existsSync(problemsPath)) {
    baseProblems = JSON.parse(fs.readFileSync(problemsPath, 'utf-8'));
  }

  const archiveEntries = [];
  const targetProblems = baseProblems.slice(0, maxProblems);

  console.log(`[CSES Archive] Processing ${targetProblems.length} problems...`);

  for (let i = 0; i < targetProblems.length; i++) {
    const p = targetProblems[i];
    console.log(`[${i + 1}/${targetProblems.length}] Archiving problem ${p.id} (${p.title})...`);

    let stats = p.stats || {
      solvedBy: 0,
      attemptedBy: 0,
      successRate: '0.0%',
      fastest: [],
      shortest: [],
    };

    try {
      const statsRes = await request(`${BASE_URL}/problemset/stats/${p.id}/`);
      if (statsRes.statusCode === 200) {
        stats = parseStats(statsRes.body);
      }
    } catch (err) {
      console.warn(`[Problem ${p.id}] Stats scrape skipped: ${err.message}`);
    }

    archiveEntries.push({
      problemId: p.id,
      title: p.title,
      category: p.category,
      timeLimit: p.timeLimit || '1.00 s',
      memoryLimit: p.memoryLimit || '512 MB',
      solvedBy: stats.solvedBy,
      attemptedBy: stats.attemptedBy,
      successRate: stats.successRate,
      fastest: stats.fastest,
      shortest: stats.shortest,
      lastUpdated: new Date().toISOString(),
    });

    await sleep(DELAY_MS);
  }

  const outDir = path.join(__dirname, '../src/data/archive');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const outPath = path.join(outDir, 'archive.json');
  fs.writeFileSync(outPath, JSON.stringify(archiveEntries, null, 2), 'utf-8');
  console.log(`[CSES Archive] Saved ${archiveEntries.length} archive entries to ${outPath}`);
}

main().catch((err) => {
  console.error('[CSES Archive] Error:', err);
  process.exit(1);
});
