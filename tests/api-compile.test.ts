import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../src/app/api/compile/route';

describe('/api/compile route handler', () => {
  const originalFetch = global.fetch;
  const originalEnv = process.env;

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
    delete process.env.COMPILER_API_KEY;
    delete process.env.COMPILER_BASE_URL;
    delete process.env.COMPILER_FALLBACK_URL;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = originalEnv;
  });

  it('uses default API key fallback and sends Authorization header when COMPILER_API_KEY is not set', async () => {
    let capturedHeaders: Record<string, string> = {};
    let capturedBody: any = null;

    global.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      capturedHeaders = (init?.headers as Record<string, string>) || {};
      capturedBody = JSON.parse(init?.body as string);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          run: { stdout: '42\n', stderr: '', code: 0 },
        }),
      };
    });

    const req = new NextRequest('http://localhost:3000/api/compile', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        language: 'cpp',
        files: [{ name: 'solution.cpp', content: 'int main(){ return 0; }' }],
        stdin: '',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.run.stdout).toBe('42\n');
    expect(capturedHeaders['Authorization']).toBe('b4b490a8bb89d44e4f65b2d857570af2');
    expect(capturedBody.language).toBe('c++');
    expect(capturedBody.version).toBe('15');
  });

  it('supports simplified payload format by converting code string into files array', async () => {
    let capturedBody: any = null;

    global.fetch = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
      capturedBody = JSON.parse(init?.body as string);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          run: { stdout: 'Simplified OK\n', stderr: '', code: 0 },
        }),
      };
    });

    const req = new NextRequest('http://localhost:3000/api/compile', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        language: 'cpp',
        code: '#include <iostream>\nusing namespace std;\nint main(){ cout << 42; return 0; }',
        stdin: '123',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    expect(capturedBody.files).toBeDefined();
    expect(capturedBody.files.length).toBe(1);
    expect(capturedBody.files[0].name).toBe('solution.cpp');
    expect(capturedBody.files[0].content).toContain('using namespace std;');
    expect(capturedBody.language).toBe('c++');
    expect(capturedBody.stdin).toBe('123');
  });

  it('names Java files Main.java for simplified payloads', async () => {
    let capturedBody: any = null;

    global.fetch = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
      capturedBody = JSON.parse(init?.body as string);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          run: { stdout: 'Java OK\n', stderr: '', code: 0 },
        }),
      };
    });

    const req = new NextRequest('http://localhost:3000/api/compile', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        language: 'java',
        code: 'public class Main { public static void main(String[] args){} }',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(capturedBody.files[0].name).toBe('Main.java');
    expect(capturedBody.language).toBe('java');
    expect(capturedBody.version).toBe('25');
  });

  it('rejects oversized code payloads (>64KB) with 413', async () => {
    const hugeCode = 'a'.repeat(65 * 1024);
    const req = new NextRequest('http://localhost:3000/api/compile', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        language: 'python',
        code: hugeCode,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(413);
    const data = await res.json();
    expect(data.error).toContain('64KB');
  });

  it('handles compiler 403 / 500 error and returns clean JSON error structure', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ message: 'Forbidden access' }),
      text: async () => 'Forbidden access',
    });

    const req = new NextRequest('http://localhost:3000/api/compile', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        language: 'python',
        code: 'print(1)',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toBe('Forbidden access');
    expect(data.run).toBeDefined();
    expect(data.run.stderr).toContain('Forbidden access');
  });

  it('tries secondary fallback if configured when primary fails', async () => {
    process.env.COMPILER_FALLBACK_URL = 'https://backup-piston.internal/api/v2';

    let calls: string[] = [];
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      calls.push(url);
      if (url.includes('onlinecompiler.io')) {
        return {
          ok: false,
          status: 500,
          json: async () => ({ message: 'Primary Down' }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          run: { stdout: 'From fallback\n', stderr: '', code: 0 },
        }),
      };
    });

    const req = new NextRequest('http://localhost:3000/api/compile', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        language: 'python',
        code: 'print(1)',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.run.stdout).toBe('From fallback\n');
    expect(calls.some((u) => u.includes('backup-piston'))).toBe(true);
  });
});
