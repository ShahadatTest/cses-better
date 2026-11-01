# CSES Better — VS Code Extension

Companion VS Code extension for the **CSES Better** competitive programming platform.

## Features
- **Fetch & View Problems**: Browse all 400 CSES problems with formatted constraints and sample test cases.
- **Run Locally & in Cloud**: Run your current open C++, Python, Java, Rust, or Go solution against sample or custom inputs using the CSES Better compilation engine.
- **Judge Submissions**: Evaluate your solution against full test suites and receive verdicts (**AC**, **WA**, **TLE**, **CE**, **RE**) directly inside your VS Code editor.
- **View Hall of Fame Leaderboard**: Compare your runtime and code length against the global record holders.

## Setup & Development
1. Open this folder in VS Code:
   ```bash
   cd extension
   npm install
   ```
2. Press `F5` to launch an Extension Development Host.
3. Open any solution file (e.g. `1068.cpp`) and run:
   - `Ctrl+Alt+Enter` (or `Cmd+Alt+Enter` on macOS) to **Run Solution**.
   - `Ctrl+Alt+S` (or `Cmd+Alt+S` on macOS) to **Submit to Judge**.
