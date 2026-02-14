/**
 * Translation Service using Gemini 3 Flash API
 * 
 * Provides on-demand translation of text content to any language
 * supported by Gemini. Uses caching to avoid redundant API calls.
 * 
 * Architecture:
 * - Server-side translation via Gemini REST API
 * - In-memory cache with TTL for frequently requested translations
 * - Batch translation support for translating multiple strings at once
 * - Structured JSON output for reliable parsing
 */

import { ENV } from './_core/env';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview';

// Supported languages with their display names
export const SUPPORTED_LANGUAGES: Record<string, string> = {
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  it: 'Italian',
  pt: 'Portuguese',
  nl: 'Dutch',
  ru: 'Russian',
  ja: 'Japanese',
  ko: 'Korean',
  zh: 'Chinese (Simplified)',
  'zh-TW': 'Chinese (Traditional)',
  ar: 'Arabic',
  hi: 'Hindi',
  bn: 'Bengali',
  ur: 'Urdu',
  tr: 'Turkish',
  vi: 'Vietnamese',
  th: 'Thai',
  pl: 'Polish',
  uk: 'Ukrainian',
  ro: 'Romanian',
  sv: 'Swedish',
  da: 'Danish',
  fi: 'Finnish',
  no: 'Norwegian',
  he: 'Hebrew',
  id: 'Indonesian',
  ms: 'Malay',
  tl: 'Filipino',
  sw: 'Swahili',
  am: 'Amharic',
  ha: 'Hausa',
  yo: 'Yoruba',
  ig: 'Igbo',
  so: 'Somali',
};

// In-memory translation cache with TTL
interface CacheEntry {
  translation: string;
  timestamp: number;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const translationCache = new Map<string, CacheEntry>();

function getCacheKey(text: string, targetLang: string): string {
  // Use a hash-like key combining text content and target language
  const textKey = text.length > 100 ? text.substring(0, 100) + '...' + text.length : text;
  return `${targetLang}:${textKey}`;
}

function getCachedTranslation(text: string, targetLang: string): string | null {
  const key = getCacheKey(text, targetLang);
  const entry = translationCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    translationCache.delete(key);
    return null;
  }
  return entry.translation;
}

function setCachedTranslation(text: string, targetLang: string, translation: string): void {
  const key = getCacheKey(text, targetLang);
  translationCache.set(key, { translation, timestamp: Date.now() });
  
  // Evict old entries if cache grows too large (keep under 5000 entries)
  if (translationCache.size > 5000) {
    const entries = Array.from(translationCache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    const toDelete = entries.slice(0, 1000);
    for (const [key] of toDelete) {
      translationCache.delete(key);
    }
  }
}

/**
 * Translate a single text string to the target language
 */
export async function translateText(
  text: string,
  targetLang: string,
  context?: string
): Promise<string> {
  // Skip translation if target is English (source language)
  if (targetLang === 'en') return text;
  
  // Check cache first
  const cached = getCachedTranslation(text, targetLang);
  if (cached) return cached;
  
  const apiKey = ENV.geminiApiKey;
  if (!apiKey) {
    console.warn('[Translation] GEMINI_API_KEY not configured, returning original text');
    return text;
  }

  const languageName = SUPPORTED_LANGUAGES[targetLang] || targetLang;
  
  const systemPrompt = `You are a professional translator. Translate the given text to ${languageName}.

Rules:
- Preserve all formatting (markdown, HTML tags, line breaks)
- Preserve all numbers, currency symbols, and units exactly as-is
- Preserve all proper nouns (company names, brand names, place names) unless they have well-known translations
- Preserve all URLs, email addresses, and code snippets exactly as-is
- Do NOT add any explanations or notes — return ONLY the translated text
- Maintain the same tone and register as the original
- For real estate and financial terminology, use the standard terms in the target language
${context ? `\nContext: This text is from ${context}` : ''}`;

  try {
    const response = await fetch(
      `${GEMINI_API_URL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text }] }],
          generationConfig: {
            temperature: 0.1, // Low temperature for consistent translations
            maxOutputTokens: 8192,
          },
          safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
          ],
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Translation] Gemini API error: ${response.status} - ${errorText}`);
      return text; // Fallback to original text
    }

    const data = await response.json();
    const translatedText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!translatedText) {
      console.error('[Translation] No translation returned from Gemini');
      return text;
    }

    // Cache the result
    setCachedTranslation(text, targetLang, translatedText.trim());
    return translatedText.trim();
  } catch (error) {
    console.error('[Translation] Error:', error);
    return text; // Fallback to original text
  }
}

/**
 * Translate multiple text strings in a single API call (batch translation)
 * More efficient than calling translateText for each string individually
 */
