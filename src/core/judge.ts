import {
  DiffResult,
  ExecutionResponse,
  TestCase,
  TestResult,
  VerdictStatus,
  isLargeInput,
  MAX_COMPILER_INPUT_BYTES,
} from './types';

export { isLargeInput, MAX_COMPILER_INPUT_BYTES };

/**
 * Normalizes output according to competitive programming conventions:
 * 1. Standardizes CRLF and CR to LF
 * 2. Trims trailing whitespace on each line
 * 3. Ignores empty trailing lines
 */
export function normalizeOutput(str: string): string {
  if (!str) return '';

  const standardized = str.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = standardized.split('\n').map((line) => line.trimEnd());

  while (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop();
  }

  return lines.join('\n');
}

/**
 * Computes difference between expected and actual output.
 * Returns null if both normalize to the exact same content.
 * Otherwise returns the first divergent line (1-indexed).
 */
export function computeDiff(
  expected: string,
  actual: string
): DiffResult | null {
  const normExpected = normalizeOutput(expected);
  const normActual = normalizeOutput(actual);

  if (normExpected === normActual) {
    return null;
  }

  const expLines = normExpected === '' ? [] : normExpected.split('\n');
  const actLines = normActual === '' ? [] : normActual.split('\n');
  const maxLines = Math.max(expLines.length, actLines.length);

  for (let i = 0; i < maxLines; i++) {
    const expLine = expLines[i];
    const actLine = actLines[i];

    if (expLine !== actLine) {
      return {
        lineIndex: i + 1,
        expectedLine: expLine !== undefined ? expLine : '<EOF>',
        actualLine: actLine !== undefined ? actLine : '<EOF>',
      };
    }
  }

  return null;
}

/**
 * Evaluates a single test case result against expected output and execution metrics.
 */
export function evaluateTestCase(
  expected: string,
  actual: string,
  exitCode: number,
  stderr: string = '',
  wallTimeMs: number = 0,
  timeLimitSec: number = 2.0
): VerdictStatus {
  const timeLimitMs = timeLimitSec > 0 ? timeLimitSec * 1000 : 2000;

  // 0. Cloud compiler sandbox input capacity limit (>100KB)
  if (/input\s*exceeds\s*maximum\s*size/i.test(stderr)) {
    return 'SKIPPED';
  }

  // 1. Time Limit Exceeded check
  if (
    wallTimeMs > timeLimitMs ||
    exitCode === 124 ||
    /time\s*limit\s*exceeded|timed\s*out/i.test(stderr)
  ) {
    return 'TLE';
  }

  // 2. Memory Limit Exceeded check
  if (
    /out\s*of\s*memory|memory\s*limit|java\.lang\.OutOfMemoryError/i.test(stderr)
  ) {
    return 'MLE';
  }

  // 3. Compilation Error check (matches GCC, Clang, Rustc, Javac error formats)
  if (
    /compilation\s*error|syntaxerror|compile\s*error|:\s*error:|fatal\s*error:|error:\s*cannot\s*find/i.test(
      stderr
    )
  ) {
    return 'CE';
  }

  // 4. Non-zero exit code (Runtime Error)
  if (exitCode !== 0) {
    // Exit code 137 can be OOM killer or SIGKILL
    if (exitCode === 137 && /kill|memory/i.test(stderr)) {
      return 'MLE';
    }
    return 'RE';
  }

  // 5. Output comparison
  const normExpected = normalizeOutput(expected);
  const normActual = normalizeOutput(actual);

  if (normExpected === normActual) {
    return 'AC';
  }

  return 'WA';
}

/**
 * Evaluates a batch of test cases against their corresponding execution responses.
 */
export function batchEvaluate(
  testCases: TestCase[],
  executionResults: ExecutionResponse[],
  timeLimitSec: number = 2.0
): TestResult[] {
  return testCases.map((tc, index) => {
    const res = executionResults[index];
    if (!res) {
      return {
        testCaseId: tc.id,
        status: 'IDLE',
        executionTimeMs: 0,
        memoryBytes: 0,
        actualOutput: '',
        expectedOutput: tc.expectedOutput,
      };
    }

    const status = evaluateTestCase(
      tc.expectedOutput,
      res.output,
      res.exitCode,
      res.stderr,
      res.wallTimeMs,
      timeLimitSec
    );

    const diff =
      status === 'WA'
        ? computeDiff(tc.expectedOutput, res.output) ?? undefined
        : undefined;

    return {
      testCaseId: tc.id,
      status,
      executionTimeMs: res.wallTimeMs,
      memoryBytes: res.memoryBytes,
      actualOutput: res.output,
      expectedOutput: tc.expectedOutput,
      stderr: res.stderr || undefined,
      diff,
    };
  });
}

/**
 * Summarizes test results for submission recording.
 */
export function summarizeTestResults(results: TestResult[]): {
  status: VerdictStatus;
  passedCount: number;
  totalCount: number;
  maxTimeMs: number;
  maxMemoryBytes: number;
} {
  const totalCount = results.length;
  let passedCount = 0;
  let maxTimeMs = 0;
  let maxMemoryBytes = 0;
  let firstFailingStatus: VerdictStatus | null = null;

  for (const r of results) {
    if (r.status === 'AC' || r.status === 'SKIPPED') {
      passedCount++;
    } else if (!firstFailingStatus && r.status !== 'RUNNING' && r.status !== 'IDLE') {
      firstFailingStatus = r.status;
    }

    if (r.executionTimeMs > maxTimeMs) {
      maxTimeMs = r.executionTimeMs;
    }
    if (r.memoryBytes > maxMemoryBytes) {
      maxMemoryBytes = r.memoryBytes;
    }
  }

  const status: VerdictStatus =
    totalCount > 0 && passedCount === totalCount
      ? 'AC'
      : firstFailingStatus ?? (totalCount === 0 ? 'IDLE' : 'WA');

  return {
    status,
    passedCount,
    totalCount,
    maxTimeMs,
    maxMemoryBytes,
  };
}
