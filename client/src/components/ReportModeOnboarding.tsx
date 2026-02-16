import { useState } from 'react';
import { useReportMode, ReportMode } from '@/contexts/ReportModeContext';
import { BarChart3, BookOpen, Check, Sparkles, TrendingUp, MessageCircle } from 'lucide-react';

/**
 * First-time onboarding modal for report mode selection.
 * Shows when user has never chosen a mode (needsOnboarding === true).
 * 
 * DESIGN: Coach Inayah Brand — Premium Property Investment Aesthetic
 * - Full navy background with gold gradient accents
 * - Large, expressive icons with gradient fills
 * - Rich card-based selection with visual hierarchy
 * - Signature gold-to-teal gradient on CTAs
 * - Playfair Display serif headlines + DM Sans body
 */
export function ReportModeOnboarding() {
  const { needsOnboarding, completeOnboarding } = useReportMode();
  const [selected, setSelected] = useState<ReportMode | null>(null);
  const [hoveredMode, setHoveredMode] = useState<ReportMode | null>(null);

  if (!needsOnboarding) return null;

  const handleContinue = () => {
    if (selected) {
      completeOnboarding(selected, true);
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-[#0F172A]/70 backdrop-blur-md p-4">
      <div
        className="w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-500"
        style={{
          background: 'linear-gradient(145deg, #0F172A 0%, #1a2744 50%, #0F172A 100%)',
          borderRadius: '1.5rem',
          border: '1px solid rgba(201, 169, 98, 0.2)',
          boxShadow: '0 0 80px rgba(201, 169, 98, 0.08), 0 25px 60px rgba(0, 0, 0, 0.5)',
        }}
      >
        {/* Top gold accent bar */}
        <div className="h-1 w-full bg-gradient-to-r from-transparent via-[#D4A84B] to-transparent opacity-60" />

        {/* Header */}
        <div className="px-8 pt-8 pb-2 text-center relative">
          {/* Decorative glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-[#D4A84B]/5 rounded-full blur-3xl pointer-events-none" />
          
          {/* Icon */}
          <div className="relative inline-flex items-center justify-center w-16 h-16 mb-5">
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#D4A84B]/20 to-[#4ECDC4]/10 blur-sm" />
            <div className="relative w-full h-full rounded-2xl bg-gradient-to-br from-[#D4A84B]/15 to-[#4ECDC4]/10 border border-[#D4A84B]/20 flex items-center justify-center">
              <Sparkles className="w-7 h-7 text-[#D4A84B]" />
            </div>
          </div>

          <h2 className="text-2xl font-serif font-semibold text-white tracking-tight leading-tight">
            How Should We Talk<br />About Your Data?
          </h2>
          <p className="text-white/40 text-sm mt-3 font-sans max-w-xs mx-auto leading-relaxed">
            Choose your analysis style. You can switch anytime from the bottom-right corner.
          </p>
        </div>

        {/* Mode Selection Cards */}
        <div className="px-8 pt-4 pb-2 space-y-3">
          {/* Pro Mode Card */}
          <button
            onClick={() => setSelected('pro')}
            onMouseEnter={() => setHoveredMode('pro')}
            onMouseLeave={() => setHoveredMode(null)}
            className="w-full text-left group relative overflow-hidden transition-all duration-300"
            style={{
              borderRadius: '1rem',
              border: selected === 'pro'
                ? '2px solid rgba(212, 168, 75, 0.6)'
                : '2px solid rgba(255, 255, 255, 0.06)',
              background: selected === 'pro'
                ? 'linear-gradient(135deg, rgba(212, 168, 75, 0.12) 0%, rgba(78, 205, 196, 0.06) 100%)'
                : hoveredMode === 'pro'
                  ? 'rgba(255, 255, 255, 0.04)'
                  : 'rgba(255, 255, 255, 0.02)',
              padding: '1.25rem',
            }}
          >
            {/* Selection indicator glow */}
            {selected === 'pro' && (
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#D4A84B]/10 rounded-full blur-2xl pointer-events-none" />
            )}
            
            <div className="relative flex items-start gap-4">
              {/* Icon */}
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
                selected === 'pro'
                  ? 'bg-gradient-to-br from-[#D4A84B] to-[#B8922E] shadow-lg shadow-[#D4A84B]/20'
                  : 'bg-white/[0.06] group-hover:bg-white/[0.1]'
              }`}>
                <TrendingUp className={`w-5 h-5 transition-colors duration-300 ${
                  selected === 'pro' ? 'text-white' : 'text-white/40 group-hover:text-white/60'
                }`} />
              </div>
              
              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2.5">
                  <span className={`font-semibold text-base font-sans transition-colors duration-300 ${
                    selected === 'pro' ? 'text-[#D4A84B]' : 'text-white/80 group-hover:text-white'
                  }`}>
                    Pro Mode
                  </span>
                  {selected === 'pro' && (
                    <div className="w-5 h-5 rounded-full bg-[#D4A84B] flex items-center justify-center animate-in zoom-in-50 duration-200">
                      <Check className="w-3 h-3 text-white" strokeWidth={3} />
                    </div>
                  )}
                </div>
                <p className={`text-sm mt-1.5 leading-relaxed font-sans transition-colors duration-300 ${
                  selected === 'pro' ? 'text-white/50' : 'text-white/30 group-hover:text-white/40'
                }`}>
                  Investor-grade analysis with precise financial terminology, market benchmarks, and data-dense reporting.
                </p>
                {/* Feature pills */}
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {['Cap Rates', 'CoC Returns', 'Market Comps'].map((tag) => (
                    <span
                      key={tag}
                      className={`text-[10px] font-medium font-sans px-2 py-0.5 rounded-full transition-colors duration-300 ${
                        selected === 'pro'
                          ? 'bg-[#D4A84B]/15 text-[#D4A84B]/80'
                          : 'bg-white/[0.04] text-white/25 group-hover:text-white/35'
                      }`}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </button>

          {/* Guided Mode Card */}
          <button
            onClick={() => setSelected('guided')}
            onMouseEnter={() => setHoveredMode('guided')}
            onMouseLeave={() => setHoveredMode(null)}
            className="w-full text-left group relative overflow-hidden transition-all duration-300"
            style={{
              borderRadius: '1rem',
              border: selected === 'guided'
                ? '2px solid rgba(78, 205, 196, 0.5)'
                : '2px solid rgba(255, 255, 255, 0.06)',
              background: selected === 'guided'
                ? 'linear-gradient(135deg, rgba(78, 205, 196, 0.10) 0%, rgba(212, 168, 75, 0.05) 100%)'
                : hoveredMode === 'guided'
                  ? 'rgba(255, 255, 255, 0.04)'
                  : 'rgba(255, 255, 255, 0.02)',
              padding: '1.25rem',
            }}
          >
            {/* Selection indicator glow */}
            {selected === 'guided' && (
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#4ECDC4]/10 rounded-full blur-2xl pointer-events-none" />
            )}
            
            <div className="relative flex items-start gap-4">
              {/* Icon */}
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
                selected === 'guided'
                  ? 'bg-gradient-to-br from-[#4ECDC4] to-[#38B2AC] shadow-lg shadow-[#4ECDC4]/20'
                  : 'bg-white/[0.06] group-hover:bg-white/[0.1]'
              }`}>
                <MessageCircle className={`w-5 h-5 transition-colors duration-300 ${
                  selected === 'guided' ? 'text-white' : 'text-white/40 group-hover:text-white/60'
                }`} />
              </div>
              
              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2.5">
                  <span className={`font-semibold text-base font-sans transition-colors duration-300 ${
                    selected === 'guided' ? 'text-[#4ECDC4]' : 'text-white/80 group-hover:text-white'
                  }`}>
                    Guided Mode
                  </span>
                  {selected === 'guided' && (
                    <div className="w-5 h-5 rounded-full bg-[#4ECDC4] flex items-center justify-center animate-in zoom-in-50 duration-200">
                      <Check className="w-3 h-3 text-white" strokeWidth={3} />
                    </div>
                  )}
                </div>
                <p className={`text-sm mt-1.5 leading-relaxed font-sans transition-colors duration-300 ${
                  selected === 'guided' ? 'text-white/50' : 'text-white/30 group-hover:text-white/40'
                }`}>
                  Plain-language explanations with context and analogies. Perfect if you're newer to short-term rental investing.
                </p>
                {/* Feature pills */}
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {['Plain English', 'Step-by-Step', 'Beginner Friendly'].map((tag) => (
                    <span
                      key={tag}
                      className={`text-[10px] font-medium font-sans px-2 py-0.5 rounded-full transition-colors duration-300 ${
                        selected === 'guided'
                          ? 'bg-[#4ECDC4]/15 text-[#4ECDC4]/80'
                          : 'bg-white/[0.04] text-white/25 group-hover:text-white/35'
                      }`}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </button>
        </div>

        {/* Footer */}
        <div className="px-8 pt-4 pb-8">
          <button
            onClick={handleContinue}
            disabled={!selected}
            className="w-full relative overflow-hidden py-3.5 rounded-xl font-semibold text-sm font-sans flex items-center justify-center gap-2 transition-all duration-300 disabled:opacity-20 disabled:cursor-not-allowed group"
            style={{
              background: selected
                ? 'linear-gradient(135deg, #D4A84B 0%, #4ECDC4 100%)'
                : 'rgba(255, 255, 255, 0.06)',
              color: selected ? '#0F172A' : 'rgba(255, 255, 255, 0.3)',
              boxShadow: selected ? '0 8px 24px rgba(212, 168, 75, 0.25)' : 'none',
            }}
          >
            {/* Shimmer effect */}
            {selected && (
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
            )}
            <span className="relative font-bold tracking-wide">
              {selected ? "Let's Go" : 'Select a Mode'}
            </span>
          </button>
          
          <button
            onClick={() => completeOnboarding('guided', false)}
            className="w-full text-center text-xs text-white/25 hover:text-white/45 mt-4 py-1 transition-colors duration-300 font-sans"
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
}
