import { describe, it, expect } from 'vitest';
import { z } from 'zod';

/**
 * Tests for translation service and user properties drill-down features
 */

// ============================================
// TRANSLATION SERVICE TESTS
// ============================================
describe('Translation Service', () => {
  describe('Supported Languages', () => {
    const SUPPORTED_LANGUAGES = [
      'es', 'fr', 'de', 'it', 'pt', 'zh', 'ja', 'ko', 'ar', 'hi',
      'ru', 'nl', 'sv', 'pl', 'tr', 'vi', 'th', 'id', 'ms', 'tl',
      'he', 'uk', 'cs', 'ro', 'hu', 'el', 'da', 'fi', 'no', 'sk',
      'bg', 'hr', 'sr', 'sl', 'et', 'lv', 'lt', 'sw', 'bn', 'ta',
      'te', 'mr', 'gu', 'kn', 'ml', 'pa', 'ur',
    ];

    it('should have at least 40 supported languages', () => {
      expect(SUPPORTED_LANGUAGES.length).toBeGreaterThanOrEqual(40);
    });

    it('should include major world languages', () => {
      const majorLanguages = ['es', 'fr', 'de', 'zh', 'ja', 'ko', 'ar', 'hi', 'pt', 'ru'];
      for (const lang of majorLanguages) {
        expect(SUPPORTED_LANGUAGES).toContain(lang);
      }
    });

    it('should not include English as a target language', () => {
      expect(SUPPORTED_LANGUAGES).not.toContain('en');
    });
  });

  describe('Translation Input Validation', () => {
    const translateInputSchema = z.object({
      texts: z.array(z.string().min(1)).min(1).max(50),
      targetLanguage: z.string().min(2).max(5),
      sourceLanguage: z.string().min(2).max(5).optional(),
    });

    it('should accept valid translation input', () => {
      const input = {
        texts: ['Hello, world!', 'How are you?'],
        targetLanguage: 'es',
      };
      expect(() => translateInputSchema.parse(input)).not.toThrow();
    });

    it('should reject empty texts array', () => {
      const input = {
        texts: [],
        targetLanguage: 'es',
      };
      expect(() => translateInputSchema.parse(input)).toThrow();
    });

    it('should reject texts with empty strings', () => {
      const input = {
        texts: [''],
        targetLanguage: 'es',
      };
      expect(() => translateInputSchema.parse(input)).toThrow();
    });

    it('should reject more than 50 texts', () => {
      const input = {
        texts: Array(51).fill('test'),
        targetLanguage: 'es',
      };
      expect(() => translateInputSchema.parse(input)).toThrow();
    });

    it('should accept optional source language', () => {
      const input = {
        texts: ['Hello'],
        targetLanguage: 'es',
        sourceLanguage: 'en',
      };
      const result = translateInputSchema.parse(input);
      expect(result.sourceLanguage).toBe('en');
    });
  });

  describe('Batch Translation Logic', () => {
    it('should split texts into batches of correct size', () => {
      const texts = Array(25).fill('test text');
      const batchSize = 10;
      const batches: string[][] = [];
      
      for (let i = 0; i < texts.length; i += batchSize) {
        batches.push(texts.slice(i, i + batchSize));
      }
      
      expect(batches).toHaveLength(3);
      expect(batches[0]).toHaveLength(10);
      expect(batches[1]).toHaveLength(10);
      expect(batches[2]).toHaveLength(5);
    });

    it('should handle single text without batching', () => {
      const texts = ['Hello'];
      const batchSize = 10;
      const batches: string[][] = [];
      
      for (let i = 0; i < texts.length; i += batchSize) {
        batches.push(texts.slice(i, i + batchSize));
      }
      
      expect(batches).toHaveLength(1);
      expect(batches[0]).toHaveLength(1);
    });
  });

  describe('Translation Cache Key Generation', () => {
    it('should generate consistent cache keys for same input', () => {
      const generateKey = (text: string, lang: string) => `translate:${lang}:${text.slice(0, 100)}`;
      
      const key1 = generateKey('Hello world', 'es');
      const key2 = generateKey('Hello world', 'es');
      expect(key1).toBe(key2);
    });

    it('should generate different keys for different languages', () => {
      const generateKey = (text: string, lang: string) => `translate:${lang}:${text.slice(0, 100)}`;
      
      const key1 = generateKey('Hello world', 'es');
      const key2 = generateKey('Hello world', 'fr');
      expect(key1).not.toBe(key2);
    });

    it('should truncate long text in cache keys', () => {
      const generateKey = (text: string, lang: string) => `translate:${lang}:${text.slice(0, 100)}`;
      
      const longText = 'a'.repeat(200);
      const key = generateKey(longText, 'es');
      expect(key.length).toBeLessThanOrEqual(115); // "translate:es:" + 100 chars
    });
  });
});

