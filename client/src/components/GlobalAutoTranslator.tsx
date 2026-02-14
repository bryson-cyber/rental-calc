/**
 * GlobalAutoTranslator
 *
 * Sits at the app root and automatically translates every visible text node
 * in the DOM when the user selects a non-English language. Uses a
 * MutationObserver to catch dynamically added content (route changes,
 * modals, lazy loads, toasts) and translates those too.
 *
 * Key design decisions:
 * - DOM-level approach: zero changes needed in individual components
 * - Batches text nodes to minimise API calls (≤ 50 items per batch)
 * - Debounces mutation callbacks to avoid hammering the API
 * - Skips numbers, currency, dates, code, SVG, inputs
 * - Caches translations in a Map keyed by (lang + originalText)
 * - Shows a small floating indicator while translating
 * - Auto-reverts when user switches back to English
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { Loader2, Globe, Check } from 'lucide-react';
import { useTranslation } from '@/contexts/TranslationContext';

// ── persistent caches (survive re-renders) ──
const translationCache = new Map<string, string>();
const originalTextMap = new Map<Text, string>();
const originalAttrMap = new Map<string, string>(); // key: elementId+attr
const translatedNodes = new Set<Text>();

function cacheKey(text: string, lang: string) {
  return `${lang}::${text}`;
}

// ── DOM helpers ──

/** Tags whose text content should never be translated */
const SKIP_TAGS = new Set([
  'script', 'style', 'code', 'pre', 'svg', 'math',
  'input', 'textarea', 'select', 'option', 'noscript',
]);

/** Attribute values we should translate */
const TRANSLATABLE_ATTRS = ['placeholder', 'title', 'aria-label', 'alt'];

/** Returns true when the string is purely numeric / currency / date / code */
function isNonTranslatable(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length === 0) return true;
  // Pure numbers, currency, percentages, dates, time
  if (/^[\d$€£¥₹%,./:;\-–—\s()]+$/.test(trimmed)) return true;
  // ISO dates
  if (/^\d{4}-\d{2}(-\d{2})?$/.test(trimmed)) return true;
  // Email addresses
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return true;
  // URLs
  if (/^https?:\/\//.test(trimmed)) return true;
  // Phone numbers
  if (/^\+?[\d\s\-().]+$/.test(trimmed) && trimmed.length >= 7) return true;
  return false;
}

/** Check if an element or any ancestor is hidden */
function isVisible(el: Element): boolean {
  if (!el.isConnected) return false;
  const style = window.getComputedStyle(el);
  return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
}

