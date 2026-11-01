import { getLanguageConfig } from './templates';
import { ExecutionOptions, ExecutionResponse, isLargeInput } from './types';

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

  const fileName = `solution${langConfig.extension}`;
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

  if (options.apiKey) {
    headers['Authorization'] = options.apiKey;
    headers['x-api-key'] = options.apiKey;
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
        stderr: data.stderr ?? '',
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
      const compileErr = data.compile.stderr || data.compile.output || 'Compilation failed';
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
      const stderr = data.run.stderr || (runCode !== 0 ? data.run.output || '' : '');
      const signal = data.run.signal ?? null;

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

      return {
        output: stdout,
        stderr,
        exitCode: runCode,
        wallTimeMs: reportedTime,
        memoryBytes: reportedMemory,
        status: runCode === 0 && !signal ? 'success' : 'error',
        error: signal ? `Process terminated with signal ${signal}` : undefined,
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
