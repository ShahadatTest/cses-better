import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';
import { TestCase } from '@/core/types';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const problemId = params.id;
  if (!problemId || !/^\d+$/.test(problemId)) {
    return NextResponse.json({ error: 'Valid numeric Problem ID is required' }, { status: 400 });
  }

  const searchParams = request.nextUrl.searchParams;
  const isJson = searchParams.get('format') === 'json';

  try {
    // Fetch official test case zip from community mirror
    const zipUrl = `https://cses-tests.pages.dev/${problemId}.zip`;
    const res = await fetch(zipUrl, {
      headers: {
        'User-Agent': 'CSES-Better-Platform/1.0',
      },
      next: { revalidate: 86400 }, // Cache 24 hours
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Official test cases not found for problem ${problemId}` },
        { status: 404 }
      );
    }

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // If JSON requested: parse zip into structured TestCase[]
    if (isJson) {
      const zip = await JSZip.loadAsync(buffer);
      const inFiles = Object.keys(zip.files).filter((f) => f.endsWith('.in'));

      // Sort numerically by file index
      const nums = inFiles
        .map((f) => {
          const m = f.match(/^(\d+)\.in$/);
          return m ? parseInt(m[1], 10) : null;
        })
        .filter((n): n is number => n !== null)
        .sort((a, b) => a - b);

      const testCases: TestCase[] = [];
      for (const num of nums) {
        const inFile = zip.file(`${num}.in`);
        const outFile = zip.file(`${num}.out`);

        if (inFile && outFile) {
          const input = await inFile.async('text');
          const expectedOutput = await outFile.async('text');

          testCases.push({
            id: `official-${num}`,
            input,
            expectedOutput,
            isSample: num === 1,
          });
        }
      }

      return NextResponse.json({
        problemId,
        totalTests: testCases.length,
        testCases,
      });
    }

    // Default: serve the binary .zip archive for direct download
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="cses_${problemId}_tests.zip"`,
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch official tests' },
      { status: 500 }
    );
  }
}
