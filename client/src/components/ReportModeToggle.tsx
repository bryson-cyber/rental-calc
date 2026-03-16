import { useReportMode } from '@/contexts/ReportModeContext';
import { BarChart3, BookOpen } from 'lucide-react';
import { useLocation } from 'wouter';
import { isPublicPage } from '@/lib/publicPages';

/**
 * Persistent mode toggle — always visible as a floating pill.
 * Positioned bottom-right, always on screen on every page (including homepage).
 * Uses the site's navy (#0F172A) + gold (#C9A962) brand palette.
 * z-index 9997 to stay just below the language selector (9998).
 *
 * Hidden on public-facing pages (shared reports, video landing pages, etc.)
 * where only the page's own content should be visible.
 */
export function ReportModeToggle() {
  const { mode, setMode } = useReportMode();
  const [location] = useLocation();

  // Hide on public-facing pages
  if (isPublicPage(location)) return null;

  return (
    <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-[9997]">
      <div className="inline-flex items-center bg-white/95 backdrop-blur-md border border-[#C9A962]/30 shadow-lg rounded-full p-1 gap-0.5 hover:shadow-xl transition-shadow duration-200">
        <button
          onClick={() => setMode('pro')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold transition-all duration-200 min-h-[36px] ${
            mode === 'pro'
              ? 'bg-[#0F172A] text-[#C9A962] shadow-md'
              : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
          }`}
          title="Pro Mode — Investor-grade analysis with market benchmarks"
        >
          <BarChart3 className="w-3.5 h-3.5" />
          <span>Pro</span>
        </button>
        <button
          onClick={() => setMode('guided')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold transition-all duration-200 min-h-[36px] ${
            mode === 'guided'
              ? 'bg-[#0F172A] text-[#C9A962] shadow-md'
              : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
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
