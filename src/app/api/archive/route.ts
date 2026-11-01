import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { CsesArchiveEntry } from '@/core/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q')?.toLowerCase().trim() || '';
    const category = searchParams.get('category')?.toLowerCase().trim() || '';
    const user = searchParams.get('user')?.toLowerCase().trim() || '';
    const sortBy = searchParams.get('sort') || 'id';
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const archivePath = path.join(process.cwd(), 'src/data/archive/archive.json');
    if (!fs.existsSync(archivePath)) {
      return NextResponse.json({ total: 0, items: [] });
    }

    const archiveData: CsesArchiveEntry[] = JSON.parse(
      fs.readFileSync(archivePath, 'utf-8')
    );

    let filtered = archiveData.filter((entry) => {
      if (query) {
        const matchesTitle = entry.title.toLowerCase().includes(query);
        const matchesId = entry.problemId.includes(query);
        if (!matchesTitle && !matchesId) return false;
      }

      if (category && entry.category.toLowerCase() !== category) {
        return false;
      }

      if (user) {
        const inFastest = (entry.fastest || []).some((f) =>
          f.user.toLowerCase().includes(user)
        );
        const inShortest = (entry.shortest || []).some((s) =>
          s.user.toLowerCase().includes(user)
        );
        if (!inFastest && !inShortest) return false;
      }

      return true;
    });

    // Sorting
    if (sortBy === 'solved') {
      filtered.sort((a, b) => (b.solvedBy || 0) - (a.solvedBy || 0));
    } else if (sortBy === 'rate') {
      filtered.sort((a, b) => parseFloat(b.successRate) - parseFloat(a.successRate));
    } else {
      filtered.sort((a, b) => parseInt(a.problemId, 10) - parseInt(b.problemId, 10));
    }

    const paginated = filtered.slice(0, limit);

    return NextResponse.json({
      total: filtered.length,
      limit,
      items: paginated,
    });
  } catch (error: any) {
    console.error('[Archive API] Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to query CSES archive' },
      { status: 500 }
    );
  }
}
