import { useReportMode } from '@/contexts/ReportModeContext';
import { BarChart3, BookOpen } from 'lucide-react';
import { useLocation } from 'wouter';

/**
 * Persistent mode toggle — always visible as a floating pill.
 * Positioned in the top-right area, just left of the GlobalLanguageSelector.
 * Hidden on homepage (/) where LeadMagnet has its own header.
 * z-index 9997 to stay just below the language selector (9998).
 */
export function ReportModeToggle() {
  const { mode, setMode } = useReportMode();
  const [location] = useLocation();

  // Hide on homepage — LeadMagnet has its own header
  if (location === '/') return null;

  return (
    <div className="fixed top-3 right-28 sm:top-4 sm:right-32 z-[9997]">
      <div className="inline-flex items-center bg-white/90 backdrop-blur-md border border-slate-200/80 shadow-sm rounded-full p-0.5 gap-0.5 hover:shadow-md transition-shadow duration-200">
        <button
          onClick={() => setMode('pro')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium transition-all duration-200 min-h-[36px] ${
            mode === 'pro'
              ? 'bg-[#0F172A] text-white shadow-sm'
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100/60'
          }`}
          title="Pro Mode — Data-driven analysis with market benchmarks"
        >
          <BarChart3 className="w-3.5 h-3.5" />
          <span>Pro</span>
        </button>
        <button
          onClick={() => setMode('guided')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium transition-all duration-200 min-h-[36px] ${
            mode === 'guided'
              ? 'bg-[#0F172A] text-white shadow-sm'
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100/60'
          }`}
          title="Guided Mode — Plain-language explanations with context"
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Guided</span>
        </button>
      </div>
    </div>
  );
}
