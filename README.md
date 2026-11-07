<div align="center">

# ⚡ CSES Better

### Your problem. Your editor. Your next breakthrough.

A focused browser workspace for the **CSES Problem Set** — read, code, test, and keep moving.

[![Live Demo](https://img.shields.io/badge/Live_Demo-Open_Workspace-10b981?style=for-the-badge)](https://cses-better.vercel.app)
[![GitHub Stars](https://img.shields.io/github/stars/codewithpom/cses-better?style=for-the-badge&logo=github&color=38bdf8)](https://github.com/codewithpom/cses-better/stargazers)
[![MIT License](https://img.shields.io/badge/License-MIT-f59e0b?style=for-the-badge)](LICENSE)

[![CI](https://github.com/codewithpom/cses-better/actions/workflows/ci.yml/badge.svg)](https://github.com/codewithpom/cses-better/actions/workflows/ci.yml)
[![Next.js](https://img.shields.io/badge/Next.js-14-111111?logo=nextdotjs)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-18-149eca?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3-06b6d4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-Auth_+_Sync-3ecf8e?logo=supabase&logoColor=white)](https://supabase.com/)
[![Monaco](https://img.shields.io/badge/Editor-Monaco-007acc)](https://microsoft.github.io/monaco-editor/)
[![Vitest](https://img.shields.io/badge/Tests-Vitest-6e9f18?logo=vitest&logoColor=white)](https://vitest.dev/)

[🚀 Try it live](https://cses-better.vercel.app) · [✨ Features](#features) · [⚡ Quick start](#quick-start) · [🏗 Architecture](#architecture) · [🤝 Contribute](#contributing)

**Guest mode ready · Optional cloud sync · Dark, Dim & Light themes**

</div>

---

<a id="preview"></a>

## 🎬 See the workspace in action

[![Animated tour: problem statement, code editor, and test bench](public/readme-demo.gif)](https://cses-better.vercel.app/practice)

<div align="center">

**📖 Read the statement · 💻 Build your solution · 🧪 Check your output**

[Open practice ↗](https://cses-better.vercel.app/practice) · [View the full-resolution screenshot](public/workspace.jpg)

</div>

<details>
<summary>🖼 Expand the full workspace screenshot</summary>

![CSES Better workspace with problem statement, editor, and test bench](public/workspace.jpg)

</details>

---

<a id="features"></a>

## ✨ Built for the whole practice session

| | Feature | What you get |
| :---: | --- | --- |
| 💻 | **Code in context** | Monaco editor beside the problem statement, with drafts you can return to. |
| 🧪 | **Test your idea** | Selected-input execution, loaded test cases, and output comparisons. |
| 🏆 | **Go to the official judge** | Personal CSES connection, submissions, verdicts, and available judge details. |
| 📚 | **Learn as you solve** | Topic roadmaps, visual explanations, and hints revealed when you need them. |
| 🗂 | **Make practice your own** | Personal problem lists, stars, notes, and saved work. |
| 🔥 | **Track verified progress** | Solve streaks based on personal CSES accepts, with history import. |
| 🌍 | **Explore beyond CSES** | A separate olympiad problem bank alongside the CSES workspace. |
| 🤖 | **Ask for a hint** | Optional AI prompt links, with control over whether editor code is included. |
| ☁ | **Pick up on another device** | Guest practice plus optional sign-in for supported cloud synchronization. |
| 🎨 | **Set your environment** | Dark, Dim, Light, or System appearance; five accent colors and editable shortcuts. |

> [!NOTE]
> **Sample passed ≠ officially accepted.** Workbench results cover the inputs available to the app. Official acceptance comes from CSES; compiler and account features depend on external services.

### 🛤 A simple practice loop

1. **Choose a problem** - browse the set or build a personal list.
2. **Work through the idea** - read the statement, explore Learn, and keep notes.
3. **Write and test** - edit your solution and inspect results on loaded inputs.
4. **Submit and revisit** - use your CSES connection for official judging, then return to your drafts and progress.

---

<a id="architecture"></a>

## 🏗 Under the hood

```text
cses-better/
|-- src/
|   |-- app/                  # Landing, practice, olympiad routes & server APIs
|   |-- components/           # Workspace, editor, test bench & visual lessons
|   |-- core/                 # Execution, judging, storage, sync & CSES integration
|   `-- data/                 # CSES catalog, roadmaps & olympiad problems
|-- public/                   # Screenshots, animated demo & static assets
|-- supabase/migrations/      # Database migrations for supported cloud features
|-- tests/                    # Additional tests also live beside source
`-- .github/workflows/        # Automated checks & repository workflows
```

| Layer | Tools |
| --- | --- |
| 🖥 Interface | Next.js 14 · React 18 · TypeScript · Tailwind CSS |
| 📝 Editing & math | Monaco Editor · KaTeX |
| 🔐 Accounts & sync | Supabase Auth and database |
| ⚙ Execution & judging | Compiler service integration · CSES server routes |
| ✅ Validation | Vitest · TypeScript · Production build |

---

<a id="quick-start"></a>

## ⚡ Quick start

Requirements: Node.js 22 and npm.

```sh
git clone https://github.com/codewithpom/cses-better.git
cd cses-better
npm ci
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) or [http://localhost:3000/practice](http://localhost:3000/practice).

Configure your own compiler credentials for execution. The embedded compiler may need its own widget key. Supabase enables cloud features; without it, guest mode remains available. For app sign-in, configure GitHub OAuth and allow the deployment's `/auth/callback` URL. Optional server-side CSES credentials enable shared-session features; a personal CSES connection is separate from app sign-in.

Never commit `.env.local`. Rotate previously committed working bot credentials before public release. See [SECURITY.md](SECURITY.md).

## 🧪 Checks and deployment

```sh
npx tsc --noEmit
npm test
npm run build
```

Pull request CI runs these checks. Verify OAuth, compiler access, and official submissions separately with a maintainer-controlled account. Set `NEXT_PUBLIC_APP_URL` to the deployment origin, and review the preview on phone, tablet, and laptop before promotion.

Guest work is stored in the browser. Export a JSON backup through settings before clearing site data. Cloud sync covers supported records; check each feature's status and retry failures. Keep backups for local-only work.

## 🔍 Workspace details

<details>
<summary><strong>Lists, Learn, and cloud synchronization</strong></summary>

Lists are saved locally and included in JSON backups. Signing in imports guest lists once and synchronizes account lists separately. Changes remain available offline; use **Retry sync** in Lists if a sync fails. If two devices edit the same list, the cloud version is kept and the local version is saved as a recovered list. Deleted lists use tombstones so an older device cannot restore them accidentally. Learn lessons are bundled static files; hints and explanations are revealed on demand.

Before enabling cloud list synchronization, deploy [`20261104172357_user_problem_lists.sql`](supabase/migrations/20261104172357_user_problem_lists.sql) to the linked Supabase project with `supabase db push`. It restricts authenticated users to their own rows and enforces revision increments. Local lists continue to work if the migration is not deployed.

</details>

<details>
<summary><strong>AI help, submissions, and streaks</strong></summary>

**Ask AI** opens a hint-first prompt in Grok, or lets you copy it and open ChatGPT, Claude, or Gemini. **Open Claude Desktop** is an optional link for the installed app. Editor code is included only when selected. Grok may ask for confirmation before sending. If clipboard access fails, the menu provides selectable prompt text.

Submission filters query CSES history. Leaderboard **See code** retrieves accepted source; incomplete searches are labeled as the fastest result found. Official verdicts and available test details appear separately from local workbench runs. An interrupted verdict check can be retried without resubmitting code.

Stars are stored per app account, with offline changes retried during synchronization. The streak indicator counts verified personal CSES accepts, using the earliest retrieved acceptance per problem and a persisted timezone. Use **Import / continue history** to backfill older solves; **Pause import** saves progress. Coverage gaps remain visible until history is verified. Shared-account submissions and manual solved marks do not add streak activity.

Before enabling cloud streak synchronization, deploy [`20261106190911_official_solve_streaks.sql`](supabase/migrations/20261106190911_official_solve_streaks.sql) with `supabase db push`. It adds owner-restricted solve history and timezone preferences, preserves the earliest acceptance during concurrent updates, and ensures bookmark table access. Local storage remains available when cloud sync is unavailable. JSON backups include stars and streak history.

</details>

<details>
<summary><strong>Appearance and keyboard shortcuts</strong></summary>

Use **Settings → Appearance** to choose Dark, Dim, Light, or System appearance and one of five accent colors. Changes apply immediately and are saved in this browser. The OnlineCompiler embed has its own theme controls.

Open **Settings → Shortcuts** to search commands, record a key combination, disable a shortcut, or reset one binding. Browser-reserved combinations and conflicts are rejected with feedback. **Reset all shortcuts** restores the built-in defaults.

</details>

<a id="contributing"></a>

## 🤝 Contributing

Pick a contribution that fits your interests:

| 🐛 Bugs | 🎨 Experience | 📚 Learning | 🛠 Engineering |
| --- | --- | --- | --- |
| Clear reproduction steps | Accessibility and responsive fixes | Explanations and documentation | Tests and language starters |

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request. Documentation, accessibility fixes, reproducible bug reports, and language starters are useful starting points. See the [Code of Conduct](CODE_OF_CONDUCT.md) and [Accessibility](ACCESSIBILITY.md) guidance. For security reports, follow [SECURITY.md](SECURITY.md). Issue reports must exclude passwords, tokens, private code, and account data.

## 📜 License and attribution

Application code is [MIT licensed](LICENSE). CSES statements, test data, and trademarks belong to their respective owners; the code license does not grant rights to upstream content. This is an independent project and is not affiliated with CSES.

---

<div align="center">

**⚡ One problem at a time.**

[Start practicing](https://cses-better.vercel.app/practice) · [Report a bug](https://github.com/codewithpom/cses-better/issues) · [Star the project ⭐](https://github.com/codewithpom/cses-better/stargazers)

</div>
