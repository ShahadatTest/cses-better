export type ParsedCsesResult = {
  status: 'PENDING' | 'TESTING' | 'ACCEPTED' | 'WRONG ANSWER' | 'TIME LIMIT EXCEEDED' | 'MEMORY LIMIT EXCEEDED' | 'OUTPUT LIMIT EXCEEDED' | 'COMPILE ERROR' | 'RUNTIME ERROR' | 'UNKNOWN';
  lifecycleStatus: 'READY' | 'PENDING' | 'TESTING' | 'FINISHED' | 'UNKNOWN';
  rawStatusText: string;
  totalTime?: string;
  totalMemory?: string;
  timestamp?: number;
  compilerOutput?: string;
  code?: string;
  language?: string;
  tests: { index: number; verdict: string; time: string; memory?: string; input?: string; expectedOutput?: string; actualOutput?: string; detailsUrl?: string }[];
};

export function trustedCsesDetailUrl(href: string | undefined, baseUrl: string): string | undefined {
  if (!href?.startsWith('/') || href.startsWith('//')) return;
  try {
    const base = new URL(baseUrl);
    const url = new URL(href, base);
    return url.origin === base.origin && /^\/view\/[123]\/[a-z\d_-]+$/i.test(url.pathname) && !url.search && !url.hash
      ? url.toString() : undefined;
  } catch { return undefined; }
}

const text = (html: string) => html.replace(/<br\s*\/?\s*>/gi, '\n').replace(/<[^>]*>/g, ' ')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
  .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const codeText = (html: string) => html.replace(/<br\s*\/?\s*>/gi, '\n').replace(/<\/p\s*>/gi, '\n').replace(/<[^>]*>/g, '')
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, ' ');

function tableValues(html: string, label: string): string | undefined {
  for (const row of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((cell) => text(cell[1]));
    if (cells.length > 1 && cells[0].replace(/:\s*$/, '').toLowerCase() === label.toLowerCase()) return cells[1];
    const inline = cells[0]?.match(new RegExp(`^${label}\\s*:\\s*(.+)$`, 'i'));
    if (inline) return inline[1];
  }
}

function verdict(value?: string): ParsedCsesResult['status'] {
  const v = (value || '').toUpperCase().replace(/\s+/g, ' ').trim();
  if (/\bACCEPTED\b/.test(v)) return 'ACCEPTED';
  if (/\bWRONG ANSWER\b/.test(v)) return 'WRONG ANSWER';
  if (/\bTIME LIMIT/.test(v)) return 'TIME LIMIT EXCEEDED';
  if (/\bMEMORY LIMIT/.test(v)) return 'MEMORY LIMIT EXCEEDED';
  if (/\bOUTPUT LIMIT/.test(v)) return 'OUTPUT LIMIT EXCEEDED';
  if (/\b(COMPILE|COMPILATION) ERROR\b/.test(v)) return 'COMPILE ERROR';
  if (/\bRUNTIME ERROR\b/.test(v)) return 'RUNTIME ERROR';
  if (/\b(READY|PENDING|QUEUED)\b/.test(v)) return 'PENDING';
  if (/\b(TESTING|RUNNING)\b/.test(v)) return 'TESTING';
  return 'UNKNOWN';
}

export function parseCsesResult(html: string): ParsedCsesResult {
  const lifecycleText = tableValues(html, 'Status') || text(html.match(/<[^>]*id=["']status["'][^>]*>([\s\S]*?)<\//i)?.[1] || '');
  const resultText = tableValues(html, 'Result') || lifecycleText;
  const status = verdict(resultText);
  const lifecycleStatus = status !== 'UNKNOWN' && status !== 'PENDING' && status !== 'TESTING' ? 'FINISHED'
    : /\bREADY\b/i.test(lifecycleText) ? 'READY'
    : /\b(PENDING|QUEUED)\b/i.test(lifecycleText) ? 'PENDING'
    : /\b(TESTING|RUNNING)\b/i.test(lifecycleText) ? 'TESTING'
    : status !== 'UNKNOWN' && status !== 'PENDING' && status !== 'TESTING' ? 'FINISHED' : 'UNKNOWN';

  const codeHtml = html.match(/<pre\b[^>]*class=["'][^"']*(?:prettyprint|linenums)[^"']*["'][^>]*>([\s\S]*?)<\/pre>/i)?.[1];
  const compilerOutput = html.match(/<pre\b[^>]*class=["'][^"']*compiler-output[^"']*["'][^>]*>([\s\S]*?)<\/pre>/i)?.[1]
    || html.match(/<h[1-6][^>]*>\s*Compiler message\s*<\/h[1-6]>\s*<pre\b[^>]*>([\s\S]*?)<\/pre>/i)?.[1];
  const tests: ParsedCsesResult['tests'] = [];
  for (const row of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => text(m[1]));
    if (cells.length >= 2 && /^#?\d+$/.test(cells[0])) tests.push({
      index: Number(cells[0].replace('#', '')), verdict: cells[1], time: cells[2] || '',
      memory: cells[3] && /^[\d.]+\s*(?:B|KB|MB|GB|KiB|MiB|GiB)$/i.test(cells[3]) ? cells[3] : undefined,
    });
  }
  for (const section of html.matchAll(/<h4\b[^>]*id=["']test(\d+)["'][^>]*>([\s\S]*?)(?=<h4\b|$)/gi)) {
    const body = section[2];
    const field = (name: string) => {
      let pendingLabel = '';
      for (const row of body.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
        const cells = [...row[1].matchAll(/<(th|td)\b[^>]*>([\s\S]*?)<\/\1>/gi)];
        for (const [index, cell] of cells.entries()) {
          const tag = cell[1].toLowerCase();
          const content = cell[2];
          if (tag === 'th') {
            pendingLabel = text(content).toLowerCase();
            if (cells[index + 1]) {
              const next = cells[index + 1][2];
              if (pendingLabel === name) {
                const snippet = next.match(/<(?:samp|pre)\b[^>]*>([\s\S]*?)<\/(?:samp|pre)>/i)?.[1] || next;
                return codeText(snippet);
              }
            }
          } else if (pendingLabel === name) {
            const snippet = content.match(/<(?:samp|pre)\b[^>]*>([\s\S]*?)<\/(?:samp|pre)>/i)?.[1] || content;
            return codeText(snippet);
          }
        }
      }
    };
    const href = body.match(/<a\b[^>]*href=["'](\/problemset\/result\/[^"']*\/view\/[^"']*|\/?view\/[^"']*)["']/i)?.[1];
    const index = Number(section[1]);
    const existing = tests.find((test) => test.index === index);
    if (existing) {
      existing.input = field('input'); existing.expectedOutput = field('correct output');
      existing.actualOutput = field('user output'); existing.detailsUrl = href;
    } else tests.push({
      index, verdict: text(body.match(/Verdict\s*:\s*([\s\S]*?)<\//i)?.[1] || ''),
      time: '', input: field('input'), expectedOutput: field('correct output'), actualOutput: field('user output'), detailsUrl: href,
    });
  }

  return {
    status, lifecycleStatus, rawStatusText: resultText || lifecycleText || 'Unknown CSES result',
    totalTime: tableValues(html, 'Total time'), totalMemory: tableValues(html, 'Total memory'),
    timestamp: (() => { const date = tableValues(html, 'Submission time'); const ms = date ? Date.parse(date) : NaN; return Number.isFinite(ms) ? ms : undefined; })(),
    compilerOutput: compilerOutput ? text(compilerOutput) : undefined,
    code: codeHtml ? codeText(codeHtml) : undefined,
    language: tableValues(html, 'Language'), tests,
  };
}
