/**
 * Translation Context
 * 
 * Provides app-wide translation state and utilities.
 * Uses a two-tier caching strategy:
 *   1. Server-side persistent cache (DB) — pre-translated UI strings loaded on language change
 *   2. Client-side in-memory cache — avoids redundant tRPC calls within a session
 * Falls back to AI API via tRPC only for cache misses.
 * Persists language preference in localStorage.
 */

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { trpc } from '@/lib/trpc';

interface TranslationContextType {
  /** Current language code (e.g., 'en', 'es', 'fr') */
  currentLanguage: string;
  /** Display name of current language */
  currentLanguageName: string;
  /** Set the active language */
  setLanguage: (langCode: string) => void;
  /** Translate a single text string */
  translate: (text: string, context?: string) => Promise<string>;
  /** Translate multiple text strings at once (batch) */
  translateBatch: (texts: Record<string, string>, context?: string) => Promise<Record<string, string>>;
  /** Translate a long report/document */
  translateReport: (content: string) => Promise<string>;
  /** Whether a translation is currently in progress */
  isTranslating: boolean;
  /** List of supported languages */
  supportedLanguages: Array<{ code: string; name: string }>;
  /** Whether translation is available (non-English language selected) */
  isTranslationActive: boolean;
  /** Whether the server cache has been loaded for the current language */
  isCacheReady: boolean;
}

const TranslationContext = createContext<TranslationContextType | null>(null);

const STORAGE_KEY = 'rental-calc-language';

// Client-side translation cache to avoid redundant tRPC calls.
// This is populated from the server cache on language change, then
// augmented with AI translations for cache misses.
const clientCache = new Map<string, string>();

function getClientCacheKey(text: string, lang: string): string {
  const shortText = text.length > 80 ? text.substring(0, 80) + text.length : text;
  return `${lang}:${shortText}`;
}

