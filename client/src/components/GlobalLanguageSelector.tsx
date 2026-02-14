/**
 * GlobalLanguageSelector
 *
 * A persistent, floating language selector that appears on EVERY page.
 * Placed in App.tsx so it's always rendered regardless of route.
 *
 * Design:
 * - Fixed position in the top-right corner
 * - Pill-shaped button with globe icon + current language
 * - Expands into a dropdown with search + grouped languages
 * - Semi-transparent backdrop-blur to work on any page background
 * - Hides itself on the homepage (/) where LeadMagnet has its own header with LanguageSelector
 * - z-index 9998 to stay above page content but below modals
 */

import { useState, useRef, useEffect } from 'react';
import { Globe, Check, ChevronDown, Loader2, X } from 'lucide-react';
import { useTranslation } from '@/contexts/TranslationContext';
import { useLocation } from 'wouter';

// Group languages by region for easier browsing
const LANGUAGE_GROUPS: Record<string, string[]> = {
  'Popular': ['en', 'es', 'fr', 'de', 'pt', 'zh', 'ja', 'ko', 'ar', 'hi'],
  'European': ['it', 'nl', 'ru', 'pl', 'uk', 'ro', 'sv', 'da', 'fi', 'no'],
  'Asian': ['zh-TW', 'vi', 'th', 'id', 'ms', 'tl', 'bn'],
  'Middle Eastern': ['tr', 'he', 'ur'],
  'African': ['sw', 'am', 'ha', 'yo', 'ig', 'so'],
};

// Flag emoji mapping
const FLAG_MAP: Record<string, string> = {
  en: '🇺🇸', es: '🇪🇸', fr: '🇫🇷', de: '🇩🇪', it: '🇮🇹',
  pt: '🇧🇷', nl: '🇳🇱', ru: '🇷🇺', ja: '🇯🇵', ko: '🇰🇷',
  zh: '🇨🇳', 'zh-TW': '🇹🇼', ar: '🇸🇦', hi: '🇮🇳', bn: '🇧🇩',
  ur: '🇵🇰', tr: '🇹🇷', vi: '🇻🇳', th: '🇹🇭', pl: '🇵🇱',
  uk: '🇺🇦', ro: '🇷🇴', sv: '🇸🇪', da: '🇩🇰', fi: '🇫🇮',
  no: '🇳🇴', he: '🇮🇱', id: '🇮🇩', ms: '🇲🇾', tl: '🇵🇭',
  sw: '🇰🇪', am: '🇪🇹', ha: '🇳🇬', yo: '🇳🇬', ig: '🇳🇬', so: '🇸🇴',
};

export default function GlobalLanguageSelector() {
  const { currentLanguage, currentLanguageName, setLanguage, supportedLanguages, isTranslating } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [location] = useLocation();

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearch('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close on route change
  useEffect(() => {
    setIsOpen(false);
    setSearch('');
  }, [location]);

  // Hide on homepage — LeadMagnet already has its own LanguageSelector in the fixed header
  if (location === '/') return null;

  const filteredLanguages = search
    ? supportedLanguages.filter(l =>
        l.name.toLowerCase().includes(search.toLowerCase()) ||
        l.code.toLowerCase().includes(search.toLowerCase())
      )
    : null;

  const handleSelect = (code: string) => {
    setLanguage(code);
    setIsOpen(false);
    setSearch('');
  };

  const getFlag = (code: string) => FLAG_MAP[code] || '🌐';

  return (
    <div
      ref={dropdownRef}
      className="fixed top-3 right-3 sm:top-4 sm:right-4 z-[9998]"
      data-language-selector="true"
      data-global-translator="true"
    >
      {/* Trigger Button — pill shape, works on light & dark backgrounds */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium transition-all duration-200 bg-white/90 backdrop-blur-md border border-slate-200/80 shadow-sm hover:shadow-md hover:border-[#C9A962]/40 min-h-[40px]"
        aria-label="Select language"
        title="Translate website"
      >
        {isTranslating ? (
          <Loader2 className="w-4 h-4 animate-spin text-[#C9A962]" />
        ) : (
          <Globe className="w-4 h-4 text-slate-600" />
        )}
        <span className="text-slate-700 max-w-[80px] truncate">
          {currentLanguage === 'en' ? 'EN' : currentLanguageName}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Header with close */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/50">
            <span className="text-sm font-semibold text-slate-700">Translate Page</span>
            <button
              onClick={() => { setIsOpen(false); setSearch(''); }}
              className="p-1 rounded-md hover:bg-slate-200/60 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Search */}
          <div className="p-3 border-b border-slate-100">
            <input
              type="text"
              placeholder="Search languages..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C9A962]/30 focus:border-[#C9A962]/50 bg-white"
              autoFocus
            />
          </div>

          {/* Language List */}
          <div className="max-h-72 overflow-y-auto py-1">
            {filteredLanguages ? (
              filteredLanguages.length === 0 ? (
                <div className="px-4 py-6 text-center text-sm text-slate-400">
                  No languages found
                </div>
              ) : (
                filteredLanguages.map(lang => (
                  <button
                    key={lang.code}
                    onClick={() => handleSelect(lang.code)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-[#C9A962]/5 transition-colors ${
                      currentLanguage === lang.code ? 'bg-[#C9A962]/10 text-slate-900 font-medium' : 'text-slate-600'
                    }`}
                  >
                    <span className="text-base">{getFlag(lang.code)}</span>
                    <span className="flex-1 text-left">{lang.name}</span>
                    {currentLanguage === lang.code && (
                      <Check className="w-4 h-4 text-[#C9A962]" />
                    )}
                  </button>
                ))
              )
            ) : (
              Object.entries(LANGUAGE_GROUPS).map(([group, codes]) => {
                const groupLangs = codes
                  .map(code => supportedLanguages.find(l => l.code === code))
                  .filter(Boolean) as Array<{ code: string; name: string }>;

                if (groupLangs.length === 0) return null;

                return (
                  <div key={group}>
                    <div className="px-4 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      {group}
                    </div>
                    {groupLangs.map(lang => (
                      <button
                        key={lang.code}
                        onClick={() => handleSelect(lang.code)}
                        className={`w-full flex items-center gap-3 px-4 py-2 text-sm hover:bg-[#C9A962]/5 transition-colors ${
                          currentLanguage === lang.code ? 'bg-[#C9A962]/10 text-slate-900 font-medium' : 'text-slate-600'
                        }`}
                      >
                        <span className="text-base">{getFlag(lang.code)}</span>
                        <span className="flex-1 text-left">{lang.name}</span>
                        {currentLanguage === lang.code && (
                          <Check className="w-4 h-4 text-[#C9A962]" />
                        )}
                      </button>
                    ))}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50/30">
            <p className="text-xs text-slate-400 text-center">
              Powered by Gemini AI Translation
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