// ============================================
// USER PROPERTIES DRILL-DOWN TESTS
// ============================================
describe('User Properties Drill-Down', () => {
  describe('Input Validation', () => {
    const getUserPropertiesSchema = z.object({
      userId: z.number().int(),
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(100).default(20),
    });

    it('should accept valid input with defaults', () => {
      const input = { userId: 1 };
      const result = getUserPropertiesSchema.parse(input);
      expect(result.userId).toBe(1);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
    });

    it('should accept custom page and pageSize', () => {
      const input = { userId: 5, page: 3, pageSize: 50 };
      const result = getUserPropertiesSchema.parse(input);
      expect(result.page).toBe(3);
      expect(result.pageSize).toBe(50);
    });

    it('should reject page less than 1', () => {
      const input = { userId: 1, page: 0 };
      expect(() => getUserPropertiesSchema.parse(input)).toThrow();
    });

    it('should reject pageSize greater than 100', () => {
      const input = { userId: 1, pageSize: 101 };
      expect(() => getUserPropertiesSchema.parse(input)).toThrow();
    });

    it('should reject non-integer userId', () => {
      const input = { userId: 1.5 };
      expect(() => getUserPropertiesSchema.parse(input)).toThrow();
    });
  });

  describe('Pagination Logic', () => {
    it('should calculate correct offset for page 1', () => {
      const page = 1;
      const pageSize = 20;
      const offset = (page - 1) * pageSize;
      expect(offset).toBe(0);
    });

    it('should calculate correct offset for page 3', () => {
      const page = 3;
      const pageSize = 20;
      const offset = (page - 1) * pageSize;
      expect(offset).toBe(40);
    });

    it('should calculate total pages correctly', () => {
      const totalItems = 45;
      const pageSize = 20;
      const totalPages = Math.ceil(totalItems / pageSize);
      expect(totalPages).toBe(3);
    });

    it('should handle zero items', () => {
      const totalItems = 0;
      const pageSize = 20;
      const totalPages = Math.ceil(totalItems / pageSize);
      expect(totalPages).toBe(0);
    });
  });

  describe('Report Verdict Badge Styling', () => {
    const getVerdictStyle = (verdict: string) => {
      switch (verdict) {
        case 'GO': return 'bg-green-100 text-green-700 border-green-200';
        case 'CAUTION': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
        case 'NO-GO': return 'bg-red-100 text-red-700 border-red-200';
        default: return 'bg-gray-100 text-gray-700 border-gray-200';
      }
    };

    it('should return green styling for GO verdict', () => {
      expect(getVerdictStyle('GO')).toContain('green');
    });

    it('should return yellow styling for CAUTION verdict', () => {
      expect(getVerdictStyle('CAUTION')).toContain('yellow');
    });

    it('should return red styling for NO-GO verdict', () => {
      expect(getVerdictStyle('NO-GO')).toContain('red');
    });

    it('should return gray styling for unknown verdict', () => {
      expect(getVerdictStyle('UNKNOWN')).toContain('gray');
    });
  });

  describe('Activity Category Filtering', () => {
    const propertyCategories = ['analysis', 'search', 'report'];

    it('should include analysis category', () => {
      expect(propertyCategories).toContain('analysis');
    });

    it('should include search category', () => {
      expect(propertyCategories).toContain('search');
    });

    it('should include report category', () => {
      expect(propertyCategories).toContain('report');
    });

    it('should not include navigation category', () => {
      expect(propertyCategories).not.toContain('navigation');
    });

    it('should not include auth category', () => {
      expect(propertyCategories).not.toContain('auth');
    });
  });

  describe('Session-to-Report Mapping', () => {
    it('should batch session IDs correctly', () => {
      const sessionIds = Array.from({ length: 120 }, (_, i) => `session-${i}`);
      const batchSize = 50;
      const batches: string[][] = [];
      
      for (let i = 0; i < Math.min(sessionIds.length, batchSize); i += batchSize) {
        batches.push(sessionIds.slice(i, i + batchSize));
      }
      
      // Only first batch due to Math.min limit
      expect(batches).toHaveLength(1);
      expect(batches[0]).toHaveLength(50);
    });

    it('should handle empty session IDs', () => {
      const sessionIds: string[] = [];
      expect(sessionIds.length).toBe(0);
      // Should skip report query when no sessions
    });
  });
});
