import { useState } from 'react';
import { useReportMode, ReportMode } from '@/contexts/ReportModeContext';
import { BarChart3, BookOpen, Check } from 'lucide-react';

/**
 * First-time onboarding modal for report mode selection.
 * Shows when user has never chosen a mode (needsOnboarding === true).
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
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-300">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#0F172A] to-[#1e293b] px-6 py-5 text-center">
          <h2 className="text-xl font-serif font-semibold text-white">
            Choose Your Report Style
          </h2>
          <p className="text-white/70 text-sm mt-1 font-sans">
            You can switch anytime using the toggle in the top bar
          </p>
        </div>

        {/* Options */}
        <div className="p-6 space-y-3">
          {/* Pro Mode */}
          <button
            onClick={() => setSelected('pro')}
            className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-200 ${
              selected === 'pro'
                ? 'border-[#0F172A] bg-[#0F172A]/5 shadow-sm'
                : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                selected === 'pro' ? 'bg-[#0F172A] text-white' : 'bg-slate-100 text-slate-500'
              }`}>
                <BarChart3 className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-[#0F172A] font-sans">Pro Mode</span>
                  {selected === 'pro' && <Check className="w-4 h-4 text-[#0F172A]" />}
                </div>
                <p className="text-sm text-slate-500 mt-1 font-sans">
                  Investor-grade analysis with precise financial terminology, market benchmarks, and data-dense reporting.
                </p>
              </div>
            </div>
          </button>

          {/* Guided Mode */}
          <button
            onClick={() => setSelected('guided')}
            className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-200 ${
              selected === 'guided'
                ? 'border-[#C9A962] bg-[#C9A962]/5 shadow-sm'
                : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                selected === 'guided' ? 'bg-[#C9A962] text-white' : 'bg-slate-100 text-slate-500'
              }`}>
                <BookOpen className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-[#0F172A] font-sans">Guided Mode</span>
                  {selected === 'guided' && <Check className="w-4 h-4 text-[#C9A962]" />}
                </div>
                <p className="text-sm text-slate-500 mt-1 font-sans">
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
            className="w-full bg-[#0F172A] text-white py-3 rounded-xl font-semibold text-sm hover:bg-[#1e293b] transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed font-sans"
          >
            Continue
          </button>
          <button
            onClick={() => completeOnboarding('guided', false)}
            className="w-full text-center text-sm text-slate-400 hover:text-slate-600 mt-3 py-1 transition-colors font-sans"
          >
            Skip — I'll decide later
          </button>
        </div>
      </div>
    </div>
  );
}
