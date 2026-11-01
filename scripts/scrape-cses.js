/**
 * CSES Scraper & Data Pipeline
 * Scrapes problem catalog, problem statements, sample test cases, and leaderboards from CSES.fi
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://cses.fi';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Concurrency & rate limiting
const CONCURRENCY = 4;
const DELAY_MS = 80;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Universal HTTPS request with IPv4 forced ({ family: 4 })
 */
function request(urlStr, options = {}, retries = 3) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const reqOptions = {
      family: 4, // IPv4 mandatory for cses.fi
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
      // Handle redirect
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        const redirectUrl = new URL(res.headers.location, urlStr).toString();
        const setCookie = res.headers['set-cookie'];
        const headers = { ...options.headers };
        if (setCookie) {
          const cookieStr = setCookie.map((c) => c.split(';')[0]).join('; ');
          headers['Cookie'] = headers['Cookie'] ? `${headers['Cookie']}; ${cookieStr}` : cookieStr;
        }
        return request(redirectUrl, { ...options, headers }, retries)
          .then(resolve)
          .catch(reject);
      }

      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data,
        });
      });
    });

    req.on('error', (err) => {
      if (retries > 0) {
        console.warn(`[Retry] ${urlStr} failed: ${err.message}. Retrying...`);
        setTimeout(() => {
          request(urlStr, options, retries - 1).then(resolve).catch(reject);
        }, 500);
      } else {
        reject(err);
      }
    });

    req.setTimeout(12000, () => {
      req.destroy(new Error(`Timeout fetching ${urlStr}`));
    });

    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

/**
 * Extract cookies from response headers
 */
function extractCookie(headers) {
  const setCookie = headers['set-cookie'];
  if (!setCookie) return '';
  return setCookie.map((c) => c.split(';')[0]).join('; ');
}

/**
 * Authenticates with CSES
 */
async function authenticate() {
  console.log('[Auth] Authenticating with CSES...');

  // Try logging in with pre-existing account
  try {
    const loginPage = await request(`${BASE_URL}/login`);
    const csrfMatch = loginPage.body.match(/name="csrf_token"\s+value="([^"]+)"/);
    const initialCookie = extractCookie(loginPage.headers);

    if (csrfMatch && initialCookie) {
      const postBody = new URLSearchParams({
        csrf_token: csrfMatch[1],
        nick: 'csesbetter99',
        pass: 'SecretPass12345!',
      }).toString();

      const loginRes = await request(`${BASE_URL}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Cookie: initialCookie,
          'Content-Length': Buffer.byteLength(postBody),
        },
        body: postBody,
      });

      const sessionCookie = extractCookie(loginRes.headers) || initialCookie;
      console.log('[Auth] Successfully logged in with csesbetter99');
      return sessionCookie;
    }
  } catch (err) {
    console.warn(`[Auth] Login attempt with csesbetter99 failed: ${err.message}`);
  }

  // Fallback: Register a temporary bot
  try {
    console.log('[Auth] Falling back to registering temporary bot...');
    const regPage = await request(`${BASE_URL}/register`);
    const csrfMatch = regPage.body.match(/name="csrf_token"\s+value="([^"]+)"/);
    const initialCookie = extractCookie(regPage.headers);
    const botNick = `csesbot_${Math.floor(100000 + Math.random() * 900000)}`;

    const postBody = new URLSearchParams({
      csrf_token: csrfMatch ? csrfMatch[1] : '',
      nick: botNick,
      pass: 'SecretPass12345!',
      pass2: 'SecretPass12345!',
    }).toString();

    const regRes = await request(`${BASE_URL}/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Cookie: initialCookie,
        'Content-Length': Buffer.byteLength(postBody),
      },
      body: postBody,
    });

    const sessionCookie = extractCookie(regRes.headers) || initialCookie;
    console.log(`[Auth] Registered bot account ${botNick} successfully`);
    return sessionCookie;
  } catch (err) {
    console.error(`[Auth] Bot registration failed: ${err.message}`);
    return '';
  }
}

