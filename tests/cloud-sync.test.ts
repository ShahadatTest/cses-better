import { describe, it, expect, beforeEach } from 'vitest';
import {
  saveNote,
  getNote,
  getAllNotes,
  clearAllStorage,
  exportUserData,
  importUserData,
} from '../src/core/storage';
import { mapSupabaseUser } from '../src/core/supabase';

describe('Cloud Sync & Notes Storage Unit Tests', () => {
  beforeEach(() => {
    clearAllStorage();
  });

  it('stores and retrieves problem notes correctly', () => {
    expect(getNote('1068')).toBeNull();
    saveNote('1068', 'Approach: Use binary exponentiation and check bounds.');
    expect(getNote('1068')).toBe('Approach: Use binary exponentiation and check bounds.');

    // Updating note
    saveNote('1068', 'Updated approach.');
    expect(getNote('1068')).toBe('Updated approach.');

    // Clearing note
    saveNote('1068', '');
    expect(getNote('1068')).toBeNull();
  });

  it('collects all notes across problems with getAllNotes', () => {
    saveNote('1068', 'Note 1');
    saveNote('1083', 'Note 2');
    saveNote('1069', 'Note 3');

    const all = getAllNotes();
    expect(all['1068']).toBe('Note 1');
    expect(all['1083']).toBe('Note 2');
    expect(all['1069']).toBe('Note 3');
  });

  it('exports and imports notes seamlessly in UserDataExport', () => {
    saveNote('1068', 'Important mathematical proof');
    const exportedJson = exportUserData();
    const parsed = JSON.parse(exportedJson);
    expect(parsed.notes).toBeDefined();
    expect(parsed.notes['1068']).toBe('Important mathematical proof');

    clearAllStorage();
    expect(getNote('1068')).toBeNull();

    const ok = importUserData(exportedJson);
    expect(ok).toBe(true);
    expect(getNote('1068')).toBe('Important mathematical proof');
  });

  it('accurately maps GitHub OAuth user metadata to UserProfile', () => {
    const mockUser: any = {
      id: 'uuid-12345',
      email: 'pom@example.com',
      user_metadata: {
        user_name: 'codewithpom',
        full_name: 'Code With Pom',
        avatar_url: 'https://avatars.githubusercontent.com/u/12345',
      },
      app_metadata: {
        provider: 'github',
      },
      created_at: '2026-11-01T12:00:00Z',
    };

    const profile = mapSupabaseUser(mockUser);
    expect(profile.id).toBe('uuid-12345');
    expect(profile.username).toBe('codewithpom');
    expect(profile.displayName).toBe('codewithpom');
    expect(profile.avatarUrl).toBe('https://avatars.githubusercontent.com/u/12345');
    expect(profile.provider).toBe('github');
  });
});
