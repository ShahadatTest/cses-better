import { NextRequest, NextResponse } from 'next/server';
import { csesRequest, CSES_BASE_URL } from '@/core/cses-network';
import { CsesUserProfile } from '@/core/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: { nick: string } }
) {
  const nick = params.nick;
  if (!nick) {
    return NextResponse.json({ error: 'Username is required' }, { status: 400 });
  }

  try {
    const url = `${CSES_BASE_URL}/user/${encodeURIComponent(nick)}/`;
    const res = await csesRequest(url);

    if (res.statusCode === 404 || res.body.includes('User not found')) {
      return NextResponse.json({ error: `User '${nick}' not found on CSES` }, { status: 404 });
    }

    const html = res.body;

    // Parse Display Name / Real Name
    let name: string | undefined;
    const nameMatch = html.match(/<h2>([^<]+)<\/h2>/i);
    if (nameMatch) {
      name = nameMatch[1].trim();
    }

    // Parse Country
    let country: string | undefined;
    const countryMatch = html.match(/Country:<\/td>\s*<td>([^<]+)<\/td>/i);
    if (countryMatch) {
      country = countryMatch[1].trim();
    }

    // Parse Registered date
    let registeredDate: string | undefined;
    const regMatch = html.match(/Registered:<\/td>\s*<td>([^<]+)<\/td>/i);
    if (regMatch) {
      registeredDate = regMatch[1].trim();
    }

    // Parse Solved Problems
    const solvedProblems: { id: string; name: string }[] = [];
    const taskLinkRegex = /<a href="\/problemset\/task\/(\d+)\/?">([^<]+)<\/a>/gi;
    let taskMatch;

    while ((taskMatch = taskLinkRegex.exec(html)) !== null) {
      solvedProblems.push({
        id: taskMatch[1],
        name: taskMatch[2].trim(),
      });
    }

    const userProfile: CsesUserProfile = {
      nick,
      name,
      country,
      registeredDate,
      solvedCount: solvedProblems.length,
      solvedProblems,
      officialUrl: url,
    };

    return NextResponse.json(userProfile);
  } catch (error: any) {
    console.error(`[CSES User Profile ${nick}] Error:`, error);
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch user profile' },
      { status: 500 }
    );
  }
}