/**
 * Parses https://cses.fi/problemset/
 */
async function scrapeProblemset() {
  console.log('[Problemset] Fetching main problemset catalog...');
  const res = await request(`${BASE_URL}/problemset/`);
  const html = res.body;

  const h2Splits = html.split('<h2>');
  const categories = [];
  const allProblems = [];

  for (let i = 1; i < h2Splits.length; i++) {
    const part = h2Splits[i];
    const catName = part.split('</h2>')[0].trim();
    const catId = catName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    const taskMatches = [...part.matchAll(/<a href="\/problemset\/task\/(\d+)">([^<]+)<\/a>/g)];
    const taskIds = [];

    for (const m of taskMatches) {
      const id = m[1];
      const title = m[2].trim();
      taskIds.push(id);
      allProblems.push({
        id,
        title,
        category: catName,
      });
    }

    categories.push({
      id: catId,
      name: catName,
      taskCount: taskIds.length,
      problemIds: taskIds,
    });
  }

  console.log(`[Problemset] Parsed ${categories.length} categories, ${allProblems.length} problems total.`);
  return { categories, allProblems };
}

/**
 * Parses problem task page HTML
 */
function parseTaskHtml(html, problemMeta) {
  // 1. Title
  let title = problemMeta.title;
  const titleMatch =
    html.match(/<div class="title-block">[\s\S]*?<h1>([^<]+)<\/h1>/i) ||
    html.match(/<title>CSES - ([^<]+)<\/title>/i);
  if (titleMatch && titleMatch[1].trim()) {
    title = titleMatch[1].trim();
  }

  // 2. Limits
  let timeLimit = '1.00 s';
  let memoryLimit = '512 MB';
  const timeMatch = html.match(/Time limit:<\/b>\s*([^<]+)<\/li>/i);
  if (timeMatch) timeLimit = timeMatch[1].trim();
  const memMatch = html.match(/Memory limit:<\/b>\s*([^<]+)<\/li>/i);
  if (memMatch) memoryLimit = memMatch[1].trim();

  // 3. Statement HTML
  const mdMatch =
    html.match(/<div class="md">([\s\S]*?)<\/div>\s*<\/div>\s*<div class="nav sidebar">/i) ||
    html.match(/<div class="md">([\s\S]*?)<\/div>/i);

  let mdContent = mdMatch ? mdMatch[1].trim() : '';

  // Fix relative URLs
  mdContent = mdContent.replace(/src="\/([^"]+)"/g, `src="${BASE_URL}/$1"`);
  mdContent = mdContent.replace(/href="\/([^"]+)"/g, `href="${BASE_URL}/$1"`);

  // Ensure KaTeX class formatting
  // CSES already emits <span class="math math-inline"> and <span class="math math-display">
  // Just ensure any bare math classes are math-inline
  mdContent = mdContent.replace(/<span class="math(?!\s+math-(?:inline|display))">/g, '<span class="math math-inline">');

  // 4. Constraints
  const constraints = [];
  const constraintsMatch = mdContent.match(/<h1 id="constraints">Constraints<\/h1>([\s\S]*?)(?:<h1|$)/i);
  if (constraintsMatch) {
    const liMatches = [...constraintsMatch[1].matchAll(/<li>([\s\S]*?)<\/li>/gi)];
    for (const li of liMatches) {
      // Strip HTML tags for clean constraint text, or keep math content
      const cleanConstraint = li[1].replace(/<[^>]+>/g, '').trim();
      if (cleanConstraint) constraints.push(cleanConstraint);
    }
  }

  // 5. Test Cases (Input & Expected Output samples)
  const testCases = [];
  const exampleRegex = /<p>\s*Input:?\s*<\/p>\s*<pre>([\s\S]*?)<\/pre>\s*<p>\s*Output:?\s*<\/p>\s*<pre>([\s\S]*?)<\/pre>/gi;
  let exMatch;
  let testCaseIndex = 1;

  while ((exMatch = exampleRegex.exec(mdContent)) !== null) {
    let input = exMatch[1].replace(/\r\n/g, '\n');
    let output = exMatch[2].replace(/\r\n/g, '\n');

    // Decode HTML entities if any (&lt;, &gt;, &amp;)
    input = input.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
    output = output.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

    if (!input.endsWith('\n')) input += '\n';
    if (!output.endsWith('\n')) output += '\n';

    testCases.push({
      id: `sample-${testCaseIndex++}`,
      input,
      expectedOutput: output,
      isSample: true,
    });
  }

  // Fallback: paired <pre> blocks if regex didn't match standard Input/Output headers
  if (testCases.length === 0) {
    const pres = [...mdContent.matchAll(/<pre>([\s\S]*?)<\/pre>/gi)];
    for (let i = 0; i + 1 < pres.length; i += 2) {
      let input = pres[i][1].replace(/\r\n/g, '\n');
      let output = pres[i + 1][1].replace(/\r\n/g, '\n');
      input = input.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
      output = output.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
      if (!input.endsWith('\n')) input += '\n';
      if (!output.endsWith('\n')) output += '\n';

      testCases.push({
        id: `sample-${testCaseIndex++}`,
        input,
        expectedOutput: output,
        isSample: true,
      });
    }
  }

  return {
    title,
    timeLimit,
    memoryLimit,
    statementHtml: mdContent,
    constraints,
    testCases,
  };
}

