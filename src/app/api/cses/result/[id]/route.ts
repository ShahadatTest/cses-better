import { NextRequest, NextResponse } from 'next/server';
import { csesRequest, CSES_BASE_URL, getSharedCsesSession } from '@/core/cses-network';
import { CsesVerdictResult, CsesTestDetail } from '@/core/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function unescapeHtml(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const submissionId = params.id;
  if (!submissionId || !/^\d+$/.test(submissionId)) {
    return NextResponse.json({ error: 'Valid numeric submission ID is required' }, { status: 400 });
  }

  try {
    const sessionCookie = await getSharedCsesSession();
    const url = `${CSES_BASE_URL}/problemset/result/${submissionId}/`;
    const res = await csesRequest(url, { cookie: sessionCookie });

    if (res.statusCode === 404) {
      return NextResponse.json({ error: 'CSES submission not found or private' }, { status: 404 });
    }

    const html = res.body;

    // Parse status
    let status: CsesVerdictResult['status'] = 'UNKNOWN';
    let rawStatusText = 'PENDING';

    const statusMatch = html.match(/Result:<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/i);
    if (statusMatch) {
      rawStatusText = statusMatch[1].replace(/<[^>]+>/g, '').trim();
    } else {
      const genericStatusMatch = html.match(/class="status\s+([^"]+)"/i);
      if (genericStatusMatch) {
        rawStatusText = genericStatusMatch[1].toUpperCase();
      }
    }

    const upperRaw = rawStatusText.toUpperCase();
    if (upperRaw.includes('READY') || upperRaw.includes('PENDING')) {
      status = 'PENDING';
    } else if (upperRaw.includes('TESTING')) {
      status = 'TESTING';
    } else if (upperRaw.includes('ACCEPTED')) {
      status = 'ACCEPTED';
    } else if (upperRaw.includes('WRONG ANSWER')) {
      status = 'WRONG ANSWER';
    } else if (upperRaw.includes('TIME LIMIT')) {
      status = 'TIME LIMIT EXCEEDED';
    } else if (upperRaw.includes('OUTPUT LIMIT')) {
      status = 'OUTPUT LIMIT EXCEEDED';
    } else if (upperRaw.includes('COMPILE ERROR') || upperRaw.includes('COMPILATION')) {
      status = 'COMPILE ERROR';
    } else if (upperRaw.includes('RUNTIME ERROR')) {
      status = 'RUNTIME ERROR';
    } else {
      status = upperRaw as any;
    }

    // Parse Language
    let language: string | undefined;
    const langMatch = html.match(/Language:<\/td>\s*<td[^>]*>([^<]+)<\/td>/i);
    if (langMatch) language = langMatch[1].trim();

    // Parse Total Time & Memory
    let totalTime: string | undefined;
    let totalMemory: string | undefined;

    const timeMatch = html.match(/Total time:<\/td>\s*<td[^>]*>([^<]+)<\/td>/i);
    if (timeMatch) totalTime = timeMatch[1].trim();

    const memMatch = html.match(/Total memory:<\/td>\s*<td[^>]*>([^<]+)<\/td>/i);
    if (memMatch) totalMemory = memMatch[1].trim();

    // Parse Source Code
    let code: string | undefined;
    const codeMatch =
      html.match(/<pre[^>]*class="[^"]*prettyprint[^"]*"[^>]*>([\s\S]*?)<\/pre>/i) ||
      html.match(/<pre[^>]*class="[^"]*linenums[^"]*"[^>]*>([\s\S]*?)<\/pre>/i) ||
      html.match(/<h3>Code<\/h3>\s*<pre[^>]*>([\s\S]*?)<\/pre>/i);

    if (codeMatch) {
      code = unescapeHtml(codeMatch[1]).trim();
    }

    // Parse compiler diagnostics
    let compilerOutput: string | undefined;
    const compilerMatch =
      html.match(/<pre class="compiler-output">([\s\S]*?)<\/pre>/i) ||
      html.match(/<h3>Compiler message<\/h3>\s*<pre>([\s\S]*?)<\/pre>/i);
    if (compilerMatch) {
      compilerOutput = compilerMatch[1].trim();
    }

    // Parse test breakdown
    const tests: CsesTestDetail[] = [];
    const tableRowRegex = /<tr>\s*<td>#?(\d+)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/gi;
    let rowMatch;

    while ((rowMatch = tableRowRegex.exec(html)) !== null) {
      const idx = parseInt(rowMatch[1], 10);
      const verdict = rowMatch[2].replace(/<[^>]+>/g, '').trim();
      const time = rowMatch[3].replace(/<[^>]+>/g, '').trim();

      if (!isNaN(idx) && verdict) {
        tests.push({
          index: idx,
          verdict,
          time,
        });
      }
    }

    const result: CsesVerdictResult = {
      submissionId,
      status,
      rawStatusText,
      totalTime,
      totalMemory,
      compilerOutput,
      code,
      language,
      tests,
      resultUrl: url,
    };

    return NextResponse.json(result);
  } catch (error: any) {
    console.error(`[CSES Result ${submissionId}] Error:`, error);
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch CSES submission result' },
      { status: 500 }
    );
  }
}
