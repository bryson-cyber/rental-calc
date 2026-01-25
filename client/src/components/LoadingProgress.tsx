/**
 * LoadingProgress - A detailed loading progress indicator for data fetching
 * Shows progress bar, count, and estimated time remaining
 */

import { Progress } from '@/components/ui/progress';
import { Loader2, Database, CheckCircle2 } from 'lucide-react';

interface LoadingProgressProps {
  current: number;
  total: number;
  label?: string;
  showEstimate?: boolean;
  startTime?: number;
  className?: string;
}

export function LoadingProgress({
  current,
  total,
  label = 'Loading listings',
  showEstimate = true,
  startTime,
  className = '',
}: LoadingProgressProps) {
  const percentage = total > 0 ? Math.min(100, (current / total) * 100) : 0;
  const isComplete = current >= total && total > 0;
  
  // Calculate estimated time remaining
  let estimatedRemaining = '';
  if (showEstimate && startTime && current > 0 && !isComplete) {
    const elapsed = (Date.now() - startTime) / 1000;
    const rate = current / elapsed;
    const remaining = (total - current) / rate;
    
    if (remaining < 60) {
      estimatedRemaining = `~${Math.ceil(remaining)}s remaining`;
    } else {
      estimatedRemaining = `~${Math.ceil(remaining / 60)}m remaining`;
    }
  }
  
  return (
    <div className={`bg-white rounded-xl border border-slate-200 p-4 shadow-sm ${className}`}>
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
          isComplete ? 'bg-emerald-100' : 'bg-amber-100'
        }`}>
          {isComplete ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          ) : (
            <Loader2 className="w-5 h-5 text-amber-600 animate-spin" />
          )}
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <span className="font-medium text-slate-900">{label}</span>
            <span className="text-sm font-medium text-slate-600">
              {current.toLocaleString()} / {total.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center justify-between mt-0.5">
            <span className="text-xs text-slate-500">
              {isComplete ? 'Complete!' : `${Math.round(percentage)}% loaded`}
            </span>
            {estimatedRemaining && !isComplete && (
              <span className="text-xs text-slate-400">{estimatedRemaining}</span>
            )}
          </div>
        </div>
      </div>
      
      <Progress value={percentage} className="h-2" />
      
      {/* Status badges */}
      <div className="flex items-center gap-2 mt-3">
        <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-50 rounded-md">
          <Database className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-xs text-slate-600">
            {current.toLocaleString()} records
          </span>
        </div>
        {isComplete && (
          <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-50 rounded-md">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span className="text-xs text-emerald-700">Ready to analyze</span>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Compact inline loading progress for smaller spaces
 */
export function InlineLoadingProgress({
  current,
  total,
  className = '',
}: {
  current: number;
  total: number;
  className?: string;
}) {
  const percentage = total > 0 ? Math.min(100, (current / total) * 100) : 0;
  
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Loader2 className="w-4 h-4 text-amber-500 animate-spin" />
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div 
          className="h-full bg-amber-500 transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-xs text-slate-500 min-w-[60px] text-right">
        {current.toLocaleString()} / {total.toLocaleString()}
      </span>
    </div>
  );
}
