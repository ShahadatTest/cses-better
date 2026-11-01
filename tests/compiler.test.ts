import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { executeCode } from '../src/core/compiler';

describe('compiler: executeCode', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('handles standard Piston successful execution', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          run: {
            stdout: '42\n',
            stderr: '',
            code: 0,
            signal: null,
            wall_time: 0.05,
            memory: 2048,
          },
        }),
    });

    const res = await executeCode({
      language: 'cpp',
      code: '#include <iostream>',
      stdin: '',
    });

    expect(res.status).toBe('success');
    expect(res.output).toBe('42\n');
    expect(res.exitCode).toBe(0);
    expect(res.wallTimeMs).toBe(50);
    expect(res.memoryBytes).toBe(2048);
  });

  it('handles Piston compilation error', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          compile: {
            code: 1,
            output: 'main.cpp: error: expected ;',
            stderr: 'main.cpp: error: expected ;',
          },
        }),
    });

    const res = await executeCode({
      language: 'cpp',
      code: 'invalid code',
    });

    expect(res.status).toBe('error');
    expect(res.error).toBe('Compilation Error');
    expect(res.exitCode).toBe(1);
    expect(res.stderr).toContain('expected ;');
  });

  it('handles Piston runtime error', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          run: {
            stdout: '',
            stderr: 'IndexOutOfBoundsException',
            code: 1,
            signal: null,
          },
        }),
    });

    const res = await executeCode({
      language: 'java',
      code: 'class Main {}',
    });

    expect(res.status).toBe('error');
    expect(res.exitCode).toBe(1);
    expect(res.stderr).toContain('IndexOutOfBoundsException');
  });

  it('handles HTTP error status codes', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      text: async () => JSON.stringify({ message: 'Rate limit exceeded' }),
    });

    const res = await executeCode({
      language: 'python',
      code: 'print(1)',
    });

    expect(res.status).toBe('error');
    expect(res.exitCode).toBe(429);
    expect(res.stderr).toContain('Rate limit exceeded');
  });

  it('handles network / fetch failure gracefully', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network offline'));

    const res = await executeCode({
      language: 'python',
      code: 'print(1)',
    });

    expect(res.status).toBe('error');
    expect(res.exitCode).toBe(-1);
    expect(res.error).toContain('Network offline');
  });

  it('correctly handles millisecond wall_time from OnlineCompiler.io without multiplying', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          run: {
            stdout: '3 10 5 16 8 4 2 1\n',
            stderr: '',
            code: 0,
            signal: null,
            wall_time: 22, // 22 ms
            memory: 6045696,
          },
        }),
    });

    const res = await executeCode({
      language: 'cpp',
      code: '#include <iostream>',
    });

    expect(res.status).toBe('success');
    expect(res.wallTimeMs).toBe(22); // Must NOT be 22000!
  });

  it('immediately returns status: "success" without making a network call when stdin > 98KB, with stderr mentioning "Input exceeds maximum size of 100KB"', async () => {
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy;

    const largeStdin = 'X'.repeat(98 * 1024 + 1);

    const res = await executeCode({
      language: 'cpp',
      code: '#include <iostream>',
      stdin: largeStdin,
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(res.status).toBe('success');
    expect(res.exitCode).toBe(0);
    expect(res.output).toBe('');
    expect(res.stderr).toContain('Input exceeds maximum size of 100KB');
  });

  it('retries on 429 response and succeeds if subsequent call succeeds', async () => {
    let callCount = 0;
    global.fetch = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return {
          ok: false,
          status: 429,
          statusText: 'Too Many Requests',
          text: async () => JSON.stringify({ message: 'Rate limited, retry later' }),
        };
      }
      return {
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            run: {
              stdout: 'hello world\n',
              stderr: '',
              code: 0,
              signal: null,
              wall_time: 18,
              memory: 4096,
            },
          }),
      };
    });

    const res = await executeCode({
      language: 'python',
      code: 'print("hello world")',
    });

    expect(callCount).toBe(2);
    expect(res.status).toBe('success');
    expect(res.output).toBe('hello world\n');
    expect(res.exitCode).toBe(0);
    expect(res.wallTimeMs).toBe(18);
  });

  it('handles backend 400 response with "Input exceeds maximum size" as bypassed success', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      text: async () =>
        JSON.stringify({ message: 'Input exceeds maximum size of 100KB' }),
    });

    const res = await executeCode({
      language: 'python',
      code: 'print(1)',
      stdin: 'some input',
    });

    expect(res.status).toBe('success');
    expect(res.exitCode).toBe(0);
    expect(res.stderr).toContain('Input exceeds maximum size of 100KB');
  });
});
