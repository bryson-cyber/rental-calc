import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

/**
 * Skeleton loader for Market Advisor results
 * Shows placeholder shapes while data is loading
 */
export function MarketAdvisorSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Market Overview Card Skeleton */}
      <Card className="border-[#C9A962]/20">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-8 w-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics Grid Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="border-[#C9A962]/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-4">
                <Skeleton className="h-8 w-8 rounded-lg" />
                <Skeleton className="h-5 w-24" />
              </div>
              <Skeleton className="h-10 w-32 mb-2" />
              <Skeleton className="h-4 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Chart Section Skeleton */}
      <Card className="border-[#C9A962]/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-8 w-24 rounded-full" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-2 h-48">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2">
                <Skeleton 
                  className="w-full rounded-t" 
                  style={{ height: `${Math.random() * 60 + 40}%` }} 
                />
                <Skeleton className="h-3 w-8" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* AI Analysis Section Skeleton */}
      <Card className="border-[#C9A962]/20">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <Skeleton className="h-6 w-48" />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <div className="pt-4 space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </CardContent>
      </Card>

      {/* Expandable Sections Skeleton */}
      {[1, 2, 3].map((i) => (
        <Card key={i} className="border-[#C9A962]/20">
          <CardHeader className="cursor-pointer">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-lg" />
                <Skeleton className="h-5 w-36" />
              </div>
              <Skeleton className="h-5 w-5 rounded" />
            </div>
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}

/**
 * Skeleton loader for Property Advisor results
 * Shows placeholder shapes while data is loading
 */
export function PropertyAdvisorSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Property Header Skeleton */}
      <Card className="border-[#C9A962]/20">
        <CardContent className="pt-6">
          <div className="flex gap-6">
            <Skeleton className="h-48 w-64 rounded-lg flex-shrink-0" />
            <div className="flex-1 space-y-4">
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-5 w-1/2" />
              <div className="flex gap-4 pt-2">
                <Skeleton className="h-6 w-20" />
                <Skeleton className="h-6 w-20" />
                <Skeleton className="h-6 w-20" />
              </div>
              <div className="grid grid-cols-3 gap-4 pt-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-8 w-full" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Revenue Estimate Card Skeleton */}
      <Card className="border-[#C9A962]/20 bg-gradient-to-br from-[#0F172A] to-[#1e293b]">
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <Skeleton className="h-5 w-40 mx-auto bg-white/10" />
            <Skeleton className="h-12 w-48 mx-auto bg-white/10" />
            <div className="flex justify-center gap-8 pt-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-16 bg-white/10" />
                  <Skeleton className="h-6 w-20 bg-white/10" />
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Competitor Cards Skeleton */}
      <div className="space-y-4">
        <Skeleton className="h-6 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="border-[#C9A962]/20 overflow-hidden">
              <Skeleton className="h-40 w-full rounded-none" />
              <CardContent className="pt-4 space-y-3">
                <Skeleton className="h-5 w-3/4" />
                <div className="flex gap-2">
                  <Skeleton className="h-4 w-12" />
                  <Skeleton className="h-4 w-12" />
                  <Skeleton className="h-4 w-12" />
                </div>
                <div className="flex justify-between pt-2">
                  <Skeleton className="h-6 w-20" />
                  <Skeleton className="h-6 w-16" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton loader for data cards (generic)
 */
export function DataCardSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="border-[#C9A962]/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-4">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <Skeleton className="h-4 w-24" />
            </div>
            <Skeleton className="h-8 w-32 mb-2" />
            <Skeleton className="h-3 w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/**
 * Skeleton loader for table rows
 */
export function TableRowSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex gap-4 pb-2 border-b border-[#C9A962]/20">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex gap-4 py-2">
          {Array.from({ length: cols }).map((_, colIndex) => (
            <Skeleton key={colIndex} className="h-5 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}
