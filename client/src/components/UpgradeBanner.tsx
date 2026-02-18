import { trpc } from "@/lib/trpc";
import { AlertTriangle, ArrowRight, Sparkles, X } from "lucide-react";
import { useState, useEffect } from "react";

const TURNKEY_URL = "https://masterclass.coachinayah.com/the-turnkey-program";

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
 * Prominent upgrade banner shown when a user hits their daily usage limit.
 * Directs them to the Turnkey Program for unlimited access.
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
  if (forceShow) {
    limitReached = true;
  } else if (usage) {
    if (type === "property") {
      limitReached = usage.propertyAnalyses.remaining <= 0;
    } else if (type === "market") {
      limitReached = usage.marketResearches.remaining <= 0;
    } else if (type === "api") {
      limitReached = usage.apiCalls.remaining <= 0;
    } else {
      // "all" — show if any limit is reached
      limitReached = 
        usage.propertyAnalyses.remaining <= 0 || 
        usage.marketResearches.remaining <= 0 || 
        usage.apiCalls.remaining <= 0;
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
              You've used all your free analyses for today. Unlock unlimited access to property reports, 
              market research, and deal-finding tools with the Turnkey Program.
            </p>

            {/* CTA Button */}
            <a
              href={TURNKEY_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 mt-4 px-5 py-2.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold text-sm shadow-md shadow-amber-300/30 hover:from-amber-600 hover:to-orange-600 hover:shadow-lg hover:shadow-amber-300/40 transition-all duration-200 group"
            >
              <Sparkles className="w-4 h-4" />
              Upgrade to Unlimited Access
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </a>

            <p className="mt-2.5 text-xs text-amber-700/60 font-sans">
              Free credits reset daily at midnight. Come back tomorrow or upgrade now.
            </p>
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
 * Compact inline version of the upgrade banner for tighter spaces.
 * Shows a single-line message with upgrade link.
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
        Daily limit reached.{" "}
        <a
          href={TURNKEY_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-amber-700 underline underline-offset-2 hover:text-amber-900 transition-colors"
        >
          Upgrade for unlimited access
        </a>
      </span>
    </div>
  );
}
