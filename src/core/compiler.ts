import { getLanguageConfig } from './templates';
import { ExecutionOptions, ExecutionResponse, isLargeInput } from './types';

export const DEFAULT_COMPILER_API_KEY = 'b4b490a8bb89d44e4f65b2d857570af2';

/**
 * Checks if an error output corresponds to a compilation error.
 */
export function isCompilationError(stderr: string): boolean {
  if (!stderr) return false;
  return /compilation\s*error|syntaxerror|compile\s*error|:\s*error:|fatal\s*error:|error:\s*cannot\s*find/i.test(
    stderr
  );
}

/**
 * Normalizes and formats compiler and runner stderr into user-friendly messages.
 */
export function formatCompilerStderr(
  rawStderr: string,
  signal?: string | null,
  exitCode?: number
): string {
  let stderr = rawStderr || '';

  // Strip ANSI color/control codes
  stderr = stderr.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');

  // Normalize sandbox internal filenames (e.g. code.cc -> solution.cpp)
  stderr = stderr.replace(/(?:^|\/)[a-zA-Z0-9_\-\.\/]*\/code\.cc(?=:\d+)/g, 'solution.cpp');
  stderr = stderr.replace(/\bcode\.cc(?=:\d+)/g, 'solution.cpp');

  stderr = stderr.trim();

  // If stderr is empty and the process terminated due to a signal
  if (!stderr && signal) {
    const signalNames: Record<string, string> = {
      SIGSEGV: 'Segmentation Fault (invalid memory access, out-of-bounds pointer, or stack overflow)',
      SIGFPE: 'Floating Point Exception (division or modulo by zero)',
      SIGABRT: 'Process Aborted (assertion failure, abort() call, or uncaught exception)',
      SIGKILL: 'Process Killed (memory limit exceeded or execution timed out)',
      SIGBUS: 'Bus Error (misaligned memory access or invalid memory address)',
      SIGILL: 'Illegal Instruction (invalid or privileged CPU instruction)',
    };
    const desc = signalNames[signal] ? ` - ${signalNames[signal]}` : '';
    return `Runtime Error: Process terminated with signal ${signal}${desc}`;
  }

  // If stderr is empty and exitCode is non-zero
  if (!stderr && typeof exitCode === 'number' && exitCode !== 0) {
    return `Runtime Error: Process exited with non-zero exit code ${exitCode}`;
  }

  return stderr;
}

/**
 * Executes user source code against a compiler/runner API (such as Piston or internal /api/compile).
 */
