/**
 * MockModeBadge — A small floating indicator shown when DEV_MOCK_API=true.
 * Queries the system.devFlags endpoint and renders a subtle badge in the
 * bottom-left corner so developers always know when mock data is active.
 */
import { trpc } from "@/lib/trpc";
import { FlaskConical } from "lucide-react";
import { useState } from "react";

export function MockModeBadge() {
  const { data } = trpc.system.devFlags.useQuery(undefined, {
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
  const [dismissed, setDismissed] = useState(false);

  // Only show when mock mode is active and not in production
  if (!data?.mockApi || data?.isProduction || dismissed) return null;

  return (
    <div
      className="fixed bottom-4 left-4 z-[9999] flex items-center gap-2 rounded-lg border border-amber-400/60 bg-amber-50 px-3 py-2 shadow-lg backdrop-blur-sm transition-all duration-300 hover:shadow-xl"
      role="status"
      aria-label="Mock API mode is active"
    >
      <FlaskConical className="h-4 w-4 text-amber-600 animate-pulse" />
      <div className="flex flex-col">
        <span className="text-xs font-semibold text-amber-800 uppercase tracking-wider">
          Mock Mode
        </span>
        <span className="text-[10px] text-amber-600/80">
          No live API calls
        </span>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="ml-1 rounded p-0.5 text-amber-500 hover:bg-amber-200/50 hover:text-amber-700 transition-colors"
        aria-label="Dismiss mock mode badge"
      >
        <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M2 2l8 8M10 2l-8 8" />
        </svg>
      </button>
    </div>
  );
}
