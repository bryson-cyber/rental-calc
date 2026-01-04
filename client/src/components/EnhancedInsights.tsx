/**
 * Enhanced Insights Component
 * 
 * Displays the enhanced AI analysis including:
 * - What This Means For You sections
 * - Action Items with priorities
 * - Market Context
 * - Quick Facts
 */

import { motion } from 'framer-motion';
import {
  Lightbulb,
  Target,
  AlertTriangle,
  CheckCircle2,
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
  DollarSign,
  Users,
  Calendar,
  MapPin,
  ArrowRight,
  Info,
  Zap,
  Award
} from 'lucide-react';

// Types matching the enhanced narrative report
interface ActionItem {
  priority: 'high' | 'medium' | 'low';
  action: string;
  why: string;
  timeline: string;
}

interface WhatThisMeans {
  revenue: string;
  competition: string;
  seasonality: string;
  overall: string;
}

interface MarketContext {
  type: 'tourist' | 'business' | 'mixed' | 'suburban' | 'urban' | 'rural';
  seasonality: 'high' | 'moderate' | 'low';
  competition: 'high' | 'moderate' | 'low';
  pricePoint: 'luxury' | 'mid-range' | 'budget';
  description: string;
}

interface KeyMetrics {
  projected_annual_revenue: number;
  projected_monthly_profit: number;
  market_occupancy: number;
  market_adr: number;
  break_even_months: number;
  confidence_level: 'high' | 'medium' | 'low';
  revenue_to_rent_ratio: number;
}

export interface EnhancedNarrativeReport {
  executive_summary: string;
  market_overview: string;
  revenue_analysis: string;
  competitive_landscape: string;
  seasonal_strategy: string;
  historical_context: string;
  risk_assessment: string;
  financial_outlook: string;
  conclusion: string;
  what_this_means: WhatThisMeans;
  action_items: ActionItem[];
  market_context: MarketContext;
  key_metrics: KeyMetrics;
  quick_facts: string[];
}

interface EnhancedInsightsProps {
  report: EnhancedNarrativeReport;
  monthlyRent: number;
}