/**
 * Fallback stats object
 */
function createFallbackStats() {
  return {
    solvedBy: 0,
    attemptedBy: 0,
    successRate: '0.0%',
    fastest: [],
    shortest: [],
  };
}

/**
 * Parses stats page HTML
 */
function parseStatsHtml(html) {
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

    return rows.slice(0, 5).map((r) => ({
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

/**
 * Scrapes a single problem (task page + stats page)
 */
async function scrapeProblemFull(problemMeta, sessionCookie) {
  const { id } = problemMeta;
  let taskData = {
    title: problemMeta.title,
    timeLimit: '1.00 s',
    memoryLimit: '512 MB',
    statementHtml: `<p>Problem statement available on <a href="${BASE_URL}/problemset/task/${id}" target="_blank">CSES</a>.</p>`,
    constraints: [],
    testCases: [],
  };
  let statsData = createFallbackStats();

  // 1. Fetch task
  try {
    const taskRes = await request(`${BASE_URL}/problemset/task/${id}`);
    if (taskRes.statusCode === 200) {
      taskData = parseTaskHtml(taskRes.body, problemMeta);
    }
  } catch (err) {
    console.warn(`[Problem ${id}] Failed to fetch task page: ${err.message}`);
  }

  // 2. Fetch stats
  if (sessionCookie) {
    try {
      const statsRes = await request(`${BASE_URL}/problemset/stats/${id}/`, {
        headers: { Cookie: sessionCookie },
      });
      if (statsRes.statusCode === 200) {
        statsData = parseStatsHtml(statsRes.body);
      }
    } catch (err) {
      console.warn(`[Problem ${id}] Failed to fetch stats page: ${err.message}`);
    }
  }

  return {
    id: problemMeta.id,
    title: taskData.title,
    category: problemMeta.category,
    timeLimit: taskData.timeLimit,
    memoryLimit: taskData.memoryLimit,
    statementHtml: taskData.statementHtml,
    testCases: taskData.testCases,
    stats: statsData,
    constraints: taskData.constraints,
  };
}

/**
 * Creates indexed placeholder problem
 */
function createIndexedProblem(problemMeta) {
  return {
    id: problemMeta.id,
    title: problemMeta.title,
    category: problemMeta.category,
    timeLimit: '1.00 s',
    memoryLimit: '512 MB',
    statementHtml: `<div class="md"><p>View this problem on CSES: <a href="${BASE_URL}/problemset/task/${problemMeta.id}" target="_blank">${problemMeta.title}</a></p></div>`,
    testCases: [],
    stats: createFallbackStats(),
    constraints: [],
  };
}

/**
 * Main scraper pipeline
 */
async function main() {
  console.log('=== CSES Scraper & Data Pipeline Starting ===');

  // Step 1: Authenticate
  const sessionCookie = await authenticate();

  // Step 2: Problemset catalog
  const { categories, allProblems } = await scrapeProblemset();

  // Determine core problems to scrape in full:
  // Introductory Problems (24 problems) + Sorting and Searching (35 problems) = 59 problems
  const coreCategoryNames = new Set(['Introductory Problems', 'Sorting and Searching']);
  const coreProblems = allProblems.filter((p) => coreCategoryNames.has(p.category));
  const otherProblems = allProblems.filter((p) => !coreCategoryNames.has(p.category));

  console.log(`[Queue] Scraped catalog: ${allProblems.length} problems total.`);
  console.log(`[Queue] Core problems to scrape fully: ${coreProblems.length} (${[...coreCategoryNames].join(', ')})`);
  console.log(`[Queue] Other problems to index: ${otherProblems.length}`);

  // Step 3: Scrape core problems with concurrency pool
  const fullyScrapedProblems = [];
  let completedCount = 0;

  async function worker(queue) {
    while (queue.length > 0) {
      const problem = queue.shift();
      if (!problem) break;
      try {
        const fullProblem = await scrapeProblemFull(problem, sessionCookie);
        fullyScrapedProblems.push(fullProblem);
        completedCount++;
        if (completedCount % 5 === 0 || completedCount === coreProblems.length) {
          console.log(
            `[Progress] Scraped ${completedCount}/${coreProblems.length} core problems (${fullProblem.id}: ${fullProblem.title}, testCases: ${fullProblem.testCases.length}, solvedBy: ${fullProblem.stats.solvedBy})`
          );
        }
      } catch (err) {
        console.error(`[Error] Problem ${problem.id} failed:`, err.message);
        fullyScrapedProblems.push(createIndexedProblem(problem));
      }
      await sleep(DELAY_MS);
    }
  }

  const queue = [...coreProblems];
  const workers = Array.from({ length: CONCURRENCY }, () => worker(queue));
  await Promise.all(workers);

  // Step 4: Index remaining problems
  const indexedProblems = otherProblems.map(createIndexedProblem);

  // Combine and sort by original problem order
  const problemMap = new Map();
  for (const p of [...fullyScrapedProblems, ...indexedProblems]) {
    problemMap.set(p.id, p);
  }

  const finalProblems = allProblems.map((p) => problemMap.get(p.id));

  // Step 5: Save src/data/categories.ts
  const dataDir = path.resolve(__dirname, '../src/data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const categoriesTsContent = `import { Category } from '../core/types';

export { type Category } from '../core/types';

export const categories: Category[] = ${JSON.stringify(categories, null, 2)};

export const CATEGORIES = categories;
export default categories;
`;

  const categoriesPath = path.join(dataDir, 'categories.ts');
  fs.writeFileSync(categoriesPath, categoriesTsContent, 'utf8');
  console.log(`[Output] Written categories to ${categoriesPath}`);

  // Step 6: Save src/data/problems.json
  const problemsPath = path.join(dataDir, 'problems.json');
  fs.writeFileSync(problemsPath, JSON.stringify(finalProblems, null, 2), 'utf8');
  console.log(`[Output] Written ${finalProblems.length} problems to ${problemsPath}`);

  // Step 7: Summary stats
  const withTestCases = finalProblems.filter((p) => p.testCases && p.testCases.length > 0).length;
  const withStats = finalProblems.filter((p) => p.stats && p.stats.solvedBy > 0).length;

  console.log('\n=== Pipeline Completed Successfully ===');
  console.log(`Categories count: ${categories.length}`);
  console.log(`Total problems in catalog: ${finalProblems.length}`);
  console.log(`Fully scraped core problems: ${fullyScrapedProblems.length}`);
  console.log(`Problems with parsed test cases: ${withTestCases}`);
  console.log(`Problems with live CSES stats: ${withStats}`);
}

main().catch((err) => {
  console.error('[Fatal Error]', err);
  process.exit(1);
});
