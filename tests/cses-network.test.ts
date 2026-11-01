import { describe, it, expect, beforeEach } from 'vitest';
import { extractCsrfToken, mapLanguageToCsesOption } from '../src/core/cses-network';
import {
  getStoredCsesCredentials,
  saveStoredCsesCredentials,
  clearStoredCsesCredentials,
} from '../src/core/cses-client';
import { mapSupabaseUser } from '../src/core/supabase';

describe('CSES Network & Helpers', () => {
  it('extracts CSRF token from standard form input', () => {
    const html = `
      <form action="/login" method="post">
        <input type="hidden" name="csrf_token" value="abc123xyz789">
        <input type="text" name="nick">
      </form>
    `;
    const token = extractCsrfToken(html);
    expect(token).toBe('abc123xyz789');
  });

  it('extracts CSRF token with inverted attribute order', () => {
    const html = `
      <form action="/problemset/submit/1068" method="post">
        <input value="token999secure" name="csrf_token" type="hidden">
      </form>
    `;
    const token = extractCsrfToken(html);
    expect(token).toBe('token999secure');
  });

  it('returns null if no csrf token found', () => {
    const html = '<div>No token here</div>';
    expect(extractCsrfToken(html)).toBeNull();
  });

  it('maps standard language IDs to CSES language options', () => {
    expect(mapLanguageToCsesOption('cpp')).toBe('C++');
    expect(mapLanguageToCsesOption('c++')).toBe('C++');
    expect(mapLanguageToCsesOption('python')).toBe('Python3');
    expect(mapLanguageToCsesOption('py')).toBe('Python3');
    expect(mapLanguageToCsesOption('java')).toBe('Java');
    expect(mapLanguageToCsesOption('rust')).toBe('Rust');
    expect(mapLanguageToCsesOption('go')).toBe('Go');
    expect(mapLanguageToCsesOption('unknown-lang')).toBe('C++');
  });
});

describe('CSES Client Credentials Storage', () => {
  beforeEach(() => {
    const store: Record<string, string> = {};
    const mockStorage = {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, value: string) => {
        store[key] = value;
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        for (const k of Object.keys(store)) delete store[k];
      },
    };
    (global as any).window = {
      localStorage: mockStorage,
    };
    (global as any).localStorage = mockStorage;
    clearStoredCsesCredentials();
  });

  it('saves nickname without persisting plaintext password when remember is true', () => {
    saveStoredCsesCredentials({
      nick: 'tourist',
      pass: 'secret',
      remember: true,
    });
    const stored = getStoredCsesCredentials();
    expect(stored).not.toBeNull();
    expect(stored?.nick).toBe('tourist');
    // Security: Raw password must never be stored in persistent localStorage
    expect(stored?.pass).toBe('');
  });

  it('does not save credentials when remember is false', () => {
    saveStoredCsesCredentials({
      nick: 'tourist',
      pass: 'secret',
      remember: false,
    });
    const stored = getStoredCsesCredentials();
    expect(stored).toBeNull();
  });
});

describe('Supabase User Mapping', () => {
  it('maps Supabase User to UserProfile correctly', () => {
    const mockUser: any = {
      id: 'usr-12345',
      email: 'alex@example.com',
      created_at: '2026-01-01T00:00:00Z',
      user_metadata: {
        full_name: 'Alex Johnson',
        avatar_url: 'https://example.com/avatar.png',
      },
      app_metadata: {
        provider: 'google',
      },
    };

    const profile = mapSupabaseUser(mockUser);
    expect(profile.id).toBe('usr-12345');
    expect(profile.email).toBe('alex@example.com');
    expect(profile.displayName).toBe('Alex Johnson');
    expect(profile.avatarUrl).toBe('https://example.com/avatar.png');
    expect(profile.provider).toBe('google');
  });
});
