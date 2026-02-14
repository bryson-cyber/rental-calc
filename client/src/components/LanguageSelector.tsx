/**
 * Language Selector Component
 * 
 * A dropdown that lets users choose their preferred language.
 * Triggers Gemini-powered translation of all website content.
 */

import { useState, useRef, useEffect } from 'react';
import { Globe, Check, ChevronDown, Loader2 } from 'lucide-react';
import { useTranslation } from '@/contexts/TranslationContext';

// Group languages by region for easier browsing
const LANGUAGE_GROUPS: Record<string, string[]> = {
  'Popular': ['en', 'es', 'fr', 'de', 'pt', 'zh', 'ja', 'ko', 'ar', 'hi'],
  'European': ['it', 'nl', 'ru', 'pl', 'uk', 'ro', 'sv', 'da', 'fi', 'no'],
  'Asian': ['zh-TW', 'vi', 'th', 'id', 'ms', 'tl', 'bn'],
  'Middle Eastern': ['tr', 'he', 'ur'],
  'African': ['sw', 'am', 'ha', 'yo', 'ig', 'so'],
};

export default function LanguageSelector() {
  const { currentLanguage, currentLanguageName, setLanguage, supportedLanguages, isTranslating } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  // Get flag emoji for language code (best effort)
  const getLanguageFlag = (code: string): string => {
    const flagMap: Record<string, string> = {
      en: '🇺🇸', es: '🇪🇸', fr: '🇫🇷', de: '🇩🇪', it: '🇮🇹',
      pt: '🇧🇷', nl: '🇳🇱', ru: '🇷🇺', ja: '🇯🇵', ko: '🇰🇷',
      zh: '🇨🇳', 'zh-TW': '🇹🇼', ar: '🇸🇦', hi: '🇮🇳', bn: '🇧🇩',
      ur: '🇵🇰', tr: '🇹🇷', vi: '🇻🇳', th: '🇹🇭', pl: '🇵🇱',
      uk: '🇺🇦', ro: '🇷🇴', sv: '🇸🇪', da: '🇩🇰', fi: '🇫🇮',
      no: '🇳🇴', he: '🇮🇱', id: '🇮🇩', ms: '🇲🇾', tl: '🇵🇭',
      sw: '🇰🇪', am: '🇪🇹', ha: '🇳🇬', yo: '🇳🇬', ig: '🇳🇬', so: '🇸🇴',
    };
    return flagMap[code] || '🌐';
  };

  return (
    <div ref={dropdownRef} className="relative" data-language-selector="true">
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 hover:bg-black/5 border border-transparent hover:border-[#C9A962]/30"
        aria-label="Select language"
        title="Translate website"
      >
        {isTranslating ? (
          <Loader2 className="w-4 h-4 animate-spin text-[#C9A962]" />
        ) : (
          <Globe className="w-4 h-4 text-[#0F172A]/60" />
        )}
        <span className="hidden sm:inline text-[#0F172A]/80">
          {currentLanguage === 'en' ? 'EN' : currentLanguageName}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-[#0F172A]/40 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl shadow-xl border border-[#0F172A]/10 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Search */}
          <div className="p-3 border-b border-[#0F172A]/5">
            <input
              type="text"
              placeholder="Search languages..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-[#0F172A]/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C9A962]/30 focus:border-[#C9A962]/50"
              autoFocus
            />
          </div>

          {/* Language List */}
          <div className="max-h-80 overflow-y-auto py-1">
            {filteredLanguages ? (
              // Search results
              filteredLanguages.length === 0 ? (
                <div className="px-4 py-6 text-center text-sm text-[#0F172A]/40">
                  No languages found
                </div>
              ) : (
                filteredLanguages.map(lang => (
                  <button
                    key={lang.code}
                    onClick={() => handleSelect(lang.code)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-[#C9A962]/5 transition-colors ${
                      currentLanguage === lang.code ? 'bg-[#C9A962]/10 text-[#0F172A] font-medium' : 'text-[#0F172A]/70'
                    }`}
                  >
                    <span className="text-base">{getLanguageFlag(lang.code)}</span>
                    <span className="flex-1 text-left">{lang.name}</span>
                    {currentLanguage === lang.code && (
                      <Check className="w-4 h-4 text-[#C9A962]" />
                    )}
                  </button>
                ))
              )
            ) : (
              // Grouped view
              Object.entries(LANGUAGE_GROUPS).map(([group, codes]) => {
                const groupLangs = codes
                  .map(code => supportedLanguages.find(l => l.code === code))
                  .filter(Boolean) as Array<{ code: string; name: string }>;

                if (groupLangs.length === 0) return null;

                return (
                  <div key={group}>
                    <div className="px-4 py-1.5 text-xs font-semibold text-[#0F172A]/40 uppercase tracking-wider">
                      {group}
                    </div>
                    {groupLangs.map(lang => (
                      <button
                        key={lang.code}
                        onClick={() => handleSelect(lang.code)}
                        className={`w-full flex items-center gap-3 px-4 py-2 text-sm hover:bg-[#C9A962]/5 transition-colors ${
                          currentLanguage === lang.code ? 'bg-[#C9A962]/10 text-[#0F172A] font-medium' : 'text-[#0F172A]/70'
                        }`}
                      >
                        <span className="text-base">{getLanguageFlag(lang.code)}</span>
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
          <div className="px-4 py-2.5 border-t border-[#0F172A]/5 bg-[#0F172A]/[0.02]">
            <p className="text-xs text-[#0F172A]/40 text-center">
              Powered by Gemini AI Translation
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
