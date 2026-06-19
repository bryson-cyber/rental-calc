/**
 * Tesla Dashboard Component
 * 
 * Design Philosophy:
 * - Powerful market insights with dramatically simpler interface
 * - One hero metric per section, progressive disclosure for details
 * - Smart defaults, visual over tabular, instant insights
 * - Color = meaning (green/yellow/red for quick decisions)
 */

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { trpc } from '@/lib/trpc';
import { LightMarkdown } from '@/components/LightMarkdown';
import {
  TrendingUp,
  TrendingDown,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Calendar,
  Percent,
  DollarSign,
  Home,
  Star,
  AlertTriangle,
  CheckCircle2,
  Info,
  Bed,
  Bath,
  Users,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Plus,
  RotateCcw,
  Camera,
  Briefcase,
  Award,
  Building2,
  MapPin,
  Sparkles,
  Bot,
  Loader2,
  Pencil,
  Check,
  Map,
  Save
} from 'lucide-react';
import { ImageCarousel } from './ImageCarousel';
import { MapView } from './Map';
import MaxPurchasePriceCalculator from './MaxPurchasePriceCalculator';
import { PropertyChatBot } from './PropertyChatBot';
import OfferPriceSuggester from './OfferPriceSuggester';
import AmortizationSchedule from './AmortizationSchedule';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

// ============================================
// TYPE DEFINITIONS
// ============================================

interface MonthlyForecast {
  month: string;
  revenue: number;
  adr: number;
  occupancy: number;
  revpar?: number; // Revenue Per Available Room = ADR × Occupancy
}

interface Comparable {
  id: string;
  title: string;
  bedrooms: number;
  bathrooms: number;
  accommodates: number;
  revenue: number;
  adr: number;
  occupancy: number;
  rating: number;
  reviews: number;
  imageUrl?: string;
  images?: string[];  // All images for carousel
  airbnbUrl?: string;
  distanceMeters?: number;
  latitude?: number;
  longitude?: number;
  amenities?: string[];
}

interface AnalysisResult {
  revenue: {
    projected: number;
    low: number;
    high: number;
  };
  metrics: {
    adr: number;
    occupancy: number;
  };
  cashFlow: {
    monthlyRevenue: number;
    monthlyRent: number;
    monthlyProfit: number;
  };
  forecast: MonthlyForecast[];
  comparables: Comparable[];
  historicalData?: {
    summary: {
      monthly_pct_change: number;
      yearly_pct_change: number;
      trend: 'up' | 'down' | 'stable';
    };
    months: Array<{
      date: string;
      revenue: number;
      occupancy: number;
      adr: number;
    }>;
  };
  marketInsights?: {
    professionallyManagedPct: number;
    superhostPct: number;
    avgRating?: number;
    totalListings?: number;
    marketScore?: number;
  };
  revenueScenarios?: {
    conservative: number;  // P50 - Median performer
    target: number;        // P75 - Top quarter performer
    optimistic: number;    // P90 - Top 10% performer
    source: string;
    compCount: number;
  };
}