/** Walk the DOM and collect translatable text nodes */
function collectTextNodes(root: Node): Text[] {
  const nodes: Text[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      if (SKIP_TAGS.has(parent.tagName.toLowerCase())) return NodeFilter.FILTER_REJECT;
      // Skip the translator indicator itself
      if (parent.closest('[data-global-translator]')) return NodeFilter.FILTER_REJECT;
      // Skip the language selector dropdown
      if (parent.closest('[data-language-selector]')) return NodeFilter.FILTER_REJECT;
      if (!isVisible(parent)) return NodeFilter.FILTER_REJECT;
      const text = node.textContent?.trim() || '';
      if (text.length === 0) return NodeFilter.FILTER_REJECT;
      if (isNonTranslatable(text)) return NodeFilter.FILTER_REJECT;
      // Skip already-translated nodes
      if (translatedNodes.has(node as Text)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  let n: Text | null;
  while ((n = walker.nextNode() as Text | null)) nodes.push(n);
  return nodes;
}

/** Collect translatable attributes from elements */
function collectTranslatableAttrs(root: Element): Array<{ el: Element; attr: string; value: string }> {
  const results: Array<{ el: Element; attr: string; value: string }> = [];
  const allElements = Array.from(root.querySelectorAll('*'));
  for (const el of allElements) {
    if (SKIP_TAGS.has(el.tagName.toLowerCase())) continue;
    if (el.closest('[data-global-translator]')) continue;
    if (el.closest('[data-language-selector]')) continue;
    for (const attr of TRANSLATABLE_ATTRS) {
      const val = el.getAttribute(attr);
      if (val && val.trim().length >= 2 && !isNonTranslatable(val)) {
        results.push({ el, attr, value: val.trim() });
      }
    }
  }
  return results;
}

/** Split items into batches of ≤ maxItems, also respecting maxChars */
function batchItems<T>(items: T[], getText: (item: T) => string, maxItems = 40, maxChars = 4000): T[][] {
  const batches: T[][] = [];
  let batch: T[] = [];
  let len = 0;
  for (const item of items) {
    const text = getText(item);
    if ((len + text.length > maxChars || batch.length >= maxItems) && batch.length > 0) {
      batches.push(batch);
      batch = [];
      len = 0;
    }
    batch.push(item);
    len += text.length;
  }
  if (batch.length > 0) batches.push(batch);
  return batches;
}

// ── Component ──

export default function GlobalAutoTranslator() {
  const { currentLanguage, isTranslationActive, translateBatch } = useTranslation();
  const [status, setStatus] = useState<'idle' | 'translating' | 'done'>('idle');
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const observerRef = useRef<MutationObserver | null>(null);
  const pendingRef = useRef<Set<Node>>(new Set());
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isProcessing = useRef(false);
  const prevLang = useRef(currentLanguage);

  // ── translate a set of text nodes ──
  const translateNodes = useCallback(async (
    textNodes: Text[],
    lang: string,
    translateFn: typeof translateBatch,
  ) => {
    // Apply cached translations first
    const uncached: Text[] = [];
    for (const node of textNodes) {
      if (!node.isConnected) continue;
      const original = originalTextMap.get(node) || node.textContent?.trim() || '';
      if (!original || isNonTranslatable(original)) continue;
      const key = cacheKey(original, lang);
      if (translationCache.has(key)) {
        const cached = translationCache.get(key)!;
        const ws = node.textContent || '';
        const lead = ws.match(/^\s*/)?.[0] || '';
        const trail = ws.match(/\s*$/)?.[0] || '';
        node.textContent = lead + cached + trail;
        translatedNodes.add(node);
      } else {
        uncached.push(node);
      }
    }

    if (uncached.length === 0) return;

    // Save originals before translating
    for (const node of uncached) {
      if (!originalTextMap.has(node)) {
        originalTextMap.set(node, node.textContent || '');
      }
    }

    const batches = batchItems(uncached, n => n.textContent?.trim() || '');

    // Process all batches, continue even if one fails
    for (const batch of batches) {
      const textsMap: Record<string, string> = {};
      const validNodes: Array<{ node: Text; key: string; original: string }> = [];
      
      batch.forEach((node, i) => {
        const text = node.textContent?.trim() || '';
        if (text && node.isConnected) {
          const k = `t${i}`;
          textsMap[k] = text;
          validNodes.push({ node, key: k, original: text });
        }
      });

      if (Object.keys(textsMap).length === 0) continue;

      try {
        const result = await translateFn(textsMap, 'a rental property analysis website');
        for (const { node, key, original } of validNodes) {
          if (result[key] && node.isConnected) {
            const ws = node.textContent || '';
            const lead = ws.match(/^\s*/)?.[0] || '';
            const trail = ws.match(/\s*$/)?.[0] || '';
            node.textContent = lead + result[key] + trail;
            translatedNodes.add(node);
            translationCache.set(cacheKey(original, lang), result[key]);
          }
        }
      } catch (err) {
        console.error('[GlobalAutoTranslator] batch failed, continuing:', err);
        // Don't stop — continue with next batch
      }

      setProgress(p => ({ ...p, done: Math.min(p.done + batch.length, p.total) }));
      
      // Small delay between batches to avoid rate limiting
      await new Promise(r => setTimeout(r, 100));
    }
  }, []);

  // ── translate attributes (placeholder, title, aria-label, alt) ──
  const translateAttributes = useCallback(async (
    attrs: Array<{ el: Element; attr: string; value: string }>,
    lang: string,
    translateFn: typeof translateBatch,
  ) => {
    const uncached: Array<{ el: Element; attr: string; value: string }> = [];
    for (const item of attrs) {
      const key = cacheKey(item.value, lang);
      if (translationCache.has(key)) {
        item.el.setAttribute(item.attr, translationCache.get(key)!);
      } else {
        uncached.push(item);
      }
    }
    if (uncached.length === 0) return;

    const batches = batchItems(uncached, item => item.value);
    for (const batch of batches) {
      const textsMap: Record<string, string> = {};
      batch.forEach((item, i) => { textsMap[`a${i}`] = item.value; });
      try {
        const result = await translateFn(textsMap, 'UI element attributes on a rental property analysis website');
        batch.forEach((item, i) => {
          const key = `a${i}`;
          if (result[key]) {
            if (!item.el.hasAttribute(`data-orig-${item.attr}`)) {
              item.el.setAttribute(`data-orig-${item.attr}`, item.value);
            }
            item.el.setAttribute(item.attr, result[key]);
            translationCache.set(cacheKey(item.value, lang), result[key]);
          }
        });
      } catch (err) {
        console.error('[GlobalAutoTranslator] attr batch failed, continuing:', err);
      }
      setProgress(p => ({ ...p, done: Math.min(p.done + batch.length, p.total) }));
      await new Promise(r => setTimeout(r, 100));
    }
  }, []);

  // ── full-page translation ──
  const translatePage = useCallback(async (lang: string, translateFn: typeof translateBatch) => {
    if (isProcessing.current) return;
    isProcessing.current = true;
    setStatus('translating');

    try {
      const textNodes = collectTextNodes(document.body);
      const attrItems = collectTranslatableAttrs(document.body);
      setProgress({ done: 0, total: textNodes.length + attrItems.length });

      await translateNodes(textNodes, lang, translateFn);
      await translateAttributes(attrItems, lang, translateFn);

      setStatus('done');
    } catch (err) {
      console.error('[GlobalAutoTranslator] page translation error:', err);
      setStatus('done');
    } finally {
      isProcessing.current = false;
      // Auto-hide the "done" indicator after 3s
      setTimeout(() => setStatus('idle'), 3000);
    }
  }, [translateNodes, translateAttributes]);

  // ── revert all translations ──
  const revertAll = useCallback(() => {
    for (const [node, original] of Array.from(originalTextMap.entries())) {
      if (node.isConnected) {
        node.textContent = original;
      }
    }
    originalTextMap.clear();
    translatedNodes.clear();

    // Revert attributes
    Array.from(document.querySelectorAll('[data-orig-placeholder], [data-orig-title], [data-orig-aria-label], [data-orig-alt]')).forEach(el => {
      for (const attr of TRANSLATABLE_ATTRS) {
        const orig = el.getAttribute(`data-orig-${attr}`);
        if (orig !== null) {
          el.setAttribute(attr, orig);
          el.removeAttribute(`data-orig-${attr}`);
        }
      }
    });

    setStatus('idle');
    setProgress({ done: 0, total: 0 });
  }, []);

  // ── handle mutation-observed new content ──
  const processPendingMutations = useCallback(async () => {
    if (!isTranslationActive || isProcessing.current) return;
    const nodes = Array.from(pendingRef.current);
    pendingRef.current.clear();
    if (nodes.length === 0) return;

    isProcessing.current = true;
    setStatus('translating');

    try {
      const allTextNodes: Text[] = [];
      const allAttrItems: Array<{ el: Element; attr: string; value: string }> = [];

      for (const root of nodes) {
        if (!root.isConnected) continue;
        allTextNodes.push(...collectTextNodes(root));
        if (root instanceof Element) {
          allAttrItems.push(...collectTranslatableAttrs(root));
        }
      }

      const newTextNodes = allTextNodes.filter(n => !translatedNodes.has(n));
      if (newTextNodes.length > 0 || allAttrItems.length > 0) {
        setProgress({ done: 0, total: newTextNodes.length + allAttrItems.length });
        await translateNodes(newTextNodes, currentLanguage, translateBatch);
        await translateAttributes(allAttrItems, currentLanguage, translateBatch);
      }
    } catch (err) {
      console.error('[GlobalAutoTranslator] mutation processing error:', err);
    }

    setStatus('done');
    isProcessing.current = false;
    setTimeout(() => setStatus('idle'), 2000);
  }, [isTranslationActive, currentLanguage, translateBatch, translateNodes, translateAttributes]);

  // ── MutationObserver setup ──
  useEffect(() => {
    if (!isTranslationActive) {
      observerRef.current?.disconnect();
      return;
    }

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const added of Array.from(mutation.addedNodes)) {
          if (added.nodeType === Node.ELEMENT_NODE || added.nodeType === Node.TEXT_NODE) {
            if (added instanceof Element && added.hasAttribute('data-global-translator')) continue;
            pendingRef.current.add(added);
          }
        }
        if (mutation.type === 'characterData' && mutation.target.nodeType === Node.TEXT_NODE) {
          const textNode = mutation.target as Text;
          if (!translatedNodes.has(textNode)) {
            pendingRef.current.add(textNode.parentElement || textNode);
          }
        }
      }

      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => {
        processPendingMutations();
      }, 500);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    observerRef.current = observer;

    return () => {
      observer.disconnect();
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [isTranslationActive, processPendingMutations]);

  // ── React to language changes ──
  useEffect(() => {
    if (prevLang.current === currentLanguage) return;
    prevLang.current = currentLanguage;

    // Revert first
    revertAll();
    // Clear cache for new language (keep cross-language cache for performance)

    if (currentLanguage !== 'en') {
      // Delay to let React finish rendering after revert
      setTimeout(() => {
        translatePage(currentLanguage, translateBatch);
      }, 500);
    }
  }, [currentLanguage, revertAll, translatePage, translateBatch]);

  // ── Initial translation on mount (if non-English already selected) ──
  useEffect(() => {
    if (isTranslationActive && currentLanguage !== 'en') {
      const timer = setTimeout(() => {
        translatePage(currentLanguage, translateBatch);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Floating indicator ──
  if (status === 'idle') return null;

  return (
    <div
      data-global-translator="true"
      className="fixed bottom-4 right-4 z-[9999] flex items-center gap-2 px-4 py-2.5 rounded-full shadow-lg border transition-all duration-300"
      style={{
        background: status === 'translating' ? 'rgba(255,255,255,0.97)' : 'rgba(240,253,244,0.97)',
        borderColor: status === 'translating' ? '#C9A962' : '#22c55e',
      }}
    >
      {status === 'translating' ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin text-[#C9A962]" />
          <span className="text-sm font-medium text-[#0F172A]/80">
            Translating{progress.total > 0 ? ` (${progress.done}/${progress.total})` : '...'}
          </span>
        </>
      ) : (
        <>
          <Check className="w-4 h-4 text-green-600" />
          <span className="text-sm font-medium text-green-700">
            Translation complete
          </span>
        </>
      )}
    </div>
  );
}
