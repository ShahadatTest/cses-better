<div align="center">

# ⚡ CSES Better

**A modern, high-performance competitive programming platform & online judge for the CSES Problem Set.**

[![Live Demo](https://img.shields.io/badge/Demo-cses--better.vercel.app-10b981?style=for-the-badge&logo=vercel&logoColor=white)](https://cses-better.vercel.app)
[![GitHub Stars](https://img.shields.io/github/stars/codewithpom/cses-better?style=for-the-badge&logo=github&color=38bdf8)](https://github.com/codewithpom/cses-better/stargazers)
[![License: MIT](https://img.shields.io/badge/License-MIT-f59e0b?style=for-the-badge)](https://opensource.org/licenses/MIT)

[![Next.js 14](https://img.shields.io/badge/Next.js-14.2-black?style=flat&logo=next.js)](https://nextjs.org/)
[![TypeScript 5](https://img.shields.io/badge/TypeScript-5.6-3178C6?style=flat&logo=typescript)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Auth_%26_Database-3ECF8E?style=flat&logo=supabase)](https://supabase.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC?style=flat&logo=tailwind-css)](https://tailwindcss.com/)
[![Monaco Editor](https://img.shields.io/badge/Monaco_Editor-VS_Code_Engine-007ACC?style=flat&logo=visual-studio-code)](https://microsoft.github.io/monaco-editor/)
[![Tests Passing](https://img.shields.io/badge/Vitest-109%20passed-success?style=flat&logo=vitest)](https://vitest.dev/)

[🚀 Live Demo](https://cses-better.vercel.app) • [✨ Features](#-features) • [⚡ Quick Start](#-quick-start) • [🏗️ Architecture](#-architecture) • [🏆 CSES Mirror & Stats](#-live-cses-parity) • [🤝 Contributing](#-contributing) • [📜 License](#-license)

</div>

---

## 🌟 Overview

[CSES Problem Set](https://cses.fi/problemset/) by Antti Laaksonen is celebrated worldwide as the gold standard curriculum for competitive programming, algorithmic puzzles, and technical interview preparation. 

**CSES Better** modernizes and reimagines the entire practice journey. It preserves official CSES parity while delivering an ultra-fast, feature-packed workbench:

- 💻 **Integrated Monaco Code Editor**: The exact engine powering VS Code running in your browser with multi-cursor editing, bracket pair colorization, customizable font sizing, and keyboard shortcuts.
- 🚀 **Direct Remote CSES Submission Engine**: Submit your final solutions directly to `cses.fi` under your official account, complete with CSRF extraction and live verdict polling (`ACCEPTED`, `WRONG ANSWER`, `TIME LIMIT EXCEEDED`).
- 🔀 **Dual-Submit Architecture**:
  - **Test Cases Button**: Rapid local/cloud sandbox execution against sample and custom test cases with zero impact on your CSES submission history.
  - **Submit to CSES Button**: Transmits your code straight to the official CSES judge.
- ⚡ **Live Official CSES Standings**: Real-time stats scraped from `cses.fi` with 60s in-memory caching and a manual **"Refresh Standings"** cache-busting button.
- 📦 **Continuous CSES Mirror Archive**: Scheduled GitHub Action continuously syncs all 400 problems, test bounds, time limits, memory limits, and Hall of Fame records into a searchable in-app explorer.
- 🔐 **Multi-Tenant Cloud Sync**: Google & GitHub 1-click OAuth powered by Supabase with Row Level Security (RLS) and automatic offline `localStorage` fallback for guests.
- 📐 **KaTeX Mathematical Formatting**: LaTeX rendering for algorithmic formulas, constraints, and recurrence relations.
- 🔍 **Interactive Diff Viewer**: Line-by-line visual diff inspector pinpointing exact divergence points between actual and expected outputs.
- ⌨️ **Command Palette (`Ctrl+K` / `⌘K`)**: Fuzzy navigation across all 400 CSES problems with instant category filtering.

---

## ✨ Features

### 1. 🔀 Substitutable Dual-Editor Engine
- **Monaco Pro**: Full VS Code editor inside the browser. Keybindings (`Ctrl+Enter` to Run, `Ctrl+Shift+Enter` to Submit), customizable font sizing, and tab size adjustments.
- **OnlineCompiler.io Embedded Sandbox**: Official embedded widget with gVisor container sandbox and custom input controls.
- **State Synchronization**: Code drafts and language choices remain in sync when switching between editors.

### 2. 🏆 Live CSES Parity & Official Leaderboard
- **Live Scraper**: Queries `cses.fi/problemset/stats/[id]` with authenticated session pooling.
- **Fastest Code (Top 5)**: Official CSES Hall of Fame records by runtime, language, and user.
- **Shortest Code (Top 5)**: Code-golf leaderboard by character count.
- **Personal Scorecard**: Live comparison metrics calculating where your runtime (ms) and code size rank against world records.
- **Profile Inspector Modal**: Click any username to inspect their official CSES profile and solved tasks.
- **Refresh Standings**: 1-click cache-busting button to immediately pull the latest standings after solving a problem.

### 3. 🧪 Comprehensive Test Workbench & Judging
- **Sample & Custom Testcases**: Multi-tab testcase runner with editable custom inputs.
- **Official Test Archive Loader**: 1-click download and unzip of full official test suites (`.in` / `.out`).
- **Line-by-Line Diff Viewer**: Visual side-by-side diff between actual and expected outputs.
- **Telemetry**: Precise execution time (ms), memory consumption (MB), and exit codes.
- **Verdicts**: `AC` (with confetti 🎉), `WA` (with diff), `TLE`, `CE` (with compiler diagnostics), `RE` (with stderr).

### 4. 🗄️ Continuous CSES Mirror Archive
- **Automated Mirror**: Scheduled GitHub Action (`.github/workflows/mirror-cses.yml`) crawls problem statements, constraints, and leaderboards.
- **Compliant Archive**: Respectful crawling adhering to GitHub Acceptable Use Policies.
- **In-App Explorer**: Filter the archive by category, keyword, time/memory limits, or user record.

### 5. 🛡️ Enterprise Security & Hardening
- **Credential Safety**: User passwords are never saved in plaintext `localStorage`.
- **XSS Sanitization**: All mathematical formulas and markdown notes pass through `DOMPurify` before rendering.
- **Rate-Limited API Proxy**: Server-side `/api/compile` protected by sliding-window IP rate limiting (30 reqs/min) and payload size caps.
- **Input Validation**: Strict regex validation (`/^\d+$/`) on all dynamic route IDs.

---

## 🏗️ Architecture

```
cses-better/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── archive/route.ts        # Instant in-memory CSES archive query
│   │   │   ├── compile/route.ts        # Rate-limited execution proxy (Piston v2)
│   │   │   ├── cses/auth/route.ts      # CSES credential validation
│   │   │   ├── cses/result/[id]/       # Live CSES verdict & testcase poller
│   │   │   ├── cses/stats/[id]/        # Authenticated live leaderboard scraper
│   │   │   ├── cses/submit/route.ts    # Direct CSES remote multipart submission
│   │   │   ├── cses/user/[nick]/       # Official CSES user profile inspector
│   │   │   └── tests/[id]/route.ts     # Official testcase zip archive extractor
│   │   ├── auth/callback/route.ts      # Supabase OAuth PKCE cookie exchange
│   │   ├── layout.tsx                  # Dark root shell + KaTeX styling
│   │   ├── page.tsx                    # Master workspace orchestrator
│   │   └── globals.css                 # Tailwind CSS & design tokens
│   ├── core/                           # Decoupled core engine
│   │   ├── types.ts                    # Problem, TestCase, Verdict, Leaderboard contracts
│   │   ├── cses-network.ts             # IPv4 forced networking & CSRF extraction
│   │   ├── cses-client.ts              # Client-side CSES polling & submit helpers
│   │   ├── supabase.ts                 # Multi-tenant auth & cloud persistence
│   │   ├── compiler.ts                 # Piston v2 execution client
│   │   ├── judge.ts                    # Normalizer, diff calculator, verdict engine
│   │   └── storage.ts                  # LocalStorage persistence & JSON backup
│   ├── components/                     # High-performance React components
│   │   ├── Header.tsx                  # Navigation, problem breadcrumb, solved counter
│   │   ├── ProblemPane.tsx             # Statement, Leaderboard, Submissions, Notes
│   │   ├── KaTeXRenderer.tsx           # XSS-sanitized LaTeX mathematical renderer
│   │   ├── LeaderboardTab.tsx          # Live standings with manual cache refresh
│   │   ├── SubmissionsTab.tsx          # Past submissions history & code restore
│   │   ├── CsesSubmitModal.tsx         # Animated live pipeline remote submit modal
│   │   ├── CsesUserProfileModal.tsx    # Official CSES user profile inspector
│   │   ├── ArchiveExplorerModal.tsx    # CSES mirror archive search & navigation
│   │   ├── AuthModal.tsx               # Google & GitHub OAuth dialog
│   │   ├── TestBench.tsx               # Testbench runner & custom test cases
│   │   ├── DiffViewer.tsx              # Side-by-side output comparison
│   │   └── editor/
│   │       ├── EditorWorkbench.tsx     # Dual-editor switcher & dual-submit actions
│   │       ├── MonacoEditorView.tsx    # Monaco Pro (VS Code engine in browser)
│   │       └── InbuiltCompilerView.tsx # OnlineCompiler.io iframe embed
│   └── data/
│       ├── categories.ts               # 19 CSES categories
│       ├── problems.json               # 400 problems + statements + tests
│       └── archive/archive.json        # 400 problems archive with live stats
├── supabase/
│   └── schema.sql                      # PostgreSQL schema with Row Level Security (RLS)
├── .github/workflows/
│   └── mirror-cses.yml                 # Automated weekly CSES archive synchronization
└── tests/                              # Comprehensive Vitest test suite (109 tests)
```

---

## ⚡ Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) ≥ 18.0.0
- [npm](https://www.npmjs.com/) ≥ 9.0.0

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/codewithpom/cses-better.git
   cd cses-better
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
   Add your compiler API key and Supabase credentials (optional for guest mode):
   ```env
   COMPILER_API_KEY=your_compiler_api_key_here
   COMPILER_BASE_URL=https://api.onlinecompiler.io/api/v2/piston
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
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

## 🤝 Contributing

Contributions are welcome! Whether it's adding new language starters, optimizing judge latency, or improving UI animations:

1. Fork the Project (`https://github.com/codewithpom/cses-better/fork`)
2. Create your Feature Branch (`git checkout -b feat/AmazingFeature`)
3. Commit your Changes (`git commit -m 'feat: Add AmazingFeature'`)
4. Push to the Branch (`git push origin feat/AmazingFeature`)
5. Open a Pull Request

---

## 📜 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

*Problem statements, test data, and CSES trademarks are copyright © [CSES / Antti Laaksonen](https://cses.fi/problemset/) and are used under fair educational practice.*

### Problem lists and Learn

Lists are saved locally and included in JSON backups. Signing in imports guest lists once and synchronizes account lists separately. Changes remain available offline; use Retry sync in Lists if a sync fails. When two devices edit the same list, the cloud version is kept and the local version is saved as a recovered list. Deleted lists use tombstones so an older device cannot restore them accidentally. Learn lessons are bundled static files; hints and explanations are revealed on demand.

Deploy `supabase/migrations/20261104172357_user_problem_lists.sql` to the linked Supabase project using `supabase db push` before enabling cloud list sync. The migration grants authenticated users access only to their own rows and enforces revision increments. Existing local lists continue to work if the migration has not been deployed.

### AI help, official submissions, and streaks

Use **Ask AI** in either problem workspace to copy a hint-first prompt and open ChatGPT, Claude, Gemini, or Grok. Editor code is included only when selected. If clipboard access fails, the menu provides selectable prompt text.

Submission filters query CSES history. Leaderboard **See code** retrieves actual accepted source; incomplete searches are labeled as the fastest result found. Official verdicts and available test details appear separately from local workbench runs. An interrupted verdict check can be retried without submitting code again.

Stars are stored per app account, with offline additions and removals retried during synchronization. The streak indicator counts verified personal CSES accepts, using the earliest retrieved acceptance per problem and a persisted timezone. Use **Import / continue history** to backfill older solves; **Pause import** saves progress. Coverage gaps remain visible until verified history is available. Shared-account submissions and manual solved marks do not add streak activity.

Before enabling cloud streak synchronization, deploy `supabase/migrations/20261106190911_official_solve_streaks.sql` to the linked Supabase project with `supabase db push`. It adds owner-restricted solve history and timezone preferences, preserves the earliest acceptance during concurrent updates, and ensures bookmark table access. Local storage remains available while cloud synchronization is unavailable. JSON backups include stars and streak history.
