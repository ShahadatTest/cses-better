import { LanguageConfig, LanguageId } from './types';

export const CPP_TEMPLATE = `#include <bits/stdc++.h>
using namespace std;

int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);

    // Solution here

    return 0;
}
`;

export const PYTHON_TEMPLATE = `import sys

def solve():
    input_data = sys.stdin.read().split()
    if not input_data:
        return
    # Solution here

if __name__ == '__main__':
    solve()
`;

export const JAVA_TEMPLATE = `import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.PrintWriter;
import java.io.BufferedOutputStream;
import java.util.StringTokenizer;
import java.io.IOException;

public class Main {
    static class FastScanner {
        private final BufferedReader br;
        private StringTokenizer st;

        public FastScanner() {
            br = new BufferedReader(new InputStreamReader(System.in));
        }

        public String next() {
            while (st == null || !st.hasMoreElements()) {
                try {
                    String line = br.readLine();
                    if (line == null) return null;
                    st = new StringTokenizer(line);
                } catch (IOException e) {
                    return null;
                }
            }
            return st.nextToken();
        }

        public int nextInt() {
            return Integer.parseInt(next());
        }

        public long nextLong() {
            return Long.parseLong(next());
        }

        public double nextDouble() {
            return Double.parseDouble(next());
        }
    }

    public static void main(String[] args) {
        FastScanner scanner = new FastScanner();
        PrintWriter out = new PrintWriter(new BufferedOutputStream(System.out));

        // Solution here

        out.flush();
    }
}
`;

export const RUST_TEMPLATE = `use std::io::{self, Read, BufWriter, Write};

fn main() {
    let mut input = String::new();
    io::stdin().read_to_string(&mut input).unwrap();
    let mut tokens = input.split_whitespace();

    let stdout = io::stdout();
    let mut out = BufWriter::new(stdout.lock());

    // Solution here

    out.flush().unwrap();
}
`;

export const GO_TEMPLATE = `package main

import (
	"bufio"
	"fmt"
	"os"
)

func main() {
	in := bufio.NewReader(os.Stdin)
	out := bufio.NewWriter(os.Stdout)
	defer out.Flush()

	// Solution here
	_ = in
	_ = fmt.Sprint
}
`;

export const JAVASCRIPT_TEMPLATE = `const fs = require('fs');

function solve() {
    const input = fs.readFileSync(0, 'utf-8');
    const tokens = input.trim().split(/\\s+/);
    if (!tokens[0]) return;

    // Solution here
}

solve();
`;

export const TYPESCRIPT_TEMPLATE = `import * as fs from 'fs';

function solve(): void {
    const input: string = fs.readFileSync(0, 'utf-8');
    const tokens: string[] = input.trim().split(/\\s+/);
    if (!tokens[0]) return;

    // Solution here
}

solve();
`;

export const C_TEMPLATE = `#include <stdio.h>
#include <stdlib.h>

int main(void) {
    // Solution here

    return 0;
}
`;

export const SUPPORTED_LANGUAGES: LanguageConfig[] = [
  {
    id: 'cpp',
    name: 'C++ (GCC 15)',
    pistonLanguage: 'c++',
    pistonVersion: '15',
    extension: '.cpp',
    monacoLanguage: 'cpp',
    defaultTemplate: CPP_TEMPLATE,
  },
  {
    id: 'python',
    name: 'Python (3.14)',
    pistonLanguage: 'python',
    pistonVersion: '3.14',
    extension: '.py',
    monacoLanguage: 'python',
    defaultTemplate: PYTHON_TEMPLATE,
  },
  {
    id: 'java',
    name: 'Java (OpenJDK 25)',
    pistonLanguage: 'java',
    pistonVersion: '25',
    extension: '.java',
    monacoLanguage: 'java',
    defaultTemplate: JAVA_TEMPLATE,
  },
  {
    id: 'rust',
    name: 'Rust (1.93)',
    pistonLanguage: 'rust',
    pistonVersion: '1.93',
    extension: '.rs',
    monacoLanguage: 'rust',
    defaultTemplate: RUST_TEMPLATE,
  },
  {
    id: 'go',
    name: 'Go (1.26)',
    pistonLanguage: 'go',
    pistonVersion: '1.26',
    extension: '.go',
    monacoLanguage: 'go',
    defaultTemplate: GO_TEMPLATE,
  },
  {
    id: 'javascript',
    name: 'JavaScript (Node 24)',
    pistonLanguage: 'javascript',
    pistonVersion: '24',
    extension: '.js',
    monacoLanguage: 'javascript',
    defaultTemplate: JAVASCRIPT_TEMPLATE,
  },
  {
    id: 'typescript',
    name: 'TypeScript (v2)',
    pistonLanguage: 'typescript',
    pistonVersion: '2',
    extension: '.ts',
    monacoLanguage: 'typescript',
    defaultTemplate: TYPESCRIPT_TEMPLATE,
  },
  {
    id: 'c',
    name: 'C (GCC 15)',
    pistonLanguage: 'c',
    pistonVersion: '15',
    extension: '.c',
    monacoLanguage: 'c',
    defaultTemplate: C_TEMPLATE,
  },
];

const LANGUAGE_MAP = new Map<LanguageId, LanguageConfig>(
  SUPPORTED_LANGUAGES.map((cfg) => [cfg.id, cfg])
);

export function getLanguageConfig(id: LanguageId): LanguageConfig {
  const config = LANGUAGE_MAP.get(id);
  if (!config) {
    // Default fallback to C++ if unknown
    return SUPPORTED_LANGUAGES[0];
  }
  return config;
}

export function getLanguageTemplate(id: LanguageId): string {
  return getLanguageConfig(id).defaultTemplate;
}

