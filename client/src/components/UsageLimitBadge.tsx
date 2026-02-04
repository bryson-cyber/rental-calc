import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Zap, Infinity, AlertTriangle } from "lucide-react";

interface UsageLimitBadgeProps {
  type?: "property" | "market";
  className?: string;
}

export function UsageLimitBadge({ type = "property", className = "" }: UsageLimitBadgeProps) {
  const { data: usage, isLoading } = trpc.usage.getStatus.useQuery(undefined, {
    refetchInterval: 60000, // Refresh every minute
    staleTime: 30000,
  });

  if (isLoading) {
    return (
      <Badge variant="outline" className={`animate-pulse ${className}`}>
        <Zap className="w-3 h-3 mr-1" />
        Loading...
      </Badge>
    );
  }

  if (!usage) {
    return null;
  }

  // Admins have unlimited access
  if (usage.isAdmin) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="secondary" className={`bg-amber-100 text-amber-800 border-amber-300 ${className}`}>
              <Infinity className="w-3 h-3 mr-1" />
              Admin
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>Admin accounts have unlimited access</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  const stats = type === "property" ? usage.propertyAnalyses : usage.marketResearches;
  const remaining = stats.remaining;
  const limit = stats.limit;
  const used = stats.used;

  // Determine badge color based on remaining
  let badgeClass = "bg-emerald-100 text-emerald-800 border-emerald-300"; // Plenty remaining
  let icon = <Zap className="w-3 h-3 mr-1" />;
  
  if (remaining === 0) {
    badgeClass = "bg-red-100 text-red-800 border-red-300";
    icon = <AlertTriangle className="w-3 h-3 mr-1" />;
  } else if (remaining <= 2) {
    badgeClass = "bg-amber-100 text-amber-800 border-amber-300";
  }

  const label = type === "property" ? "analyses" : "market searches";

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className={`${badgeClass} ${className}`}>
            {icon}
            {remaining} of {limit} {label} left today
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <div className="space-y-1">
            <p className="font-medium">Daily Usage</p>
            <p className="text-sm text-muted-foreground">
              You've used {used} of {limit} free {label} today.
              {remaining === 0 
                ? " Come back tomorrow for more!" 
                : ` You have ${remaining} remaining.`}
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Resets daily at midnight
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Compact version for inline display
 */
export function UsageLimitInline({ type = "property", className = "" }: UsageLimitBadgeProps) {
  const { data: usage, isLoading } = trpc.usage.getStatus.useQuery(undefined, {
    refetchInterval: 60000,
    staleTime: 30000,
  });

  if (isLoading || !usage) {
    return null;
  }

  if (usage.isAdmin) {
    return (
      <span className={`text-xs text-amber-600 ${className}`}>
        <Infinity className="w-3 h-3 inline mr-1" />
        Unlimited (Admin)
      </span>
    );
  }

  const stats = type === "property" ? usage.propertyAnalyses : usage.marketResearches;
  const remaining = stats.remaining;
  const limit = stats.limit;

  let colorClass = "text-emerald-600";
  if (remaining === 0) {
    colorClass = "text-red-600";
  } else if (remaining <= 2) {
    colorClass = "text-amber-600";
  }

  return (
    <span className={`text-xs ${colorClass} ${className}`}>
      {remaining}/{limit} remaining today
    </span>
  );
}
