/**
 * ReportTranslateButton Component
 * 
 * A button that translates report content to the selected language.
 * Shows translation progress and allows reverting to original.
 * 
 * Usage:
 *   <ReportTranslateButton
 *     content={reportMarkdownContent}
 *     onTranslated={(translatedContent) => setContent(translatedContent)}
 *   />
 */

import { useState, useCallback } from 'react';
import { Globe, Loader2, RotateCcw, Check } from 'lucide-react';
import { useTranslation } from '@/contexts/TranslationContext';
import { Button } from '@/components/ui/button';

interface ReportTranslateButtonProps {
  /** The original report content (markdown/text) to translate */
  content: string;
  /** Callback when translation is complete */
  onTranslated: (translatedContent: string) => void;
  /** Callback to revert to original content */
  onRevert?: () => void;
  /** Size variant */
  size?: 'sm' | 'default';
  /** Additional className */
  className?: string;
}

export function ReportTranslateButton({
  content,
  onTranslated,
  onRevert,
  size = 'default',
  className = '',
}: ReportTranslateButtonProps) {
  const { currentLanguage, currentLanguageName, translateReport, isTranslationActive } = useTranslation();
  const [isTranslating, setIsTranslating] = useState(false);
  const [isTranslated, setIsTranslated] = useState(false);
  const [translatedLang, setTranslatedLang] = useState<string | null>(null);

  const handleTranslate = useCallback(async () => {
    if (!content || isTranslating) return;

    setIsTranslating(true);
    try {
      const translated = await translateReport(content);
      onTranslated(translated);
      setIsTranslated(true);
      setTranslatedLang(currentLanguageName);
    } catch (error) {
      console.error('[ReportTranslate] Error:', error);
    } finally {
      setIsTranslating(false);
    }
  }, [content, currentLanguageName, isTranslating, onTranslated, translateReport]);

  const handleRevert = useCallback(() => {
    setIsTranslated(false);
    setTranslatedLang(null);
    onRevert?.();
  }, [onRevert]);

  // Don't show if English is selected
  if (!isTranslationActive) {
    // If was translated and user switched back to English, revert
    if (isTranslated) {
      handleRevert();
    }
    return null;
  }

  if (isTranslated) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <span className="flex items-center gap-1.5 text-sm text-emerald-600 font-medium">
          <Check className="w-4 h-4" />
          Translated to {translatedLang}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRevert}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="w-3.5 h-3.5 mr-1" />
          Original
        </Button>
      </div>
    );
  }

  return (
    <Button
      variant="outline"
      size={size}
      onClick={handleTranslate}
      disabled={isTranslating || !content}
      className={`gap-2 ${className}`}
    >
      {isTranslating ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          Translating to {currentLanguageName}...
        </>
      ) : (
        <>
          <Globe className="w-4 h-4" />
          Translate to {currentLanguageName}
        </>
      )}
    </Button>
  );
}

/**
 * Inline translate banner that appears at the top of reports
 * when a non-English language is selected
 */
export function ReportTranslateBanner({
  content,
  onTranslated,
  onRevert,
}: {
  content: string;
  onTranslated: (translatedContent: string) => void;
  onRevert?: () => void;
}) {
  const { isTranslationActive, currentLanguageName } = useTranslation();
  const [isTranslating, setIsTranslating] = useState(false);
  const [isTranslated, setIsTranslated] = useState(false);
  const { translateReport } = useTranslation();

  if (!isTranslationActive) return null;

  const handleTranslate = async () => {
    if (!content || isTranslating) return;
    setIsTranslating(true);
    try {
      const translated = await translateReport(content);
      onTranslated(translated);
      setIsTranslated(true);
    } catch (error) {
      console.error('[ReportTranslate] Error:', error);
    } finally {
      setIsTranslating(false);
    }
  };

  const handleRevert = () => {
    setIsTranslated(false);
    onRevert?.();
  };

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg mb-4">
      <div className="flex items-center gap-2 text-sm text-blue-700">
        <Globe className="w-4 h-4" />
        {isTranslated
          ? `This report has been translated to ${currentLanguageName}`
          : `This report is in English. Translate to ${currentLanguageName}?`
        }
      </div>
      <div className="flex items-center gap-2">
        {isTranslated ? (
          <Button variant="ghost" size="sm" onClick={handleRevert} className="text-xs">
            <RotateCcw className="w-3.5 h-3.5 mr-1" />
            Show Original
          </Button>
        ) : (
          <Button
            variant="default"
            size="sm"
            onClick={handleTranslate}
            disabled={isTranslating}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isTranslating ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                Translating...
              </>
            ) : (
              'Translate'
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