export async function translateBatch(
  texts: Record<string, string>,
  targetLang: string,
  context?: string
): Promise<Record<string, string>> {
  // Skip translation if target is English
  if (targetLang === 'en') return texts;
  
  const apiKey = ENV.geminiApiKey;
  if (!apiKey) {
    console.warn('[Translation] GEMINI_API_KEY not configured, returning original texts');
    return texts;
  }

  // Check cache for each text, collect uncached ones
  const result: Record<string, string> = {};
  const uncachedKeys: string[] = [];
  const uncachedTexts: Record<string, string> = {};
  
  for (const [key, text] of Object.entries(texts)) {
    const cached = getCachedTranslation(text, targetLang);
    if (cached) {
      result[key] = cached;
    } else {
      uncachedKeys.push(key);
      uncachedTexts[key] = text;
    }
  }
  
  // If everything was cached, return immediately
  if (uncachedKeys.length === 0) return result;
  
  const languageName = SUPPORTED_LANGUAGES[targetLang] || targetLang;
  
  const systemPrompt = `You are a professional translator. Translate all values in the given JSON object to ${languageName}.

Rules:
- Return a valid JSON object with the same keys but translated values
- Preserve all formatting (markdown, HTML tags, line breaks) within values
- Preserve all numbers, currency symbols, and units exactly as-is
- Preserve all proper nouns unless they have well-known translations
- Preserve all URLs, email addresses, and code snippets exactly as-is
- Do NOT translate the JSON keys — only translate the values
- Maintain the same tone and register as the original
- For real estate and financial terminology, use standard terms in the target language
${context ? `\nContext: This text is from ${context}` : ''}`;

  try {
    const response = await fetch(
      `${GEMINI_API_URL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: JSON.stringify(uncachedTexts) }] }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 16384,
            responseMimeType: 'application/json',
          },
          safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
          ],
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Translation] Batch Gemini API error: ${response.status} - ${errorText}`);
      // Fallback: return original texts for uncached items
      for (const key of uncachedKeys) {
        result[key] = uncachedTexts[key];
      }
      return result;
    }

    const data = await response.json();
    const responseText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!responseText) {
      console.error('[Translation] No batch translation returned from Gemini');
      for (const key of uncachedKeys) {
        result[key] = uncachedTexts[key];
      }
      return result;
    }

    // Parse the JSON response
    try {
      const translated = JSON.parse(responseText);
      for (const key of uncachedKeys) {
        const translatedValue = translated[key];
        if (translatedValue && typeof translatedValue === 'string') {
          result[key] = translatedValue.trim();
          setCachedTranslation(uncachedTexts[key], targetLang, translatedValue.trim());
        } else {
          result[key] = uncachedTexts[key]; // Fallback to original
        }
      }
    } catch (parseError) {
      console.error('[Translation] Failed to parse batch response:', parseError);
      for (const key of uncachedKeys) {
        result[key] = uncachedTexts[key];
      }
    }

    return result;
  } catch (error) {
    console.error('[Translation] Batch error:', error);
    for (const key of uncachedKeys) {
      result[key] = uncachedTexts[key];
    }
    return result;
  }
}

/**
 * Translate a long-form report/document content
 * Handles large content by splitting into manageable chunks
 */
export async function translateReport(
  content: string,
  targetLang: string
): Promise<string> {
  if (targetLang === 'en') return content;
  
  // For shorter content, translate directly
  if (content.length <= 4000) {
    return translateText(content, targetLang, 'a rental property analysis report');
  }
  
  // For longer content, split by sections (double newlines or markdown headers)
  const sections = content.split(/(?=\n#{1,3}\s|\n\n)/);
  const translatedSections: string[] = [];
  
  // Process in batches of ~4000 chars
  let currentBatch = '';
  for (const section of sections) {
    if (currentBatch.length + section.length > 4000 && currentBatch.length > 0) {
      const translated = await translateText(currentBatch, targetLang, 'a rental property analysis report');
      translatedSections.push(translated);
      currentBatch = section;
    } else {
      currentBatch += section;
    }
  }
  
  // Translate remaining batch
  if (currentBatch.length > 0) {
    const translated = await translateText(currentBatch, targetLang, 'a rental property analysis report');
    translatedSections.push(translated);
  }
  
  return translatedSections.join('');
}

/**
 * Get the list of supported languages
 */
export function getSupportedLanguages(): Array<{ code: string; name: string }> {
  return Object.entries(SUPPORTED_LANGUAGES).map(([code, name]) => ({
    code,
    name,
  }));
}

/**
 * Clear the translation cache (useful for admin operations)
 */
export function clearTranslationCache(): number {
  const size = translationCache.size;
  translationCache.clear();
  return size;
}
