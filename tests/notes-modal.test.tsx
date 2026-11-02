import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { NotesTab } from '../src/components/NotesTab';
import { AllNotesModal } from '../src/components/AllNotesModal';
import { saveNote, clearAllStorage, getAllNotes, getAllNotesList } from '../src/core/storage';

describe('Developer-Grade NotesTab & AllNotesModal Unit Tests', () => {
  beforeEach(() => {
    clearAllStorage();
  });

  it('renders NotesTab toolbar with all formatting controls and action buttons', () => {
    const html = renderToStaticMarkup(
      <NotesTab
        problemId="1068"
        problemTitle="Weird Algorithm"
        problemCategory="Introductory Problems"
      />
    );

    // View modes
    expect(html).toContain('Write');
    expect(html).toContain('Preview Math');
    expect(html).toContain('Split');

    // Toolbar formatting controls
    expect(html).toContain('Bold (**text**)');
    expect(html).toContain('Italic (*text*)');
    expect(html).toContain('Heading 1');
    expect(html).toContain('Inline Code');
    expect(html).toContain('Inline LaTeX Math');
    expect(html).toContain('Block LaTeX Math');
    expect(html).toContain('Fenced Code Block');
    expect(html).toContain('Task Checklist');
    expect(html).toContain('Insert Markdown Table');

    // Actions & Templates
    expect(html).toContain('Template');
    expect(html).toContain('Paste LLM');
    expect(html).toContain('View All Notes');
    expect(html).toContain('Markdown and LaTeX');
  });

  it('AllNotesModal returns null when closed', () => {
    const html = renderToStaticMarkup(
      <AllNotesModal isOpen={false} onClose={() => {}} />
    );
    expect(html).toBe('');
  });

  it('AllNotesModal displays empty state when no notes exist', () => {
    const html = renderToStaticMarkup(
      <AllNotesModal isOpen={true} onClose={() => {}} />
    );
    expect(html).toContain('CSES Notebook — All Problem Notes');
    expect(html).toContain('No notes recorded yet');
    expect(html).toContain('0 notes');
  });

  it('AllNotesModal renders problem cards and metadata when notes exist', () => {
    saveNote(
      '1068',
      '# Weird Algorithm\nCore recurrence: $n \\leftarrow n/2$ if even else $3n+1$.\n\n> [!NOTE]\n> Time complexity fits well.'
    );
    saveNote(
      '1083',
      '# Missing Number\nUse XOR sum: $$\\bigoplus_{i=1}^n i$$ to solve in $O(n)$ time.'
    );

    const html = renderToStaticMarkup(
      <AllNotesModal isOpen={true} onClose={() => {}} currentProblemId="1068" />
    );

    expect(html).toContain('CSES Notebook — All Problem Notes');
    expect(html).toContain('2 notes');
    expect(html).toContain('#1068');
    expect(html).toContain('Weird Algorithm');
    expect(html).toContain('#1083');
    expect(html).toContain('Missing Number');
    expect(html).toContain('Introductory Problems');
    expect(html).toContain('Export Notes');
  });

  it('storage: getAllNotesList returns array of note entries with updatedAt', () => {
    saveNote('1068', 'Approach 1');
    saveNote('1083', 'Approach 2');

    const list = getAllNotesList();
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBe(2);
    expect(list[0].problemId).toBeDefined();
    expect(list[0].content).toBeDefined();
    expect(list[0].updatedAt).toBeTypeOf('number');

    const record = getAllNotes();
    expect(record['1068']).toBe('Approach 1');
    expect(record['1083']).toBe('Approach 2');
  });
});
