import { describe, it, expect } from 'vitest';
import { CsesUserProfile } from '@/core/types';

describe('cses-user-profile parsing logic', () => {
  it('correctly parses user profile HTML and solved tasks structure', () => {
    const mockUserHtml = `
      <h1>User mitcute</h1>
      <table class="summary-table narrow">
        <tr><td >Submission count:</td><td >69</td></tr>
        <tr><td >First submission:</td><td >2022-10-13 08:18:09</td></tr>
        <tr><td >Last submission:</td><td >2024-03-21 05:40:00</td></tr>
      </table>
      <h2>Languages</h2>
      <table class="narrow">
        <thead><tr><th>language</th><th>number of submissions</th><th>share</th></tr></thead>
        <tr><td>C++</td><td>46</td><td>66.67%</td></tr>
        <tr><td>Pascal</td><td>23</td><td>33.33%</td></tr>
      </table>
    `;

    const mockProblemsetHtml = `
      <h2>Statistics for mitcute</h2>
      <p>Solved tasks: 2/400</p>
      <table class="course-user-solved">
        <tr>
          <td><a href="/problemset/task/1068/" title="Weird Algorithm" class="task-score icon full"></a></td>
          <td><a href="/problemset/task/1083/" title="Missing Number" class="task-score icon full"></a></td>
        </tr>
      </table>
    `;

    // 1. Nickname
    const h1Match = mockUserHtml.match(/<h1>User ([^<]+)<\/h1>/i);
    expect(h1Match?.[1].trim()).toBe('mitcute');

    // 2. Submissions
    const subMatch = mockUserHtml.match(/Submission count:<\/td>\s*<td[^>]*>([\d,]+)<\/td>/i);
    expect(subMatch?.[1]).toBe('69');

    // 3. Languages
    const langRows = [
      ...mockUserHtml.matchAll(
        /<tr>\s*<td\s*>([^<]+)<\/td>\s*<td\s*>([\d,]+)<\/td>\s*<td\s*>([^<]+)<\/td>\s*<\/tr>/gi
      ),
    ];
    const languages = langRows.map((r) => ({
      language: r[1].trim(),
      submissions: parseInt(r[2].replace(/,/g, ''), 10),
      share: r[3].trim(),
    }));
    expect(languages).toHaveLength(2);
    expect(languages[0]).toEqual({ language: 'C++', submissions: 46, share: '66.67%' });
    expect(languages[1]).toEqual({ language: 'Pascal', submissions: 23, share: '33.33%' });

    // 4. Solved Tasks
    const solvedProblems: { id: string; name: string }[] = [];
    const taskLinkRegex =
      /<a href="\/problemset\/task\/(\d+)\/?"\s+title="([^"]+)"\s+class="task-score icon full"/gi;
    let taskMatch: RegExpExecArray | null;

    while ((taskMatch = taskLinkRegex.exec(mockProblemsetHtml)) !== null) {
      solvedProblems.push({
        id: taskMatch[1],
        name: taskMatch[2].trim(),
      });
    }

    expect(solvedProblems).toHaveLength(2);
    expect(solvedProblems[0]).toEqual({ id: '1068', name: 'Weird Algorithm' });
    expect(solvedProblems[1]).toEqual({ id: '1083', name: 'Missing Number' });

    const profile: CsesUserProfile = {
      nick: 'mitcute',
      userId: '134297',
      submissionCount: 69,
      firstSubmission: '2022-10-13 08:18:09',
      lastSubmission: '2024-03-21 05:40:00',
      languages,
      solvedCount: solvedProblems.length,
      solvedProblems,
      officialUrl: 'https://cses.fi/user/134297/',
    };

    expect(profile.nick).toBe('mitcute');
    expect(profile.userId).toBe('134297');
    expect(profile.solvedCount).toBe(2);
  });

  it('handles empty / zero-submission users gracefully', () => {
    const mockUserHtml = `
      <h1>User newbie</h1>
      <table class="summary-table narrow">
        <tr><td >Submission count:</td><td >0</td></tr>
      </table>
    `;

    const subMatch = mockUserHtml.match(/Submission count:<\/td>\s*<td[^>]*>([\d,]+)<\/td>/i);
    expect(subMatch?.[1]).toBe('0');

    const firstMatch = mockUserHtml.match(/First submission:<\/td>\s*<td[^>]*>([^<]+)<\/td>/i);
    expect(firstMatch).toBeNull();
  });
});
