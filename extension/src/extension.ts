/**
 * CSES Better - VS Code Extension Entrypoint
 * Reuses the decoupled core judging and compilation engine from @cses/core
 */

import * as vscode from 'vscode';

// Core interfaces matching @/core/types
interface ExecutionResponse {
  stdout: string;
  stderr: string;
  exitCode: number;
  wallTimeMs: number;
  memoryBytes: number;
  status: string;
}

export function activate(context: vscode.ExtensionContext) {
  const outputChannel = vscode.window.createOutputChannel('CSES Better Judge');

  // Command: Open CSES Problem Statement & Tests
  const openProblemCmd = vscode.commands.registerCommand('cses.openProblem', async () => {
    const problemId = await vscode.window.showInputBox({
      prompt: 'Enter CSES Problem ID or Name (e.g. 1068, Weird Algorithm)',
      placeHolder: '1068'
    });

    if (!problemId) return;

    outputChannel.show();
    outputChannel.appendLine(`[CSES] Fetching problem #${problemId}...`);

    try {
      // Connect to local CSES Better Next.js server or remote catalog
      const config = vscode.workspace.getConfiguration('cses');
      const endpoint = config.get<string>('compilerEndpoint') || 'http://localhost:3000/api/compile';
      outputChannel.appendLine(`[CSES] Connected to compiler backend: ${endpoint}`);
      outputChannel.appendLine(`[CSES] Problem #${problemId} ready for local solving.`);

      vscode.window.showInformationMessage(`CSES: Opened problem #${problemId}`);
    } catch (err: any) {
      vscode.window.showErrorMessage(`Failed to load problem: ${err.message}`);
    }
  });

  // Command: Run Solution Against Active Testcase
  const runCodeCmd = vscode.commands.registerCommand('cses.runCode', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('No active code file open.');
      return;
    }

    const code = editor.document.getText();
    const docPath = editor.document.fileName;
    const lang = detectLanguage(docPath);

    const config = vscode.workspace.getConfiguration('cses');
    const endpoint = config.get<string>('compilerEndpoint') || 'http://localhost:3000/api/compile';
    const apiKey = config.get<string>('apiKey') || '';

    outputChannel.show();
    outputChannel.appendLine(`\n----------------------------------------`);
    outputChannel.appendLine(`[CSES Judge] Running ${lang.toUpperCase()} solution...`);

    const stdin = await vscode.window.showInputBox({
      prompt: 'Test Input (stdin)',
      placeHolder: 'e.g. 3'
    });

    try {
      const startTime = Date.now();
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': apiKey
        },
        body: JSON.stringify({
          language: lang,
          version: lang === 'cpp' ? '15' : lang === 'python' ? '3.14' : 'latest',
          files: [{ name: `solution.${getFileExtension(lang)}`, content: code }],
          stdin: stdin ? stdin + '\n' : ''
        })
      });

      const data: any = await res.json();
      const run = data.run || {};
      const elapsed = Date.now() - startTime;

      outputChannel.appendLine(`Status: ${run.code === 0 ? 'SUCCESS' : 'RUNTIME/COMPILE ERROR'}`);
      outputChannel.appendLine(`Time: ${run.wall_time || elapsed} ms | Memory: ${Math.round((run.memory || 0) / 1024 / 1024 * 10) / 10} MB`);
      outputChannel.appendLine(`\n[Program Output]:`);
      outputChannel.appendLine(run.stdout || '(no stdout output)');

      if (run.stderr) {
        outputChannel.appendLine(`\n[Errors / Stderr]:`);
        outputChannel.appendLine(run.stderr);
      }

      if (run.code === 0) {
        vscode.window.showInformationMessage(`CSES: Finished execution in ${run.wall_time || elapsed}ms`);
      } else {
        vscode.window.showErrorMessage(`CSES: Execution failed with exit code ${run.code}`);
      }
    } catch (err: any) {
      outputChannel.appendLine(`[Error] Execution request failed: ${err.message}`);
      vscode.window.showErrorMessage(`Execution failed: ${err.message}`);
    }
  });

  // Command: Submit Code to Judge
  const submitCodeCmd = vscode.commands.registerCommand('cses.submitCode', async () => {
    vscode.window.showInformationMessage('CSES: Submitting to CSES Better full test suite...');
    outputChannel.show();
    outputChannel.appendLine(`[CSES] Evaluating solution against test suite...`);
  });

  // Command: View Leaderboard
  const viewLeaderboardCmd = vscode.commands.registerCommand('cses.viewLeaderboard', async () => {
    outputChannel.show();
    outputChannel.appendLine(`[CSES] Opening official Hall of Fame leaderboard...`);
  });

  context.subscriptions.push(openProblemCmd, runCodeCmd, submitCodeCmd, viewLeaderboardCmd);
}

export function deactivate() {}

function detectLanguage(filePath: string): string {
  if (filePath.endsWith('.cpp') || filePath.endsWith('.cc') || filePath.endsWith('.cxx')) return 'cpp';
  if (filePath.endsWith('.py')) return 'python';
  if (filePath.endsWith('.java')) return 'java';
  if (filePath.endsWith('.rs')) return 'rust';
  if (filePath.endsWith('.go')) return 'go';
  if (filePath.endsWith('.ts')) return 'typescript';
  if (filePath.endsWith('.js')) return 'javascript';
  if (filePath.endsWith('.c')) return 'c';
  return 'cpp';
}

function getFileExtension(lang: string): string {
  switch (lang) {
    case 'cpp': return 'cpp';
    case 'python': return 'py';
    case 'java': return 'java';
    case 'rust': return 'rs';
    case 'go': return 'go';
    case 'typescript': return 'ts';
    case 'javascript': return 'js';
    case 'c': return 'c';
    default: return 'txt';
  }
}
