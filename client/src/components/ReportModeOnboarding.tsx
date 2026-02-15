import { useState } from 'react';
import { useReportMode, ReportMode } from '@/contexts/ReportModeContext';
import { BarChart3, BookOpen, Check, ArrowRight } from 'lucide-react';

/**
 * First-time onboarding modal for report mode selection.
 * Shows when user has never chosen a mode (needsOnboarding === true).
 * Styled to match the Coach Inayah brand: navy (#0F172A) + gold (#C9A962).
 */
export function ReportModeOnboarding() {
  const { needsOnboarding, completeOnboarding } = useReportMode();
  const [selected, setSelected] = useState<ReportMode | null>(null);

  if (!needsOnboarding) return null;

  const handleContinue = () => {
    if (selected) {
      completeOnboarding(selected, true);
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-[#0F172A]/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-300 border border-[#C9A962]/20">
        {/* Header — navy gradient with gold accent */}
        <div className="bg-gradient-to-br from-[#0F172A] via-[#0F172A] to-[#1e293b] px-6 py-6 text-center relative overflow-hidden">
          {/* Subtle gold accent line */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#C9A962] to-transparent" />
          <h2 className="text-xl font-serif font-semibold text-white tracking-tight">
            Choose Your Report Style
          </h2>
          <p className="text-[#C9A962]/80 text-sm mt-1.5 font-sans">
            You can switch anytime using the toggle in the bottom-right corner
          </p>
        </div>

        {/* Options */}
        <div className="p-6 space-y-3">
          {/* Pro Mode */}
          <button
            onClick={() => setSelected('pro')}
            className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-200 group ${
              selected === 'pro'
                ? 'border-[#C9A962] bg-[#C9A962]/5 shadow-sm'
                : 'border-slate-200 hover:border-[#C9A962]/40 hover:bg-[#0F172A]/[0.02]'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                selected === 'pro' ? 'bg-[#0F172A] text-[#C9A962]' : 'bg-[#0F172A]/5 text-[#0F172A]/50 group-hover:bg-[#0F172A]/10'
              }`}>
                <BarChart3 className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-[#0F172A] font-sans">Pro Mode</span>
                  {selected === 'pro' && <Check className="w-4 h-4 text-[#C9A962]" />}
                </div>
                <p className="text-sm text-slate-500 mt-1 font-sans leading-relaxed">
                  Investor-grade analysis with precise financial terminology, market benchmarks, and data-dense reporting.
                </p>
              </div>
            </div>
          </button>

          {/* Guided Mode */}
          <button
            onClick={() => setSelected('guided')}
            className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-200 group ${
              selected === 'guided'
                ? 'border-[#C9A962] bg-[#C9A962]/5 shadow-sm'
                : 'border-slate-200 hover:border-[#C9A962]/40 hover:bg-[#0F172A]/[0.02]'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                selected === 'guided' ? 'bg-[#0F172A] text-[#C9A962]' : 'bg-[#0F172A]/5 text-[#0F172A]/50 group-hover:bg-[#0F172A]/10'
              }`}>
                <BookOpen className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-[#0F172A] font-sans">Guided Mode</span>
                  {selected === 'guided' && <Check className="w-4 h-4 text-[#C9A962]" />}
                </div>
                <p className="text-sm text-slate-500 mt-1 font-sans leading-relaxed">
                  Plain-language explanations with context and analogies. Perfect if you're newer to short-term rental investing.
                </p>
              </div>
            </div>
          </button>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6">
          <button
            onClick={handleContinue}
            disabled={!selected}
            className="w-full bg-[#0F172A] text-white py-3.5 rounded-xl font-semibold text-sm transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed font-sans flex items-center justify-center gap-2 group hover:bg-[#1e293b] hover:shadow-lg"
          >
            <span>Continue</span>
            {selected && <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />}
          </button>
          <button
            onClick={() => completeOnboarding('guided', false)}
            className="w-full text-center text-sm text-slate-400 hover:text-[#C9A962] mt-3 py-1 transition-colors font-sans"
          >
            Skip — I'll decide later
          </button>
        </div>
      </div>
    </div>
  );
}
