/**
 * Skeleton Loading Component for AI Narrative Section
 * Shows animated placeholders while the AI generates insights
 */

import { motion } from 'framer-motion';
import { Sparkles, Loader2 } from 'lucide-react';

// Shimmer animation for skeleton elements
const shimmer = {
  animate: {
    backgroundPosition: ['200% 0', '-200% 0'],
  },
  transition: {
    duration: 2,
    repeat: Infinity,
    ease: 'linear' as const,
  },
};

function SkeletonLine({ width = '100%', height = '1rem', className = '' }: { 
  width?: string; 
  height?: string;
  className?: string;
}) {
  return (
    <motion.div
      className={`bg-gradient-to-r from-[#0F172A]/5 via-[#0F172A]/10 to-[#0F172A]/5 rounded ${className}`}
      style={{ width, height, backgroundSize: '200% 100%' }}
      animate={shimmer.animate}
      transition={shimmer.transition}
    />
  );
}

function SkeletonCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-2xl border border-[#C9A962]/20 shadow-sm p-6 ${className}`}>
      {children}
    </div>
  );
}

export default function NarrativeSkeleton() {
  return (
    <div className="space-y-6">
      {/* Loading Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-[#C9A962]/10 to-[#D4A84B]/10 rounded-2xl border border-[#C9A962]/30 p-6"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-[#C9A962]/20 flex items-center justify-center">
            <Loader2 className="w-5 h-5 text-[#C9A962] animate-spin" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-[#0F172A] font-sans flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#C9A962]" />
              AI Generating Executive Summary...
            </h3>
            <p className="text-sm text-[#0F172A]/60">
              Our AI is analyzing your property data and market conditions
            </p>
          </div>
        </div>
        
        {/* Progress indicator */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-[#0F172A]/50">
            <span>Analyzing data...</span>
            <span>This may take 30-60 seconds</span>
          </div>
          <div className="h-2 bg-[#0F172A]/10 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-[#C9A962] to-[#D4A84B] rounded-full"
              initial={{ width: '0%' }}
              animate={{ width: '100%' }}
              transition={{ duration: 45, ease: 'linear' }}
            />
          </div>
        </div>
      </motion.div>

      {/* Key Metrics Skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { color: 'from-green-50 to-emerald-50', border: 'border-green-200' },
          { color: 'from-[#FDF8F3] to-[#FFF5E6]', border: 'border-[#C9A962]/30' },
          { color: 'from-blue-50 to-indigo-50', border: 'border-blue-200' },
          { color: 'from-purple-50 to-pink-50', border: 'border-purple-200' },
        ].map((style, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className={`bg-gradient-to-br ${style.color} rounded-xl p-4 border ${style.border}`}
          >
            <SkeletonLine width="60%" height="0.75rem" className="mb-2" />
            <SkeletonLine width="80%" height="1.75rem" className="mb-1" />
            <SkeletonLine width="40%" height="0.625rem" />
          </motion.div>
        ))}
      </div>

      {/* Quick Facts Skeleton */}
      <SkeletonCard>
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4].map((i) => (
            <SkeletonLine 
              key={i} 
              width={`${80 + Math.random() * 60}px`} 
              height="2rem" 
              className="rounded-full" 
            />
          ))}
        </div>
      </SkeletonCard>

      {/* Executive Summary Skeleton */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-gradient-to-r from-[#FDF8F3] to-[#FFF5E6] rounded-2xl border border-[#C9A962]/30 p-6"
      >
        <div className="flex items-center gap-2 mb-4">
          <SkeletonLine width="24px" height="24px" className="rounded" />
          <SkeletonLine width="180px" height="1.5rem" />
        </div>
        <div className="space-y-3">
          <SkeletonLine width="100%" height="1rem" />
          <SkeletonLine width="95%" height="1rem" />
          <SkeletonLine width="88%" height="1rem" />
          <SkeletonLine width="92%" height="1rem" />
          <SkeletonLine width="75%" height="1rem" />
        </div>
      </motion.div>

      {/* Section Skeletons */}
      {['Market Overview', 'Revenue Analysis', 'Competitive Landscape'].map((title, i) => (
        <motion.div
          key={title}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 + i * 0.1 }}
        >
          <SkeletonCard>
            <div className="flex items-center gap-2 mb-4">
              <SkeletonLine width="24px" height="24px" className="rounded" />
              <SkeletonLine width={`${120 + i * 30}px`} height="1.25rem" />
            </div>
            <div className="space-y-2">
              <SkeletonLine width="100%" height="0.875rem" />
              <SkeletonLine width="90%" height="0.875rem" />
              <SkeletonLine width="85%" height="0.875rem" />
            </div>
          </SkeletonCard>
        </motion.div>
      ))}
    </div>
  );
}

// Export a simpler inline skeleton for use within existing components
export function InlineNarrativeSkeleton() {
  return (
    <div className="bg-gradient-to-r from-[#C9A962]/5 to-[#D4A84B]/5 rounded-xl p-4 border border-[#C9A962]/20">
      <div className="flex items-center gap-3">
        <Loader2 className="w-5 h-5 text-[#C9A962] animate-spin" />
        <div>
          <p className="text-sm font-medium text-[#0F172A]">Generating AI Insights...</p>
          <p className="text-xs text-[#0F172A]/50">This typically takes 30-60 seconds</p>
        </div>
      </div>
    </div>
  );
}