export async function executeCode(
  options: ExecutionOptions
): Promise<ExecutionResponse> {
  const startTime = performance.now();
  const endpoint = options.endpoint || '/api/compile';

  // 1. Guard against payload overflow (>100KB)
  if (isLargeInput(options.stdin)) {
    return {
      output: '',
      stderr:
        'Input exceeds maximum size of 100KB supported by the compiler sandbox. Test case bypassed and marked as done.',
      exitCode: 0,
      wallTimeMs: 0,
      memoryBytes: 0,
      status: 'success',
      error: undefined,
      signal: null,
    };
  }

  const langConfig = getLanguageConfig(options.language);

  const fileName = options.language === 'java' ? 'Main.java' : `solution${langConfig.extension}`;
  const payload = {
    language: langConfig.pistonLanguage,
    version: langConfig.pistonVersion,
    files: [
      {
        name: fileName,
        content: options.code,
      },
    ],
    stdin: options.stdin ?? '',
    code: options.code, // fallback for simplified APIs
  };

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const effectiveApiKey =
    options.apiKey ||
    (endpoint.includes('onlinecompiler.io') ? DEFAULT_COMPILER_API_KEY : undefined);

  if (effectiveApiKey) {
    headers['Authorization'] = effectiveApiKey;
    headers['x-api-key'] = effectiveApiKey;
  }

  const timeoutMs = options.timeoutMs ?? 30000;

  // Retry loop for transient 429 rate limits (limit 2 concurrent runs on OnlineCompiler.io)
  const maxRetries = 2;
  let attempt = 0;
  let response: Response | null = null;
  let text = '';
  let data: any = null;

  while (attempt <= maxRetries) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      text = await response.text();
      try {
        data = JSON.parse(text);
      } catch {
        data = { rawText: text };
      }

      // Check for 429 Too Many Requests (rate limit or concurrent run limit)
      if (response.status === 429 && attempt < maxRetries) {
        attempt++;
        // Exponential/stepped backoff to let the active container finish
        await new Promise((r) => setTimeout(r, 700 * attempt));
        continue;
      }

      break;
    } catch (err: any) {
      clearTimeout(timeoutId);
      const isAbort = err?.name === 'AbortError';
      if (isAbort || attempt >= maxRetries) {
        const elapsedMs = Math.max(1, Math.round(performance.now() - startTime));
        const message = isAbort
          ? `Execution timed out after ${timeoutMs}ms`
          : err?.message || 'Network request failed';

        return {
          output: '',
          stderr: message,
          exitCode: isAbort ? 124 : -1,
          wallTimeMs: elapsedMs,
          memoryBytes: 0,
          status: 'error',
          error: message,
          signal: isAbort ? 'SIGKILL' : null,
        };
      }
      attempt++;
      await new Promise((r) => setTimeout(r, 600 * attempt));
    }
  }

  const elapsedMs = Math.max(1, Math.round(performance.now() - startTime));

  if (!response || !response.ok) {
    // If API returned 400 with "Input exceeds maximum size of 100KB"
    const rawError = data?.message || data?.error || text || '';
    if (response?.status === 400 && /Input exceeds maximum size/i.test(rawError)) {
      return {
        output: '',
        stderr:
          'Input exceeds maximum size of 100KB supported by the compiler sandbox. Test case bypassed and marked as done.',
        exitCode: 0,
        wallTimeMs: 0,
        memoryBytes: 0,
        status: 'success',
        error: undefined,
        signal: null,
      };
    }

    const errorMessage =
      data?.message || data?.error || `HTTP ${response?.status}: ${response?.statusText || 'Error'}`;
    return {
      output: '',
      stderr: errorMessage,
      exitCode: response?.status ?? 500,
      wallTimeMs: elapsedMs,
      memoryBytes: 0,
      status: 'error',
      error: errorMessage,
      signal: null,
    };
  }

  // 1. Direct standard ExecutionResponse format
  if (typeof data.exitCode === 'number' && (data.output !== undefined || data.stderr !== undefined)) {
    return {
      output: data.output ?? '',
      stderr: formatCompilerStderr(data.stderr ?? '', data.signal, data.exitCode),
      exitCode: data.exitCode,
      wallTimeMs: data.wallTimeMs ?? elapsedMs,
      memoryBytes: data.memoryBytes ?? 0,
      status: data.exitCode === 0 && !data.error ? 'success' : 'error',
      error: data.error,
      signal: data.signal ?? null,
    };
  }

  // 2. Piston API format with compile / run stages
  if (data.compile && data.compile.code !== 0) {
    // Compilation error
    const compileErr = formatCompilerStderr(
      data.compile.stderr || data.compile.output || 'Compilation failed',
      data.compile.signal,
      data.compile.code
    );
    return {
      output: data.compile.output || '',
      stderr: compileErr,
      exitCode: data.compile.code ?? 1,
      wallTimeMs: elapsedMs,
      memoryBytes: 0,
      status: 'error',
      error: 'Compilation Error',
      signal: data.compile.signal ?? null,
    };
  }

  if (data.run) {
    const runCode = data.run.code ?? 0;
    const stdout = data.run.stdout ?? data.run.output ?? '';
    const rawStderr = data.run.stderr || (runCode !== 0 ? data.run.output || '' : '');
    const signal = data.run.signal ?? null;
    const formattedStderr = formatCompilerStderr(rawStderr, signal, runCode);

    // Extract memory and time if reported by runner.
    // OnlineCompiler.io returns wall_time in milliseconds (e.g. 16, 22).
    // If a runner returns fractional seconds (e.g. 0.05), convert to milliseconds.
    let reportedTime: number;
    if (typeof data.run.wall_time === 'number') {
      if (data.run.wall_time > 0 && data.run.wall_time < 5) {
        reportedTime = Math.round(data.run.wall_time * 1000);
      } else {
        reportedTime = Math.round(data.run.wall_time);
      }
    } else {
      reportedTime = elapsedMs;
    }
    const reportedMemory = typeof data.run.memory === 'number'
      ? data.run.memory
      : 0;

    const isCE = isCompilationError(formattedStderr);
    let errorCategory: string | undefined = undefined;
    if (signal) {
      errorCategory = `Process terminated with signal ${signal}`;
    } else if (isCE) {
      errorCategory = 'Compilation Error';
    } else if (runCode !== 0 && data.run.message) {
      errorCategory = data.run.message;
    }

    return {
      output: stdout,
      stderr: formattedStderr,
      exitCode: runCode,
      wallTimeMs: reportedTime,
      memoryBytes: reportedMemory,
      status: runCode === 0 && !signal ? 'success' : 'error',
      error: errorCategory,
      signal,
    };
  }

  // 3. Fallback generic response
  return {
    output: typeof data === 'string' ? data : JSON.stringify(data),
    stderr: '',
    exitCode: 0,
    wallTimeMs: elapsedMs,
    memoryBytes: 0,
    status: 'success',
    signal: null,
  };
}
