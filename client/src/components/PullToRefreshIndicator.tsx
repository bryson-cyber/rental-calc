import { Loader2, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PullToRefreshIndicatorProps {
  pullDistance: number;
  pullProgress: number;
  isRefreshing: boolean;
  isPulling: boolean;
}

/**
 * Visual indicator for pull-to-refresh gesture
 * Shows an arrow that rotates as user pulls, then a spinner when refreshing
 */
export function PullToRefreshIndicator({
  pullDistance,
  pullProgress,
  isRefreshing,
  isPulling,
}: PullToRefreshIndicatorProps) {
  const isReady = pullProgress >= 1;
  
  // Don't render if not pulling and not refreshing
  if (!isPulling && !isRefreshing && pullDistance === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "fixed top-0 left-0 right-0 z-50 flex items-center justify-center",
        "transition-transform duration-200 ease-out",
        "pointer-events-none"
      )}
      style={{
        transform: `translateY(${Math.max(pullDistance - 40, 0)}px)`,
        opacity: Math.min(pullProgress * 1.5, 1),
      }}
    >
      <div
        className={cn(
          "flex items-center justify-center",
          "w-10 h-10 rounded-full",
          "bg-white shadow-lg border border-slate-200",
          "transition-all duration-200",
          isReady && !isRefreshing && "bg-amber-50 border-amber-300",
          isRefreshing && "bg-amber-50 border-amber-300"
        )}
      >
        {isRefreshing ? (
          <Loader2 className="w-5 h-5 text-amber-600 animate-spin" />
        ) : (
          <ArrowDown
            className={cn(
              "w-5 h-5 transition-all duration-200",
              isReady ? "text-amber-600" : "text-slate-400"
            )}
            style={{
              transform: `rotate(${isReady ? 180 : pullProgress * 180}deg)`,
            }}
          />
        )}
      </div>
    </div>
  );
}