interface TeslaDashboardProps {
  result: AnalysisResult;
  address: string;
  bedrooms: number;
  bathrooms: number;
  accommodates?: number;
  monthlyRent?: number;
  furnitureCost?: number;  // Furniture & setup cost for break-even calculation
  expensePercent?: number;  // Operating expense percentage (default 20%)
  marketId?: string | number;  // For MarketInsightsPanel
  // Purchase mode props
  mode?: 'rent' | 'purchase';
  purchasePrice?: number;
  loanType?: 'conventional' | 'dscr' | 'fha' | 'cash';
  downPaymentPercent?: number;
  interestRate?: number;
  rentometerData?: {
    median: number;
    percentile25: number;
    percentile75: number;
    min: number;
    max: number;
    mean?: number;
    stdDev?: number;
    sampleCount: number;
    radiusMiles?: number;
    userRentVsMarket: 'below' | 'above' | 'at';
    rentAdvantage: number;
    percentileRank: number;
    quickviewUrl?: string;
    nearbyComps?: Array<{
      address: string;
      price: number;
      bedrooms: number;
      baths: string;
      property_type: string;
      distance: number;
      sqft: number;
      last_seen: string;
    }>;
    propertyRents?: Array<{
      bedrooms: number;
      baths: string;
      price: number;
      sqft: number;
      last_seen: string;
    }>;
  } | null;  // Rentometer rent validation data
  revenueScenarios?: {
    conservative: number;
    target: number;
    optimistic: number;
    source: string;
    compCount: number;
  };
  isOwner?: boolean;  // Only the owner can override revenue numbers
  shareCode?: string;  // Share code for persisting admin overrides
  persistedRevenueOverride?: number | null;  // Revenue override loaded from DB
  persistedOccupancyOverride?: number | null;  // Occupancy/booking rate override loaded from DB (0-100)
  persistedSelectedCompIds?: string[] | null;  // Admin-curated comp selection loaded from DB
  onRevenueOverrideChange?: (override: number | null) => void;  // Notify parent when admin changes revenue override
  onOccupancyOverrideChange?: (override: number | null) => void;  // Notify parent when admin changes occupancy override
  onCompSelectionChange?: (selectedIds: string[]) => void;  // Notify parent when admin changes comp selection
  // Data source info for fallback estimates (new construction / unknown addresses)
  dataSource?: {
    type: 'comp_fallback';
    market: string;
    compCount: number;
  };
  // User-selected amenities for highlighting matching comps
  selectedAmenities?: string[];
  // Property coordinates for map view
  propertyLatitude?: number;
  propertyLongitude?: number;
  // Amenity filter metadata from API
  amenityFilter?: {
    applied: boolean;
    relaxed: boolean;
    selected_amenities: string[];
    comp_count: number;
  };
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const formatCompactCurrency = (value: number): string => {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return formatCurrency(value);
};

const formatMonth = (dateStr: string): string => {
  if (dateStr && dateStr.length <= 3) return dateStr;
  if (dateStr && dateStr.includes('-') && dateStr.length === 7) {
    const [, monthNum] = dateStr.split('-');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return monthNames[parseInt(monthNum, 10) - 1] || dateStr;
  }
  const date = new Date(dateStr);
  if (!isNaN(date.getTime())) {
    return date.toLocaleDateString('en-US', { month: 'short' });
  }
  return dateStr || 'N/A';
};

// ============================================
// SUB-COMPONENTS
// ============================================

/**
 * Hero Revenue Card - The main number users care about
 */
function HeroRevenueCard({ 
  annualRevenue, 
  monthlyProfit, 
  monthlyRent,
  yearlyChange,
  expensePercent = 20,
  mode = 'rent',
  monthlyMortgage = 0,
  monthlyAdditionalCosts = 0,
  revenueScenarios,
  isOwner = false,
  onRevenueOverride,
  revenueOverrideActive = false,
  onSaveOverride,
  isSavingOverride = false,
  savedOverrideFlash = false,
  hasPendingOverride = false,
  saveOverrideError = false,
  dataSource
}: { 
  annualRevenue: number;
  monthlyProfit: number;
  monthlyRent: number;
  yearlyChange?: number;
  expensePercent?: number;
  mode?: 'rent' | 'purchase';
  monthlyMortgage?: number;
  monthlyAdditionalCosts?: number; // Property tax + insurance + maintenance + utilities (purchase mode)
  revenueScenarios?: {
    conservative: number;
    target: number;
    optimistic: number;
    source: string;
    compCount: number;
  };
  isOwner?: boolean;
  onRevenueOverride?: (newRevenue: number | null) => void;
  revenueOverrideActive?: boolean;
  onSaveOverride?: (explicitValue?: number | null) => void;
  isSavingOverride?: boolean;
  savedOverrideFlash?: boolean;
  hasPendingOverride?: boolean;
  saveOverrideError?: boolean;
  dataSource?: {
    type: 'comp_fallback';
    market: string;
    compCount: number;
  };
}) {
  // Inline editing state for typing custom revenue
  const [isEditingRevenue, setIsEditingRevenue] = useState(false);
  const [editValue, setEditValue] = useState('');

  // Calculate monthly values
  const monthlyRevenue = annualRevenue / 12;
  const monthlyExpenses = monthlyRevenue * (expensePercent / 100);
  // In purchase mode, the fixed cost is the mortgage payment, not rent
  const fixedCost = mode === 'purchase' ? monthlyMortgage : monthlyRent;
  // In purchase mode, include additional costs (property tax, insurance, maintenance, utilities)
  const trueMonthlyProfit = monthlyRevenue - fixedCost - monthlyExpenses - (mode === 'purchase' ? monthlyAdditionalCosts : 0);
  
  const isProfitable = trueMonthlyProfit > 0;
  const profitMargin = fixedCost > 0 ? ((trueMonthlyProfit / fixedCost) * 100) : 0;
  
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[oklch(0.98_0.01_265)] to-white border border-[oklch(0.90_0.01_265)] p-6 md:p-8 shadow-sm">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-[oklch(0.55_0.14_75)]/10 to-transparent rounded-full -translate-y-1/2 translate-x-1/2" />
      
      <div className="relative">
        {/* Section Headline - Why this matters */}
        <p className="text-sm text-slate-600 mb-3 font-medium">
          The bottom line — will this property make money after all monthly costs?
        </p>
        
        {/* Verdict Badge */}
        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium mb-4 ${
          isProfitable 
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {isProfitable ? (
            <>
              <CheckCircle2 className="w-4 h-4" />
              This Property Cash Flows
            </>
          ) : (
            <>
              <AlertTriangle className="w-4 h-4" />
              Tight Margins - Review Carefully
            </>
          )}
        </div>
        
        {/* Hero Number */}
        <div className="mb-6">
          <Tooltip>
            <TooltipTrigger asChild>
              <p className="text-[oklch(0.50_0_0)] text-sm font-medium mb-1 inline-flex items-center gap-1 cursor-help hover:text-[oklch(0.40_0_0)] transition-colors">
                Projected Annual Revenue
                <Info className="w-3.5 h-3.5" />
              </p>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs text-center p-3 bg-white text-[oklch(0.30_0_0)] shadow-lg border border-[oklch(0.90_0_0)]">
              <p className="text-sm leading-relaxed">{METRIC_TOOLTIPS.revenue}</p>
            </TooltipContent>
          </Tooltip>
          <div className="flex items-baseline gap-3 flex-wrap">
            {/* Owner override controls: decrement */}
            {isOwner && onRevenueOverride && !isEditingRevenue && (
              <button
                onClick={() => onRevenueOverride(annualRevenue - 5000)}
                className="w-8 h-8 rounded-full bg-red-100 hover:bg-red-200 text-red-700 flex items-center justify-center transition-colors border border-red-300 shadow-sm"
                title="Decrease revenue by $5,000"
              >
                <Minus className="w-4 h-4" />
              </button>
            )}
            {/* Revenue display: click to edit (admin only) */}
            {isOwner && onRevenueOverride && isEditingRevenue ? (
              <div className="flex items-center gap-2">
                <span className="text-3xl md:text-4xl font-bold text-amber-700">$</span>
                <input
                  type="text"
                  inputMode="numeric"
                  autoFocus
                  value={editValue}
                  onChange={(e) => {
                    // Allow only digits and commas
                    const raw = e.target.value.replace(/[^0-9]/g, '');
                    if (raw === '') {
                      setEditValue('');
                      return;
                    }
                    // Format with commas
                    setEditValue(Number(raw).toLocaleString('en-US'));
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const numericValue = Number(editValue.replace(/[^0-9]/g, ''));
                      if (numericValue > 0) {
                        onRevenueOverride(numericValue);
                      }
                      setIsEditingRevenue(false);
                    } else if (e.key === 'Escape') {
                      setIsEditingRevenue(false);
                    }
                  }}
                  onBlur={() => {
                    const numericValue = Number(editValue.replace(/[^0-9]/g, ''));
                    if (numericValue > 0) {
                      onRevenueOverride(numericValue);
                    }
                    setIsEditingRevenue(false);
                  }}
                  className="w-48 text-3xl md:text-4xl font-bold text-amber-700 bg-amber-50 border-2 border-amber-400 rounded-lg px-3 py-1 outline-none focus:ring-2 focus:ring-amber-300"
                  placeholder={annualRevenue.toLocaleString('en-US')}
                />
                <button
                  onMouseDown={(e) => {
                    e.preventDefault(); // Prevent blur from firing first
                    const numericValue = Number(editValue.replace(/[^0-9]/g, ''));
                    if (numericValue > 0) {
                      onRevenueOverride(numericValue);
                    }
                    setIsEditingRevenue(false);
                  }}
                  className="w-8 h-8 rounded-full bg-emerald-100 hover:bg-emerald-200 text-emerald-700 flex items-center justify-center transition-colors border border-emerald-300 shadow-sm"
                  title="Confirm"
                >
                  <Check className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <span
                className={`text-4xl md:text-5xl font-bold tracking-tight ${
                  isOwner && revenueOverrideActive ? 'text-amber-700' : 'text-[oklch(0.25_0_0)]'
                } ${isOwner && onRevenueOverride ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
                onClick={() => {
                  if (isOwner && onRevenueOverride) {
                    setEditValue(annualRevenue.toLocaleString('en-US'));
                    setIsEditingRevenue(true);
                  }
                }}
                title={isOwner && onRevenueOverride ? 'Click to type a custom revenue amount' : undefined}
              >
                {formatCurrency(annualRevenue)}
                {isOwner && onRevenueOverride && (
                  <Pencil className="w-4 h-4 inline-block ml-2 opacity-40" />
                )}
              </span>
            )}
            {/* Owner override controls: increment */}
            {isOwner && onRevenueOverride && !isEditingRevenue && (
              <button
                onClick={() => onRevenueOverride(annualRevenue + 5000)}
                className="w-8 h-8 rounded-full bg-emerald-100 hover:bg-emerald-200 text-emerald-700 flex items-center justify-center transition-colors border border-emerald-300 shadow-sm"
                title="Increase revenue by $5,000"
              >
                <Plus className="w-4 h-4" />
              </button>
            )}
            {/* Owner reset button when override is active */}
            {isOwner && onRevenueOverride && revenueOverrideActive && !isEditingRevenue && (
              <button
                onClick={() => {
                  onRevenueOverride(null);
                  // Reset saves immediately with explicit null — avoids React state closure issue
                  if (onSaveOverride) (onSaveOverride as (v?: number | null) => void)(null);
                }}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors border border-slate-300 shadow-sm"
                title="Reset to original estimate"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
            {/* Save button — inline next to +/- controls, only when pending */}
            {isOwner && onSaveOverride && hasPendingOverride && !isEditingRevenue && (
              <button
                onClick={() => onSaveOverride?.()}
                disabled={isSavingOverride}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white transition-colors shadow-sm"
              >
                {isSavingOverride ? (
                  <><Loader2 className="w-3 h-3 animate-spin" /> Saving...</>
                ) : (
                  <><Save className="w-3 h-3" /> Save</>
                )}
              </button>
            )}
            {/* Saved flash — inline */}
            {isOwner && onSaveOverride && savedOverrideFlash && !hasPendingOverride && !isEditingRevenue && (
              <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Saved
              </span>
            )}
            {/* Save error — inline */}
            {isOwner && onSaveOverride && saveOverrideError && !hasPendingOverride && !isEditingRevenue && (
              <span className="text-xs text-red-600 font-semibold flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Save failed
              </span>
            )}
            {!isEditingRevenue && (
              <span className="text-xs font-semibold uppercase tracking-wide px-2 py-1 rounded bg-[oklch(0.55_0.14_75)]/10 text-[oklch(0.45_0.14_75)]">/year</span>
            )}
            {yearlyChange !== undefined && (
              <span className={`flex items-center gap-1 text-sm font-medium ${
                yearlyChange >= 0 ? 'text-emerald-600' : 'text-red-600'
              }`}>
                {yearlyChange >= 0 ? (
                  <ArrowUpRight className="w-4 h-4" />
                ) : (
                  <ArrowDownRight className="w-4 h-4" />
                )}
                {Math.abs(yearlyChange).toFixed(1)}% vs last year
              </span>
            )}
          </div>
          {/* Override active indicator (below the row) */}
          {isOwner && revenueOverrideActive && (
            <p className="text-xs text-amber-600 mt-1 font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
              Admin override active — original estimate was {formatCurrency(revenueScenarios?.target || 0)}
            </p>
          )}
          {/* Area-based estimate notice for new construction / unknown addresses */}
          {dataSource?.type === 'comp_fallback' && (
            <div className="mt-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-800">
                <span className="font-semibold">Area-based estimate.</span> This address isn't in Airbnb's database yet (common for new construction). Revenue is estimated from {dataSource.compCount} comparable listings in {dataSource.market}.
              </p>
            </div>
          )}
        </div>
        
        {/* Monthly Breakdown - 4 columns with tooltips */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-[oklch(0.95_0.01_265)] rounded-xl p-4 border border-[oklch(0.90_0.01_265)]">
            <Tooltip>
              <TooltipTrigger asChild>
                <p className="text-[oklch(0.50_0_0)] text-xs font-medium mb-1 cursor-help border-b border-dotted border-[oklch(0.60_0_0)] inline-block">Monthly Revenue</p>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs p-3 bg-white text-[oklch(0.30_0_0)] shadow-lg border border-[oklch(0.90_0_0)]">
                <p className="text-sm">What you'll earn each month from Airbnb bookings before any expenses</p>
              </TooltipContent>
            </Tooltip>
            <div className="flex items-baseline gap-2">
              <p className="text-lg md:text-xl font-bold text-[oklch(0.25_0_0)]">{formatCurrency(monthlyRevenue)}</p>
              <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">/month</span>
            </div>
          </div>
          <div className="bg-[oklch(0.95_0.01_265)] rounded-xl p-4 border border-[oklch(0.90_0.01_265)]">
            <Tooltip>
              <TooltipTrigger asChild>
                <p className="text-[oklch(0.50_0_0)] text-xs font-medium mb-1 cursor-help border-b border-dotted border-[oklch(0.60_0_0)] inline-block">{mode === 'purchase' ? 'Mortgage Payment' : 'Your Rent'}</p>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs p-3 bg-white text-[oklch(0.30_0_0)] shadow-lg border border-[oklch(0.90_0_0)]">
                <p className="text-sm">{mode === 'purchase' ? 'Your monthly mortgage payment — your biggest fixed cost as a property owner' : 'The monthly rent you pay to your landlord — your biggest fixed cost'}</p>
              </TooltipContent>
            </Tooltip>
            <div className="flex items-baseline gap-2">
              <p className="text-lg md:text-xl font-bold text-[oklch(0.25_0_0)]">{formatCurrency(fixedCost)}</p>
              <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">/month</span>
            </div>
          </div>
          <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
            <Tooltip>
              <TooltipTrigger asChild>
                <p className="text-[oklch(0.50_0_0)] text-xs font-medium mb-1 cursor-help border-b border-dotted border-[oklch(0.60_0_0)] inline-block">{mode === 'purchase' ? 'All Expenses' : `Expenses (${expensePercent}%)`}</p>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs p-3 bg-white text-[oklch(0.30_0_0)] shadow-lg border border-[oklch(0.90_0_0)]">
                {mode === 'purchase' ? (
                  <div className="text-sm space-y-1">
                    <p className="font-medium">Monthly operating expenses:</p>
                    <p>Management/Cleaning ({expensePercent}%): {formatCurrency(monthlyExpenses)}</p>
                    <p>Property Tax (1.2%): {formatCurrency(monthlyAdditionalCosts * 0.35)}</p>
                    <p>Insurance (0.6%): {formatCurrency(monthlyAdditionalCosts * 0.175)}</p>
                    <p>Maintenance (5%): {formatCurrency(monthlyAdditionalCosts * 0.35)}</p>
                    <p>Utilities: {formatCurrency(monthlyAdditionalCosts * 0.125)}</p>
                  </div>
                ) : (
                  <p className="text-sm">Operating costs: cleaning, supplies, utilities, Airbnb fees, repairs. Industry standard is 20-30% of revenue.</p>
                )}
              </TooltipContent>
            </Tooltip>
            <div className="flex items-baseline gap-2">
              <p className="text-lg md:text-xl font-bold text-amber-600">{formatCurrency(monthlyExpenses + (mode === 'purchase' ? monthlyAdditionalCosts : 0))}</p>
              <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">/month</span>
            </div>
          </div>
          <div className={`rounded-xl p-4 border ${
            isProfitable ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'
          }`}>
            <Tooltip>
              <TooltipTrigger asChild>
                <p className="text-[oklch(0.50_0_0)] text-xs font-medium mb-1 cursor-help border-b border-dotted border-[oklch(0.60_0_0)] inline-block">Net Profit</p>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs p-3 bg-white text-[oklch(0.30_0_0)] shadow-lg border border-[oklch(0.90_0_0)]">
                <p className="text-sm">What you keep after paying {mode === 'purchase' ? 'mortgage' : 'rent'} and all expenses. This is your actual take-home profit.</p>
              </TooltipContent>
            </Tooltip>
            <div className="flex items-baseline gap-2">
              <p className={`text-lg md:text-xl font-bold ${isProfitable ? 'text-emerald-600' : 'text-red-600'}`}>
                {formatCurrency(trueMonthlyProfit)}
              </p>
              <span className={`text-xs font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${isProfitable ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>/month</span>
            </div>
            <div className={`flex items-baseline gap-2 mt-1.5 pt-1.5 border-t border-dashed ${isProfitable ? 'border-emerald-200' : 'border-red-200'}`}>
              <p className={`text-base font-semibold ${isProfitable ? 'text-emerald-600' : 'text-red-600'}`}>
                {formatCurrency(trueMonthlyProfit * 12)}
              </p>
              <span className={`text-xs font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${isProfitable ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>/year</span>
            </div>
          </div>
        </div>
        
        {/* Profit Insight */}
        {fixedCost > 0 && !revenueScenarios && (
          <p className="text-[oklch(0.50_0_0)] text-sm mt-4">
            {isProfitable ? (
              <>After all monthly costs, you keep <span className="text-emerald-600 font-medium">{formatCurrency(trueMonthlyProfit)}/month</span> — that's <span className="text-emerald-600 font-medium">{formatCurrency(trueMonthlyProfit * 12)}/year</span> profit</>
            ) : (
              <>After all monthly costs, you'd lose <span className="text-red-600 font-medium">{formatCurrency(Math.abs(trueMonthlyProfit))}/month</span> — {mode === 'purchase' ? 'consider a lower offer price or different loan terms' : 'consider negotiating rent or increasing rates'}</>
            )}
          </p>
        )}
        
        {/* Three-Tier Profit Projections */}
        {revenueScenarios && fixedCost > 0 && (
          <ThreeTierProjections
            scenarios={revenueScenarios}
            fixedCost={fixedCost}
            expensePercent={expensePercent}
            mode={mode}
            monthlyAdditionalCosts={monthlyAdditionalCosts}
          />
        )}
      </div>
    </div>
  );
}

/**
 * Three-Tier Profit Projections — Conservative (P50) / Target (P75) / Optimistic (P90)
 * Based on real comparable property data percentiles
 */
function ThreeTierProjections({
  scenarios,
  fixedCost,
  expensePercent,
  mode,
  monthlyAdditionalCosts = 0
}: {
  scenarios: { conservative: number; target: number; optimistic: number; source: string; compCount: number };
  fixedCost: number;
  expensePercent: number;
  mode: 'rent' | 'purchase';
  monthlyAdditionalCosts?: number; // Property tax + insurance + maintenance + utilities (purchase mode)
}) {
  // Use the target (P75) as the projection base — this aligns closer to the headline (top-3 avg)
  // The headline revenue is already the top-3-comp average; scenarios.target (P75) is the closest match
  // Using P90 here would show a HIGHER number than the headline, creating contradiction
  const projection = {
    annualRevenue: scenarios.target,
  };

  return (
    <div className="mt-6 pt-5 border-t border-[oklch(0.90_0.01_265)]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm font-semibold text-slate-800">
            Profit Projections — After All Monthly Costs
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            Based on {scenarios.compCount} comparable {scenarios.source === 'exact_match' ? 'properties (same bed/bath)' : 'properties (same bedrooms)'}
          </p>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <button className="p-1 hover:bg-slate-100 rounded-full transition-colors">
              <Info className="w-4 h-4 text-slate-400" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs p-3 bg-white text-[oklch(0.30_0_0)] shadow-lg border border-[oklch(0.90_0_0)]">
            <p className="text-sm leading-relaxed">
              This projection is based on real revenue data from top-performing comparable properties in your area.
              It reflects what the best operators achieve with optimized pricing, great reviews, and strong occupancy.
            </p>
          </TooltipContent>
        </Tooltip>
      </div>
      
      {(() => {
        const monthlyRevenue = projection.annualRevenue / 12;
        const monthlyExpenses = monthlyRevenue * (expensePercent / 100);
        const monthlyProfit = monthlyRevenue - fixedCost - monthlyExpenses - (mode === 'purchase' ? monthlyAdditionalCosts : 0);
        const annualProfit = monthlyProfit * 12;
        const isProfitable = monthlyProfit > 0;

        return (
          <div className="rounded-xl p-5 border bg-emerald-50 border-emerald-200 transition-shadow hover:shadow-md">
            {/* Label */}
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">
                Projection
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">
                Based on top performers
              </span>
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              {/* Monthly Revenue */}
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-wide">Monthly Revenue</p>
                <p className="text-xl font-bold text-emerald-700">
                  {formatCurrency(monthlyRevenue)}
                </p>
              </div>
              
              {/* Monthly Profit */}
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-wide">Monthly Profit</p>
                <p className={`text-xl font-bold ${isProfitable ? 'text-emerald-600' : 'text-red-600'}`}>
                  {isProfitable ? '+' : ''}{formatCurrency(monthlyProfit)}
                </p>
              </div>
              
              {/* Annual Profit */}
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-wide">Annual Profit</p>
                <p className={`text-xl font-bold ${isProfitable ? 'text-emerald-600' : 'text-red-600'}`}>
                  {isProfitable ? '+' : ''}{formatCurrency(annualProfit)}
                  <span className="text-[10px] font-medium ml-1">/year</span>
                </p>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

/**
 * Key Metrics Row - Supporting stats at a glance
 */
// Tooltip explanations for metrics (third-grader friendly)
const METRIC_TOOLTIPS = {
  adr: "This is how much you charge per night, on average. If you charge $200 one night and $300 another, your average is $250. Higher is better!",
  occupancy: "This shows how often your place is booked. 70% means guests stay 7 out of every 10 nights. More bookings = more money!",
  revenueRange: "This is the projected revenue range based on top-performing comparable properties in your area. Your actual results depend on your listing quality, pricing strategy, and guest reviews.",
  revenue: "Estimated annual revenue based on similar properties in your area. This is an average projection - your actual results depend on your listing quality, pricing strategy, and guest reviews.",
  revpar: "Average Daily Earnings - combines your nightly rate and how often you're booked into one number. Higher = better performance!"
};

function KeyMetricsRow({ 
  adr, 
  occupancy, 
  revenueLow, 
  revenueHigh,
  isOwner,
  occupancyOverrideActive,
  onOccupancyOverride,
  onSaveOccupancyOverride,
  isSavingOccupancyOverride,
  savedOccupancyOverrideFlash,
  hasPendingOccupancyOverride,
}: { 
  adr: number;
  occupancy: number;
  revenueLow: number;
  revenueHigh: number;
  isOwner?: boolean;
  occupancyOverrideActive?: boolean;
  onOccupancyOverride?: (newOccupancy: number | null) => void;
  onSaveOccupancyOverride?: (explicitValue?: number | null) => void;
  isSavingOccupancyOverride?: boolean;
  savedOccupancyOverrideFlash?: boolean;
  hasPendingOccupancyOverride?: boolean;
}) {
  const [isEditingOccupancy, setIsEditingOccupancy] = useState(false);
  const [occupancyInput, setOccupancyInput] = useState('');

  const commitOccupancyEdit = () => {
    const parsed = parseFloat(occupancyInput);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
      onOccupancyOverride?.(parsed);
      onSaveOccupancyOverride?.(parsed);
    }
    setIsEditingOccupancy(false);
    setOccupancyInput('');
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <MetricCard
        icon={<DollarSign className="w-5 h-5" />}
        label="Nightly Rate"
        value={formatCurrency(adr)}
        sublabel="Average Daily Rate"
        color="blue"
        tooltip={METRIC_TOOLTIPS.adr}
      />
      {/* Booking Rate card — editable by admin */}
      <div className={`bg-white border rounded-xl p-4 hover:shadow-md transition-shadow ${
        isOwner && onOccupancyOverride ? 'cursor-pointer' : 'cursor-help'
      } group ${
        occupancyOverrideActive ? 'border-amber-300 bg-amber-50/30' : 'border-slate-200'
      }`}>
        <div className="flex items-start justify-between">
          <div className="inline-flex p-2 rounded-lg mb-2 bg-purple-500/10 text-purple-500 border border-purple-500/20">
            <Percent className="w-5 h-5" />
          </div>
          <div className="flex items-center gap-1">
            {isOwner && onOccupancyOverride && occupancyOverrideActive && !isEditingOccupancy && (
              <button
                onClick={(e) => { e.stopPropagation(); onOccupancyOverride(null); onSaveOccupancyOverride?.(null); }}
                className="text-xs text-amber-600 hover:text-amber-800 px-1 py-0.5 rounded hover:bg-amber-100 transition-colors"
                title="Reset to original booking rate"
              >
                Reset
              </button>
            )}
            {isOwner && onOccupancyOverride && !isEditingOccupancy && (
              <button
                onClick={(e) => { e.stopPropagation(); setIsEditingOccupancy(true); setOccupancyInput(String(Math.round(occupancy))); }}
                className="text-slate-300 hover:text-purple-500 transition-colors"
                title="Edit booking rate"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
        <p className={`text-xs font-medium mb-0.5 ${
          isOwner && occupancyOverrideActive ? 'text-amber-700' : 'text-slate-500'
        }`}>Booking Rate</p>
        {isOwner && onOccupancyOverride && isEditingOccupancy ? (
          <div className="flex items-center gap-1 mt-1">
            <input
              type="number"
              min="0"
              max="100"
              step="1"
              value={occupancyInput}
              onChange={(e) => setOccupancyInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitOccupancyEdit();
                if (e.key === 'Escape') { setIsEditingOccupancy(false); setOccupancyInput(''); }
              }}
              onBlur={commitOccupancyEdit}
              autoFocus
              className="w-16 text-xl font-bold border-b-2 border-purple-400 bg-transparent outline-none text-slate-900"
            />
            <span className="text-xl font-bold text-slate-900">%</span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {/* Minus button: decrease by 5% */}
            {isOwner && onOccupancyOverride && !isEditingOccupancy && (
              <button
                onClick={(e) => { e.stopPropagation(); const newVal = Math.max(0, Math.round(occupancy) - 5); onOccupancyOverride(newVal); onSaveOccupancyOverride?.(newVal); }}
                className="w-6 h-6 rounded-full bg-red-100 hover:bg-red-200 text-red-700 flex items-center justify-center transition-colors border border-red-300 shadow-sm"
                title="Decrease booking rate by 5%"
              >
                <Minus className="w-3 h-3" />
              </button>
            )}
            <p
              className={`text-xl font-bold ${
                isOwner && occupancyOverrideActive ? 'text-amber-700' : 'text-slate-900'
              } ${isOwner && onOccupancyOverride ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
              onClick={() => {
                if (isOwner && onOccupancyOverride) {
                  setIsEditingOccupancy(true);
                  setOccupancyInput(String(Math.round(occupancy)));
                }
              }}
              title={isOwner && onOccupancyOverride ? 'Click to edit booking rate' : undefined}
            >
              {Math.round(occupancy)}%
              {isOwner && onOccupancyOverride && (
                <Pencil className="inline w-3 h-3 ml-1 text-slate-300" />
              )}
            </p>
            {/* Plus button: increase by 5% */}
            {isOwner && onOccupancyOverride && !isEditingOccupancy && (
              <button
                onClick={(e) => { e.stopPropagation(); const newVal = Math.min(100, Math.round(occupancy) + 5); onOccupancyOverride(newVal); onSaveOccupancyOverride?.(newVal); }}
                className="w-6 h-6 rounded-full bg-emerald-100 hover:bg-emerald-200 text-emerald-700 flex items-center justify-center transition-colors border border-emerald-300 shadow-sm"
                title="Increase booking rate by 5%"
              >
                <Plus className="w-3 h-3" />
              </button>
            )}
          </div>
        )}
        <p className="text-slate-400 text-xs">How often you're booked</p>
        {isOwner && occupancyOverrideActive && (
          <p className="text-amber-600 text-xs mt-1 font-medium">Admin override active</p>
        )}
        {savedOccupancyOverrideFlash && (
          <p className="text-emerald-600 text-xs mt-1 font-medium">✓ Saved</p>
        )}
      </div>
      <MetricCard
        icon={<TrendingUp className="w-5 h-5" />}
        label="Revenue Range"
        value={`${formatCompactCurrency(revenueLow)} – ${formatCompactCurrency(revenueHigh)}`}
        sublabel="Projected annual range"
        color="emerald"
        tooltip={METRIC_TOOLTIPS.revenueRange}
      />
    </div>
  );
}

function MetricCard({ 
  icon, 
  label, 
  value, 
  sublabel, 
  color,
  tooltip
}: { 
  icon: React.ReactNode;
  label: string;
  value: string;
  sublabel: string;
  color: 'blue' | 'purple' | 'amber' | 'emerald';
  tooltip?: string;
}) {
  const colorClasses = {
    blue: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    purple: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
    amber: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    emerald: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  };
  
  const cardContent = (
    <div className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-md transition-shadow cursor-help group">
      <div className="flex items-start justify-between">
        <div className={`inline-flex p-2 rounded-lg mb-2 ${colorClasses[color]}`}>
          {icon}
        </div>
        {tooltip && (
          <Info className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
        )}
      </div>
      <p className="text-slate-500 text-xs font-medium">{label}</p>
      <p className="text-xl font-bold text-slate-900">{value}</p>
      <p className="text-slate-400 text-xs">{sublabel}</p>
    </div>
  );
  
  if (tooltip) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          {cardContent}
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-center p-3 bg-white text-[oklch(0.30_0_0)] shadow-lg border border-[oklch(0.90_0_0)]">
          <p className="text-sm leading-relaxed">{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    );
  }
  
  return cardContent;
}

/**
 * Seasonal Forecast Chart - Comprehensive 12-month view with chart and table
 */
// Available metrics for the seasonal forecast
type MetricKey = 'revenue' | 'adr' | 'occupancy' | 'revpar';

const METRIC_CONFIG: Record<MetricKey, { label: string; format: (val: number) => string; color: string }> = {
  revenue: { label: 'Revenue', format: (val) => formatCurrency(val), color: 'emerald' },
  adr: { label: 'Nightly Rate', format: (val) => formatCurrency(val), color: 'blue' },
  occupancy: { label: 'Booking Rate', format: (val) => `${Math.round(val)}%`, color: 'purple' },
  revpar: { label: 'Avg Daily Earnings', format: (val) => formatCurrency(val), color: 'amber' },
};

function SeasonalForecast({ forecast, historicalData }: { forecast: MonthlyForecast[]; historicalData?: { months: Array<{ date: string; revenue: number; occupancy: number; adr: number }> } }) {
  const [viewMode, setViewMode] = useState<'chart' | 'table' | 'yoy'>('chart');
  
  if (!forecast || forecast.length === 0) return null;
  
  // Calculate RevPAR for each month (ADR × Occupancy / 100)
  const forecastWithRevpar = forecast.map(m => ({
    ...m,
    revpar: m.revpar ?? Math.round(m.adr * (m.occupancy / 100))
  }));
  
  // Calculate insights
  const maxRevenue = Math.max(...forecastWithRevpar.map(m => m.revenue));
  const minRevenue = Math.min(...forecastWithRevpar.map(m => m.revenue));
  const avgRevenue = forecastWithRevpar.reduce((sum, m) => sum + m.revenue, 0) / forecastWithRevpar.length;
  const avgOccupancy = forecastWithRevpar.reduce((sum, m) => sum + m.occupancy, 0) / forecastWithRevpar.length;
  const avgAdr = forecastWithRevpar.reduce((sum, m) => sum + m.adr, 0) / forecastWithRevpar.length;
  
  // Calculate YoY changes if historical data is available
  const getYoYChange = (month: MonthlyForecast & { revpar?: number }): { revenue: number | null; adr: number | null; occupancy: number | null; revpar: number | null } => {
    if (!historicalData?.months || historicalData.months.length === 0) {
      return { revenue: null, adr: null, occupancy: null, revpar: null };
    }
    
    const currentMonthNum = month.month.split('-')[1];
    const lastYearMonth = historicalData.months.find(h => {
      const hMonthNum = h.date.split('-')[1];
      return hMonthNum === currentMonthNum;
    });
    
    if (!lastYearMonth) return { revenue: null, adr: null, occupancy: null, revpar: null };
    
    const revenueChange = lastYearMonth.revenue > 0 
      ? ((month.revenue - lastYearMonth.revenue) / lastYearMonth.revenue) * 100 
      : null;
    const adrChange = lastYearMonth.adr > 0 
      ? ((month.adr - lastYearMonth.adr) / lastYearMonth.adr) * 100 
      : null;
    const occupancyChange = lastYearMonth.occupancy > 0 
      ? ((month.occupancy - lastYearMonth.occupancy) / lastYearMonth.occupancy) * 100 
      : null;
    
    const lastYearRevpar = lastYearMonth.adr * (lastYearMonth.occupancy / 100);
    const currentRevpar = month.revpar || (month.adr * (month.occupancy / 100));
    const revparChange = lastYearRevpar > 0 
      ? ((currentRevpar - lastYearRevpar) / lastYearRevpar) * 100 
      : null;
    
    return { revenue: revenueChange, adr: adrChange, occupancy: occupancyChange, revpar: revparChange };
  };
  
  // Sort months by revenue for ranking
  const sortedByRevenue = [...forecastWithRevpar].sort((a, b) => b.revenue - a.revenue);
  const peakMonths = sortedByRevenue.slice(0, 3);
  const slowMonths = sortedByRevenue.slice(-3).reverse();
  
  // Get bar color based on revenue intensity (green gradient)
  const getBarColor = (revenue: number) => {
    const ratio = maxRevenue > minRevenue ? (revenue - minRevenue) / (maxRevenue - minRevenue) : 0.5;
    // From light sage to rich emerald
    if (ratio >= 0.66) return 'bg-emerald-600';
    if (ratio >= 0.33) return 'bg-emerald-400';
    return 'bg-emerald-200';
  };
  
  // Format compact currency for bar labels
  const formatCompactCurrency = (value: number) => {
    if (value >= 1000) return `$${(value / 1000).toFixed(1)}k`;
    return `$${value}`;
  };
  
  // Seasonality spread
  const seasonalitySpread = avgRevenue > 0 ? Math.round(((maxRevenue - minRevenue) / avgRevenue) * 100) : 0;
  
  // Format YoY change display
  const formatYoYChange = (change: number | null) => {
    if (change === null) return null;
    const isPositive = change >= 0;
    return (
      <span className={`inline-flex items-center text-xs font-medium ${
        isPositive ? 'text-emerald-600' : 'text-red-500'
      }`} title="Compared to same month last year">
        {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
        {Math.abs(change).toFixed(1)}%
      </span>
    );
  };
  
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Monthly Earnings Forecast</h3>
          <p className="text-slate-500 text-sm">How much you can expect to earn each month</p>
        </div>
        <div className="flex items-center gap-2 bg-slate-100 rounded-lg p-1">
          <button
            onClick={() => setViewMode('chart')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
              viewMode === 'chart' 
                ? 'bg-white text-slate-900 shadow-sm' 
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Chart
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
              viewMode === 'table' 
                ? 'bg-white text-slate-900 shadow-sm' 
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Details
          </button>
          {historicalData?.months && historicalData.months.length > 0 && (
            <button
              onClick={() => setViewMode('yoy')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                viewMode === 'yoy' 
                  ? 'bg-white text-slate-900 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              vs Last Year
            </button>
          )}
        </div>
      </div>
      
      {/* Key Stats Row - Simple, 3 numbers */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="text-center p-3 bg-emerald-50 rounded-xl border border-emerald-100">
          <p className="text-emerald-600 text-xs font-medium mb-1">Avg Monthly Revenue</p>
          <p className="text-xl font-bold text-emerald-700">{formatCurrency(avgRevenue)}</p>
        </div>
        <div className="text-center p-3 bg-slate-50 rounded-xl border border-slate-100">
          <p className="text-slate-500 text-xs font-medium mb-1">Avg Nightly Rate</p>
          <p className="text-xl font-bold text-slate-800">{formatCurrency(avgAdr)}</p>
        </div>
        <div className="text-center p-3 bg-slate-50 rounded-xl border border-slate-100">
          <p className="text-slate-500 text-xs font-medium mb-1">Avg Booking Rate</p>
          <p className="text-xl font-bold text-slate-800">{Math.round(avgOccupancy)}%</p>
        </div>
      </div>
      
      {viewMode === 'chart' ? (
        /* ===== CHART VIEW - Clean revenue bars with dollar labels ===== */
        <>
          {/* Simple legend */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-emerald-600" />
                <span className="text-xs text-slate-500">Higher revenue</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-emerald-200" />
                <span className="text-xs text-slate-500">Lower revenue</span>
              </div>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-xs text-slate-400 cursor-help border-b border-dashed border-slate-300">
                  {seasonalitySpread}% seasonal swing
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs text-center p-3 bg-white text-slate-700 shadow-lg border border-slate-200">
                <p className="text-sm leading-relaxed">
                  The difference between your best and slowest months is {seasonalitySpread}% of the average. 
                  {seasonalitySpread > 50 ? ' This market has strong seasonality — plan your budget around slow months.' : 
                   seasonalitySpread > 25 ? ' Moderate seasonality — some months will be noticeably slower.' : 
                   ' Low seasonality — revenue stays relatively steady year-round.'}
                </p>
              </TooltipContent>
            </Tooltip>
          </div>
          
          {/* Bar Chart with dollar labels */}
          <div className="grid grid-cols-12 gap-1.5 items-end mb-1" style={{ height: '200px' }}>
            {forecastWithRevpar.slice(0, 12).map((month, idx) => {
              const heightPct = maxRevenue > 0 ? (month.revenue / maxRevenue) * 100 : 0;
              const isPeak = peakMonths.some(p => p.month === month.month);
              const isSlow = slowMonths.some(s => s.month === month.month);
              const yoyChange = getYoYChange(month);
              
              return (
                <div key={idx} className="flex flex-col items-center h-full justify-end group relative">
                  {/* Hover tooltip with full details */}
                  <div className="absolute bottom-full mb-2 hidden group-hover:block z-10">
                    <div className="bg-white text-slate-800 text-xs rounded-lg px-3 py-2.5 whitespace-nowrap shadow-xl border border-slate-200">
                      <p className="font-semibold text-sm mb-1.5">{formatMonth(month.month)}</p>
                      <div className="space-y-1">
                        <div className="flex justify-between gap-4">
                          <span className="text-slate-500">Revenue</span>
                          <span className="font-bold text-emerald-600">{formatCurrency(month.revenue)}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-slate-500">Nightly Rate</span>
                          <span className="font-medium">{formatCurrency(month.adr)}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-slate-500">Booking Rate</span>
                          <span className="font-medium">{Math.round(month.occupancy)}%</span>
                        </div>
                        {yoyChange.revenue !== null && (
                          <div className="flex justify-between gap-4 pt-1 mt-1 border-t border-slate-100">
                            <span className="text-slate-500">vs Last Year</span>
                            <span className={yoyChange.revenue >= 0 ? 'text-emerald-600 font-medium' : 'text-red-500 font-medium'}>
                              {yoyChange.revenue >= 0 ? '+' : ''}{yoyChange.revenue.toFixed(1)}%
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Dollar amount above bar */}
                  <div className={`text-[10px] font-semibold mb-1 ${
                    isPeak ? 'text-emerald-700' : isSlow ? 'text-slate-400' : 'text-slate-500'
                  }`}>
                    {formatCompactCurrency(month.revenue)}
                  </div>
                  
                  {/* Bar */}
                  <div 
                    className={`w-full rounded-t-md transition-all cursor-pointer hover:opacity-80 ${getBarColor(month.revenue)}`}
                    style={{ height: `${Math.max(heightPct, 10)}%` }}
                  />
                  
                  {/* Occupancy dot indicator */}
                  <div className="mt-1 flex items-center justify-center" title={`${Math.round(month.occupancy)}% booked`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${
                      month.occupancy >= 70 ? 'bg-emerald-500' : month.occupancy >= 50 ? 'bg-amber-400' : 'bg-red-300'
                    }`} />
                  </div>
                  
                  {/* Month label */}
                  <div className={`text-[10px] mt-0.5 font-medium ${
                    isPeak ? 'text-emerald-700' : isSlow ? 'text-slate-400' : 'text-slate-500'
                  }`}>
                    {formatMonth(month.month).substring(0, 3)}
                  </div>
                </div>
              );
            })}
          </div>
          
          {/* Occupancy legend */}
          <div className="flex items-center justify-center gap-4 mt-2 mb-0">
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="text-[10px] text-slate-400">70%+ booked</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              <span className="text-[10px] text-slate-400">50-70% booked</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-red-300" />
              <span className="text-[10px] text-slate-400">&lt;50% booked</span>
            </div>
          </div>
        </>
      ) : viewMode === 'yoy' ? (
        /* YoY Comparison Chart View */
        <>
          {historicalData?.months && historicalData.months.length > 0 ? (
            <>
              <div className="mb-4">
                <div className="flex items-center gap-4 mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-slate-700" />
                    <span className="text-xs text-slate-600 font-medium">This Year</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-slate-300" />
                    <span className="text-xs text-slate-600 font-medium">Last Year</span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-12 gap-1 h-48 items-end mb-2">
                {forecastWithRevpar.slice(0, 12).map((month, idx) => {
                  const currentMonthNum = month.month.split('-')[1];
                  const lastYearMonth = historicalData.months.find(h => {
                    const hMonthNum = h.date.split('-')[1];
                    return hMonthNum === currentMonthNum;
                  });
                  
                  const maxVal = Math.max(
                    maxRevenue,
                    ...(historicalData.months.map(m => m.revenue) || [])
                  );
                  
                  const currentHeightPct = maxVal > 0 ? (month.revenue / maxVal) * 100 : 0;
                  const lastYearHeightPct = lastYearMonth && maxVal > 0 
                    ? (lastYearMonth.revenue / maxVal) * 100 
                    : 0;
                  
                  const yoyChange = lastYearMonth && lastYearMonth.revenue > 0
                    ? ((month.revenue - lastYearMonth.revenue) / lastYearMonth.revenue) * 100
                    : null;
                  
                  return (
                    <div key={idx} className="flex flex-col items-center h-full justify-end group relative">
                      {/* Tooltip */}
                      <div className="absolute bottom-full mb-2 hidden group-hover:block z-10">
                        <div className="bg-white text-[oklch(0.30_0_0)] text-xs rounded-lg px-3 py-2 whitespace-nowrap shadow-lg border border-[oklch(0.90_0_0)]">
                          <p className="font-medium mb-2">{formatMonth(month.month)}</p>
                          <div className="space-y-1">
                            <div className="flex justify-between gap-4">
                              <span className="text-slate-400">This Year:</span>
                              <span className="text-emerald-300 font-medium">{formatCurrency(month.revenue)}</span>
                            </div>
                            {lastYearMonth && (
                              <div className="flex justify-between gap-4">
                                <span className="text-slate-400">Last Year:</span>
                                <span className="text-slate-300">{formatCurrency(lastYearMonth.revenue)}</span>
                              </div>
                            )}
                            {yoyChange !== null && (
                              <div className="flex justify-between gap-4 pt-1 border-t border-slate-700">
                                <span className="text-slate-400">Change:</span>
                                <span className={yoyChange >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                                  {yoyChange >= 0 ? '+' : ''}{yoyChange.toFixed(1)}%
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {/* Side-by-side bars */}
                      <div className="flex gap-0.5 w-full h-full items-end">
                        {/* Last Year Bar */}
                        <div 
                          className="flex-1 bg-slate-300 rounded-t transition-all"
                          style={{ height: `${Math.max(lastYearHeightPct, 4)}%` }}
                        />
                        {/* This Year Bar */}
                        <div 
                          className={`flex-1 rounded-t transition-all ${
                            yoyChange !== null && yoyChange >= 0 
                              ? 'bg-slate-700' 
                              : 'bg-slate-500'
                          }`}
                          style={{ height: `${Math.max(currentHeightPct, 4)}%` }}
                        />
                      </div>
                      
                      {/* YoY Change indicator */}
                      {yoyChange !== null && (
                        <div className={`text-[9px] font-bold mt-0.5 ${
                          yoyChange >= 0 ? 'text-emerald-600' : 'text-red-500'
                        }`}>
                          {yoyChange >= 0 ? '+' : ''}{yoyChange.toFixed(0)}%
                        </div>
                      )}
                      
                      {/* Month label */}
                      <div className="text-[10px] text-slate-500 font-medium">
                        {formatMonth(month.month).substring(0, 3)}
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {/* YoY Summary Stats */}
              <div className="grid grid-cols-3 gap-4 mt-4 p-4 bg-slate-50 rounded-xl">
                {(() => {
                  const currentYearTotal = forecastWithRevpar.slice(0, 12).reduce((sum, m) => sum + m.revenue, 0);
                  const lastYearTotal = historicalData.months.reduce((sum, m) => sum + m.revenue, 0);
                  const totalYoYChange = lastYearTotal > 0 
                    ? ((currentYearTotal - lastYearTotal) / lastYearTotal) * 100 
                    : null;
                  
                  const growthMonths = forecastWithRevpar.slice(0, 12).filter(month => {
                    const currentMonthNum = month.month.split('-')[1];
                    const lastYearMonth = historicalData.months.find(h => h.date.split('-')[1] === currentMonthNum);
                    return lastYearMonth && month.revenue > lastYearMonth.revenue;
                  }).length;
                  
                  return (
                    <>
                      <div className="text-center">
                        <p className="text-slate-500 text-xs mb-1">Annual Revenue Change</p>
                        <p className={`text-xl font-bold ${
                          totalYoYChange !== null && totalYoYChange >= 0 ? 'text-emerald-600' : 'text-red-500'
                        }`}>
                          {totalYoYChange !== null ? (
                            <>{totalYoYChange >= 0 ? '+' : ''}{totalYoYChange.toFixed(1)}%</>
                          ) : 'N/A'}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-slate-500 text-xs mb-1">Months Growing</p>
                        <p className="text-xl font-bold text-slate-900">{growthMonths}/12</p>
                      </div>
                      <div className="text-center">
                        <p className="text-slate-500 text-xs mb-1">Market Trend</p>
                        <p className={`text-xl font-bold flex items-center justify-center gap-1 ${
                          totalYoYChange !== null && totalYoYChange >= 5 ? 'text-emerald-600' :
                          totalYoYChange !== null && totalYoYChange <= -5 ? 'text-red-500' : 'text-amber-600'
                        }`}>
                          {totalYoYChange !== null && totalYoYChange >= 5 ? (
                            <><TrendingUp className="w-5 h-5" /> Growing</>
                          ) : totalYoYChange !== null && totalYoYChange <= -5 ? (
                            <><TrendingDown className="w-5 h-5" /> Declining</>
                          ) : (
                            <><Minus className="w-5 h-5" /> Stable</>
                          )}
                        </p>
                      </div>
                    </>
                  );
                })()}
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-slate-500">
              <p>Historical data not available for YoY comparison</p>
              <p className="text-sm mt-1">Try the Chart or Table view instead</p>
            </div>
          )}
        </>
      ) : (
        /* ===== TABLE VIEW - Clean details with all metrics ===== */
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-slate-200">
                <th className="text-left py-3 px-3 font-semibold text-slate-700">Month</th>
                <th className="text-right py-3 px-3 font-semibold text-slate-700">Revenue</th>
                <th className="text-right py-3 px-3 font-semibold text-slate-700">Nightly Rate</th>
                <th className="text-right py-3 px-3 font-semibold text-slate-700">Booking Rate</th>
                {historicalData?.months && historicalData.months.length > 0 && (
                  <th className="text-right py-3 px-3 font-semibold text-slate-700">vs Last Year</th>
                )}
              </tr>
            </thead>
            <tbody>
              {forecastWithRevpar.slice(0, 12).map((month, idx) => {
                const isPeak = peakMonths.some(p => p.month === month.month);
                const isSlow = slowMonths.some(s => s.month === month.month);
                const yoyChange = getYoYChange(month);
                
                return (
                  <tr key={idx} className={`border-b border-slate-100 ${
                    isPeak ? 'bg-emerald-50' : isSlow ? 'bg-slate-50' : ''
                  }`}>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-900">{formatMonth(month.month)}</span>
                        {isPeak && <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded">BEST</span>}
                        {isSlow && <span className="text-[10px] font-semibold text-slate-500 bg-slate-200 px-1.5 py-0.5 rounded">SLOW</span>}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <span className={`font-bold ${isPeak ? 'text-emerald-700' : 'text-slate-900'}`}>{formatCurrency(month.revenue)}</span>
                    </td>
                    <td className="py-3 px-3 text-right text-slate-700">{formatCurrency(month.adr)}</td>
                    <td className="py-3 px-3 text-right">
                      <span className={`font-medium ${
                        month.occupancy >= 70 ? 'text-emerald-600' : month.occupancy >= 50 ? 'text-amber-600' : 'text-red-500'
                      }`}>
                        {Math.round(month.occupancy)}%
                      </span>
                    </td>
                    {historicalData?.months && historicalData.months.length > 0 && (
                      <td className="py-3 px-3 text-right">
                        {formatYoYChange(yoyChange.revenue)}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      
      {/* Best & Slowest Months - Clear, visual summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6 pt-5 border-t border-slate-200">
        <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-emerald-600" />
            <p className="text-sm font-semibold text-emerald-700">Best Earning Months</p>
          </div>
          <div className="space-y-2">
            {peakMonths.map((m, i) => (
              <div key={i} className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-emerald-600 bg-emerald-100 w-5 h-5 rounded-full flex items-center justify-center">{i + 1}</span>
                  <span className="text-sm font-medium text-slate-800">{formatMonth(m.month)}</span>
                </div>
                <span className="text-sm font-bold text-emerald-700">{formatCurrency(m.revenue)}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
          <div className="flex items-center gap-2 mb-3">
            <TrendingDown className="w-4 h-4 text-slate-500" />
            <p className="text-sm font-semibold text-slate-600">Slowest Months</p>
          </div>
          <div className="space-y-2">
            {slowMonths.map((m, i) => (
              <div key={i} className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-500 bg-slate-200 w-5 h-5 rounded-full flex items-center justify-center">{i + 1}</span>
                  <span className="text-sm font-medium text-slate-700">{formatMonth(m.month)}</span>
                </div>
                <span className="text-sm font-bold text-slate-600">{formatCurrency(m.revenue)}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-400 mt-3 pt-2 border-t border-slate-200">
            Plan your budget around these months — save from peak months to cover slow periods.
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Rent Validation Section - First thing investors want to know: "Is my rent assumption valid?"
 * Now includes expandable dropdown with full Rentometer data (nearby comps, property rents, stats)
 */
function RentValidationSection({
  rentometerData,
  monthlyRent,
  mode = 'rent'
}: {
  rentometerData: {
    median: number;
    percentile25: number;
    percentile75: number;
    min: number;
    max: number;
    mean?: number;
    stdDev?: number;
    sampleCount: number;
    radiusMiles?: number;
    userRentVsMarket: 'below' | 'at' | 'above';
    rentAdvantage: number;
    percentileRank: number;
    quickviewUrl?: string;
    nearbyComps?: Array<{
      address: string;
      price: number;
      bedrooms: number;
      baths: string;
      property_type: string;
      distance: number;
      sqft: number;
      last_seen: string;
    }>;
    propertyRents?: Array<{
      bedrooms: number;
      baths: string;
      price: number;
      sqft: number;
      last_seen: string;
    }>;
  };
  monthlyRent: number;
  mode?: 'rent' | 'purchase';
}) {
  const [showDetails, setShowDetails] = useState(false);
  const [detailTab, setDetailTab] = useState<'stats' | 'comps' | 'history'>('stats');

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const hasNearbyComps = rentometerData.nearbyComps && rentometerData.nearbyComps.length > 0;
  const hasPropertyRents = rentometerData.propertyRents && rentometerData.propertyRents.length > 0;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6">
      {/* Section Headline - Why this matters */}
      <p className="text-sm text-slate-600 mb-3 font-medium">
        {mode === 'purchase'
          ? 'What are similar properties renting for in this area?'
          : 'How does your rent compare to similar properties in the area?'}
      </p>
      
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Home className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-slate-900">{mode === 'purchase' ? 'Area Rental Rates' : 'Rent Validation'}</h3>
        </div>
        <span className="text-sm text-slate-400">{rentometerData.sampleCount} rental comps</span>
      </div>
      
      {/* Main Status */}
      {mode === 'purchase' ? (
        <div className="p-4 rounded-xl mb-4 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-700 mb-1">Median Long-Term Rent</p>
              <p className="text-2xl font-bold text-slate-900">
                {formatCurrency(rentometerData.median)}<span className="text-base font-normal text-slate-500">/mo</span>
              </p>
              <p className="text-sm text-slate-600 mt-1">
                Properties like this one rent for {formatCurrency(rentometerData.percentile25)} – {formatCurrency(rentometerData.percentile75)}/mo
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-blue-700">{formatCurrency(rentometerData.median * 12)}</p>
              <p className="text-xs text-blue-600">potential annual rental income</p>
            </div>
          </div>
        </div>
      ) : (
        <div className={`p-4 rounded-xl mb-4 ${
          rentometerData.userRentVsMarket === 'below' 
            ? 'bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200' 
            : rentometerData.userRentVsMarket === 'above'
            ? 'bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200'
            : 'bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-slate-900">
                {formatCurrency(monthlyRent)}<span className="text-base font-normal text-slate-500">/mo</span>
              </p>
              <p className={`text-sm font-medium ${
                rentometerData.userRentVsMarket === 'below' 
                  ? 'text-emerald-700' 
                  : rentometerData.userRentVsMarket === 'above'
                  ? 'text-amber-700'
                  : 'text-blue-700'
              }`}>
                {rentometerData.percentileRank <= 25
                  ? `Bottom 25% of market — Great deal!`
                  : rentometerData.percentileRank <= 50
                  ? `Below median — Good deal`
                  : rentometerData.percentileRank <= 75
                  ? `Above median — Fair price`
                  : `Top 25% — Premium rent`
                }
              </p>
            </div>
            {rentometerData.userRentVsMarket === 'below' && rentometerData.rentAdvantage > 0 && (
              <div className="text-right">
                <p className="text-2xl font-bold text-emerald-600">+{formatCurrency(rentometerData.rentAdvantage * 12)}</p>
                <p className="text-xs text-emerald-600">annual rent savings vs median</p>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Key Comparison Stats - Simplified for layman understanding */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="text-center p-3 bg-emerald-50 rounded-lg border border-emerald-200">
          <p className="text-xs text-emerald-600 font-medium mb-1">{mode === 'purchase' ? 'Low End' : 'Budget Rent'}</p>
          <p className="text-lg font-semibold text-emerald-700">{formatCurrency(rentometerData.percentile25)}</p>
          <p className="text-[10px] text-emerald-500">Lower 25%</p>
        </div>
        <div className="text-center p-3 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-xs text-blue-600 font-medium mb-1">{mode === 'purchase' ? 'Market Rate' : 'Typical Rent'}</p>
          <p className="text-lg font-semibold text-blue-700">{formatCurrency(rentometerData.median)}</p>
          <p className="text-[10px] text-blue-500">Average</p>
        </div>
        <div className="text-center p-3 bg-amber-50 rounded-lg border border-amber-200">
          <p className="text-xs text-amber-600 font-medium mb-1">{mode === 'purchase' ? 'High End' : 'Premium Rent'}</p>
          <p className="text-lg font-semibold text-amber-700">{formatCurrency(rentometerData.percentile75)}</p>
          <p className="text-[10px] text-amber-500">Upper 25%</p>
        </div>
      </div>
      
      <p className="text-xs text-slate-500 text-center mt-2">
        Based on {rentometerData.sampleCount} similar {mode === 'purchase' ? 'properties' : 'rentals'} within {rentometerData.radiusMiles != null ? rentometerData.radiusMiles : '?'} miles
      </p>

      {/* Expandable Detailed Data Dropdown */}
      <button
        onClick={() => setShowDetails(!showDetails)}
        className="w-full mt-4 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-all duration-200 text-sm font-medium text-slate-600 hover:text-slate-800"
      >
        {showDetails ? (
          <>
            <ChevronUp className="w-4 h-4" />
            Hide Detailed Market Data
          </>
        ) : (
          <>
            <ChevronDown className="w-4 h-4" />
            View Detailed Market Data
            {hasNearbyComps && <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">{rentometerData.nearbyComps!.length} comps</span>}
          </>
        )}
      </button>

      {showDetails && (
        <div className="mt-4 border-t border-slate-200 pt-4 animate-in fade-in slide-in-from-top-2 duration-300">
          {/* Tab Navigation */}
          <div className="flex gap-1 mb-4 bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => setDetailTab('stats')}
              className={`flex-1 py-2 px-3 rounded-md text-xs font-medium transition-all ${
                detailTab === 'stats'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Full Statistics
            </button>
            {hasNearbyComps && (
              <button
                onClick={() => setDetailTab('comps')}
                className={`flex-1 py-2 px-3 rounded-md text-xs font-medium transition-all ${
                  detailTab === 'comps'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Nearby Comps ({rentometerData.nearbyComps!.length})
              </button>
            )}
            {hasPropertyRents && (
              <button
                onClick={() => setDetailTab('history')}
                className={`flex-1 py-2 px-3 rounded-md text-xs font-medium transition-all ${
                  detailTab === 'history'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Rent History ({rentometerData.propertyRents!.length})
              </button>
            )}
          </div>

          {/* Tab Content: Full Statistics */}
          {detailTab === 'stats' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Mean Rent</p>
                  <p className="text-lg font-semibold text-slate-800">{formatCurrency(rentometerData.mean || rentometerData.median)}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Std Deviation</p>
                  <p className="text-lg font-semibold text-slate-800">{rentometerData.stdDev != null ? `±${formatCurrency(rentometerData.stdDev)}` : 'N/A'}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Lowest Rent</p>
                  <p className="text-lg font-semibold text-emerald-700">{formatCurrency(rentometerData.min)}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Highest Rent</p>
                  <p className="text-lg font-semibold text-amber-700">{formatCurrency(rentometerData.max)}</p>
                </div>
              </div>

              {/* Rent Distribution Bar */}
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-3">Rent Distribution</p>
                <div className="relative h-8 bg-gradient-to-r from-emerald-200 via-blue-200 to-amber-200 rounded-full overflow-hidden">
                  {/* User rent marker */}
                  {(() => {
                    const range = rentometerData.max - rentometerData.min;
                    const position = range > 0 ? ((monthlyRent - rentometerData.min) / range) * 100 : 50;
                    const clampedPos = Math.max(2, Math.min(98, position));
                    return (
                      <div
                        className="absolute top-0 h-full w-0.5 bg-slate-900"
                        style={{ left: `${clampedPos}%` }}
                      >
                        <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[9px] px-1.5 py-0.5 rounded whitespace-nowrap">
                          {mode === 'purchase' ? 'Median' : 'You'}: {formatCurrency(mode === 'purchase' ? rentometerData.median : monthlyRent)}
                        </div>
                      </div>
                    );
                  })()}
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-[10px] text-slate-500">{formatCurrency(rentometerData.min)}</span>
                  <span className="text-[10px] text-slate-500">{formatCurrency(rentometerData.max)}</span>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Analysis Radius</p>
                <p className="text-sm text-slate-700">{rentometerData.radiusMiles != null ? rentometerData.radiusMiles : '?'} miles &middot; {rentometerData.sampleCount} comparable rentals analyzed</p>
              </div>

              {rentometerData.quickviewUrl && (
                <a
                  href={rentometerData.quickviewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 py-2 px-4 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 transition-all text-sm font-medium text-blue-700"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  View Full Report on Rentometer
                </a>
              )}
            </div>
          )}

          {/* Tab Content: Nearby Comps */}
          {detailTab === 'comps' && hasNearbyComps && (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {rentometerData.nearbyComps!.map((comp, i) => (
                <div key={i} className="p-3 bg-slate-50 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-800 truncate">{comp.address}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-xs text-slate-500">{comp.bedrooms}BR/{comp.baths}BA</span>
                        <span className="text-xs text-slate-400">&middot;</span>
                        <span className="text-xs text-slate-500">{comp.property_type || 'N/A'}</span>
                        {comp.sqft > 0 && (
                          <>
                            <span className="text-xs text-slate-400">&middot;</span>
                            <span className="text-xs text-slate-500">{comp.sqft.toLocaleString()} sqft</span>
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        <span className="text-xs text-slate-500">{comp.distance.toFixed(1)} mi away</span>
                        <span className="text-xs text-slate-400">&middot;</span>
                        <span className="text-xs text-slate-500">Last seen: {comp.last_seen}</span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-lg font-bold text-slate-900">{formatCurrency(comp.price)}</p>
                      <p className="text-[10px] text-slate-500">/mo</p>
                    </div>
                  </div>
                </div>
              ))}
              {rentometerData.nearbyComps!.length > 0 && (
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-xs text-blue-700 font-medium">
                    Average nearby rent: {formatCurrency(Math.round(rentometerData.nearbyComps!.reduce((s, c) => s + c.price, 0) / rentometerData.nearbyComps!.length))}/mo
                    &nbsp;&middot;&nbsp;
                    Closest comp: {formatCurrency(rentometerData.nearbyComps![0].price)}/mo ({rentometerData.nearbyComps![0].distance.toFixed(2)} mi)
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Tab Content: Property Rent History */}
          {detailTab === 'history' && hasPropertyRents && (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              <p className="text-xs text-slate-500 mb-2">Recent rent listings at this specific property address:</p>
              {rentometerData.propertyRents!.map((rent, i) => (
                <div key={i} className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{rent.bedrooms}BR / {rent.baths}BA</p>
                    <div className="flex items-center gap-2 mt-1">
                      {rent.sqft > 0 && <span className="text-xs text-slate-500">{rent.sqft.toLocaleString()} sqft</span>}
                      <span className="text-xs text-slate-400">Last seen: {rent.last_seen}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-slate-900">{formatCurrency(rent.price)}</p>
                    <p className="text-[10px] text-slate-500">/mo</p>
                  </div>
                </div>
              ))}
              {rentometerData.propertyRents!.length > 0 && (
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-xs text-blue-700 font-medium">
                    Average listed rent at property: {formatCurrency(Math.round(rentometerData.propertyRents!.reduce((s, r) => s + r.price, 0) / rentometerData.propertyRents!.length))}/mo
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Airbnb vs Long-Term Rental Comparison
 * Shows the financial advantage of short-term rentals over traditional long-term rentals
 */
function AirbnbVsLongTermComparison({
  annualAirbnbRevenue,
  monthlyRent,
  rentometerMedian,
  expensePercent = 20,
  mode = 'rent',
  monthlyMortgage = 0,
  monthlyAdditionalCosts = 0
}: {
  annualAirbnbRevenue: number;
  monthlyRent: number;
  rentometerMedian?: number;
  expensePercent?: number;
  mode?: 'rent' | 'purchase';
  monthlyMortgage?: number;
  monthlyAdditionalCosts?: number;
}) {
  // Calculate long-term rental income (what you'd earn as a landlord)
  // Use Rentometer median if available, otherwise use user's rent as proxy
  const monthlyLongTermIncome = rentometerMedian || monthlyRent;
  const annualLongTermIncome = monthlyLongTermIncome * 12;
  
  // Calculate Airbnb net income (after expenses)
  const airbnbExpenses = annualAirbnbRevenue * (expensePercent / 100);
  // In purchase mode, also subtract mortgage and additional costs from Airbnb net
  const annualMortgageAndCosts = mode === 'purchase' ? (monthlyMortgage + monthlyAdditionalCosts) * 12 : 0;
  const annualAirbnbNet = annualAirbnbRevenue - airbnbExpenses - annualMortgageAndCosts;
  
  // Long-term rental expenses (typically 5-10% for maintenance, vacancy, etc.)
  const longTermExpenseRate = 0.08; // 8% average
  // In purchase mode, subtract mortgage and property costs from long-term net too
  const annualLongTermNet = annualLongTermIncome * (1 - longTermExpenseRate) - annualMortgageAndCosts;
  
  // Calculate the difference
  const annualDifference = annualAirbnbNet - annualLongTermNet;
  const percentageIncrease = annualLongTermNet > 0 
    ? ((annualAirbnbNet - annualLongTermNet) / annualLongTermNet) * 100 
    : 0;
  
  const isAirbnbBetter = annualDifference > 0;
  
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6">
      {/* Section Headline - Why this matters */}
      <p className="text-sm text-slate-600 mb-3 font-medium">
        Short-Term vs Long-Term — Which strategy earns more?
      </p>
      
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-5 h-5 text-purple-600" />
        <h3 className="text-lg font-semibold text-slate-900">Short-Term vs Long-Term Income</h3>
        <Tooltip>
          <TooltipTrigger asChild>
            <button className="p-1 hover:bg-slate-100 rounded-full transition-colors">
              <Info className="w-4 h-4 text-slate-400" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs p-3 bg-white text-[oklch(0.30_0_0)] shadow-lg border border-[oklch(0.90_0_0)]">
            <p className="text-sm leading-relaxed">
              Compares short-term rental income (Airbnb) vs traditional long-term rental income for this property.
              Works for both property owners and rental arbitrage operators.
            </p>
          </TooltipContent>
        </Tooltip>
      </div>
      
      {/* Comparison Cards */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Airbnb Column */}
        <div className={`p-4 rounded-xl ${isAirbnbBetter ? 'bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-300' : 'bg-slate-50 border border-slate-200'}`}>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-rose-500 to-pink-500 flex items-center justify-center">
              <span className="text-white text-xs font-bold">A</span>
            </div>
            <span className="text-sm font-medium text-slate-700">Short-Term (Airbnb)</span>
            {isAirbnbBetter && (
              <span className="ml-auto px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-medium rounded-full">Winner</span>
            )}
          </div>
          <p className="text-2xl font-bold text-slate-900">{formatCurrency(annualAirbnbNet)}</p>
          <p className="text-xs text-slate-500">Annual net income (after {expensePercent}% expenses)</p>
          <div className="mt-2 pt-2 border-t border-slate-200">
            <p className="text-xs text-slate-400">Gross: {formatCurrency(annualAirbnbRevenue)}</p>
            <p className="text-xs text-slate-400">Expenses: -{formatCurrency(airbnbExpenses)}</p>
          </div>
        </div>
        
        {/* Long-Term Column */}
        <div className={`p-4 rounded-xl ${!isAirbnbBetter ? 'bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-300' : 'bg-slate-50 border border-slate-200'}`}>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center">
              <Home className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-medium text-slate-700">Long-Term Tenant</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="p-0.5 hover:bg-blue-100 rounded-full transition-colors">
                  <Info className="w-3 h-3 text-slate-400" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs p-3 bg-[#0F172A] text-white shadow-lg border-0">
                <p className="text-sm leading-relaxed">
                  {rentometerMedian 
                    ? `Based on market data: The median rent for similar properties in this area is $${rentometerMedian.toLocaleString()}/month.`
                    : `Using your entered rent amount as the baseline for comparison.`
                  }
                </p>
              </TooltipContent>
            </Tooltip>
            {!isAirbnbBetter && (
              <span className="ml-auto px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">Winner</span>
            )}
          </div>
          <p className="text-2xl font-bold text-slate-900">{formatCurrency(annualLongTermNet)}</p>
          <p className="text-xs text-slate-500">Annual net income (after 8% expenses)</p>
          <div className="mt-2 pt-2 border-t border-slate-200">
            <p className="text-xs text-slate-400">Gross: {formatCurrency(annualLongTermIncome)}</p>
            <p className="text-xs text-slate-400">Expenses: -{formatCurrency(annualLongTermIncome * longTermExpenseRate)}</p>
          </div>
        </div>
      </div>
      
      {/* Summary */}
      <div className={`p-4 rounded-xl ${isAirbnbBetter ? 'bg-emerald-100' : 'bg-blue-100'}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className={`text-sm font-medium ${isAirbnbBetter ? 'text-emerald-800' : 'text-blue-800'}`}>
              {isAirbnbBetter ? 'Short-Term Wins' : 'Long-Term Wins'}
            </p>
            <p className={`text-2xl font-bold ${isAirbnbBetter ? 'text-emerald-700' : 'text-blue-700'}`}>
              +{formatCurrency(Math.abs(annualDifference))}/year
            </p>
          </div>
          <div className="text-right">
            <p className={`text-3xl font-bold ${isAirbnbBetter ? 'text-emerald-600' : 'text-blue-600'}`}>
              {Math.abs(percentageIncrease).toFixed(0)}%
            </p>
            <p className="text-xs text-slate-600">more income</p>
          </div>
        </div>
        {isAirbnbBetter && (
          <p className="text-xs text-emerald-700 mt-2">
            That's {formatCurrency(Math.abs(annualDifference) / 12)}/month extra with short-term rentals
          </p>
        )}
      </div>
      
      {/* Considerations */}
      <div className="mt-4 p-3 bg-slate-50 rounded-lg">
        <p className="text-xs text-slate-500">
          <span className="font-medium">Note:</span> Airbnb requires more active management, furnishing costs, and has variable income. 
          Long-term rentals offer stable, passive income with less work. Consider your time and goals.
        </p>
      </div>
    </div>
  );
}

/**
 * Revenue Projection Range
 * Shows the projected revenue based on top-performing comparable properties
 */
function RevenuePercentileProjections({
  revenueData,
  bedrooms
}: {
  revenueData: { projected: number; low: number; high: number };
  bedrooms?: number;
}) {
  const { projected, low, high } = revenueData;
  
  // Don't show if we don't have valid data
  if (!projected || projected <= 0) return null;
  
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6">
      {/* Section Headline */}
      <p className="text-sm text-slate-600 mb-3 font-medium">
        What can you realistically expect to earn{bedrooms ? ` with this ${bedrooms}BR property` : ''}?
      </p>
      
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-5 h-5 text-emerald-600" />
        <h3 className="text-lg font-semibold text-slate-900">
          Revenue Projection
        </h3>
        <Tooltip>
          <TooltipTrigger asChild>
            <button className="p-1 hover:bg-slate-100 rounded-full transition-colors">
              <Info className="w-4 h-4 text-slate-400" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs p-3 bg-white text-[oklch(0.30_0_0)] shadow-lg border border-[oklch(0.90_0_0)]">
            <p className="text-sm leading-relaxed">
              This projection is based on the average revenue of the top-performing comparable properties in your area.
              The range shows the lowest to highest earner among those top comps.
            </p>
          </TooltipContent>
        </Tooltip>
      </div>
      
      {/* Single Projection Card — uses headline revenue (top-3 avg), NOT high */}
      <div className="rounded-xl p-5 border bg-emerald-50 border-emerald-200 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">Projection</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">Average of top comps</span>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wide">Annual Revenue</p>
            <p className="text-2xl font-bold text-emerald-700">{formatCompactCurrency(projected)}</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wide">Monthly Revenue</p>
            <p className="text-2xl font-bold text-emerald-700">{formatCompactCurrency(projected / 12)}</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wide">Top Comp Range</p>
            <p className="text-sm font-bold text-emerald-700">{formatCompactCurrency(low)} – {formatCompactCurrency(high)}</p>
          </div>
        </div>
      </div>
      
      {/* Upside Potential — shows how much more the best comp earns vs the average */}
      {high > projected && (
      <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-indigo-700">Best Comp Upside</p>
            <p className="text-2xl font-bold text-indigo-800">+{formatCompactCurrency(high - projected)}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-indigo-600">+{Math.round(((high - projected) / projected) * 100)}% above projection</p>
            <p className="text-xs text-indigo-500">With optimized pricing and reviews</p>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}

/**
 * Arbitrage Calculator - Break-even and investment recoup analysis
 */
function ArbitrageCalculator({ 
  monthlyRevenue, 
  monthlyRent, 
  occupancy,
  adr,
  furnitureCost = 0,
  expensePercent = 20,
  revenueScenarios
}: { 
  monthlyRevenue: number;
  monthlyRent: number;
  occupancy: number;
  adr: number;
  furnitureCost?: number;
  expensePercent?: number;
  revenueScenarios?: { conservative: number; target: number; optimistic: number; source: string; compCount: number };
}) {
  // Calculate expenses as percentage of revenue
  const monthlyExpenses = monthlyRevenue * (expensePercent / 100);
  
  // Calculate true monthly profit (revenue - rent - expenses)
  const trueMonthlyProfit = monthlyRevenue - monthlyRent - monthlyExpenses;
  
  // Calculate months to recoup furniture investment
  const monthsToRecoup = furnitureCost > 0 && trueMonthlyProfit > 0
    ? Math.ceil(furnitureCost / trueMonthlyProfit)
    : furnitureCost > 0 && trueMonthlyProfit <= 0
    ? Infinity
    : 0;
  
  // Calculate break-even occupancy (to cover rent + expenses)
  // Monthly Revenue = ADR * Days * Occupancy
  // Break-even: (Rent + Expenses) = ADR * 30 * BreakEvenOcc * (1 - expensePercent/100)
  // Simplified: Rent = ADR * 30 * BreakEvenOcc * (1 - expensePercent/100)
  const effectiveRate = adr * 30 * (1 - expensePercent / 100);
  const breakEvenOccupancy = monthlyRent > 0 && effectiveRate > 0 
    ? (monthlyRent / effectiveRate) * 100 
    : 0;
  
  // Calculate cushion
  const occupancyCushion = occupancy - breakEvenOccupancy;
  
  // Risk scenario: 20% drop in occupancy
  const riskOccupancy = occupancy * 0.8;
  const riskRevenue = (riskOccupancy / 100) * adr * 30;
  const riskExpenses = riskRevenue * (expensePercent / 100);
  const riskProfit = riskRevenue - monthlyRent - riskExpenses;
  
  // Calculate annual ROI percentage
  const annualProfit = trueMonthlyProfit * 12;
  const annualROI = furnitureCost > 0 ? (annualProfit / furnitureCost) * 100 : 0;
  
  // Get ROI rating message
  const getROIRating = () => {
    if (annualROI >= 100) return { label: 'Exceptional', color: 'emerald', message: 'You could 2x your investment in year one' };
    if (annualROI >= 50) return { label: 'Excellent', color: 'emerald', message: 'Outperforms most investment vehicles' };
    if (annualROI >= 30) return { label: 'Strong', color: 'emerald', message: 'Better than real estate appreciation' };
    if (annualROI >= 15) return { label: 'Good', color: 'amber', message: 'Competitive with stock market returns' };
    return { label: 'Moderate', color: 'slate', message: 'Consider optimizing pricing or expenses' };
  };
  const roiRating = getROIRating();
  
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <h3 className="text-lg font-semibold text-slate-900">Investment Analysis</h3>
        {furnitureCost > 0 && (
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
            roiRating.color === 'emerald' 
              ? 'bg-emerald-100 text-emerald-700'
              : roiRating.color === 'amber'
              ? 'bg-amber-100 text-amber-700'
              : 'bg-slate-100 text-slate-700'
          }`}>
            {roiRating.label} ROI
          </span>
        )}
      </div>
      
      <div className="space-y-4">
        {/* ROI & Payback Period */}
        {furnitureCost > 0 && (() => {
          // Calculate how long other investments would take to generate the same annual profit
          const stockMarketYears = annualProfit > 0 ? Math.ceil(annualProfit / (furnitureCost * 0.10)) : 999;
          const realEstateYears = annualProfit > 0 ? Math.ceil(annualProfit / (furnitureCost * 0.05)) : 999;
          const savingsYears = annualProfit > 0 ? Math.ceil(annualProfit / (furnitureCost * 0.04)) : 999;
          
          return (
          <div className="p-5 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl border border-emerald-200">
            {/* Header */}
            <p className="text-sm font-semibold text-slate-800 mb-4">Investment Return</p>
            
            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-white/70 rounded-xl p-3">
                <p className="text-[11px] text-slate-500 uppercase tracking-wide">Setup Cost</p>
                <p className="text-xl font-bold text-slate-800">{formatCurrency(furnitureCost)}</p>
              </div>
              <div className="bg-white/70 rounded-xl p-3">
                <p className="text-[11px] text-slate-500 uppercase tracking-wide">Monthly Profit</p>
                <p className="text-xl font-bold text-emerald-600">{formatCurrency(trueMonthlyProfit)}</p>
              </div>
              <div className="bg-white/70 rounded-xl p-3">
                <p className="text-[11px] text-slate-500 uppercase tracking-wide">Annual Gross Profit</p>
                <p className="text-xl font-bold text-emerald-600">{formatCurrency(annualProfit)}</p>
              </div>
              <div className="bg-white/70 rounded-xl p-3">
                <p className="text-[11px] text-slate-500 uppercase tracking-wide">ROI</p>
                <p className="text-xl font-bold text-emerald-600">{Math.round(annualROI)}%</p>
              </div>
            </div>

            {/* Comparison Chart */}
            <div className="bg-white/70 rounded-xl p-4">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">
                To earn {formatCurrency(annualProfit)}/year from {formatCurrency(furnitureCost)}, other investments would take:
              </p>
              <div className="space-y-3">
                {/* Your Airbnb */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-emerald-500" />
                    <span className="text-sm font-medium text-slate-700">Your Airbnb</span>
                  </div>
                  <span className="text-sm font-bold text-emerald-600">Year 1</span>
                </div>
                
                {/* Stock Market */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-slate-300" />
                    <span className="text-sm text-slate-600">Stock Market (S&P 500)</span>
                  </div>
                  <span className="text-sm text-slate-500">
                    {stockMarketYears >= 999 ? '—' : `${stockMarketYears}+ years`}
                  </span>
                </div>
                
                {/* Real Estate */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-slate-300" />
                    <span className="text-sm text-slate-600">Real Estate Appreciation</span>
                  </div>
                  <span className="text-sm text-slate-500">
                    {realEstateYears >= 999 ? '—' : `${realEstateYears}+ years`}
                  </span>
                </div>
                
                {/* Savings */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-slate-300" />
                    <span className="text-sm text-slate-600">High-Yield Savings</span>
                  </div>
                  <span className="text-sm text-slate-500">
                    {savingsYears >= 999 ? '—' : `${savingsYears}+ years`}
                  </span>
                </div>
              </div>
            </div>
          </div>
        );})()}
        


        {/* Profit Potential — By Scenario */}
        {revenueScenarios && furnitureCost > 0 && (() => {
          const calcTierProfit = (annualRevenue: number) => {
            const monthlyRev = annualRevenue / 12;
            const monthlyExp = monthlyRev * (expensePercent / 100);
            const monthlyProfit = monthlyRev - monthlyRent - monthlyExp;
            const annualGross = monthlyProfit * 12;
            return { monthlyProfit, annualGross };
          };
          const top = calcTierProfit(revenueScenarios.target);
          return (
            <div className="pt-4 border-t border-slate-200">
              <div className="mb-4">
                <p className="text-sm font-semibold text-slate-800">Profit Projection</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Based on {revenueScenarios.compCount} comparable {revenueScenarios.source === 'exact_match' ? 'properties (same bed/bath)' : 'properties (same bedrooms)'}
                </p>
              </div>
              <div className="rounded-xl p-5 border bg-emerald-50 border-emerald-200 transition-shadow hover:shadow-md">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">Projection</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">Based on top performers</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wide">Monthly Profit</p>
                    <p className={`text-2xl font-bold ${top.monthlyProfit > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {top.monthlyProfit > 0 ? '+' : ''}{formatCurrency(top.monthlyProfit)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wide">Annual Gross</p>
                    <p className={`text-2xl font-bold ${top.annualGross > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {top.annualGross > 0 ? '+' : ''}{formatCurrency(top.annualGross)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
        
        {/* Safety Margin - only show when positive */}
        {riskProfit >= 0 && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-emerald-600" />
              <span className="text-sm font-medium text-slate-700">Built-in Safety Margin</span>
            </div>
            <p className="text-lg font-bold text-emerald-700">
              Even at 20% lower occupancy, this property still profits {formatCurrency(riskProfit)}/month
            </p>
            <p className="text-xs text-slate-500 mt-1">
              At {riskOccupancy.toFixed(0)}% occupancy = {formatCurrency(riskRevenue)}/month revenue (after {expensePercent}% expenses)
            </p>
          </div>
        )}

      </div>
    </div>
  );
}

/**
 * Market Position Card - How property ranks
 */
function MarketPosition({ 
  propertyRevenue, 
  comparables 
}: { 
  propertyRevenue: number;
  comparables: Comparable[];
}) {
  if (!comparables || comparables.length === 0) return null;
  
  const allRevenues = comparables.map(c => c.revenue).sort((a, b) => b - a);
  const position = allRevenues.findIndex(r => propertyRevenue >= r);
  const rank = position === -1 ? allRevenues.length + 1 : position + 1;
  const percentile = Math.round(((allRevenues.length - rank + 1) / allRevenues.length) * 100);
  const avgCompRevenue = allRevenues.reduce((sum, r) => sum + r, 0) / allRevenues.length;
  const vsAvg = ((propertyRevenue - avgCompRevenue) / avgCompRevenue) * 100;
  
  // Determine grade - optimistic thresholds (encourages users)
  const grade = percentile >= 65 ? 'A+' : percentile >= 50 ? 'A' : percentile >= 40 ? 'B+' : 
                percentile >= 30 ? 'B' : percentile >= 20 ? 'C+' : percentile >= 10 ? 'C' : 'D';
  
  const gradeColor = grade.startsWith('A') ? 'emerald' : grade.startsWith('B') ? 'blue' : 
                     grade.startsWith('C') ? 'amber' : 'red';
  
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6">
      {/* Section Headline - Why this matters */}
      <p className="text-sm text-slate-600 mb-2 font-medium">
        How does this property stack up against the competition?
      </p>
      <h3 className="text-lg font-semibold text-slate-900 mb-4">Your Competitive Ranking</h3>
      
      <div className="flex items-center gap-6">
        {/* Grade Circle */}
        <div className={`w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold ${
          gradeColor === 'emerald' ? 'bg-emerald-100 text-emerald-700 border-4 border-emerald-500' :
          gradeColor === 'blue' ? 'bg-blue-100 text-blue-700 border-4 border-blue-500' :
          gradeColor === 'amber' ? 'bg-amber-100 text-amber-700 border-4 border-amber-500' :
          'bg-red-100 text-red-700 border-4 border-red-500'
        }`}>
          {grade}
        </div>
        
        {/* Stats */}
        <div className="flex-1">
          <div className="flex items-center gap-4 mb-2">
            <div>
              <p className="text-slate-500 text-xs">Percentile</p>
              <p className="text-xl font-bold text-slate-900">{percentile}th</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs">Rank</p>
              <p className="text-xl font-bold text-slate-900">#{rank} of {allRevenues.length + 1}</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs">vs Average</p>
              <p className={`text-xl font-bold ${vsAvg >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {vsAvg >= 0 ? '+' : ''}{vsAvg.toFixed(0)}%
              </p>
            </div>
          </div>
          
          {/* Progress bar */}
          <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all ${
                gradeColor === 'emerald' ? 'bg-emerald-500' :
                gradeColor === 'blue' ? 'bg-blue-500' :
                gradeColor === 'amber' ? 'bg-amber-500' : 'bg-red-500'
              }`}
              style={{ width: `${percentile}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-slate-400 mt-1">
            <span>Bottom 25%</span>
            <span>Median</span>
            <span>Top 25%</span>
          </div>
        </div>
      </div>
      
      {/* Methodology Explanation */}
      <div className="mt-4 pt-4 border-t border-slate-100">
        <p className="text-xs text-slate-500">
          <span className="font-medium">How this is calculated:</span> Your property's projected annual revenue ({formatCompactCurrency(propertyRevenue)}) is compared against {allRevenues.length} similar properties in the area with the same bedroom count. The grade reflects where you rank in terms of earning potential.
        </p>
      </div>
    </div>
  );
}

/**
 * Market Health Grade - Overall market assessment with letter grade
 */
function MarketHealthGrade({
  occupancy,
  yoyChange,
  professionalPct,
  superhostPct,
  totalListings,
  avgRating,
  forecast,
  marketScore
}: {
  occupancy: number;
  yoyChange?: number;
  professionalPct?: number;
  superhostPct?: number;
  totalListings?: number;
  avgRating?: number;
  forecast?: MonthlyForecast[];
  marketScore?: number;
}) {
  // Calculate individual scores (0-100)
  
  // 1. Occupancy Score (higher is better)
  // 70%+ = excellent, 50-70% = good, 30-50% = fair, <30% = poor
  const occupancyScore = Math.min(100, Math.max(0, (occupancy / 0.75) * 100));
  
  // 2. Growth Score (based on YoY change)
  // +10%+ = excellent, +5-10% = good, 0-5% = fair, negative = poor
  let growthScore = 50; // neutral default
  if (yoyChange !== undefined) {
    if (yoyChange >= 10) growthScore = 100;
    else if (yoyChange >= 5) growthScore = 80;
    else if (yoyChange >= 0) growthScore = 60;
    else if (yoyChange >= -5) growthScore = 40;
    else growthScore = 20;
  }
  
  // 3. Competition Score (lower professional % = better for new hosts)
  // <30% = excellent opportunity, 30-50% = good, 50-70% = competitive, >70% = saturated
  let competitionScore = 70; // neutral default
  if (professionalPct !== undefined) {
    if (professionalPct < 30) competitionScore = 90;
    else if (professionalPct < 50) competitionScore = 70;
    else if (professionalPct < 70) competitionScore = 50;
    else competitionScore = 30;
  }
  
  // 4. Quality Score (based on avg rating and superhost %)
  let qualityScore = 70;
  if (avgRating !== undefined && avgRating > 0) {
    qualityScore = Math.min(100, (avgRating / 5) * 100);
  }
  
  // 5. Seasonality Score (how stable is revenue throughout the year)
  let seasonalityScore = 70;
  if (forecast && forecast.length >= 4) {
    const revenues = forecast.map(f => f.revenue);
    const avgRevenue = revenues.reduce((a, b) => a + b, 0) / revenues.length;
    const variance = revenues.reduce((sum, r) => sum + Math.pow(r - avgRevenue, 2), 0) / revenues.length;
    const coefficientOfVariation = Math.sqrt(variance) / avgRevenue;
    // Lower CV = more stable = higher score
    seasonalityScore = Math.max(20, 100 - (coefficientOfVariation * 200));
  }
  
  // 6. Market Score (if available from API)
  // This is a comprehensive score that factors in many market indicators
  const apiMarketScore = marketScore !== undefined ? marketScore : undefined;
  
  // Calculate weighted average - adjust weights if Market score is available
  const weights = apiMarketScore !== undefined ? {
    occupancy: 0.20,
    growth: 0.20,
    competition: 0.15,
    quality: 0.10,
    seasonality: 0.10,
    marketApi: 0.25  // Give significant weight to the comprehensive market score
  } : {
    occupancy: 0.30,
    growth: 0.25,
    competition: 0.20,
    quality: 0.15,
    seasonality: 0.10
  };
  
  const overallScore = apiMarketScore !== undefined
    ? occupancyScore * weights.occupancy +
      growthScore * weights.growth +
      competitionScore * weights.competition +
      qualityScore * weights.quality +
      seasonalityScore * weights.seasonality +
      apiMarketScore * (weights as any).marketApi
    : occupancyScore * weights.occupancy +
      growthScore * weights.growth +
      competitionScore * weights.competition +
      qualityScore * weights.quality +
      seasonalityScore * weights.seasonality;
  
  // Convert score to letter grade
  let grade: string;
  let gradeColor: string;
  let gradeBg: string;
  let gradeText: string;
  
  // More optimistic grading - adjusted thresholds to encourage users
  if (overallScore >= 82) {
    grade = 'A+';
    gradeColor = 'text-emerald-600';
    gradeBg = 'bg-emerald-100';
    gradeText = 'Exceptional market with strong fundamentals';
  } else if (overallScore >= 70) {
    grade = 'A';
    gradeColor = 'text-emerald-600';
    gradeBg = 'bg-emerald-100';
    gradeText = 'Excellent market for short-term rentals';
  } else if (overallScore >= 58) {
    grade = 'B+';
    gradeColor = 'text-blue-600';
    gradeBg = 'bg-blue-100';
    gradeText = 'Strong market with good potential';
  } else if (overallScore >= 48) {
    grade = 'B';
    gradeColor = 'text-blue-600';
    gradeBg = 'bg-blue-100';
    gradeText = 'Solid market worth considering';
  } else if (overallScore >= 38) {
    grade = 'C+';
    gradeColor = 'text-amber-600';
    gradeBg = 'bg-amber-100';
    gradeText = 'Average market - room for growth';
  } else if (overallScore >= 28) {
    grade = 'C';
    gradeColor = 'text-amber-600';
    gradeBg = 'bg-amber-100';
    gradeText = 'Developing market - opportunity for early movers';
  } else if (overallScore >= 18) {
    grade = 'D';
    gradeColor = 'text-red-600';
    gradeBg = 'bg-red-100';
    gradeText = 'Challenging market - requires strategy';
  } else {
    grade = 'F';
    gradeColor = 'text-red-600';
    gradeBg = 'bg-red-100';
    gradeText = 'High risk - not recommended';
  }
  
  // Factor breakdown
  // Factor definitions for user understanding
  const factorDefinitions: Record<string, string> = {
    'Market Score': 'Overall market health combining demand, supply, and revenue potential',
    'Occupancy': 'How often properties are booked. Higher = more demand',
    'Growth Trend': 'Year-over-year revenue change. Positive = growing market',
    'Competition': 'Professional host saturation. Lower = easier entry for new hosts',
    'Quality': 'Average guest ratings. Higher = better guest experiences',
    'Income Stability': 'Is income steady all year? Higher = more consistent monthly earnings',
  };
  
  const factors = [
    ...(apiMarketScore !== undefined ? [{ name: 'Market Score', score: apiMarketScore, weight: (weights as any).marketApi, definition: factorDefinitions['Market Score'] }] : []),
    { name: 'Occupancy', score: occupancyScore, weight: weights.occupancy, definition: factorDefinitions['Occupancy'] },
    { name: 'Growth Trend', score: growthScore, weight: weights.growth, definition: factorDefinitions['Growth Trend'] },
    { name: 'Competition', score: competitionScore, weight: weights.competition, definition: factorDefinitions['Competition'] },
    { name: 'Quality', score: qualityScore, weight: weights.quality, definition: factorDefinitions['Quality'] },
    { name: 'Income Stability', score: seasonalityScore, weight: weights.seasonality, definition: factorDefinitions['Income Stability'] },
  ];
  
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6">
      {/* Section Headline - Why this matters */}
      <p className="text-sm text-slate-600 mb-2 font-medium">
        Is this a good market for short-term rentals?
      </p>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Award className="w-5 h-5 text-slate-600" />
            Market Score
          </h3>
          <p className="text-sm text-slate-500 mt-1">Based on demand, competition, and growth trends</p>
        </div>
        
        {/* Big Grade Badge */}
        <div className={`${gradeBg} ${gradeColor} rounded-2xl px-6 py-4 text-center`}>
          <div className="text-4xl font-bold">{grade}</div>
          <div className="text-xs font-medium mt-1 opacity-80">
            {Math.round(overallScore)}/100
          </div>
        </div>
      </div>
      
      {/* Grade Summary with Market Trend */}
      <div className={`${gradeBg} rounded-lg p-4 mb-6`}>
        <p className={`${gradeColor} font-medium`}>{gradeText}</p>
        
        {/* Market Trend Indicator */}
        {yoyChange !== undefined && (
          <div className="mt-3 pt-3 border-t border-slate-200/50 flex items-center justify-between">
            <span className="text-sm text-slate-600">Market Trend</span>
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold ${
              yoyChange >= 5 
                ? 'bg-emerald-100 text-emerald-700' 
                : yoyChange <= -5 
                ? 'bg-red-100 text-red-700' 
                : 'bg-amber-100 text-amber-700'
            }`}>
              {yoyChange >= 5 ? (
                <>
                  <TrendingUp className="w-4 h-4" />
                  <span>Growing Market</span>
                  <span className="text-xs opacity-75">+{yoyChange.toFixed(1)}% YoY</span>
                </>
              ) : yoyChange <= -5 ? (
                <>
                  <TrendingDown className="w-4 h-4" />
                  <span>Declining Market</span>
                  <span className="text-xs opacity-75">{yoyChange.toFixed(1)}% YoY</span>
                </>
              ) : (
                <>
                  <Minus className="w-4 h-4" />
                  <span>Stable Market</span>
                  <span className="text-xs opacity-75">{yoyChange >= 0 ? '+' : ''}{yoyChange.toFixed(1)}% YoY</span>
                </>
              )}
            </div>
          </div>
        )}
      </div>
      
      {/* Factor Breakdown */}
      <div className="space-y-4">
        <p className="text-sm font-medium text-slate-700">Score Breakdown</p>
        {factors.map((factor) => (
          <div key={factor.name} className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700">{factor.name}</span>
              <span className="text-sm font-bold text-slate-900">
                {Math.round(factor.score)}/100
              </span>
            </div>
            <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all ${
                  factor.score >= 70 ? 'bg-emerald-500' :
                  factor.score >= 50 ? 'bg-blue-500' :
                  factor.score >= 30 ? 'bg-amber-500' : 'bg-red-500'
                }`}
                style={{ width: `${factor.score}%` }}
              />
            </div>
            <p className="text-xs text-slate-500">{factor.definition}</p>
          </div>
        ))}
      </div>
      
      {/* Methodology Note */}
      <div className="mt-4 pt-4 border-t border-slate-100">
        <p className="text-xs text-slate-400">
          Grade calculated from: occupancy rate (30%), growth trends (25%), competition level (20%), 
          quality indicators (15%), and seasonality stability (10%).
        </p>
      </div>
    </div>
  );
}

/**
 * Market Insights Card - Professional management and Superhost stats
 */
function MarketInsights({ 
  insights,
  totalComparables
}: { 
  insights?: {
    professionallyManagedPct: number;
    superhostPct: number;
    avgRating?: number;
    totalListings?: number;
  };
  totalComparables: number;
}) {
  if (!insights) return null;
  
  const { professionallyManagedPct, superhostPct, avgRating, totalListings } = insights;
  
  // Determine competitive landscape
  const isHighlyProfessional = professionallyManagedPct > 50;
  const isHighSuperhost = superhostPct > 40;
  
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6">
      {/* Section Headline - Why this matters */}
      <p className="text-sm text-slate-600 mb-2 font-medium">
        Who are you competing against?
      </p>
      <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
        <Building2 className="w-5 h-5 text-slate-600" />
        Your Competition
      </h3>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Professional Management */}
        <div className="bg-slate-50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              isHighlyProfessional ? 'bg-amber-100' : 'bg-emerald-100'
            }`}>
              <Briefcase className={`w-4 h-4 ${
                isHighlyProfessional ? 'text-amber-600' : 'text-emerald-600'
              }`} />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900">
            {professionallyManagedPct.toFixed(0)}%
          </p>
          <p className="text-xs text-slate-500">Professionally Managed</p>
          <p className={`text-xs mt-1 ${
            isHighlyProfessional ? 'text-amber-600' : 'text-emerald-600'
          }`}>
            {isHighlyProfessional ? 'High competition' : 'Opportunity for individuals'}
          </p>
        </div>
        
        {/* Superhost Percentage */}
        <div className="bg-slate-50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              isHighSuperhost ? 'bg-amber-100' : 'bg-blue-100'
            }`}>
              <Award className={`w-4 h-4 ${
                isHighSuperhost ? 'text-amber-600' : 'text-blue-600'
              }`} />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900">
            {superhostPct.toFixed(0)}%
          </p>
          <p className="text-xs text-slate-500">Superhosts</p>
          <p className={`text-xs mt-1 ${
            isHighSuperhost ? 'text-amber-600' : 'text-blue-600'
          }`}>
            {isHighSuperhost ? 'Quality-focused market' : 'Room to stand out'}
          </p>
        </div>
        
        {/* Average Rating */}
        {avgRating !== undefined && avgRating > 0 && (
          <div className="bg-slate-50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-yellow-100 flex items-center justify-center">
                <Star className="w-4 h-4 text-yellow-600" />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900">
              {avgRating.toFixed(1)}
            </p>
            <p className="text-xs text-slate-500">Avg Rating</p>
            <p className="text-xs mt-1 text-yellow-600">
              {avgRating >= 4.8 ? 'High standards' : avgRating >= 4.5 ? 'Good quality' : 'Mixed reviews'}
            </p>
          </div>
        )}
        
        {/* Total Listings */}
        <div className="bg-slate-50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
              <Home className="w-4 h-4 text-purple-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900">
            {totalListings || totalComparables}
          </p>
          <p className="text-xs text-slate-500">Similar Listings</p>
          <p className="text-xs mt-1 text-purple-600">
            {(totalListings || totalComparables) > 50 ? 'Established market' : 
             (totalListings || totalComparables) > 20 ? 'Growing market' : 'Emerging market'}
          </p>
        </div>
      </div>
      
      {/* Insight Summary */}
      <div className="mt-4 p-3 bg-slate-100 rounded-lg">
        <p className="text-sm text-slate-600">
          <span className="font-medium">Market Insight:</span>{' '}
          {isHighlyProfessional && isHighSuperhost ? (
            'This is a competitive, quality-focused market dominated by professionals. Focus on exceptional guest experience to succeed.'
          ) : isHighlyProfessional ? (
            'Professional operators dominate this market. Consider property management or develop strong systems to compete.'
          ) : isHighSuperhost ? (
            'Quality matters here. Invest in guest experience and aim for Superhost status to maximize bookings.'
          ) : (
            'This market has room for new hosts. Focus on quality photos, competitive pricing, and responsive communication to stand out.'
          )}
        </p>
      </div>
    </div>
  );
}

/**
 * AI Property Advisor - Comprehensive AI-powered analysis
 * Uses Claude AI to synthesize all data into actionable insights
 */
function AIPropertyAdvisor({
  address,
  bedrooms,
  bathrooms,
  accommodates,
  monthlyRent,
  result,
  effectiveRevenue
}: {
  address: string;
  bedrooms: number;
  bathrooms: number;
  accommodates?: number;
  monthlyRent?: number;
  result: AnalysisResult;
  effectiveRevenue?: { projected: number; low: number; high: number };
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [advice, setAdvice] = useState<string | null>(null);
  const [hasRequested, setHasRequested] = useState(false);
  
  const advisorMutation = trpc.advanced.propertyAdvisor.useMutation();
  
  const handleGetAdvice = async () => {
    if (hasRequested && advice) {
      setIsExpanded(!isExpanded);
      return;
    }
    
    setIsExpanded(true);
    setHasRequested(true);
    
    try {
      // Prepare the comprehensive data payload
      const payload = {
        property: {
          address,
          bedrooms,
          bathrooms,
          accommodates,
          monthlyRent: monthlyRent || result.cashFlow.monthlyRent,
        },
        revenue: {
          projected: effectiveRevenue?.projected ?? result.revenue.projected,
          low: effectiveRevenue?.low ?? result.revenue.low,
          high: effectiveRevenue?.high ?? result.revenue.high,
          adr: result.metrics.adr,
          occupancy: result.metrics.occupancy,
        },
        cashFlow: monthlyRent || result.cashFlow.monthlyRent > 0 ? (() => {
          const effMonthly = effectiveRevenue?.projected ? effectiveRevenue.projected / 12 : result.cashFlow.monthlyRevenue;
          const effRent = monthlyRent || result.cashFlow.monthlyRent;
          const effExpenses = effMonthly * (expensePercent / 100);
          const effProfit = effMonthly - effRent - effExpenses;
          return {
            monthlyRevenue: effMonthly,
            monthlyRent: effRent,
            monthlyProfit: effProfit,
            annualProfit: effProfit * 12,
            profitMargin: effRent > 0 ? (effProfit / effMonthly) * 100 : 0,
          };
        })() : undefined,
        comparables: result.comparables.map(c => ({
          title: c.title,
          bedrooms: c.bedrooms,
          bathrooms: c.bathrooms,
          revenue: c.revenue,
          adr: c.adr,
          occupancy: c.occupancy,
          rating: c.rating || 0,
          reviews: c.reviews,
          distanceMeters: c.distanceMeters,
          latitude: c.latitude,
          longitude: c.longitude,
          isSuperhost: false, // TODO: Add to comparables data
          isProfessionallyManaged: false, // TODO: Add to comparables data
        })),
        marketInsights: result.marketInsights ? {
          professionallyManagedPct: result.marketInsights.professionallyManagedPct,
          superhostPct: result.marketInsights.superhostPct,
          avgRating: result.marketInsights.avgRating,
          totalListings: result.marketInsights.totalListings,
          marketScore: result.marketInsights.marketScore,
        } : undefined,
        historicalData: result.historicalData ? {
          yoyChange: result.historicalData.summary.yearly_pct_change,
          trend: result.historicalData.summary.trend,
          months: result.historicalData.months,
        } : undefined,
        seasonality: result.forecast.map(f => ({
          month: f.month,
          revenue: f.revenue,
          adr: f.adr,
          occupancy: f.occupancy,
        })),
        marketGrade: result.marketInsights?.marketScore ? {
          grade: result.marketInsights.marketScore >= 80 ? 'A' :
                 result.marketInsights.marketScore >= 60 ? 'B' :
                 result.marketInsights.marketScore >= 40 ? 'C' : 'D',
          score: result.marketInsights.marketScore,
          description: result.marketInsights.marketScore >= 80 ? 'Excellent investment market' :
                       result.marketInsights.marketScore >= 60 ? 'Good investment potential' :
                       result.marketInsights.marketScore >= 40 ? 'Moderate opportunity' : 'Challenging market',
        } : undefined,
      };
      
      const response = await advisorMutation.mutateAsync(payload);
      
      if (response.success && response.data?.advice) {
        setAdvice(response.data.advice);
      } else {
        setAdvice('Unable to generate analysis. Please try again.');
      }
    } catch (error) {
      console.error('Error getting AI advice:', error);
      setAdvice('An error occurred while generating the analysis. Please try again.');
    }
  };
  
  return (
    <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl border border-indigo-200 overflow-hidden">
      {/* Header - Always visible */}
      <button
        onClick={handleGetAdvice}
        className="w-full p-4 flex items-center justify-between hover:bg-indigo-100/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              AI Property Advisor
              <span className="text-xs px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full font-medium">
                Powered by Claude AI
              </span>
            </h3>
            <p className="text-sm text-slate-500">
              {hasRequested && advice 
                ? 'Click to expand/collapse analysis' 
                : 'Get a comprehensive AI analysis of this property opportunity'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {advisorMutation.isPending && (
            <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />
          )}
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-slate-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-slate-400" />
          )}
        </div>
      </button>
      
      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-indigo-200">
          {advisorMutation.isPending ? (
            <div className="p-8 text-center">
              <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-4" />
              <p className="text-slate-600 font-medium">Analyzing property data...</p>
              <p className="text-sm text-slate-500 mt-1">
                Claude AI is reviewing {result.comparables.length} competitors, {result.forecast.length} months of seasonality data, and market insights
              </p>
            </div>
          ) : advice ? (
            <div className="p-6">
              <div className="prose prose-slate prose-sm max-w-none">
                <LightMarkdown>{advice}</LightMarkdown>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center">
              <Bot className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">Click the button above to generate your AI analysis</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Comp Strength Indicator - Shows how reliable the estimate is based on comp data
 */
function CompStrengthIndicator({ comparables }: { comparables: Comparable[] }) {
  if (!comparables || comparables.length === 0) return null;
  
  // Calculate metrics
  const compCount = comparables.length;
  const compsWithDistance = comparables.filter(c => c.distanceMeters !== undefined);
  const avgDistanceMeters = compsWithDistance.length > 0 
    ? compsWithDistance.reduce((sum, c) => sum + (c.distanceMeters || 0), 0) / compsWithDistance.length
    : null;
  const avgDistanceMiles = avgDistanceMeters ? (avgDistanceMeters / 1609.34) : null;
  
  // Determine strength level
  let strengthLabel: string;
  let strengthColor: string;
  let strengthBg: string;
  
  if (compCount >= 10 && avgDistanceMiles && avgDistanceMiles < 1) {
    strengthLabel = 'High Confidence';
    strengthColor = 'text-emerald-700';
    strengthBg = 'bg-emerald-50 border-emerald-200';
  } else if (compCount >= 5 && avgDistanceMiles && avgDistanceMiles < 2) {
    strengthLabel = 'Good Confidence';
    strengthColor = 'text-blue-700';
    strengthBg = 'bg-blue-50 border-blue-200';
  } else {
    strengthLabel = 'Limited Data';
    strengthColor = 'text-amber-700';
    strengthBg = 'bg-amber-50 border-amber-200';
  }
  
  return (
    <div className={`flex items-center justify-between p-3 rounded-lg border mb-4 ${strengthBg}`}>
      <div className="flex items-center gap-3">
        <div className={`flex items-center gap-1.5 ${strengthColor}`}>
          <CheckCircle2 className="w-4 h-4" />
          <span className="text-sm font-medium">{strengthLabel}</span>
        </div>
        <span className="text-slate-400">|</span>
        <span className="text-sm text-slate-600">
          Based on <span className="font-medium">{compCount}</span> similar properties
        </span>
        {avgDistanceMiles !== null && avgDistanceMiles > 0 && (
          <>
            <span className="text-slate-400">|</span>
            <span className="text-sm text-slate-600">
              Avg. <span className="font-medium">{avgDistanceMiles.toFixed(1)} mi</span> away
            </span>
          </>
        )}
        <span className="text-slate-400">|</span>
        <span className="text-sm text-slate-500">
          Data as of <span className="font-medium">{new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
        </span>
      </div>
      <Tooltip>
        <TooltipTrigger asChild>
          <button className="p-1 hover:bg-white/50 rounded transition-colors">
            <Info className="w-4 h-4 text-slate-400" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs p-3 bg-white text-[oklch(0.30_0_0)] shadow-lg border border-[oklch(0.90_0_0)]">
          <p className="text-sm leading-relaxed">
            More comps = more reliable estimate. Closer comps = more accurate for your specific location. 
            10+ comps within 1 mile is ideal!
          </p>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

/**
 * Revenue tier color helper
 */
function getRevenueTier(revenue: number, allRevenues: number[]): { color: string; label: string; bgClass: string; textClass: string } {
  if (allRevenues.length === 0) return { color: '#3b82f6', label: 'N/A', bgClass: 'bg-slate-100', textClass: 'text-slate-600' };
  const sorted = [...allRevenues].sort((a, b) => a - b);
  const p33 = sorted[Math.floor(sorted.length * 0.33)];
  const p66 = sorted[Math.floor(sorted.length * 0.66)];
  if (revenue >= p66) return { color: '#059669', label: 'High', bgClass: 'bg-emerald-50', textClass: 'text-emerald-700' };
  if (revenue >= p33) return { color: '#d97706', label: 'Mid', bgClass: 'bg-amber-50', textClass: 'text-amber-700' };
  return { color: '#dc2626', label: 'Low', bgClass: 'bg-red-50', textClass: 'text-red-700' };
}

/**
 * Comp Map Modal - Shows property and comps on a Google Map
 * Features: sidebar comp list, revenue-colored markers, distance radius circle
 */
function CompMapModal({
  comparables,
  propertyLatitude,
  propertyLongitude,
  address,
  onClose
}: {
  comparables: Comparable[];
  propertyLatitude: number;
  propertyLongitude: number;
  address: string;
  onClose: () => void;
}) {
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const [activeCompIdx, setActiveCompIdx] = useState<number | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const sidebarItemRefs = useRef<(HTMLDivElement | null)[]>([]);

  const compsWithCoords = useMemo(() => comparables.filter(c => c.latitude && c.longitude), [comparables]);
  const allRevenues = useMemo(() => compsWithCoords.map(c => c.revenue), [compsWithCoords]);
  
  // Calculate max distance for radius circle (in meters)
  const maxDistanceMeters = useMemo(() => {
    const distances = compsWithCoords.map(c => c.distanceMeters || 0).filter(d => d > 0);
    return distances.length > 0 ? Math.max(...distances) : 2414; // default 1.5 miles
  }, [compsWithCoords]);

  const handleCompClick = useCallback((idx: number) => {
    const comp = compsWithCoords[idx];
    if (!comp || !mapRef.current) return;
    
    setActiveCompIdx(idx);
    
    // Pan and zoom to the comp
    mapRef.current.panTo({ lat: comp.latitude!, lng: comp.longitude! });
    mapRef.current.setZoom(15);
    
    // Open the info window for this marker
    const marker = markersRef.current[idx + 1]; // +1 because index 0 is the property marker
    if (marker && infoWindowRef.current) {
      const revenue = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(comp.revenue);
      const distanceMi = comp.distanceMeters ? (comp.distanceMeters / 1609.34).toFixed(1) : '?';
      const imgHtml = comp.imageUrl ? `<img src="${comp.imageUrl}" style="width:100%;height:100px;object-fit:cover;border-radius:6px;margin-bottom:8px;" />` : '';
      infoWindowRef.current.setContent(`
        <div style="font-family:'DM Sans',system-ui,sans-serif;padding:4px;max-width:260px;">
          ${imgHtml}
          <div style="font-weight:700;font-size:13px;color:#0F172A;margin-bottom:4px;">${comp.title || 'Comp #' + (idx + 1)}</div>
          <div style="font-size:12px;color:#64748b;margin-bottom:6px;">${comp.bedrooms} BR \u00b7 ${comp.bathrooms} BA \u00b7 ${distanceMi} mi away</div>
          <div style="display:flex;gap:12px;">
            <div><div style="font-size:14px;font-weight:700;color:#059669;">${revenue}/yr</div></div>
            <div><div style="font-size:12px;color:#64748b;">${Math.round(comp.occupancy)}% occ \u00b7 $${Math.round(comp.adr)}/nt</div></div>
          </div>
          ${comp.airbnbUrl ? `<a href="${comp.airbnbUrl}" target="_blank" rel="noopener" style="display:inline-block;margin-top:6px;font-size:11px;color:#3b82f6;text-decoration:none;">View on Airbnb \u2192</a>` : ''}
        </div>
      `);
      infoWindowRef.current.open(mapRef.current, marker);
    }
  }, [compsWithCoords]);

  const handleResetView = useCallback(() => {
    if (!mapRef.current) return;
    setActiveCompIdx(null);
    if (infoWindowRef.current) infoWindowRef.current.close();
    const bounds = new google.maps.LatLngBounds();
    bounds.extend({ lat: propertyLatitude, lng: propertyLongitude });
    compsWithCoords.forEach(c => bounds.extend({ lat: c.latitude!, lng: c.longitude! }));
    mapRef.current.fitBounds(bounds, { top: 60, right: 60, bottom: 60, left: sidebarOpen ? 360 : 60 });
  }, [propertyLatitude, propertyLongitude, compsWithCoords, sidebarOpen]);

  const handleMapReady = (map: google.maps.Map) => {
    mapRef.current = map;
    infoWindowRef.current = new google.maps.InfoWindow();
    const bounds = new google.maps.LatLngBounds();
    
    // Add distance radius circle
    const propertyPos = { lat: propertyLatitude, lng: propertyLongitude };
    bounds.extend(propertyPos);
    
    new google.maps.Circle({
      map,
      center: propertyPos,
      radius: maxDistanceMeters,
      fillColor: '#C9A962',
      fillOpacity: 0.06,
      strokeColor: '#C9A962',
      strokeOpacity: 0.3,
      strokeWeight: 2,
      strokeDashArray: [4, 4],
    });
    
    // Add subject property marker (gold house)
    const propertyMarkerEl = document.createElement('div');
    propertyMarkerEl.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;width:44px;height:44px;background:#C9A962;border-radius:50%;border:3px solid white;box-shadow:0 2px 10px rgba(0,0,0,0.35);cursor:pointer;">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="1">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22" fill="#C9A962"/>
        </svg>
      </div>
    `;
    
    const propertyMarker = new google.maps.marker.AdvancedMarkerElement({
      map,
      position: propertyPos,
      title: address,
      content: propertyMarkerEl,
      zIndex: 1000,
    });
    markersRef.current.push(propertyMarker);
    
    propertyMarker.addListener('click', () => {
      if (infoWindowRef.current) {
        infoWindowRef.current.setContent(`
          <div style="font-family:'DM Sans',system-ui,sans-serif;padding:8px;max-width:250px;">
            <div style="font-weight:700;font-size:14px;color:#0F172A;margin-bottom:4px;">Your Property</div>
            <div style="font-size:12px;color:#64748b;">${address}</div>
          </div>
        `);
        infoWindowRef.current.open(map, propertyMarker);
      }
    });
    
    // Add comp markers with revenue-based colors
    compsWithCoords.forEach((comp, idx) => {
      const pos = { lat: comp.latitude!, lng: comp.longitude! };
      bounds.extend(pos);
      
      const tier = getRevenueTier(comp.revenue, allRevenues);
      const markerEl = document.createElement('div');
      markerEl.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:center;width:32px;height:32px;background:${tier.color};border-radius:50%;border:2.5px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);cursor:pointer;font-family:'DM Sans',system-ui,sans-serif;font-size:12px;font-weight:700;color:white;transition:transform 0.2s;">
          ${idx + 1}
        </div>
      `;
      
      const marker = new google.maps.marker.AdvancedMarkerElement({
        map,
        position: pos,
        title: comp.title,
        content: markerEl,
      });
      markersRef.current.push(marker);
      
      marker.addListener('click', () => {
        setActiveCompIdx(idx);
        // Scroll sidebar to this comp
        sidebarItemRefs.current[idx]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        
        if (infoWindowRef.current) {
          const revenue = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(comp.revenue);
          const distanceMi = comp.distanceMeters ? (comp.distanceMeters / 1609.34).toFixed(1) : '?';
          const imgHtml = comp.imageUrl ? `<img src="${comp.imageUrl}" style="width:100%;height:100px;object-fit:cover;border-radius:6px;margin-bottom:8px;" />` : '';
          infoWindowRef.current.setContent(`
            <div style="font-family:'DM Sans',system-ui,sans-serif;padding:4px;max-width:260px;">
              ${imgHtml}
              <div style="font-weight:700;font-size:13px;color:#0F172A;margin-bottom:4px;">${comp.title || 'Comp #' + (idx + 1)}</div>
              <div style="font-size:12px;color:#64748b;margin-bottom:6px;">${comp.bedrooms} BR \u00b7 ${comp.bathrooms} BA \u00b7 ${distanceMi} mi away</div>
              <div style="display:flex;gap:12px;">
                <div><div style="font-size:14px;font-weight:700;color:${tier.color};">${revenue}/yr</div></div>
                <div><div style="font-size:12px;color:#64748b;">${Math.round(comp.occupancy)}% occ \u00b7 $${Math.round(comp.adr)}/nt</div></div>
              </div>
              ${comp.airbnbUrl ? `<a href="${comp.airbnbUrl}" target="_blank" rel="noopener" style="display:inline-block;margin-top:6px;font-size:11px;color:#3b82f6;text-decoration:none;">View on Airbnb \u2192</a>` : ''}
            </div>
          `);
          infoWindowRef.current.open(map, marker);
        }
      });
    });
    
    // Fit map to show all markers with padding for sidebar
    map.fitBounds(bounds, { top: 60, right: 60, bottom: 60, left: sidebarOpen ? 360 : 60 });
  };

  const formatCompactRev = (n: number) => {
    if (n >= 1000) return `$${Math.round(n / 1000)}K`;
    return `$${n}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="relative w-full max-w-6xl h-[85vh] mx-4 bg-white rounded-2xl overflow-hidden shadow-2xl flex" onClick={e => e.stopPropagation()}>
        
        {/* Sidebar - Comp List */}
        <div className={`${sidebarOpen ? 'w-[320px]' : 'w-0'} transition-all duration-300 flex-shrink-0 flex flex-col bg-white border-r border-slate-200 overflow-hidden`}>
          {/* Sidebar Header */}
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-semibold text-sm text-slate-900">Comparables</h4>
                <p className="text-xs text-slate-500">{compsWithCoords.length} properties</p>
              </div>
              <button
                onClick={handleResetView}
                className="text-xs text-[#C9A962] hover:text-[#b8963f] font-medium px-2 py-1 rounded hover:bg-[#C9A962]/10 transition-colors"
              >
                Reset View
              </button>
            </div>
            {/* Revenue Legend */}
            <div className="flex items-center gap-3 mt-2 text-[10px]">
              <div className="flex items-center gap-1">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="text-slate-500">High Rev</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span className="text-slate-500">Mid Rev</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                <span className="text-slate-500">Low Rev</span>
              </div>
            </div>
          </div>
          
          {/* Your Property Card */}
          <div
            className="px-4 py-3 border-b border-slate-100 cursor-pointer hover:bg-[#C9A962]/5 transition-colors"
            onClick={handleResetView}
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#C9A962] flex items-center justify-center flex-shrink-0">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="white" stroke="white" strokeWidth="1">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[#C9A962] truncate">Your Property</p>
                <p className="text-[10px] text-slate-500 truncate">{address}</p>
              </div>
            </div>
          </div>
          
          {/* Comp List */}
          <div className="flex-1 overflow-y-auto">
            {compsWithCoords.map((comp, idx) => {
              const tier = getRevenueTier(comp.revenue, allRevenues);
              const distanceMi = comp.distanceMeters ? (comp.distanceMeters / 1609.34).toFixed(1) : '?';
              const isActive = activeCompIdx === idx;
              return (
                <div
                  key={comp.id || idx}
                  ref={el => { sidebarItemRefs.current[idx] = el; }}
                  className={`px-4 py-3 border-b border-slate-100 cursor-pointer transition-colors ${
                    isActive ? 'bg-blue-50 border-l-2 border-l-blue-500' : 'hover:bg-slate-50'
                  }`}
                  onClick={() => handleCompClick(idx)}
                >
                  <div className="flex items-start gap-3">
                    {/* Numbered marker */}
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-bold"
                      style={{ backgroundColor: tier.color }}
                    >
                      {idx + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-slate-900 truncate leading-tight">
                        {comp.title || `Comp #${idx + 1}`}
                      </p>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        {comp.bedrooms} BR \u00b7 {comp.bathrooms} BA \u00b7 {distanceMi} mi
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs font-bold ${tier.textClass}`}>
                          {formatCompactRev(comp.revenue)}/yr
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {Math.round(comp.occupancy)}% occ
                        </span>
                      </div>
                    </div>
                    {/* Rating */}
                    {comp.rating > 0 && (
                      <div className="flex items-center gap-0.5 flex-shrink-0">
                        <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                        <span className="text-[10px] text-slate-600 font-medium">{comp.rating.toFixed(1)}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        
        {/* Map Area */}
        <div className="flex-1 relative">
          {/* Header */}
          <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-5 py-3 bg-white/95 backdrop-blur-sm border-b border-slate-200">
            <div className="flex items-center gap-2">
              {/* Sidebar toggle */}
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors text-slate-500 hover:text-slate-700"
                title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  {sidebarOpen ? (
                    <><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/></>
                  ) : (
                    <><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/><polyline points="14 9 17 12 14 15"/></>
                  )}
                </svg>
              </button>
              <Map className="w-5 h-5 text-[#C9A962]" />
              <h3 className="font-semibold text-slate-900">Comp Map</h3>
              <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                {compsWithCoords.length} comps
              </span>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors text-slate-500 hover:text-slate-700"
            >
              \u2715
            </button>
          </div>
          
          {/* Legend */}
          <div className="absolute bottom-4 left-4 z-10 bg-white/95 backdrop-blur-sm rounded-lg px-3 py-2 shadow-lg border border-slate-200">
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded-full bg-[#C9A962] border-2 border-white shadow" />
                <span className="text-slate-600 font-medium">Your Property</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3.5 h-3.5 rounded-full bg-emerald-500 border border-white shadow" />
                <span className="text-slate-500">High</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3.5 h-3.5 rounded-full bg-amber-500 border border-white shadow" />
                <span className="text-slate-500">Mid</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3.5 h-3.5 rounded-full bg-red-500 border border-white shadow" />
                <span className="text-slate-500">Low</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 mt-1.5 pt-1.5 border-t border-slate-100">
              <div className="w-4 h-4 rounded-full border-2 border-dashed border-[#C9A962]/50" />
              <span className="text-slate-500 text-[10px]">Search radius ({(maxDistanceMeters / 1609.34).toFixed(1)} mi)</span>
            </div>
          </div>
          
          {/* Map */}
          <MapView
            className="w-full h-full"
            initialCenter={{ lat: propertyLatitude, lng: propertyLongitude }}
            initialZoom={13}
            onMapReady={handleMapReady}
            showRecenter={true}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Comparable Properties Cards - Visual property cards with image carousel
 */
function ComparableProperties({ 
  comparables,
  onViewAll,
  selectedAmenities = [],
  amenityFilter,
  propertyLatitude,
  propertyLongitude,
  address,
  isOwner = false,
  selectedCompIds,
  onToggleComp,
  onSaveCompSelection,
  isSavingCompSelection = false,
  compSelectionSaved = false,
  hasUnsavedCompSelection = false,
}: { 
  comparables: Comparable[];
  onViewAll?: () => void;
  selectedAmenities?: string[];
  amenityFilter?: {
    applied: boolean;
    relaxed: boolean;
    selected_amenities: string[];
    comp_count: number;
  };
  propertyLatitude?: number;
  propertyLongitude?: number;
  address?: string;
  isOwner?: boolean;
  selectedCompIds?: Set<string>;
  onToggleComp?: (id: string) => void;
  onSaveCompSelection?: () => void;
  isSavingCompSelection?: boolean;
  compSelectionSaved?: boolean;
  hasUnsavedCompSelection?: boolean;
}) {
  const [showAll, setShowAll] = useState(false);
  const [carouselOpen, setCarouselOpen] = useState(false);
  const [selectedComp, setSelectedComp] = useState<Comparable | null>(null);
  const [showMap, setShowMap] = useState(false);
  
  if (!comparables || comparables.length === 0) return null;
  
  // Sort comps: always by revenue descending; when amenity filter active, amenity match count takes priority
  const hasAmenityFilter = selectedAmenities.length > 0;
  const sortedComparables = [...comparables].sort((a, b) => {
    if (hasAmenityFilter) {
      const aMatchCount = a.amenities?.filter(am => selectedAmenities.includes(am)).length || 0;
      const bMatchCount = b.amenities?.filter(am => selectedAmenities.includes(am)).length || 0;
      // Primary sort: amenity match count (desc)
      if (bMatchCount !== aMatchCount) return bMatchCount - aMatchCount;
    }
    // Always sort by revenue (desc) — highest earners first
    return b.revenue - a.revenue;
  });
  
  const displayComps = showAll ? sortedComparables : sortedComparables.slice(0, 6);
  
  // Split into matching and non-matching groups for section headers
  const matchingComps = hasAmenityFilter
    ? displayComps.filter(c => (c.amenities?.filter(am => selectedAmenities.includes(am)).length || 0) > 0)
    : [];
  const nonMatchingComps = hasAmenityFilter
    ? displayComps.filter(c => (c.amenities?.filter(am => selectedAmenities.includes(am)).length || 0) === 0)
    : displayComps;
  
  const openCarousel = (comp: Comparable) => {
    // Only open carousel if there are images
    const images = comp.images && comp.images.length > 0 ? comp.images : (comp.imageUrl ? [comp.imageUrl] : []);
    if (images.length > 0) {
      setSelectedComp(comp);
      setCarouselOpen(true);
    }
  };
  
  const getCompImages = (comp: Comparable): string[] => {
    if (comp.images && comp.images.length > 0) return comp.images;
    if (comp.imageUrl) return [comp.imageUrl];
    return [];
  };
  
  return (
    <>
      {/* Image Carousel Modal */}
      <ImageCarousel
        images={selectedComp ? getCompImages(selectedComp) : []}
        isOpen={carouselOpen}
        onClose={() => {
          setCarouselOpen(false);
          setSelectedComp(null);
        }}
        title={selectedComp?.title}
        airbnbUrl={selectedComp?.airbnbUrl}
      />
      
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        {/* Comp Strength Indicator */}
        <CompStrengthIndicator comparables={comparables} />

        {/* Owner: comp selection status banner */}
        {isOwner && selectedCompIds && selectedCompIds.size < comparables.length && (
          <div className="mb-4 flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-blue-800">{selectedCompIds.size} of {comparables.length} comps selected</span>
              <span className="text-xs text-blue-600">— projections updated based on selection</span>
            </div>
            <div className="flex items-center gap-3">
              {/* Save comp selection button */}
              {onSaveCompSelection && hasUnsavedCompSelection && (
                <button
                  onClick={onSaveCompSelection}
                  disabled={isSavingCompSelection}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white transition-colors shadow-sm"
                >
                  {isSavingCompSelection ? (
                    <><Loader2 className="w-3 h-3 animate-spin" /> Saving...</>
                  ) : (
                    <><Save className="w-3 h-3" /> Save Selection</>
                  )}
                </button>
              )}
              {/* Saved flash */}
              {onSaveCompSelection && compSelectionSaved && !hasUnsavedCompSelection && (
                <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Saved
                </span>
              )}
              <button
                onClick={() => {
                  comparables.forEach(c => {
                    if (onToggleComp && selectedCompIds && !selectedCompIds.has(c.id)) {
                      onToggleComp(c.id);
                    }
                  });
                }}
                className="text-xs font-medium text-blue-600 hover:text-blue-800 underline"
              >
                Reset all
              </button>
            </div>
          </div>
        )}
        
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Similar Properties Nearby</h3>
            <p className="text-slate-500 text-sm">{comparables.length} properties making money in this area</p>
          </div>
          <div className="flex items-center gap-3">
            {/* View on Map button */}
            {propertyLatitude && propertyLongitude && comparables.some(c => c.latitude && c.longitude) && (
              <button
                onClick={() => setShowMap(true)}
                className="flex items-center gap-1.5 text-sm font-medium text-[#C9A962] hover:text-[#b8963f] bg-[#C9A962]/10 hover:bg-[#C9A962]/20 px-3 py-1.5 rounded-lg transition-colors"
              >
                <Map className="w-4 h-4" />
                View on Map
              </button>
            )}
            {comparables.length > 6 && (
              <button
                onClick={() => setShowAll(!showAll)}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                {showAll ? 'Show less' : `See all ${comparables.length}`}
              </button>
            )}
          </div>
        </div>
        
        {/* Comp Map Modal */}
        {showMap && propertyLatitude && propertyLongitude && (
          <CompMapModal
            comparables={comparables}
            propertyLatitude={propertyLatitude}
            propertyLongitude={propertyLongitude}
            address={address || 'Your Property'}
            onClose={() => setShowMap(false)}
          />
        )}
        
        {/* Amenity Filter Status Banner */}
        {amenityFilter && (
          <div className={`rounded-lg p-3 mb-4 text-sm ${
            amenityFilter.applied 
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : amenityFilter.relaxed 
                ? 'bg-amber-50 border border-amber-200 text-amber-800'
                : 'bg-slate-50 border border-slate-200 text-slate-600'
          }`}>
            {amenityFilter.applied ? (
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-emerald-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                <span><strong>Amenity-filtered comps</strong> — showing only properties that match your amenities ({amenityFilter.selected_amenities.join(', ')}). Revenue estimate is based on these {amenityFilter.comp_count} comparable properties.</span>
              </div>
            ) : amenityFilter.relaxed ? (
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-amber-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
                <span><strong>Not enough amenity-matched comps</strong> — fewer than 3 properties matched your amenities ({amenityFilter.selected_amenities.join(', ')}). Showing all comparable properties instead. Matching comps are highlighted.</span>
              </div>
            ) : null}
          </div>
        )}
        
        {/* Amenity Insights Summary */}
        {(() => {
          // Calculate amenity prevalence across all comps
          const amenityCounts: Record<string, number> = {};
          const compsWithAmenities = comparables.filter(c => c.amenities && c.amenities.length > 0);
          compsWithAmenities.forEach(c => {
            c.amenities?.forEach(a => {
              amenityCounts[a] = (amenityCounts[a] || 0) + 1;
            });
          });
          
          if (compsWithAmenities.length === 0) return null;
          
          // Sort by prevalence and take top amenities
          const sortedAmenities = Object.entries(amenityCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8);
          
          // Calculate revenue premium for each amenity
          const overallMedianRevenue = (() => {
            const revs = comparables.filter(c => c.revenue > 0).map(c => c.revenue).sort((a, b) => a - b);
            if (revs.length === 0) return 0;
            return revs[Math.floor(revs.length / 2)];
          })();
          
          return (
            <div className="mb-4 p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-200/60">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm font-semibold text-amber-900">Amenity Insights</span>
                <span className="text-xs text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">{compsWithAmenities.length} properties analyzed</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {sortedAmenities.map(([amenity, count]) => {
                  const pct = Math.round((count / compsWithAmenities.length) * 100);
                  const isUserSelected = selectedAmenities.includes(amenity);
                  
                  // Calculate avg revenue for comps WITH this amenity
                  const withAmenity = comparables.filter(c => c.amenities?.includes(amenity) && c.revenue > 0);
                  const avgRevWith = withAmenity.length > 0 
                    ? withAmenity.reduce((sum, c) => sum + c.revenue, 0) / withAmenity.length 
                    : 0;
                  const revenuePremium = overallMedianRevenue > 0 
                    ? Math.round(((avgRevWith - overallMedianRevenue) / overallMedianRevenue) * 100) 
                    : 0;
                  
                  return (
                    <div 
                      key={amenity} 
                      className={`p-2 rounded-lg border text-center ${
                        isUserSelected 
                          ? 'bg-amber-100 border-amber-300' 
                          : 'bg-white/80 border-amber-100'
                      }`}
                    >
                      <div className="text-lg font-bold text-amber-800">{pct}%</div>
                      <div className="text-[10px] font-medium text-slate-700 leading-tight">{amenity}</div>
                      {revenuePremium !== 0 && (
                        <div className={`text-[10px] font-medium mt-0.5 ${
                          revenuePremium > 0 ? 'text-emerald-600' : 'text-slate-400'
                        }`}>
                          {revenuePremium > 0 ? '+' : ''}{revenuePremium}% rev
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {selectedAmenities.length > 0 && (
                 <p className="text-[10px] text-amber-700 mt-2">
                  <span className="font-medium">Your amenities highlighted</span> — comps sorted by best match first, then by revenue
                </p>
              )}
            </div>
          );
        })()}
        
        {/* Matching Comps Section */}
        {hasAmenityFilter && matchingComps.length > 0 && (
          <div className="mb-2">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="text-sm font-semibold text-slate-800">Best Matches</span>
              <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                {matchingComps.length} properties share your amenities
              </span>
            </div>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(hasAmenityFilter ? matchingComps : displayComps).map((comp, idx) => {
            const hasImages = (comp.images && comp.images.length > 0) || !!comp.imageUrl;
            const imageCount = comp.images?.length || (comp.imageUrl ? 1 : 0);
            const amenityMatchCount = hasAmenityFilter ? (comp.amenities?.filter(am => selectedAmenities.includes(am)).length || 0) : 0;
            
            const isCompSelected = !selectedCompIds || selectedCompIds.has(comp.id);
            return (
              <div 
                key={comp.id} 
                className={`border rounded-xl overflow-hidden hover:shadow-lg transition-all ${
                  !isCompSelected ? 'opacity-40 grayscale' : ''
                } ${
                  hasAmenityFilter && amenityMatchCount > 0
                    ? 'border-amber-300 ring-1 ring-amber-200/50'
                    : 'border-slate-200'
                }`}
              >
                {/* Image - Clickable to open carousel */}
                <div 
                  className={`h-32 bg-gradient-to-br from-amber-50 to-amber-100 relative ${hasImages ? 'cursor-pointer group' : ''}`}
                  onClick={() => hasImages && openCarousel(comp)}
                >
                  {comp.imageUrl ? (
                    <img 
                      src={comp.imageUrl} 
                      alt={comp.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        // On error, hide the image and show placeholder
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        const placeholder = target.nextElementSibling as HTMLElement;
                        if (placeholder) placeholder.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  {/* Placeholder - shown when no image or image fails to load */}
                  <div 
                    className="w-full h-full flex flex-col items-center justify-center absolute inset-0"
                    style={{ display: comp.imageUrl ? 'none' : 'flex' }}
                  >
                    <div className="w-12 h-12 rounded-full bg-amber-200/50 flex items-center justify-center mb-1">
                      <Home className="w-6 h-6 text-amber-600" />
                    </div>
                    <span className="text-xs font-medium text-amber-700">{comp.bedrooms} BR / {comp.bathrooms} BA</span>
                  </div>
                  {/* Hover overlay with photo count */}
                  {hasImages && imageCount > 1 && (
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <div className="flex items-center gap-1.5 bg-black/70 text-white px-3 py-1.5 rounded-full text-sm font-medium">
                        <Camera className="w-4 h-4" />
                        <span>{imageCount} photos</span>
                      </div>
                    </div>
                  )}
                  {/* Rank badge */}
                  <div className="absolute top-2 left-2 w-6 h-6 rounded-full bg-white/90 flex items-center justify-center text-xs font-bold text-slate-700 shadow-sm">
                    {idx + 1}
                  </div>
                  {/* Amenity match badge */}
                  {hasAmenityFilter && amenityMatchCount > 0 && (
                    <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-amber-500 text-white rounded-full px-2 py-0.5 shadow-sm">
                      <span className="text-[10px] font-bold">{amenityMatchCount}/{selectedAmenities.length} match</span>
                    </div>
                  )}
                  {/* Owner: include/exclude toggle */}
                  {isOwner && onToggleComp && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onToggleComp(comp.id); }}
                      className={`absolute top-2 right-2 z-10 flex items-center gap-1 rounded-full px-2 py-0.5 shadow-sm text-xs font-semibold transition-colors ${
                        isCompSelected
                          ? 'bg-emerald-500 text-white hover:bg-red-500'
                          : 'bg-slate-700 text-white hover:bg-emerald-500'
                      }`}
                      title={isCompSelected ? 'Click to exclude from projections' : 'Click to include in projections'}
                    >
                      {isCompSelected ? '✓ In' : '+ Add'}
                    </button>
                  )}
                  {/* Rating badge (only show when no owner toggle, or when deselected) */}
                  {!isOwner && comp.rating > 0 && (
                    <div className="absolute top-2 right-2 flex items-center gap-1 bg-white/90 rounded-full px-2 py-0.5 shadow-sm">
                      <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                      <span className="text-xs font-medium text-slate-700">{comp.rating.toFixed(1)}</span>
                    </div>
                  )}
                  {/* Distance badge - only show when data is available */}
                  {comp.distanceMeters !== undefined && comp.distanceMeters > 0 && (
                    <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-slate-900/80 text-white rounded-full px-2 py-0.5 shadow-sm">
                      <MapPin className="w-3 h-3" />
                      <span className="text-xs font-medium">
                        {(comp.distanceMeters / 1609.34).toFixed(1)} mi
                      </span>
                    </div>
                  )}
                </div>
            
            {/* Content */}
            <div className="p-3">
              <h4 className="font-medium text-slate-900 text-sm line-clamp-1 mb-1">{comp.title}</h4>
              <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
                <span className="flex items-center gap-1">
                  <Bed className="w-3 h-3" /> {comp.bedrooms}
                </span>
                <span className="flex items-center gap-1">
                  <Bath className="w-3 h-3" /> {comp.bathrooms}
                </span>
                {comp.accommodates && (
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3" /> {comp.accommodates}
                  </span>
                )}
              </div>
              
              {/* Amenity Badges */}
              {comp.amenities && comp.amenities.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {comp.amenities.slice(0, 6).map((amenity) => {
                    const isMatch = selectedAmenities.includes(amenity);
                    return (
                      <span
                        key={amenity}
                        className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          isMatch
                            ? 'bg-amber-100 text-amber-800 ring-1 ring-amber-300'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {amenity}
                      </span>
                    );
                  })}
                  {comp.amenities.length > 6 && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-50 text-slate-400">
                      +{comp.amenities.length - 6}
                    </span>
                  )}
                </div>
              )}
              
              {/* Revenue */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-emerald-600 font-bold">{formatCompactCurrency(comp.revenue)}/yr</p>
                  <p className="text-[10px] text-slate-400">{Math.round(comp.occupancy)}% occupancy · ${Math.round(comp.adr)}/night</p>
                </div>
                {comp.airbnbUrl && (
                  <a
                    href={comp.airbnbUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4 text-slate-600" />
                  </a>
                )}
              </div>
            </div>
          </div>
        );
      })}
      </div>
      
      {/* Non-Matching Comps Section */}
      {hasAmenityFilter && nonMatchingComps.length > 0 && (
        <>
          <div className="mt-6 mb-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-slate-300" />
              <span className="text-sm font-medium text-slate-500">Other Properties</span>
              <span className="text-xs text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full">
                {nonMatchingComps.length} without selected amenities
              </span>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 opacity-75">
            {nonMatchingComps.map((comp, idx) => {
              const hasImages = (comp.images && comp.images.length > 0) || !!comp.imageUrl;
              const imageCount = comp.images?.length || (comp.imageUrl ? 1 : 0);
              
              const isNonMatchSelected = !selectedCompIds || selectedCompIds.has(comp.id);
              return (
                <div 
                  key={comp.id} 
                  className={`border border-slate-200 rounded-xl overflow-hidden hover:shadow-lg transition-all hover:opacity-100 ${
                    !isNonMatchSelected ? 'opacity-40 grayscale' : ''
                  }`}
                >
                  {/* Image */}
                  <div 
                    className={`h-32 bg-gradient-to-br from-slate-50 to-slate-100 relative ${hasImages ? 'cursor-pointer group' : ''}`}
                    onClick={() => hasImages && openCarousel(comp)}
                  >
                    {comp.imageUrl ? (
                      <img 
                        src={comp.imageUrl} 
                        alt={comp.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          const placeholder = target.nextElementSibling as HTMLElement;
                          if (placeholder) placeholder.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <div 
                      className="w-full h-full flex flex-col items-center justify-center absolute inset-0"
                      style={{ display: comp.imageUrl ? 'none' : 'flex' }}
                    >
                      <div className="w-12 h-12 rounded-full bg-slate-200/50 flex items-center justify-center mb-1">
                        <Home className="w-6 h-6 text-slate-400" />
                      </div>
                      <span className="text-xs font-medium text-slate-500">{comp.bedrooms} BR / {comp.bathrooms} BA</span>
                    </div>
                    {hasImages && imageCount > 1 && (
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <div className="flex items-center gap-1.5 bg-black/70 text-white px-3 py-1.5 rounded-full text-sm font-medium">
                          <Camera className="w-4 h-4" />
                          <span>{imageCount} photos</span>
                        </div>
                      </div>
                    )}
                    <div className="absolute top-2 left-2 w-6 h-6 rounded-full bg-white/90 flex items-center justify-center text-xs font-bold text-slate-400 shadow-sm">
                      {matchingComps.length + idx + 1}
                    </div>
                    {isOwner && onToggleComp ? (
                      <button
                        onClick={(e) => { e.stopPropagation(); onToggleComp(comp.id); }}
                        className={`absolute top-2 right-2 z-10 flex items-center gap-1 rounded-full px-2 py-0.5 shadow-sm text-xs font-semibold transition-colors ${
                          isNonMatchSelected
                            ? 'bg-emerald-500 text-white hover:bg-red-500'
                            : 'bg-slate-700 text-white hover:bg-emerald-500'
                        }`}
                        title={isNonMatchSelected ? 'Click to exclude from projections' : 'Click to include in projections'}
                      >
                        {isNonMatchSelected ? '✓ In' : '+ Add'}
                      </button>
                    ) : comp.rating > 0 ? (
                      <div className="absolute top-2 right-2 flex items-center gap-1 bg-white/90 rounded-full px-2 py-0.5 shadow-sm">
                        <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                        <span className="text-xs font-medium text-slate-700">{comp.rating.toFixed(1)}</span>
                      </div>
                    ) : null}
                    {comp.distanceMeters !== undefined && comp.distanceMeters > 0 && (
                      <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-slate-900/80 text-white rounded-full px-2 py-0.5 shadow-sm">
                        <MapPin className="w-3 h-3" />
                        <span className="text-xs font-medium">{(comp.distanceMeters / 1609.34).toFixed(1)} mi</span>
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <h4 className="font-medium text-slate-900 text-sm line-clamp-1 mb-1">{comp.title}</h4>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
                      <span className="flex items-center gap-1"><Bed className="w-3 h-3" /> {comp.bedrooms}</span>
                      <span className="flex items-center gap-1"><Bath className="w-3 h-3" /> {comp.bathrooms}</span>
                      {comp.accommodates && (
                        <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {comp.accommodates}</span>
                      )}
                    </div>
                    {comp.amenities && comp.amenities.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {comp.amenities.slice(0, 4).map((amenity) => (
                          <span key={amenity} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-500">
                            {amenity}
                          </span>
                        ))}
                        {comp.amenities.length > 4 && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-50 text-slate-400">+{comp.amenities.length - 4}</span>
                        )}
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-emerald-600 font-bold">{formatCompactCurrency(comp.revenue)}/yr</p>
                        <p className="text-[10px] text-slate-400">{Math.round(comp.occupancy)}% occupancy · ${Math.round(comp.adr)}/night</p>
                      </div>
                      {comp.airbnbUrl && (
                        <a href={comp.airbnbUrl} target="_blank" rel="noopener noreferrer" className="p-2 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">
                          <ExternalLink className="w-4 h-4 text-slate-600" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
    </>
  );
}
// ============================================
// MAIN COMPONENT
// ============================================

export function TeslaDashboard({ result, address, bedrooms, bathrooms, accommodates, monthlyRent, furnitureCost = 0, expensePercent = 20, marketId, rentometerData, mode = 'rent', purchasePrice, loanType = 'conventional', downPaymentPercent = 20, interestRate = 7, revenueScenarios, isOwner = false, shareCode, persistedRevenueOverride, persistedOccupancyOverride, persistedSelectedCompIds, onRevenueOverrideChange, onOccupancyOverrideChange, onCompSelectionChange, dataSource, selectedAmenities, amenityFilter, propertyLatitude, propertyLongitude }: TeslaDashboardProps) {
  console.log('[TeslaDashboard] marketId received:', marketId);
  // DEBUG: Remove this after testing
  if (typeof window !== 'undefined') {
    (window as any).__DEBUG_MARKET_ID__ = marketId;
  }
  const yearlyChange = result.historicalData?.summary?.yearly_pct_change;
  
  // Use the server-computed projected revenue (top-3 comp average) as the headline
  // The server already sets annual_revenue to the average of the top 3 comps by revenue
  const effectiveScenarios = revenueScenarios || result.revenueScenarios;
  const baseHeadlineRevenue = result.revenue.projected;

  // Comp selection state — initialize from persisted selection if available, otherwise all comps
  const [selectedCompIds, setSelectedCompIds] = useState<Set<string>>(() => {
    if (persistedSelectedCompIds && persistedSelectedCompIds.length > 0) {
      // Filter to only IDs that exist in current comparables
      const validIds = persistedSelectedCompIds.filter(id => 
        result.comparables.some(c => c.id === id)
      );
      if (validIds.length > 0) return new Set(validIds);
    }
    return new Set(result.comparables.map(c => c.id));
  });

  // Reset comp selection when result changes (new analysis)
  const prevCompsRef = React.useRef(result.comparables);
  useEffect(() => {
    if (prevCompsRef.current !== result.comparables) {
      setSelectedCompIds(new Set(result.comparables.map(c => c.id)));
      prevCompsRef.current = result.comparables;
    }
  }, [result.comparables]);

  const handleToggleComp = (compId: string) => {
    setSelectedCompIds(prev => {
      const next = new Set(prev);
      if (next.has(compId)) {
        if (next.size <= 1) return prev; // keep at least 1
        next.delete(compId);
      } else {
        next.add(compId);
      }
      // Notify parent of selection change
      onCompSelectionChange?.(Array.from(next));
      return next;
    });
  };

  // Save comp selection to DB — admin only, when shareCode exists
  const saveCompSelectionMutation = trpc.shareableReports.saveCompSelection.useMutation();
  const [compSelectionSaved, setCompSelectionSaved] = useState(false);
  const [hasUnsavedCompSelection, setHasUnsavedCompSelection] = useState(false);

  // Track unsaved comp selection changes
  const initialCompSelectionRef = React.useRef<Set<string>>(selectedCompIds);
  useEffect(() => {
    // Compare current selection to initial (persisted) selection
    const initial = initialCompSelectionRef.current;
    const changed = selectedCompIds.size !== initial.size || 
      Array.from(selectedCompIds).some(id => !initial.has(id));
    setHasUnsavedCompSelection(changed);
    setCompSelectionSaved(false);
  }, [selectedCompIds]);

  const handleSaveCompSelection = () => {
    if (!shareCode) return;
    saveCompSelectionMutation.mutate(
      { shareCode, selectedCompIds: Array.from(selectedCompIds) },
      {
        onSuccess: () => {
          setHasUnsavedCompSelection(false);
          setCompSelectionSaved(true);
          initialCompSelectionRef.current = new Set(selectedCompIds);
          setTimeout(() => setCompSelectionSaved(false), 3000);
        },
      }
    );
  };

  // Derive metrics from selected comps — overrides server metrics when a subset is selected
  const derivedMetrics = useMemo(() => {
    const selectedComps = result.comparables.filter(c => selectedCompIds.has(c.id));
    if (selectedComps.length === 0 || selectedComps.length === result.comparables.length) {
      return null; // all selected — use server metrics unchanged
    }
    const avgAdr = selectedComps.reduce((sum, c) => sum + c.adr, 0) / selectedComps.length;
    const avgOccupancy = selectedComps.reduce((sum, c) => sum + c.occupancy, 0) / selectedComps.length;
    const avgRevenue = selectedComps.reduce((sum, c) => sum + c.revenue, 0) / selectedComps.length;
    const minRevenue = Math.min(...selectedComps.map(c => c.revenue));
    const maxRevenue = Math.max(...selectedComps.map(c => c.revenue));
    return {
      adr: Math.round(avgAdr),
      occupancy: Math.round(avgOccupancy * 10) / 10,
      projectedRevenue: Math.round(avgRevenue),
      lowRevenue: Math.round(minRevenue),
      highRevenue: Math.round(maxRevenue),
      compCount: selectedComps.length,
    };
  }, [result.comparables, selectedCompIds]);

  // Admin revenue override — allows admin to adjust the headline revenue up/down
  // Initialize from persisted value if available (loaded from DB for shared reports)
  const [revenueOverride, setRevenueOverride] = useState<number | null>(persistedRevenueOverride ?? null);
  // Headline revenue: admin override > derived from selected comps > server value
  const headlineRevenue = revenueOverride ?? derivedMetrics?.projectedRevenue ?? baseHeadlineRevenue;
  
  // Scale revenue scenarios proportionally when admin overrides revenue
  // e.g. if target was $37k and admin sets $30k (~19% decrease), conservative & optimistic decrease by same ratio
  const adjustedScenarios = useMemo(() => {
    if (!effectiveScenarios || revenueOverride === null) return effectiveScenarios;
    const originalTarget = effectiveScenarios.target;
    if (!originalTarget || originalTarget === 0) return effectiveScenarios;
    const ratio = revenueOverride / originalTarget;
    return {
      ...effectiveScenarios,
      conservative: Math.round(effectiveScenarios.conservative * ratio),
      target: revenueOverride,
      optimistic: Math.round(effectiveScenarios.optimistic * ratio),
    };
  }, [effectiveScenarios, revenueOverride]);
  
  // Effective revenue values that respect admin override AND comp selection
  // Priority: admin override > derived from selected comps > server value
  const effectiveRevenue = useMemo(() => {
    if (revenueOverride !== null) {
      const ratio = baseHeadlineRevenue > 0 ? revenueOverride / baseHeadlineRevenue : 1;
      return {
        projected: revenueOverride,
        low: Math.round(result.revenue.low * ratio),
        high: Math.round(result.revenue.high * ratio),
      };
    }
    if (derivedMetrics) {
      return {
        projected: derivedMetrics.projectedRevenue,
        low: derivedMetrics.lowRevenue,
        high: derivedMetrics.highRevenue,
      };
    }
    return {
      projected: headlineRevenue,
      low: result.revenue.low,
      high: result.revenue.high,
    };
  }, [headlineRevenue, baseHeadlineRevenue, revenueOverride, derivedMetrics, result.revenue.low, result.revenue.high]);
  
  // Persist revenue override to DB — explicit Save button
  const updateOverrideMutation = trpc.shareableReports.updateRevenueOverride.useMutation();
  // Track whether there are unsaved changes (pending save)
  const [hasPendingOverride, setHasPendingOverride] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  const handleRevenueOverride = (newValue: number | null) => {
    setRevenueOverride(newValue);
    // Notify parent component so share button can include the override
    onRevenueOverrideChange?.(newValue);
    // Always mark as pending — admin must click Save to confirm
    setHasPendingOverride(true);
    setSavedFlash(false);
  };

  const handleSaveOverride = (explicitValue?: number | null) => {
    const valueToSave = explicitValue !== undefined ? explicitValue : revenueOverride;
    if (shareCode) {
      // Shared report context: persist to DB
      updateOverrideMutation.mutate(
        { shareCode, revenueOverride: valueToSave },
        {
          onSuccess: () => {
            setHasPendingOverride(false);
            setSavedFlash(true);
            setTimeout(() => setSavedFlash(false), 3000);
          },
          onError: () => {
            // Keep pending state so user can retry
          },
        }
      );
    } else {
      // Main analysis page: just confirm the value is locked in (no DB needed yet)
      // The share button will embed this value when the report is shared
      setHasPendingOverride(false);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 3000);
    }
  };
  
  // Admin occupancy/booking rate override
  const [occupancyOverride, setOccupancyOverride] = useState<number | null>(
    persistedOccupancyOverride != null ? Number(persistedOccupancyOverride) : null
  );
  const [hasPendingOccupancyOverride, setHasPendingOccupancyOverride] = useState(false);
  const [savedOccupancyFlash, setSavedOccupancyFlash] = useState(false);
  const updateOccupancyOverrideMutation = trpc.shareableReports.updateOccupancyOverride.useMutation();

  const handleOccupancyOverride = (newValue: number | null) => {
    setOccupancyOverride(newValue);
    onOccupancyOverrideChange?.(newValue);
    setHasPendingOccupancyOverride(true);
    setSavedOccupancyFlash(false);
  };

  const handleSaveOccupancyOverride = (explicitValue?: number | null) => {
    const valueToSave = explicitValue !== undefined ? explicitValue : occupancyOverride;
    if (shareCode) {
      updateOccupancyOverrideMutation.mutate(
        { shareCode, occupancyOverride: valueToSave },
        {
          onSuccess: () => {
            setHasPendingOccupancyOverride(false);
            setSavedOccupancyFlash(true);
            setTimeout(() => setSavedOccupancyFlash(false), 3000);
          },
        }
      );
    } else {
      setHasPendingOccupancyOverride(false);
      setSavedOccupancyFlash(true);
      setTimeout(() => setSavedOccupancyFlash(false), 3000);
    }
  };

  // Effective ADR and occupancy — occupancy override > derived from comps > server value
  const effectiveAdr = derivedMetrics?.adr ?? result.metrics.adr;
  const effectiveOccupancy = occupancyOverride !== null
    ? occupancyOverride
    : (derivedMetrics?.occupancy ?? result.metrics.occupancy);

  // Reset override when base revenue changes (new analysis)
  useEffect(() => {
    if (!persistedRevenueOverride) {
      setRevenueOverride(null);
    }
  }, [baseHeadlineRevenue]);
  
  // Purchase mode calculations
  // Uses comprehensive expense model matching OfferPriceSuggester & MaxPurchasePriceCalculator
  const purchaseCalcs = useMemo(() => {
    if (mode !== 'purchase' || !purchasePrice) return null;
    
    const annualRevenue = headlineRevenue;
    
    // Comprehensive operating expenses (matching OfferPriceSuggester model)
    const managementExpenses = annualRevenue * (expensePercent / 100); // 20% management/cleaning/platform fees
    const maintenanceExpenses = annualRevenue * 0.05; // 5% maintenance & CapEx reserve
    const propertyTax = purchasePrice * 0.012; // 1.2% property tax
    const insuranceExpense = purchasePrice * 0.006; // 0.6% insurance (STR requires higher coverage)
    const utilitiesExpense = 3000; // $250/month utilities (furnished STR)
    
    const operatingExpenses = managementExpenses + maintenanceExpenses + propertyTax + insuranceExpense + utilitiesExpense;
    const noi = annualRevenue - operatingExpenses;
    
    // Loan calculations
    const downPayment = purchasePrice * (downPaymentPercent / 100);
    const loanAmount = purchasePrice - downPayment;
    const closingCosts = purchasePrice * 0.03; // 3% closing costs
    const totalCashNeeded = downPayment + closingCosts;
    
    // Monthly mortgage payment (P&I)
    const monthlyRate = interestRate / 100 / 12;
    const numPayments = 30 * 12; // 30-year loan
    const monthlyMortgage = loanType === 'cash' ? 0 : 
      loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / 
      (Math.pow(1 + monthlyRate, numPayments) - 1);
    const annualDebtService = monthlyMortgage * 12;
    
    // Monthly fixed costs beyond mortgage (for CashFlowHero)
    const monthlyPropertyTax = propertyTax / 12;
    const monthlyInsurance = insuranceExpense / 12;
    const monthlyMaintenance = maintenanceExpenses / 12;
    const monthlyUtilities = utilitiesExpense / 12;
    const monthlyAdditionalCosts = monthlyPropertyTax + monthlyInsurance + monthlyMaintenance + monthlyUtilities;
    
    // Investment metrics
    const capRate = (noi / purchasePrice) * 100;
    const annualCashFlow = noi - annualDebtService;
    const cashOnCash = totalCashNeeded > 0 ? (annualCashFlow / totalCashNeeded) * 100 : 0;
    const dscr = annualDebtService > 0 ? noi / annualDebtService : Infinity;
    const breakEvenOccupancy = annualDebtService > 0 ? 
      ((annualDebtService + operatingExpenses) / annualRevenue) * effectiveOccupancy : 0;
    
    return {
      noi,
      downPayment,
      loanAmount,
      closingCosts,
      totalCashNeeded,
      monthlyMortgage,
      annualDebtService,
      capRate,
      annualCashFlow,
      monthlyCashFlow: annualCashFlow / 12,
      cashOnCash,
      dscr,
      breakEvenOccupancy,
      // Expense breakdown for display
      operatingExpenses,
      managementExpenses,
      maintenanceExpenses,
      propertyTax,
      insuranceExpense,
      utilitiesExpense,
      monthlyAdditionalCosts,
    };
  }, [mode, purchasePrice, headlineRevenue, expensePercent, downPaymentPercent, interestRate, loanType, effectiveOccupancy]);
  
  return (
    <div className="space-y-6">
      {/* Property Header */}
      <div className="text-center">
        <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2">
          {mode === 'purchase' ? 'Investment Analysis' : 'Property Analysis'}
        </h2>
        <p className="text-slate-500">{address}</p>
        <div className="flex items-center justify-center gap-3 mt-2 text-sm text-slate-500">
          <span className="flex items-center gap-1">
            <Bed className="w-4 h-4" /> {bedrooms} BR
          </span>
          <span className="flex items-center gap-1">
            <Bath className="w-4 h-4" /> {bathrooms} BA
          </span>
        </div>
      </div>
      
      {/* SECTION 1: Rent Validation - Market rent data from Rentometer */}
      {rentometerData && (
        <RentValidationSection rentometerData={rentometerData} monthlyRent={result.cashFlow.monthlyRent} mode={mode} />
      )}
      
      {/* SECTION 2: Revenue Projection - "What can I make?" */}
      <HeroRevenueCard
        annualRevenue={headlineRevenue}
        monthlyProfit={result.cashFlow.monthlyProfit}
        monthlyRent={result.cashFlow.monthlyRent}
        yearlyChange={yearlyChange}
        expensePercent={expensePercent}
        mode={mode}
        monthlyMortgage={purchaseCalcs?.monthlyMortgage || 0}
        monthlyAdditionalCosts={purchaseCalcs?.monthlyAdditionalCosts || 0}
        revenueScenarios={adjustedScenarios}
        isOwner={isOwner}
        onRevenueOverride={(val) => handleRevenueOverride(val)}
        revenueOverrideActive={revenueOverride !== null}
        onSaveOverride={(v) => handleSaveOverride(v)}
        isSavingOverride={updateOverrideMutation.isPending}
        savedOverrideFlash={savedFlash}
        hasPendingOverride={hasPendingOverride}
        saveOverrideError={updateOverrideMutation.isError}
        dataSource={dataSource}
      />
      
      {/* SECTION 3: Key Metrics - ADR, Occupancy, Revenue Range */}
      <KeyMetricsRow
        adr={effectiveAdr}
        occupancy={effectiveOccupancy}
        revenueLow={effectiveRevenue.low}
        revenueHigh={effectiveRevenue.high}
        isOwner={isOwner}
        occupancyOverrideActive={occupancyOverride !== null}
        onOccupancyOverride={isOwner ? handleOccupancyOverride : undefined}
        onSaveOccupancyOverride={isOwner ? handleSaveOccupancyOverride : undefined}
        isSavingOccupancyOverride={updateOccupancyOverrideMutation.isPending}
        savedOccupancyOverrideFlash={savedOccupancyFlash}
        hasPendingOccupancyOverride={hasPendingOccupancyOverride}
      />
      
      {/* PURCHASE MODE: Investment Metrics Section */}
      {mode === 'purchase' && purchaseCalcs && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">Investment Analysis</h3>
              <p className="text-sm text-slate-500">
                {loanType === 'cash' ? 'Cash Purchase' : 
                 loanType === 'dscr' ? 'DSCR Loan' : 
                 loanType === 'fha' ? 'FHA Loan' : 'Conventional Loan'} • 
                {formatCurrency(purchasePrice || 0)} purchase price
              </p>
            </div>
          </div>
          
          {/* Key Investment Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-slate-50 rounded-xl p-4 text-center">
              <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Cap Rate</div>
              <div className={`text-2xl font-bold ${purchaseCalcs.capRate >= 8 ? 'text-emerald-600' : purchaseCalcs.capRate >= 5 ? 'text-amber-600' : 'text-red-600'}`}>
                {purchaseCalcs.capRate.toFixed(1)}%
              </div>
              <div className="text-xs text-slate-400 mt-1">
                {purchaseCalcs.capRate >= 8 ? 'Excellent' : purchaseCalcs.capRate >= 5 ? 'Good' : 'Below Average'}
              </div>
            </div>
            
            <div className="bg-slate-50 rounded-xl p-4 text-center">
              <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Cash-on-Cash</div>
              <div className={`text-2xl font-bold ${purchaseCalcs.cashOnCash >= 15 ? 'text-emerald-600' : purchaseCalcs.cashOnCash >= 8 ? 'text-amber-600' : 'text-red-600'}`}>
                {purchaseCalcs.cashOnCash.toFixed(1)}%
              </div>
              <div className="text-xs text-slate-400 mt-1">
                {purchaseCalcs.cashOnCash >= 15 ? 'Excellent' : purchaseCalcs.cashOnCash >= 8 ? 'Good' : 'Below Average'}
              </div>
            </div>
            
            <div className="bg-slate-50 rounded-xl p-4 text-center">
              <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">DSCR</div>
              <div className={`text-2xl font-bold ${purchaseCalcs.dscr >= 1.25 ? 'text-emerald-600' : purchaseCalcs.dscr >= 1 ? 'text-amber-600' : 'text-red-600'}`}>
                {purchaseCalcs.dscr === Infinity ? '∞' : purchaseCalcs.dscr.toFixed(2)}
              </div>
              <div className="text-xs text-slate-400 mt-1">
                {purchaseCalcs.dscr >= 1.25 ? 'Strong' : purchaseCalcs.dscr >= 1 ? 'Acceptable' : 'Risky'}
              </div>
            </div>
            
            <div className="bg-slate-50 rounded-xl p-4 text-center">
              <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Break-even</div>
              <div className={`text-2xl font-bold ${purchaseCalcs.breakEvenOccupancy <= 50 ? 'text-emerald-600' : purchaseCalcs.breakEvenOccupancy <= 70 ? 'text-amber-600' : 'text-red-600'}`}>
                {purchaseCalcs.breakEvenOccupancy.toFixed(0)}%
              </div>
              <div className="text-xs text-slate-400 mt-1">
                Occupancy needed
              </div>
            </div>
          </div>
          
          {/* Cash Flow Summary */}
          <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl p-4 border border-emerald-100">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-xs text-slate-500 mb-1">Monthly Cash Flow</div>
                <div className={`text-lg font-bold ${purchaseCalcs.monthlyCashFlow >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {purchaseCalcs.monthlyCashFlow >= 0 ? '+' : ''}{formatCurrency(purchaseCalcs.monthlyCashFlow)}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500 mb-1">Annual Cash Flow</div>
                <div className={`text-lg font-bold ${purchaseCalcs.annualCashFlow >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {purchaseCalcs.annualCashFlow >= 0 ? '+' : ''}{formatCurrency(purchaseCalcs.annualCashFlow)}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500 mb-1">Total Cash Needed</div>
                <div className="text-lg font-bold text-slate-900">
                  {formatCurrency(purchaseCalcs.totalCashNeeded)}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500 mb-1">Monthly Mortgage</div>
                <div className="text-lg font-bold text-slate-900">
                  {formatCurrency(purchaseCalcs.monthlyMortgage)}
                </div>
              </div>
            </div>
          </div>
          
          {/* Tax Benefits & Total Return Section */}
          <details className="mt-4 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl p-4 border border-purple-100">
            <summary className="cursor-pointer text-sm font-medium text-purple-700 hover:text-purple-800 flex items-center gap-2">
              <ChevronDown className="w-4 h-4" />
              Tax Benefits & Total Return
            </summary>
            <div className="mt-4 space-y-4">
              {/* Tax Benefits Calculations */}
              {(() => {
                const annualDepreciation = (purchasePrice || 0) / 27.5; // 27.5 year depreciation
                const taxBracket = 0.25; // Assume 25% tax bracket
                const taxSavings = annualDepreciation * taxBracket;
                
                // Equity buildup (Year 1 principal paydown)
                const monthlyRate = interestRate / 100 / 12;
                const numPayments = 30 * 12;
                const firstYearPrincipal = (() => {
                  if (loanType === 'cash' || purchaseCalcs?.loanAmount === 0) return 0;
                  let balance = purchaseCalcs?.loanAmount || 0;
                  let totalPrincipal = 0;
                  for (let i = 0; i < 12; i++) {
                    const interestPayment = balance * monthlyRate;
                    const principalPayment = (purchaseCalcs?.monthlyMortgage || 0) - interestPayment;
                    totalPrincipal += principalPayment;
                    balance -= principalPayment;
                  }
                  return totalPrincipal;
                })();
                
                const totalReturn = (purchaseCalcs?.annualCashFlow || 0) + taxSavings + firstYearPrincipal;
                const totalReturnPercent = (purchaseCalcs?.totalCashNeeded || 0) > 0 
                  ? (totalReturn / (purchaseCalcs?.totalCashNeeded || 1)) * 100 
                  : 0;
                
                return (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="bg-white/70 rounded-lg p-3 text-center">
                        <div className="text-xs text-slate-500 mb-1">Annual Depreciation</div>
                        <div className="text-lg font-bold text-purple-600">{formatCurrency(annualDepreciation)}</div>
                        <div className="text-xs text-slate-400">27.5 year schedule</div>
                      </div>
                      <div className="bg-white/70 rounded-lg p-3 text-center">
                        <div className="text-xs text-slate-500 mb-1">Est. Tax Savings</div>
                        <div className="text-lg font-bold text-emerald-600">+{formatCurrency(taxSavings)}</div>
                        <div className="text-xs text-slate-400">at 25% bracket</div>
                      </div>
                      <div className="bg-white/70 rounded-lg p-3 text-center">
                        <div className="text-xs text-slate-500 mb-1">Equity Buildup (Yr 1)</div>
                        <div className="text-lg font-bold text-blue-600">+{formatCurrency(firstYearPrincipal)}</div>
                        <div className="text-xs text-slate-400">Principal paydown</div>
                      </div>
                      <div className="bg-white/70 rounded-lg p-3 text-center">
                        <div className="text-xs text-slate-500 mb-1">Total Return (Yr 1)</div>
                        <div className="text-lg font-bold text-emerald-600">{formatCurrency(totalReturn)}</div>
                        <div className="text-xs text-slate-400">{totalReturnPercent.toFixed(1)}% return</div>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 mt-3">
                      Total Return = Cash Flow ({formatCurrency(purchaseCalcs?.annualCashFlow || 0)}) + Tax Savings ({formatCurrency(taxSavings)}) + Equity ({formatCurrency(firstYearPrincipal)})
                    </p>
                  </>
                );
              })()}
            </div>
          </details>
          
          {/* Detailed Breakdown (Collapsible) */}
          <details className="mt-4">
            <summary className="cursor-pointer text-sm text-slate-500 hover:text-slate-700 flex items-center gap-2">
              <ChevronDown className="w-4 h-4" />
              View detailed breakdown
            </summary>
            <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">Purchase Price</span>
                  <span className="font-medium">{formatCurrency(purchasePrice || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Down Payment ({downPaymentPercent}%)</span>
                  <span className="font-medium">{formatCurrency(purchaseCalcs.downPayment)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Loan Amount</span>
                  <span className="font-medium">{formatCurrency(purchaseCalcs.loanAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Closing Costs (3%)</span>
                  <span className="font-medium">{formatCurrency(purchaseCalcs.closingCosts)}</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">Projected Revenue</span>
                  <span className="font-medium">{formatCurrency(effectiveRevenue.projected)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Operating Expenses ({expensePercent}%)</span>
                  <span className="font-medium text-red-600">-{formatCurrency(effectiveRevenue.projected * (expensePercent / 100))}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Net Operating Income</span>
                  <span className="font-medium">{formatCurrency(purchaseCalcs.noi)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Annual Debt Service</span>
                  <span className="font-medium text-red-600">-{formatCurrency(purchaseCalcs.annualDebtService)}</span>
                </div>
              </div>
            </div>
          </details>
        </div>
      )}
      
      {/* PURCHASE MODE: Advanced Tools */}
      {mode === 'purchase' && purchasePrice && (
        <div className="space-y-6">
          {/* Offer Price Suggester */}
          <OfferPriceSuggester
            listingPrice={purchasePrice}
            projectedAnnualRevenue={effectiveRevenue.projected}
            downPaymentPercent={downPaymentPercent}
            interestRate={interestRate}
            loanType={loanType}
          />
          
          {/* Maximum Purchase Price Calculator */}
          <MaxPurchasePriceCalculator
            projectedAnnualRevenue={effectiveRevenue.projected}
            downPaymentPercent={downPaymentPercent}
            interestRate={interestRate}
            loanType={loanType}
          />
          
          {/* Amortization Schedule */}
          <AmortizationSchedule
            purchasePrice={purchasePrice}
            downPaymentPercent={downPaymentPercent}
            interestRate={interestRate}
            loanType={loanType}
          />
        </div>
      )}
      
      {/* SECTION 4: Profit & Break-even - "What's left? When do I recoup?" (RENT MODE ONLY) */}
      {mode === 'rent' && (
        <ArbitrageCalculator
          monthlyRevenue={effectiveRevenue.projected / 12}
          monthlyRent={result.cashFlow.monthlyRent}
          occupancy={effectiveOccupancy}
          adr={effectiveAdr}
          furnitureCost={furnitureCost}
          expensePercent={expensePercent}
          revenueScenarios={adjustedScenarios || result.revenueScenarios}
        />
      )}
      
      {/* SECTION 4.5: Airbnb vs Long-Term Comparison */}
      <AirbnbVsLongTermComparison
        annualAirbnbRevenue={effectiveRevenue.projected}
        monthlyRent={result.cashFlow.monthlyRent}
        rentometerMedian={rentometerData?.median}
        expensePercent={expensePercent}
        mode={mode}
        monthlyMortgage={purchaseCalcs?.monthlyMortgage || 0}
        monthlyAdditionalCosts={purchaseCalcs?.monthlyAdditionalCosts || 0}
      />
      
      {/* SECTION 4.6: Revenue Projection Range (hidden when three-tier projections are shown in HeroRevenueCard) */}
      {!revenueScenarios && (
        <RevenuePercentileProjections
          revenueData={result.revenue}
          bedrooms={bedrooms}
        />
      )}
      
      {/* SECTION 5: Seasonal Forecast - "When are the peak/slow months?" */}
      <SeasonalForecast forecast={result.forecast} historicalData={result.historicalData} />
      
      <MarketHealthGrade
        occupancy={effectiveOccupancy}
        yoyChange={yearlyChange}
        professionalPct={result.marketInsights?.professionallyManagedPct}
        superhostPct={result.marketInsights?.superhostPct}
        totalListings={result.marketInsights?.totalListings}
        avgRating={result.marketInsights?.avgRating}
        forecast={result.forecast}
        marketScore={result.marketInsights?.marketScore}
      />
      
      <MarketPosition
        propertyRevenue={effectiveRevenue.projected}
        comparables={result.comparables}
      />
      
      <MarketInsights
        insights={result.marketInsights}
        totalComparables={result.comparables.length}
      />
      
      {/* SECTION 7: Proof - "Show me the comps" */}
      <ComparableProperties
        comparables={result.comparables}
        selectedAmenities={selectedAmenities}
        amenityFilter={amenityFilter}
        propertyLatitude={propertyLatitude}
        propertyLongitude={propertyLongitude}
        address={address}
        isOwner={isOwner}
        selectedCompIds={selectedCompIds}
        onToggleComp={handleToggleComp}
        onSaveCompSelection={shareCode ? handleSaveCompSelection : undefined}
        isSavingCompSelection={saveCompSelectionMutation.isPending}
        compSelectionSaved={compSelectionSaved}
        hasUnsavedCompSelection={hasUnsavedCompSelection}
      />

      {/* Property-Specific AI Chatbot */}
      <PropertyChatBot
        propertyContext={{
          address,
          bedrooms,
          bathrooms,
          accommodates,
          monthlyRent,
          projectedRevenue: effectiveRevenue.projected,
          revenueLow: effectiveRevenue.low,
          revenueHigh: effectiveRevenue.high,
          adr: effectiveAdr,
          occupancyRate: effectiveOccupancy,
          monthlyRevenue: effectiveRevenue.projected / 12,
          monthlyProfit: (effectiveRevenue.projected / 12) - monthlyRent - (effectiveRevenue.projected / 12) * (expensePercent / 100),
          revenueScenarios: adjustedScenarios ? {
            conservative: adjustedScenarios.conservative,
            target: adjustedScenarios.target,
            optimistic: adjustedScenarios.optimistic,
            compCount: adjustedScenarios.compCount,
          } : undefined,
          forecast: result.forecast?.map(f => ({
            month: f.month,
            revenue: f.revenue,
            adr: f.adr,
            occupancy: f.occupancy,
          })),
          comparables: result.comparables?.map(c => ({
            title: c.title,
            bedrooms: c.bedrooms,
            bathrooms: c.bathrooms,
            rating: c.rating,
            reviews: c.reviews,
            annualRevenue: c.revenue,
            adr: c.adr,
            occupancy: c.occupancy,
            distance: c.distanceMeters,
          })),
          historicalTrend: result.historicalData?.summary?.trend,
          yearlyPctChange: yearlyChange,
          marketInsights: result.marketInsights ? {
            professionallyManagedPct: result.marketInsights.professionallyManagedPct,
            superhostPct: result.marketInsights.superhostPct,
            avgRating: result.marketInsights.avgRating,
            totalListings: result.marketInsights.totalListings,
            marketScore: result.marketInsights.marketScore,
          } : undefined,
          rentometer: rentometerData ? {
            median: rentometerData.median,
            mean: rentometerData.mean,
            min: rentometerData.min,
            max: rentometerData.max,
            sampleCount: rentometerData.sampleCount,
            radiusMiles: rentometerData.radiusMiles,
            stdDev: rentometerData.stdDev,
            userRentVsMarket: rentometerData.userRentVsMarket,
            rentAdvantage: rentometerData.rentAdvantage,
            percentileRank: rentometerData.percentileRank,
          } : undefined,
          mode,
          purchasePrice,
        }}
      />
    </div>
  );
}

export default TeslaDashboard;
