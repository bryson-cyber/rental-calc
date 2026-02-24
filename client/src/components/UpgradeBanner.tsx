import { trpc } from "@/lib/trpc";
import { AlertTriangle, Clock, X } from "lucide-react";
import { useState, useEffect } from "react";

interface UpgradeBannerProps {
  /** Force show the banner regardless of usage status (e.g., when a mutation returns limitReached) */
  forceShow?: boolean;
  /** Which limit type to check — defaults to checking all */
  type?: "property" | "market" | "api" | "all";
  /** Optional className for positioning */
  className?: string;
  /** Whether the banner can be dismissed */
  dismissible?: boolean;
}

/**
 * Banner shown when a user hits their daily usage limit.
 * Informs them that limits reset at midnight.
 */
export function UpgradeBanner({ 
  forceShow = false, 
  type = "all", 
  className = "",
  dismissible = false,
}: UpgradeBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const { data: usage } = trpc.usage.getStatus.useQuery(undefined, {
    refetchInterval: 30000,
    staleTime: 15000,
  });

  // Reset dismissed state when forceShow changes to true
  useEffect(() => {
    if (forceShow) setDismissed(false);
  }, [forceShow]);

  if (dismissed) return null;

  // Don't show for admins
  if (usage?.isAdmin) return null;

  // Determine if limit is reached
  let limitReached = false;
  let limitType = "";
  if (forceShow) {
    limitReached = true;
    limitType = "analysis";
  } else if (usage) {
    if (type === "property") {
      limitReached = usage.propertyAnalyses.remaining <= 0;
      limitType = "property analysis";
    } else if (type === "market") {
      limitReached = usage.marketResearches.remaining <= 0;
      limitType = "market research";
    } else if (type === "api") {
      limitReached = usage.apiCalls.remaining <= 0;
      limitType = "API";
    } else {
      // "all" — show if any limit is reached
      if (usage.propertyAnalyses.remaining <= 0) {
        limitReached = true;
        limitType = "property analysis";
      } else if (usage.marketResearches.remaining <= 0) {
        limitReached = true;
        limitType = "market research";
      } else if (usage.apiCalls.remaining <= 0) {
        limitReached = true;
        limitType = "API";
      }
    }
  }

  if (!limitReached) return null;

  return (
    <div className={`relative overflow-hidden rounded-xl border-2 border-amber-400/50 bg-gradient-to-r from-amber-50 via-yellow-50 to-orange-50 ${className}`}>
      {/* Decorative background pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-amber-500" />
        <div className="absolute -left-4 -bottom-4 h-24 w-24 rounded-full bg-orange-500" />
      </div>

      <div className="relative px-5 py-5 sm:px-6 sm:py-6">
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div className="flex-shrink-0 hidden sm:flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg shadow-amber-200/50">
            <AlertTriangle className="w-6 h-6 text-white" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-amber-900 font-display leading-tight">
              You've Hit Your Daily Limit
            </h3>
            <p className="mt-1.5 text-sm text-amber-800/80 font-sans leading-relaxed max-w-xl">
              You've used all your free {limitType} credits for today. 
              Your limits reset at midnight — come back tomorrow to run more analyses!
            </p>

            {/* Reset info */}
            <div className="inline-flex items-center gap-2 mt-4 px-4 py-2.5 rounded-lg bg-amber-100/80 border border-amber-200/60">
              <Clock className="w-4 h-4 text-amber-700" />
              <span className="text-sm font-medium text-amber-800">
                Limits reset daily at midnight
              </span>
            </div>
          </div>

          {/* Dismiss button */}
          {dismissible && (
            <button
              onClick={() => setDismissed(true)}
              className="flex-shrink-0 p-1.5 rounded-lg text-amber-600/60 hover:text-amber-800 hover:bg-amber-100 transition-colors"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Compact inline version of the banner for tighter spaces.
 * Shows a single-line message about limits resetting.
 */
export function UpgradeBannerInline({ 
  forceShow = false,
  className = "",
}: { forceShow?: boolean; className?: string }) {
  const { data: usage } = trpc.usage.getStatus.useQuery(undefined, {
    refetchInterval: 30000,
    staleTime: 15000,
  });

  if (usage?.isAdmin) return null;

  let limitReached = forceShow;
  if (!limitReached && usage) {
    limitReached = 
      usage.propertyAnalyses.remaining <= 0 || 
      usage.marketResearches.remaining <= 0 || 
      usage.apiCalls.remaining <= 0;
  }

  if (!limitReached) return null;

  return (
    <div className={`flex items-center gap-2 px-4 py-2.5 rounded-lg bg-amber-50 border border-amber-200 ${className}`}>
      <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
      <span className="text-sm text-amber-800 font-sans">
        Daily limit reached. Your credits reset at midnight — come back tomorrow!
      </span>
    </div>
  );
}
