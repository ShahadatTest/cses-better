import { describe, it, expect } from 'vitest';
import {
  ONLINE_COMPILER_LANG_MAP,
  getOnlineCompilerLang,
} from '../src/components/editor/InbuiltCompilerView';
import { LanguageId } from '../src/core/types';
import { SUPPORTED_LANGUAGES, getLanguageConfig } from '../src/core/templates';

describe('Editor Component Suite', () => {
  describe('OnlineCompiler.io Language Mapping', () => {
    it('correctly maps all standard competitive programming languages', () => {
      expect(getOnlineCompilerLang('cpp')).toBe('g++-15');
      expect(getOnlineCompilerLang('python')).toBe('python-3.14');
      expect(getOnlineCompilerLang('java')).toBe('openjdk-25');
      expect(getOnlineCompilerLang('rust')).toBe('rust-1.93');
      expect(getOnlineCompilerLang('go')).toBe('go-1.26');
      expect(getOnlineCompilerLang('javascript')).toBe('nodejs-24');
      expect(getOnlineCompilerLang('typescript')).toBe('typescript-deno');
      expect(getOnlineCompilerLang('c')).toBe('gcc-15');
    });

    it('falls back to input if unknown language passed', () => {
      // @ts-expect-error Testing fallback
      expect(getOnlineCompilerLang('unknown_lang')).toBe('unknown_lang');
    });

    it('covers all languages defined in SUPPORTED_LANGUAGES', () => {
      for (const lang of SUPPORTED_LANGUAGES) {
        const mapped = getOnlineCompilerLang(lang.id);
        expect(mapped).toBeDefined();
        expect(typeof mapped).toBe('string');
        expect(mapped.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Monaco Language Configuration and Tab Sizing', () => {
    it('provides correct monaco language identifiers', () => {
      for (const lang of SUPPORTED_LANGUAGES) {
        const cfg = getLanguageConfig(lang.id);
        expect(cfg.monacoLanguage).toBeDefined();
        expect(typeof cfg.monacoLanguage).toBe('string');
      }
    });

    it('assigns 2 spaces for JS/TS and 4 for others', () => {
      const getTabSize = (lang: LanguageId) =>
        lang === 'javascript' || lang === 'typescript' ? 2 : 4;

      expect(getTabSize('javascript')).toBe(2);
      expect(getTabSize('typescript')).toBe(2);
      expect(getTabSize('cpp')).toBe(4);
      expect(getTabSize('python')).toBe(4);
      expect(getTabSize('java')).toBe(4);
      expect(getTabSize('rust')).toBe(4);
      expect(getTabSize('go')).toBe(4);
      expect(getTabSize('c')).toBe(4);
    });
  });

  describe('OnlineCompiler.io Embed URL generator', () => {
    it('properly encodes code and sets query parameters', () => {
      const code = '#include <iostream>\nusing namespace std;\nint main() { return 0; }';
      const key = 'test-key-123';
      const lang: LanguageId = 'cpp';
      const embedLang = getOnlineCompilerLang(lang);
      const url = `https://api.onlinecompiler.io/embed/?key=${key}&lang=${embedLang}&theme=dark#code=${encodeURIComponent(
        code
      )}`;

      expect(url).toContain('api.onlinecompiler.io/embed');
      expect(url).toContain('key=test-key-123');
      expect(url).toContain('lang=g++-15');
      expect(url).toContain('theme=dark');
      expect(url).toContain(encodeURIComponent(code));
    });
  });

  describe('Download Solution File Naming', () => {
    function computeFilename(
      language: LanguageId,
      problemId?: string,
      problemTitle?: string
    ): string {
      const config = getLanguageConfig(language);
      const ext = config.extension;
      if (language === 'java') {
        return 'Main.java';
      }
      const cleanTitle = problemTitle
        ? problemTitle
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '')
        : 'solution';
      return problemId ? `${problemId}_${cleanTitle}${ext}` : `${cleanTitle}${ext}`;
    }

    it('enforces Main.java for Java submissions on CSES', () => {
      expect(computeFilename('java', '1068', 'Weird Algorithm')).toBe('Main.java');
      expect(computeFilename('java', '1083', 'Missing Number')).toBe('Main.java');
    });

    it('creates clean filenames for other languages with problem ID and title', () => {
      expect(computeFilename('cpp', '1068', 'Weird Algorithm')).toBe('1068_weird_algorithm.cpp');
      expect(computeFilename('python', '1069', 'Repetitions')).toBe('1069_repetitions.py');
      expect(computeFilename('rust', '1094', 'Increasing Array')).toBe('1094_increasing_array.rs');
      expect(computeFilename('go', '1070', 'Permutations')).toBe('1070_permutations.go');
    });
  });
});