export function TranslationProvider({ children }: { children: React.ReactNode }) {
  const [currentLanguage, setCurrentLanguage] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(STORAGE_KEY) || 'en';
    }
    return 'en';
  });
  const [isTranslating, setIsTranslating] = useState(false);
  const [isCacheReady, setIsCacheReady] = useState(false);
  const activeRequests = useRef(0);
  const cacheLoadedForLang = useRef<string>('');

  // Fetch supported languages
  const { data: languagesData } = trpc.translation.getSupportedLanguages.useQuery(undefined, {
    staleTime: Infinity,
  });

  const supportedLanguages = languagesData || [{ code: 'en', name: 'English' }];

  const currentLanguageName = supportedLanguages.find(l => l.code === currentLanguage)?.name || 'English';

  const translateTextMutation = trpc.translation.translateText.useMutation();
  const translateBatchMutation = trpc.translation.translateBatch.useMutation();
  const translateReportMutation = trpc.translation.translateReport.useMutation();
  const getFullCacheMutation = trpc.translation.getFullCache.useQuery(
    { targetLang: currentLanguage },
    {
      enabled: currentLanguage !== 'en',
      staleTime: 5 * 60 * 1000, // 5 minutes
    }
  );

  // Pre-load server cache into client cache when language changes
  useEffect(() => {
    if (currentLanguage === 'en') {
      setIsCacheReady(true);
      return;
    }

    if (getFullCacheMutation.data && cacheLoadedForLang.current !== currentLanguage) {
      const { translations, count } = getFullCacheMutation.data;
      console.log(`[TranslationCache] Loaded ${count} cached translations for ${currentLanguage}`);
      
      // Populate client cache with server cache entries
      for (const [sourceText, translatedText] of Object.entries(translations)) {
        const key = getClientCacheKey(sourceText, currentLanguage);
        clientCache.set(key, translatedText);
      }
      
      cacheLoadedForLang.current = currentLanguage;
      setIsCacheReady(true);
    } else if (getFullCacheMutation.isLoading) {
      setIsCacheReady(false);
    } else if (getFullCacheMutation.isError) {
      // If cache load fails, still allow translation to proceed via AI
      console.warn('[TranslationCache] Failed to load server cache, falling back to AI');
      setIsCacheReady(true);
    }
  }, [currentLanguage, getFullCacheMutation.data, getFullCacheMutation.isLoading, getFullCacheMutation.isError]);

  const setLanguage = useCallback((langCode: string) => {
    setCurrentLanguage(langCode);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, langCode);
    }
    // Clear client cache when language changes (server cache will repopulate it)
    clientCache.clear();
    cacheLoadedForLang.current = '';
    setIsCacheReady(false);
  }, []);

  const translate = useCallback(async (text: string, context?: string): Promise<string> => {
    if (currentLanguage === 'en' || !text || text.trim().length === 0) return text;

    // Check client cache (includes server cache entries)
    const cacheKey = getClientCacheKey(text, currentLanguage);
    const cached = clientCache.get(cacheKey);
    if (cached) return cached;

    activeRequests.current++;
    setIsTranslating(true);

    try {
      const result = await translateTextMutation.mutateAsync({
        text,
        targetLang: currentLanguage,
        context,
      });
      const translation = result.translation;
      clientCache.set(cacheKey, translation);
      return translation;
    } catch (error) {
      console.error('[Translation] Error:', error);
      return text;
    } finally {
      activeRequests.current--;
      if (activeRequests.current === 0) {
        setIsTranslating(false);
      }
    }
  }, [currentLanguage, translateTextMutation]);

  const translateBatchFn = useCallback(async (
    texts: Record<string, string>,
    context?: string
  ): Promise<Record<string, string>> => {
    if (currentLanguage === 'en') return texts;

    // Check client cache for each (includes server cache entries), collect uncached
    const result: Record<string, string> = {};
    const uncached: Record<string, string> = {};

    for (const [key, text] of Object.entries(texts)) {
      const cacheKey = getClientCacheKey(text, currentLanguage);
      const cached = clientCache.get(cacheKey);
      if (cached) {
        result[key] = cached;
      } else {
        uncached[key] = text;
      }
    }

    if (Object.keys(uncached).length === 0) return result;

    activeRequests.current++;
    setIsTranslating(true);

    try {
      const batchResult = await translateBatchMutation.mutateAsync({
        texts: uncached,
        targetLang: currentLanguage,
        context,
      });

      for (const [key, translation] of Object.entries(batchResult.translations)) {
        result[key] = translation;
        const cacheKey = getClientCacheKey(uncached[key], currentLanguage);
        clientCache.set(cacheKey, translation);
      }

      return result;
    } catch (error) {
      console.error('[Translation] Batch error:', error);
      return { ...result, ...uncached };
    } finally {
      activeRequests.current--;
      if (activeRequests.current === 0) {
        setIsTranslating(false);
      }
    }
  }, [currentLanguage, translateBatchMutation]);

  const translateReportFn = useCallback(async (content: string): Promise<string> => {
    if (currentLanguage === 'en' || !content) return content;

    const cacheKey = getClientCacheKey(content, currentLanguage);
    const cached = clientCache.get(cacheKey);
    if (cached) return cached;

    activeRequests.current++;
    setIsTranslating(true);

    try {
      const result = await translateReportMutation.mutateAsync({
        content,
        targetLang: currentLanguage,
      });
      const translation = result.translation;
      clientCache.set(cacheKey, translation);
      return translation;
    } catch (error) {
      console.error('[Translation] Report error:', error);
      return content;
    } finally {
      activeRequests.current--;
      if (activeRequests.current === 0) {
        setIsTranslating(false);
      }
    }
  }, [currentLanguage, translateReportMutation]);

  const value: TranslationContextType = {
    currentLanguage,
    currentLanguageName,
    setLanguage,
    translate,
    translateBatch: translateBatchFn,
    translateReport: translateReportFn,
    isTranslating,
    supportedLanguages,
    isTranslationActive: currentLanguage !== 'en',
    isCacheReady,
  };

  return (
    <TranslationContext.Provider value={value}>
      {children}
    </TranslationContext.Provider>
  );
}

/**
 * Hook to access translation utilities
 */
export function useTranslation() {
  const context = useContext(TranslationContext);
  if (!context) {
    throw new Error('useTranslation must be used within a TranslationProvider');
  }
  return context;
}

/**
 * Hook for translating a static set of UI strings.
 * Returns translated versions that update when language changes.
 */
export function useTranslatedStrings(strings: Record<string, string>, context?: string) {
  const { currentLanguage, translateBatch, isTranslationActive } = useTranslation();
  const [translated, setTranslated] = useState<Record<string, string>>(strings);
  const [loading, setLoading] = useState(false);
  const prevLangRef = useRef(currentLanguage);
  const stringsRef = useRef(strings);

  useEffect(() => {
    // Only re-translate if language changed
    if (prevLangRef.current === currentLanguage && stringsRef.current === strings) return;
    prevLangRef.current = currentLanguage;
    stringsRef.current = strings;

    if (!isTranslationActive) {
      setTranslated(strings);
      return;
    }

    let cancelled = false;
    setLoading(true);

    translateBatch(strings, context).then(result => {
      if (!cancelled) {
        setTranslated(result);
        setLoading(false);
      }
    });

    return () => { cancelled = true; };
  }, [currentLanguage, strings, isTranslationActive, translateBatch, context]);

  return { translated, loading };
}
