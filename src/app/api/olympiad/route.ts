import { NextResponse } from 'next/server';
import { contestProblems } from '@/data/olympiad';

export const dynamic = 'force-static';

export function GET() {
  return NextResponse.json(contestProblems, {
    headers: { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400' },
  });
}
