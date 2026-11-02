import { describe, it, expect } from 'vitest';
import { extractCodeFromMarkdown, normalizeFenceLanguage } from '../src/core/markdown-code';

describe('LLM Markdown Code Extractor Unit Tests', () => {
  it('normalizes fence language tags correctly', () => {
    expect(normalizeFenceLanguage('cpp')).toBe('cpp');
    expect(normalizeFenceLanguage('c++')).toBe('cpp');
    expect(normalizeFenceLanguage('python')).toBe('python');
    expect(normalizeFenceLanguage('py')).toBe('python');
    expect(normalizeFenceLanguage('rust')).toBe('rust');
    expect(normalizeFenceLanguage('rs')).toBe('rust');
    expect(normalizeFenceLanguage('java')).toBe('java');
    expect(normalizeFenceLanguage('go')).toBe('go');
    expect(normalizeFenceLanguage('js')).toBe('javascript');
    expect(normalizeFenceLanguage('ts')).toBe('typescript');
    expect(normalizeFenceLanguage('c')).toBe('c');
    expect(normalizeFenceLanguage('pascal')).toBeUndefined();
  });

  it('extracts pure C++ code from ChatGPT markdown output with preamble and explanations', () => {
    const chatGptOutput = `
Here is the optimal solution for CSES 1068:

\`\`\`cpp
#include <iostream>
using namespace std;

int main() {
    long long n;
    cin >> n;
    while (n != 1) {
        cout << n << " ";
        if (n % 2 == 0) n /= 2;
        else n = 3 * n + 1;
    }
    cout << 1 << "\\n";
    return 0;
}
\`\`\`

### Complexity:
- Time: O(steps)
- Space: O(1)
`;

    const result = extractCodeFromMarkdown(chatGptOutput);
    expect(result.wasMarkdown).toBe(true);
    expect(result.detectedLanguage).toBe('cpp');
    expect(result.code).toContain('#include <iostream>');
    expect(result.code).toContain('int main()');
    expect(result.code).not.toContain('Here is the optimal solution');
    expect(result.code).not.toContain('### Complexity');
  });

  it('extracts Python code from Claude/DeepSeek markdown output', () => {
    const claudeOutput = `
To solve this in Python:

\`\`\`python
import sys

def main():
    n = int(sys.stdin.read())
    ans = []
    while n != 1:
        ans.append(str(n))
        n = n // 2 if n % 2 == 0 else 3 * n + 1
    ans.append("1")
    print(" ".join(ans))

if __name__ == "__main__":
    main()
\`\`\`
`;

    const result = extractCodeFromMarkdown(claudeOutput);
    expect(result.wasMarkdown).toBe(true);
    expect(result.detectedLanguage).toBe('python');
    expect(result.code).toContain('def main():');
    expect(result.code).toContain('sys.stdin.read()');
  });

  it('preserves clean raw code without markdown backticks', () => {
    const rawCpp = `#include <iostream>
int main() { return 0; }`;

    const result = extractCodeFromMarkdown(rawCpp);
    expect(result.wasMarkdown).toBe(false);
    expect(result.code).toBe(rawCpp);
  });

  it('picks preferred language when multiple blocks exist', () => {
    const multiLangPrompt = `
Here is C++:
\`\`\`cpp
int x = 1;
\`\`\`

And here is Rust:
\`\`\`rust
let x = 1;
\`\`\`
`;

    const resRust = extractCodeFromMarkdown(multiLangPrompt, 'rust');
    expect(resRust.wasMarkdown).toBe(true);
    expect(resRust.detectedLanguage).toBe('rust');
    expect(resRust.code).toBe('let x = 1;');
  });
});
