/**
 * TranslatableText Component
 * 
 * Wraps text content and auto-translates it when the user
 * selects a non-English language. Shows original text with
 * a subtle loading state while translating.
 * 
 * Usage:
 *   <T>Your English text here</T>
 *   <T context="button label">Get Started</T>
 */

import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from '@/contexts/TranslationContext';

interface TranslatableTextProps {
  children: string;
  /** Optional context hint for better translation quality */
  context?: string;
  /** Tag to render (default: span) */
  as?: keyof React.JSX.IntrinsicElements;
  /** Additional className */
  className?: string;
}

export function TranslatableText({ 
  children, 
  context, 
  as: Tag = 'span',
  className 
}: TranslatableTextProps) {
  const { currentLanguage, translate, isTranslationActive } = useTranslation();
  const [translatedText, setTranslatedText] = useState(children);
  const [loading, setLoading] = useState(false);
  const prevLangRef = useRef(currentLanguage);
  const prevTextRef = useRef(children);

  useEffect(() => {
    if (!isTranslationActive) {
      setTranslatedText(children);
      return;
    }

    // Only re-translate if language or source text changed
    if (prevLangRef.current === currentLanguage && prevTextRef.current === children) return;
    prevLangRef.current = currentLanguage;
    prevTextRef.current = children;

    let cancelled = false;
    setLoading(true);

    translate(children, context).then(result => {
      if (!cancelled) {
        setTranslatedText(result);
        setLoading(false);
      }
    });

    return () => { cancelled = true; };
  }, [currentLanguage, children, isTranslationActive, translate, context]);

  const Component = Tag as any;

  return (
    <Component 
      className={className}
      style={loading ? { opacity: 0.7 } : undefined}
    >
      {translatedText}
    </Component>
  );
}

// Short alias for convenience
export const T = TranslatableText;

/**
 * Hook for translating a single string reactively.
 * Returns the translated string and a loading flag.
 */
export function useTranslatedText(text: string, context?: string) {
  const { currentLanguage, translate, isTranslationActive } = useTranslation();
  const [translated, setTranslated] = useState(text);
  const [loading, setLoading] = useState(false);
  const prevLangRef = useRef(currentLanguage);

  useEffect(() => {
    if (!isTranslationActive) {
      setTranslated(text);
      return;
    }

    if (prevLangRef.current === currentLanguage) return;
    prevLangRef.current = currentLanguage;

    let cancelled = false;
    setLoading(true);

    translate(text, context).then(result => {
      if (!cancelled) {
        setTranslated(result);
        setLoading(false);
      }
    });

    return () => { cancelled = true; };
  }, [currentLanguage, text, isTranslationActive, translate, context]);

  return { text: translated, loading };
}
