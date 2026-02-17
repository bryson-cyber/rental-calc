/**
 * TranslatePageBanner Component
 * 
 * A banner that appears at the top of a page/section when a non-English
 * language is selected. Translates all visible text nodes within a
 * container element using the AI translation API.
 * 
 * This approach works with any component — no need to modify individual
 * components or wrap every string.
 * 
 * Usage:
 *   const containerRef = useRef<HTMLDivElement>(null);
 *   <TranslatePageBanner containerRef={containerRef} />
 *   <div ref={containerRef}>...your content...</div>
 */

import { useState, useCallback, RefObject } from 'react';
import { Globe, Loader2, RotateCcw, Languages } from 'lucide-react';
import { useTranslation } from '@/contexts/TranslationContext';
import { Button } from '@/components/ui/button';

interface TranslatePageBannerProps {
  /** Ref to the container element whose text content should be translated */
  containerRef: RefObject<HTMLElement | null>;
  /** Optional label for the content being translated */
  contentLabel?: string;
}

// Store original text nodes for revert
const originalTexts = new Map<Text, string>();

/**
 * Extract translatable text nodes from a container, skipping
 * scripts, styles, code blocks, and very short strings.
 */
function getTranslatableTextNodes(container: HTMLElement): Text[] {
  const walker = document.createTreeWalker(
    container,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        
        // Skip non-visible elements
        const tag = parent.tagName.toLowerCase();
        if (['script', 'style', 'code', 'pre', 'svg', 'input', 'textarea', 'select'].includes(tag)) {
          return NodeFilter.FILTER_REJECT;
        }
        
        // Skip hidden elements
        const style = window.getComputedStyle(parent);
        if (style.display === 'none' || style.visibility === 'hidden') {
          return NodeFilter.FILTER_REJECT;
        }
        
        // Skip empty or whitespace-only text
        const text = node.textContent?.trim() || '';
        if (text.length < 3) return NodeFilter.FILTER_REJECT;
        
        // Skip pure numbers, currencies, dates
        if (/^[\d$%,./:;\-–—\s]+$/.test(text)) return NodeFilter.FILTER_REJECT;
        
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );

  const nodes: Text[] = [];
  let node: Text | null;
  while ((node = walker.nextNode() as Text | null)) {
    nodes.push(node);
  }
  return nodes;
}

/**
 * Batch text nodes into groups for efficient translation.
 * Each batch stays under ~3000 chars to fit the AI model's context.
 */
function batchTextNodes(nodes: Text[]): Text[][] {
  const batches: Text[][] = [];
  let currentBatch: Text[] = [];
  let currentLength = 0;
  const MAX_BATCH_CHARS = 3000;

  for (const node of nodes) {
    const text = node.textContent?.trim() || '';
    if (currentLength + text.length > MAX_BATCH_CHARS && currentBatch.length > 0) {
      batches.push(currentBatch);
      currentBatch = [];
      currentLength = 0;
    }
    currentBatch.push(node);
    currentLength += text.length;
  }

  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  return batches;
}

export function TranslatePageBanner({ containerRef, contentLabel }: TranslatePageBannerProps) {
  const { isTranslationActive, currentLanguageName, translateBatch } = useTranslation();
  const [isTranslating, setIsTranslating] = useState(false);
  const [isTranslated, setIsTranslated] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleTranslate = useCallback(async () => {
    const container = containerRef.current;
    if (!container || isTranslating) return;

    setIsTranslating(true);
    setProgress(0);

    try {
      const textNodes = getTranslatableTextNodes(container);
      if (textNodes.length === 0) {
        setIsTranslating(false);
        return;
      }

      // Save originals for revert
      for (const node of textNodes) {
        if (!originalTexts.has(node)) {
          originalTexts.set(node, node.textContent || '');
        }
      }

      // Batch and translate
      const batches = batchTextNodes(textNodes);
      let completed = 0;

      for (const batch of batches) {
        // Build a keyed object for batch translation
        const textsToTranslate: Record<string, string> = {};
        batch.forEach((node, i) => {
          textsToTranslate[`n${i}`] = node.textContent?.trim() || '';
        });

        const translated = await translateBatch(
          textsToTranslate,
          contentLabel ? `a ${contentLabel}` : 'a rental property analysis report'
        );

        // Apply translations to DOM
        batch.forEach((node, i) => {
          const key = `n${i}`;
          if (translated[key]) {
            // Preserve leading/trailing whitespace from original
            const original = node.textContent || '';
            const leadingSpace = original.match(/^\s*/)?.[0] || '';
            const trailingSpace = original.match(/\s*$/)?.[0] || '';
            node.textContent = leadingSpace + translated[key] + trailingSpace;
          }
        });

        completed += batch.length;
        setProgress(Math.round((completed / textNodes.length) * 100));
      }

      setIsTranslated(true);
    } catch (error) {
      console.error('[TranslatePageBanner] Error:', error);
    } finally {
      setIsTranslating(false);
      setProgress(0);
    }
  }, [containerRef, isTranslating, translateBatch, contentLabel]);

  const handleRevert = useCallback(() => {
    // Restore original text nodes
    Array.from(originalTexts.entries()).forEach(([node, original]) => {
      if (node.parentElement) {
        node.textContent = original;
      }
    });
    originalTexts.clear();
    setIsTranslated(false);
  }, []);

  if (!isTranslationActive) {
    // Auto-revert if user switches back to English
    if (isTranslated) {
      handleRevert();
    }
    return null;
  }

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/60 rounded-xl mb-4 shadow-sm">
      <div className="flex items-center gap-2.5 text-sm text-blue-800">
        <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
          <Languages className="w-4 h-4 text-blue-600" />
        </div>
        <div>
          {isTranslated ? (
            <span className="font-medium">Translated to {currentLanguageName}</span>
          ) : isTranslating ? (
            <span>Translating to {currentLanguageName}... {progress}%</span>
          ) : (
            <span>
              Translate {contentLabel || 'this page'} to <strong>{currentLanguageName}</strong>
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {isTranslated ? (
          <Button
            variant="outline"
            size="sm"
            onClick={handleRevert}
            className="text-xs border-blue-200 text-blue-700 hover:bg-blue-100"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1" />
            Show Original
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={handleTranslate}
            disabled={isTranslating}
            className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
          >
            {isTranslating ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                {progress}%
              </>
            ) : (
              <>
                <Globe className="w-3.5 h-3.5 mr-1.5" />
                Translate
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