// Priority badge component
function PriorityBadge({ priority }: { priority: ActionItem['priority'] }) {
  const colors = {
    high: 'bg-red-500/20 text-red-400 border-red-500/30',
    medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    low: 'bg-green-500/20 text-green-400 border-green-500/30',
  };

  const labels = {
    high: 'High Priority',
    medium: 'Medium',
    low: 'Nice to Have',
  };

  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${colors[priority]}`}>
      {labels[priority]}
    </span>
  );
}

// Market context badge
function MarketTypeBadge({ type }: { type: MarketContext['type'] }) {
  const icons: Record<MarketContext['type'], React.ReactNode> = {
    tourist: <MapPin className="w-3 h-3" />,
    business: <Target className="w-3 h-3" />,
    mixed: <Users className="w-3 h-3" />,
    suburban: <MapPin className="w-3 h-3" />,
    urban: <MapPin className="w-3 h-3" />,
    rural: <MapPin className="w-3 h-3" />,
  };

  const labels: Record<MarketContext['type'], string> = {
    tourist: 'Tourist Market',
    business: 'Business Travel',
    mixed: 'Mixed Market',
    suburban: 'Suburban',
    urban: 'Urban',
    rural: 'Rural',
  };

  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 bg-[#C9A962]/20 text-[#C9A962] text-xs font-medium rounded-lg">
      {icons[type]}
      {labels[type]}
    </span>
  );
}

// Level indicator (high/moderate/low)
function LevelIndicator({ level, label }: { level: 'high' | 'moderate' | 'low'; label: string }) {
  const colors = {
    high: 'text-red-400',
    moderate: 'text-yellow-400',
    low: 'text-green-400',
  };

  const icons = {
    high: <TrendingUp className="w-4 h-4" />,
    moderate: <Minus className="w-4 h-4" />,
    low: <TrendingDown className="w-4 h-4" />,
  };

  return (
    <div className="flex items-center gap-2">
      <span className={colors[level]}>{icons[level]}</span>
      <span className="text-white/70 text-sm">{label}:</span>
      <span className={`font-medium capitalize ${colors[level]}`}>{level}</span>
    </div>
  );
}

// Revenue to Rent Ratio indicator
function RatioIndicator({ ratio }: { ratio: number }) {
  const meetsRule = ratio >= 2;
  
  return (
    <div className={`p-4 rounded-xl border ${
      meetsRule 
        ? 'bg-green-500/10 border-green-500/30' 
        : 'bg-red-500/10 border-red-500/30'
    }`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-white/70 text-sm">Revenue-to-Rent Ratio</span>
        <span className={`text-2xl font-bold ${meetsRule ? 'text-green-400' : 'text-red-400'}`}>
          {ratio.toFixed(1)}x
        </span>
      </div>
      <div className="flex items-center gap-2">
        {meetsRule ? (
          <>
            <CheckCircle2 className="w-4 h-4 text-green-400" />
            <span className="text-green-400 text-sm">Meets the 2x rule</span>
          </>
        ) : (
          <>
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <span className="text-red-400 text-sm">Below 2x threshold</span>
          </>
        )}
      </div>
    </div>
  );
}

export default function EnhancedInsights({ report, monthlyRent }: EnhancedInsightsProps) {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
  };

  return (
    <motion.div
      className="space-y-8"
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      {/* Executive Summary */}
      {report.executive_summary && (
        <motion.div 
          className="bg-gradient-to-br from-[#C9A962]/20 to-[#C9A962]/5 border border-[#C9A962]/30 rounded-xl p-6"
          variants={itemVariants}
        >
          <div className="flex items-center gap-2 mb-4">
            <Award className="w-6 h-6 text-[#C9A962]" />
            <h3 className="text-xl font-semibold text-white">Executive Summary</h3>
          </div>
          <div className="prose prose-invert max-w-none">
            <p className="text-white/90 leading-relaxed whitespace-pre-line">
              {report.executive_summary}
            </p>
          </div>
        </motion.div>
      )}

      {/* Quick Facts Banner */}
      {report.quick_facts && report.quick_facts.length > 0 && (
        <motion.div 
          className="bg-[#C9A962]/10 border border-[#C9A962]/30 rounded-xl p-4"
          variants={itemVariants}
        >
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-5 h-5 text-[#C9A962]" />
            <h3 className="font-semibold text-white">Quick Facts</h3>
          </div>
          <div className="grid md:grid-cols-2 gap-2">
            {report.quick_facts.slice(0, 6).map((fact, idx) => (
              <div key={idx} className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#C9A962] flex-shrink-0 mt-0.5" />
                <span className="text-white/80 text-sm">{fact}</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Market Context & Key Metrics */}
      <motion.div 
        className="grid md:grid-cols-2 gap-6"
        variants={itemVariants}
      >
        {/* Market Context */}
        <div className="bg-white/5 rounded-xl p-5 border border-white/10">
          <div className="flex items-center gap-2 mb-4">
            <MapPin className="w-5 h-5 text-[#C9A962]" />
            <h3 className="font-semibold text-white">Market Context</h3>
          </div>
          
          <div className="space-y-3">
            <MarketTypeBadge type={report.market_context.type} />
            <p className="text-white/70 text-sm leading-relaxed">
              {report.market_context.description}
            </p>
            <div className="pt-2 space-y-2">
              <LevelIndicator level={report.market_context.seasonality} label="Seasonality" />
              <LevelIndicator level={report.market_context.competition} label="Competition" />
            </div>
          </div>
        </div>

        {/* Revenue-to-Rent Ratio */}
        <div className="bg-white/5 rounded-xl p-5 border border-white/10">
          <div className="flex items-center gap-2 mb-4">
            <DollarSign className="w-5 h-5 text-[#C9A962]" />
            <h3 className="font-semibold text-white">Investment Viability</h3>
          </div>
          
          <RatioIndicator ratio={report.key_metrics.revenue_to_rent_ratio} />
          
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="text-center p-2 bg-white/5 rounded-lg">
              <p className="text-white/50 text-xs">Break-even</p>
              <p className="text-white font-semibold">{report.key_metrics.break_even_months} months</p>
            </div>
            <div className="text-center p-2 bg-white/5 rounded-lg">
              <p className="text-white/50 text-xs">Confidence</p>
              <p className={`font-semibold capitalize ${
                report.key_metrics.confidence_level === 'high' 
                  ? 'text-green-400' 
                  : report.key_metrics.confidence_level === 'medium'
                    ? 'text-yellow-400'
                    : 'text-red-400'
              }`}>
                {report.key_metrics.confidence_level}
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* What This Means For You */}
      <motion.div 
        className="bg-gradient-to-br from-[#0F172A] to-[#1e293b] rounded-xl p-6 border border-[#C9A962]/20"
        variants={itemVariants}
      >
        <div className="flex items-center gap-2 mb-6">
          <Lightbulb className="w-6 h-6 text-[#C9A962]" />
          <h3 className="text-xl font-serif font-semibold text-white">What This Means For You</h3>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Revenue */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-green-400" />
              <h4 className="font-medium text-white">Revenue Potential</h4>
            </div>
            <p className="text-white/70 text-sm leading-relaxed pl-6">
              {report.what_this_means.revenue}
            </p>
          </div>

          {/* Competition */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-400" />
              <h4 className="font-medium text-white">Competition</h4>
            </div>
            <p className="text-white/70 text-sm leading-relaxed pl-6">
              {report.what_this_means.competition}
            </p>
          </div>

          {/* Seasonality */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-purple-400" />
              <h4 className="font-medium text-white">Seasonality</h4>
            </div>
            <p className="text-white/70 text-sm leading-relaxed pl-6">
              {report.what_this_means.seasonality}
            </p>
          </div>

          {/* Overall */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-[#C9A962]" />
              <h4 className="font-medium text-white">Bottom Line</h4>
            </div>
            <p className="text-white/70 text-sm leading-relaxed pl-6">
              {report.what_this_means.overall}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Action Items */}
      <motion.div 
        className="bg-white/5 rounded-xl p-6 border border-white/10"
        variants={itemVariants}
      >
        <div className="flex items-center gap-2 mb-6">
          <Target className="w-6 h-6 text-[#C9A962]" />
          <h3 className="text-xl font-serif font-semibold text-white">Recommended Actions</h3>
        </div>

        <div className="space-y-4">
          {report.action_items.map((item, idx) => (
            <motion.div
              key={idx}
              className="bg-white/5 rounded-xl p-4 border border-white/10 hover:border-[#C9A962]/30 transition-colors"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.1 }}
            >
              <div className="flex items-start justify-between gap-4 mb-2">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    item.priority === 'high' 
                      ? 'bg-red-500/20' 
                      : item.priority === 'medium'
                        ? 'bg-yellow-500/20'
                        : 'bg-green-500/20'
                  }`}>
                    <span className="text-white font-bold text-sm">{idx + 1}</span>
                  </div>
                  <h4 className="font-medium text-white">{item.action}</h4>
                </div>
                <PriorityBadge priority={item.priority} />
              </div>
              
              <p className="text-white/60 text-sm mb-3 pl-11">
                {item.why}
              </p>
              
              <div className="flex items-center gap-2 pl-11">
                <Clock className="w-4 h-4 text-white/40" />
                <span className="text-white/50 text-xs">{item.timeline}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
