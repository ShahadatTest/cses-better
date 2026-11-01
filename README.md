<div align="center">

# ⚡ CSES Better

**A modern, high-performance competitive programming platform & online judge for the CSES Problem Set.**

[![Next.js](https://img.shields.io/badge/Next.js-14.2-black?style=flat&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue?style=flat&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC?style=flat&logo=tailwind-css)](https://tailwindcss.com/)
[![Monaco Editor](https://img.shields.io/badge/Monaco_Editor-VS_Code_Engine-blue?style=flat&logo=visual-studio-code)](https://microsoft.github.io/monaco-editor/)
[![Tests](https://img.shields.io/badge/Vitest-87%20passed-success?style=flat&logo=vitest)](https://vitest.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[Features](#-features) • [Quick Start](#-quick-start) • [Architecture](#-architecture) • [Leaderboards](#-leaderboard--comparison) • [VS Code Extension](#-vs-code-extension) • [License](#-license)

</div>

---

## 🌟 Overview

[CSES Problem Set](https://cses.fi/problemset/) by Antti Laaksonen is one of the premier competitive programming curricula in the world. **CSES Better** elevates the practice experience by giving developers a modern, distraction-free environment with:

- **Integrated Monaco Code Editor**: The exact engine powering VS Code, running in your browser with multi-cursor editing, bracket pair colorization, and keyboard shortcuts.
- **Substitutable Dual-Editor Engine**: Switch between **Monaco Pro** and the **OnlineCompiler.io Embedded Sandbox** with a single click.
- **Instant Cloud Compilation**: Powered by `onlinecompiler.io`'s Piston v2 API supporting C++15, Python 3.14, Java 25, Rust 1.93, Go 1.26, and more.
- **KaTeX Mathematical Formatting**: Crisp rendering of all LaTeX expressions (`$n$`, `$\le$`, `$\rightarrow$`).
- **Official CSES Leaderboard Scraping**: Compare your execution runtime and code size directly against the world's fastest and shortest solutions.
- **Real-Time Diff Inspector**: Side-by-side visual diff viewer between your output and expected outputs.
- **Companion VS Code Extension**: Ready-to-use extension scaffold sharing `@cses/core` logic.

---

## 🚀 Features

### 1. 🔀 Substitutable Dual-Editor Engine
- **Monaco Pro (Default)**: Full VS Code editor inside the browser. Keybindings (`Ctrl+Enter` to Run, `Ctrl+Shift+Enter` to Submit), customizable font sizing, line numbers, and standard or Vim mode.
- **OnlineCompiler.io Inbuilt Runner**: Official embedded widget with gVisor container sandbox and custom input controls.
- **State Synchronization**: Code drafts and language choices remain in sync when switching between editors.

### 2. 🏆 Official CSES Leaderboard & Personal Comparison
- **Fastest Code (Top 5)**: Official CSES Hall of Fame records by runtime, language, and user.
- **Shortest Code (Top 5)**: Code-golf leaderboard by character count.
- **Community Stats**: Total Solved, Attempted, and Global Success Rate.
- **Personal Scorecard**: Live comparison metrics calculating where your runtime (ms) and code size (characters) rank against the world record holders.

### 3. 🧪 Comprehensive Test Workbench & Judging
- **Sample & Custom Testcases**: Multi-tab testcase runner with editable custom inputs.
- **Line-by-Line Diff Viewer**: Pinpoints the exact line where your output diverged from the testcase.
- **Performance Telemetry**: Precise execution time (ms), memory consumption (MB), and exit codes.
- **Standard Competitive Programming Verdicts**:
  - `AC` (Accepted) — with confetti celebration 🎉
  - `WA` (Wrong Answer) — with interactive diff viewer
  - `TLE` (Time Limit Exceeded)
  - `CE` (Compilation Error) — with formatted error diagnostics
  - `RE` (Runtime Error) — with stderr output

### 4. ⚡ Next.js App Router & Server Security
- Server-side execution route (`/api/compile`) executing against `onlinecompiler.io`.
- Completely eliminates browser CORS restrictions.
- Protects API keys in `.env.local` without exposing them in client bundles.
- In-app **Settings Modal** allowing visitors to supply their own API keys or custom Piston/Judge0 endpoints.

### 5. ⌨️ Developer Ergonomics
- **Command Palette (`Ctrl+K` / `⌘K`)**: Instant fuzzy search across all 400 CSES problems.
- **Keyboard Shortcuts**: `Ctrl+Enter` to Run, `Ctrl+Shift+Enter` to Submit, `Esc` to close modals.
- **Zen Mode**: 1-click collapse of problem statements to focus 100% on code.
- **Offline Drafts**: Automatic local saving per problem and language.
- **Data Portability**: Full JSON export/import of all solutions and submission history.

---

## 🛠️ Architecture

```
cses-better/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── compile/route.ts      # Server-side execution proxy (CORS & Key security)
│   │   ├── layout.tsx                # Dark root shell + KaTeX styling
│   │   ├── page.tsx                  # Master workspace orchestrator
│   │   └── globals.css               # Tailwind CSS & design tokens
│   ├── core/                         # Decoupled core (Shared with VS Code extension!)
│   │   ├── types.ts                  # Problem, TestCase, Verdict, Leaderboard contracts
│   │   ├── templates.ts              # Fast I/O starters for C++, Python, Java, Rust, Go
│   │   ├── compiler.ts               # Piston v2 execution client
│   │   ├── judge.ts                  # Normalizer, diff calculator, verdict engine
│   │   └── storage.ts                # LocalStorage persistence & JSON export/import
│   ├── components/
│   │   ├── Header.tsx                # Brand logo, breadcrumb, solved counter, settings
│   │   ├── ProblemPane.tsx           # Multi-tab view: Statement, Leaderboard, Submissions, Notes
│   │   ├── KaTeXRenderer.tsx         # LaTeX mathematical formula renderer
│   │   ├── LeaderboardTab.tsx        # CSES Fastest/Shortest tables & personal comparison
│   │   ├── SubmissionsTab.tsx        # Past submissions history & code restorer
│   │   ├── NotesTab.tsx              # Markdown algorithmic scratchpad
│   │   ├── SplitPane.tsx             # Resizable draggable workspace divider
│   │   ├── CommandPalette.tsx        # Ctrl+K problem navigator (400 problems)
│   │   ├── SettingsModal.tsx         # API key, custom endpoints, editor preferences
│   │   ├── TestBench.tsx             # Test runner, custom testcases, verdict badges
│   │   ├── DiffViewer.tsx            # Side-by-side output comparison
│   │   └── editor/
│   │       ├── EditorWorkbench.tsx   # Dual-editor switcher & sticky action bar
│   │       ├── MonacoEditorView.tsx  # Monaco Pro (VS Code engine in browser)
│   │       └── InbuiltCompilerView.tsx # OnlineCompiler.io iframe embed
│   └── data/
│       ├── categories.ts             # 19 CSES categories
│       └── problems.json             # 400 problems + statements + leaderboards
├── scripts/
│   └── scrape-cses.js                # Authenticated scraper CLI for CSES catalog & stats
├── extension/                        # Companion VS Code Extension
│   ├── package.json
│   ├── README.md
│   └── src/extension.ts              # VS Code command integration using @cses/core
└── tests/                            # Comprehensive Vitest test suite (87 tests)
    ├── judge.test.ts
    ├── compiler.test.ts
    ├── editor.test.ts
    ├── katex.test.ts
    ├── components.test.tsx
    ├── problem-components.test.tsx
    └── app-shell.test.tsx
```

---

## ⚡ Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) ≥ 18.0.0
- [npm](https://www.npmjs.com/) ≥ 9.0.0

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/cses-better.git
   cd cses-better
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment:**
   A `.env.example` file is provided as a template:
   ```env
   COMPILER_API_KEY=your_compiler_api_key_here
   COMPILER_BASE_URL=https://api.onlinecompiler.io/api/v2/piston
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

4. **Run the Development Server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

5. **Run the Automated Test Suite:**
   ```bash
   npm test
   ```

6. **Build for Production:**
   ```bash
   npm run build
   npm start
   ```

---

## 📊 Leaderboard & Comparison

When you solve any problem, switch to the **Leaderboard & Stats** tab:
1. **Hall of Fame**:
   - Inspect the top 5 fastest solutions (e.g. `0.00 s` in Pascal/C++).
   - Inspect the top 5 shortest codes (e.g. `16 ch.` in Ruby).
2. **Personal Comparison**:
   - Compares your best execution time against the record holder.
   - Calculates your code-golf efficiency against the shortest solution.

---

## 🔌 VS Code Extension

A companion VS Code extension scaffold is located in `extension/`:
1. Navigate to the extension folder:
   ```bash
   cd extension
   npm install
   ```
2. Press `F5` in VS Code to launch the extension development host.
3. Use `Ctrl+Alt+Enter` to run code and `Ctrl+Alt+S` to submit solutions to the judge.

---

## 📜 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

Problem statements and tests are copyright © [CSES / Antti Laaksonen](https://cses.fi/problemset/) and are used for free educational practice.
