// @ts-nocheck
/**
 * Full Property Report Component
 * 
 * A comprehensive, client-facing shareable report that combines ALL analysis steps:
 * 1. Property Overview (address, specs, map, Street View)
 * 2. Revenue Projections (annual/monthly estimates, monthly forecast chart)
 * 3. Market Analysis (market health, bedroom performance, seasonality)
 * 4. Competition Analysis (comparable properties with map, ratings, revenue)
 * 5. Rental Arbitrage Scenario (rent-based break-even, cash flow, ROI)
 * 6. Purchase Investment Scenario (mortgage-based break-even, cap rate, cash-on-cash)
 * 7. AI Executive Summary (synthesized analysis)
 * 
 * Designed to be NON-PRESCRIPTIVE — presents data only, no investment advice.
 * Branded as Coach Inayah throughout.
 * 
 * LIGHT THEME — warm white backgrounds, gold (#C9A962) accents, navy text.
 */

import { useState, useMemo, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Home,
  MapPin,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Percent,
  Star,
  ExternalLink,
  Users,
  Calendar,
  Target,
  BarChart3,
  Bed,
  Bath,
  Building,
  Calculator,
  PiggyBank,
  Wallet,
  Landmark,
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Share2,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Award,
  Eye,
  RefreshCw,
  Loader2,
  HelpCircle,
  Info,
  ListFilter
} from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { MonthlyForecastChart, SeasonalityChart, BedroomPerformanceChart } from './RevenueCharts';
import { CompsMapView } from './CompsMapView';
import { MapView } from './Map';
import { StreetViewPanorama } from './StreetViewPanorama';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { LightMarkdown } from '@/components/LightMarkdown';
import { useAuth } from '@/_core/hooks/useAuth';
import { trpc } from '@/lib/trpc';

// ============================================================
// TYPES
// ============================================================

interface PropertyInfo {
  address: string;
  city: string;
  state: string;
  zipCode: string;
  bedrooms: number;
  bathrooms: number;
  accommodates: number;
  propertyType?: string;
  sqft?: number;
  latitude?: number;
  longitude?: number;
}

interface RevenueEstimate {
  annual: number;
  monthly: number;
  nightly: number;
  occupancy: number;
  range?: { low: number; high: number };
}

interface MonthlyForecast {
  month: string;
  revenue: number;
  occupancy: number;
  adr?: number;
}

interface Comparable {
  id?: string;
  title: string;
  airbnb_url?: string;
  image_url?: string;
  bedrooms: number;
  bathrooms: number;
  accommodates?: number;
  property_type?: string;
  rating: number | null;
  reviews: number;
  annual_revenue: number;
  adr: number;
  occupancy: number;
  superhost?: boolean;
  distance_meters?: number;
  latitude?: number;
  longitude?: number;
  airbnb_listing_id?: string;
}

interface BedroomPerformance {
  bedrooms: number;
  occupancy: number;
  adr: number;
  revenue: number;
  listing_count?: number;
  count?: number;
  avg_revenue?: number;
  avg_adr?: number;
  avg_occupancy?: number;
}

interface MarketData {
  name: string;
  metrics: {
    occupancy: number;
    adr: number;
    revenue: number;
    revpar?: number;
    active_listings: number;
    market_score?: number;
  };
  listing_count: number;
}

interface RentalArbitrageScenario {
  monthlyRent: number;
  startupCosts?: number;
}

interface PurchaseScenario {
  purchasePrice: number;
  downPaymentPercent?: number;
  interestRate?: number;
  loanTerm?: number;
  loanType?: 'conventional' | 'dscr' | 'fha' | 'cash';
  propertyTax?: number;
  insurance?: number;
  closingCosts?: number;
}

interface HistoricalData {
  summary: {
    monthly_pct_change?: number;
    yearly_pct_change?: number;
    yoy_revenue_change?: number;
    yoy_occupancy_change?: number;
    yoy_adr_change?: number;
    trend?: 'up' | 'down' | 'stable' | string;
  };
  months?: Array<{
    date: string;
    revenue: number;
    occupancy?: number;
    adr?: number;
  }>;
  monthly?: Array<{
    date: string;
    revenue: number;
    occupancy?: number;
    adr?: number;
  }>;
}

interface SubmarketInfo {
  id: string;
  name: string;
  listing_count: number;
  metrics?: {
    occupancy: number;
    adr: number;
    revenue: number;
    revpar: number;
    market_score?: number;
  };
}

export interface FullReportData {
  property: PropertyInfo;
  revenue_estimate: RevenueEstimate;
  monthly_forecast: MonthlyForecast[];
  comps: Comparable[];
  same_bedroom_comps?: Comparable[];
  market_data?: MarketData;
  bedroom_performance: BedroomPerformance[];
  revenue_percentiles?: {
    p10: number; p25: number; p50: number; p75: number; p90: number;
  };
  rental_arbitrage?: RentalArbitrageScenario;
  purchase?: PurchaseScenario;
  historical_data?: HistoricalData;
  ai_summary?: string;
  generated_at?: string;
  prepared_for?: string;
  // New investor-grade sections
  stress_test?: StressTestMatrix;
  itemized_expenses?: ItemizedExpenses;
  regulation?: RegulationData;
  comparable_sales?: ComparableSale[];
  // Supply trend and submarket data
  supply_trend?: Array<{ date: string; value: number }>;
  submarkets?: SubmarketInfo[];
}

interface StressTestScenario {
  occupancy_pct: number;
  adr: number;
  monthly_revenue: number;
  annual_revenue: number;
  monthly_profit?: number;
  annual_profit?: number;
  cash_flow_positive: boolean;
}

interface StressTestMatrix {
  base_occupancy: number;
  base_adr: number;
  base_monthly_rent?: number;
  scenarios: StressTestScenario[];
}

interface ExpenseItem {
  category: string;
  monthly: number;
  annual: number;
  percentage: number;
}

interface ItemizedExpenses {
  items: ExpenseItem[];
  total_monthly: number;
  total_annual: number;
  total_percentage: number;
  net_monthly_revenue: number;
  net_annual_revenue: number;
}

interface RegulationData {
  status: string;
  summary: string;
  simplified_summary: string;
  key_requirements: string[];
  permit_required: boolean;
  primary_residence_only: boolean;
  max_nights_per_year?: number;
  registration_fee?: string;
  occupancy_tax?: string;
  zoning_restrictions?: string;
  confidence: string;
  warnings: string[];
  sources: Array<{ title: string; url: string; type: string; isOfficial: boolean }>;
}

interface ComparableSale {
  address: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  sqft?: number;
  lot_size?: string;
  year_built?: number;
  days_on_market?: number;
  status: string;
  url?: string;
  image_url?: string;
  price_per_sqft?: number;
}

interface FullPropertyReportProps {
  data: FullReportData;
  onBack?: () => void;
  shareId?: string;
  isSharedView?: boolean;
}

// ============================================================
// HELPERS
// ============================================================

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);

const formatPercent = (value: number) => {
  const pct = value > 1 ? value : value * 100;
  return `${Math.round(pct)}%`;
};

const formatMonth = (dateStr: string) => {
  if (!dateStr) return '';
  const parts = dateStr.split(/[-/]/);
  if (parts.length >= 2) {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthIdx = parseInt(parts[1]) - 1;
    return monthNames[monthIdx] || dateStr;
  }
  return dateStr.slice(0, 3);
};

// ============================================================
// SUB-COMPONENTS (Light Theme)
// ============================================================

/** Reusable tooltip icon — renders a small (?) circle next to any label.
 *  Hover or tap to see the explanation. */
function InfoTip({ text, className }: { text: string; className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className={`inline-flex items-center justify-center ml-1 text-[#94a3b8] hover:text-[#C9A962] transition-colors focus:outline-none ${className || ''}`}>
          <HelpCircle className="w-3.5 h-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}

/** Badge to distinguish data source — "Your Property" vs "Market Average" */
function DataSourceBadge({ type }: { type: 'property' | 'market' }) {
  return type === 'property' ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-[#C9A962]/15 text-[#C9A962] border border-[#C9A962]/25">
      <Home className="w-2.5 h-2.5" /> Your Property
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-[#f1f5f9] text-[#64748b] border border-[#e2e8f0]">
      <BarChart3 className="w-2.5 h-2.5" /> Market Data
    </span>
  );
}

function SectionHeader({ icon: Icon, title, subtitle, tooltip }: { icon: React.ElementType; title: string; subtitle?: string; tooltip?: string }) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-[#C9A962]/15 flex items-center justify-center">
          <Icon className="w-5 h-5 text-[#C9A962]" />
        </div>
        <h2 className="text-2xl md:text-3xl font-serif font-bold text-[#1e293b]">
          {title}
          {tooltip && <InfoTip text={tooltip} />}
        </h2>
      </div>
      {subtitle && <p className="text-[#64748b] ml-[52px]">{subtitle}</p>}
    </div>
  );
}

function StatCard({ label, value, sublabel, icon: Icon, highlight, tooltip }: {
  label: string; value: string; sublabel?: string; icon?: React.ElementType; highlight?: boolean; tooltip?: string;
}) {
  return (
    <div className={`rounded-xl p-5 ${highlight ? 'bg-[#C9A962]/10 border border-[#C9A962]/30' : 'bg-white border border-[#e2e8f0]'}`}>
      {Icon && <Icon className={`w-5 h-5 mb-2 ${highlight ? 'text-[#C9A962]' : 'text-[#94a3b8]'}`} />}
      <p className={`text-2xl font-serif font-bold ${highlight ? 'text-[#C9A962]' : 'text-[#1e293b]'}`}>{value}</p>
      <p className="text-sm text-[#64748b] mt-1">
        {label}
        {tooltip && <InfoTip text={tooltip} />}
      </p>
      {sublabel && <p className="text-xs text-[#94a3b8] mt-0.5">{sublabel}</p>}
    </div>
  );
}

function DataRow({ label, value, highlight, tooltip }: { label: string; value: string | React.ReactNode; highlight?: boolean; tooltip?: string }) {
  return (
    <div className={`flex justify-between items-center py-3 px-4 ${highlight ? 'bg-[#C9A962]/5' : ''} border-b border-[#e2e8f0] last:border-0`}>
      <span className="text-[#64748b] text-sm">
        {label}
        {tooltip && <InfoTip text={tooltip} />}
      </span>
      <span className={`font-medium ${highlight ? 'text-[#C9A962] font-bold' : 'text-[#1e293b]'}`}>{value}</span>
    </div>
  );
}

function InsightBox({ children, type = 'info' }: { children: React.ReactNode; type?: 'info' | 'success' | 'warning' }) {
  const styles = {
    info: 'bg-[#f8fafc] border-[#e2e8f0] text-[#1e293b]',
    success: 'bg-[#C9A962]/8 border-[#C9A962]/25 text-[#1e293b]',
    warning: 'bg-amber-50/80 border-amber-200 text-[#1e293b]',
  };
  return (
    <div className={`rounded-xl p-4 border ${styles[type]} text-sm`}>
      {children}
    </div>
  );
}

// ============================================================
// SECTION NAVIGATION (Light Theme — pill tabs with gold active)
// ============================================================

const SECTIONS = [
  { id: 'overview', label: 'Overview', icon: Home },
  { id: 'revenue', label: 'Revenue', icon: DollarSign },
  { id: 'expenses', label: 'Expenses', icon: Wallet },
  { id: 'market', label: 'Market', icon: BarChart3 },
  { id: 'competition', label: 'Competition', icon: Target },
  { id: 'regulation', label: 'Regulations', icon: BookOpen },
  { id: 'stress', label: 'Stress Test', icon: AlertTriangle },
  { id: 'sales', label: 'Comp Sales', icon: Landmark },
  { id: 'rental', label: 'Rental Arbitrage', icon: Building },
  { id: 'purchase', label: 'Purchase', icon: Landmark },
  { id: 'tax', label: 'Tax Implications', icon: Calculator },
  { id: 'summary', label: 'Summary', icon: Sparkles },
];

function SectionNav({ activeSection, onSectionClick, hasRental, hasPurchase, hasExpenses, hasRegulation, hasStressTest, hasSales, hasTax }: {
  activeSection: string;
  onSectionClick: (id: string) => void;
  hasRental: boolean;
  hasPurchase: boolean;
  hasExpenses?: boolean;
  hasRegulation?: boolean;
  hasStressTest?: boolean;
  hasSales?: boolean;
  hasTax?: boolean;
}) {
  const visibleSections = SECTIONS.filter(s => {
    if (s.id === 'rental' && !hasRental) return false;
    if (s.id === 'purchase' && !hasPurchase) return false;
    if (s.id === 'expenses' && !hasExpenses) return false;
    if (s.id === 'regulation' && !hasRegulation) return false;
    if (s.id === 'stress' && !hasStressTest) return false;
    if (s.id === 'sales' && !hasSales) return false;
    if (s.id === 'tax' && !hasTax) return false;
    return true;
  });

  return (
    <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#e2e8f0] py-3">
      <div className="max-w-5xl mx-auto px-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {visibleSections.map((section) => (
            <button
              key={section.id}
              onClick={() => onSectionClick(section.id)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${
                activeSection === section.id
                  ? 'bg-[#C9A962] text-white shadow-sm'
                  : 'bg-[#f1f5f9] text-[#64748b] hover:bg-[#e2e8f0] hover:text-[#1e293b]'
              }`}
            >
              <section.icon className="w-4 h-4" />
              {section.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function FullPropertyReport({ data, onBack, shareId, isSharedView }: FullPropertyReportProps) {
  const [activeSection, setActiveSection] = useState('overview');
  const [copied, setCopied] = useState(false);
  const [showStreetView, setShowStreetView] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [showAllComps, setShowAllComps] = useState(false);
  const [selectedCompIds, setSelectedCompIds] = useState<Set<string>>(new Set());
  const [compSelectionInitialized, setCompSelectionInitialized] = useState(false);

  const { user, isAuthenticated } = useAuth();
  const isAdmin = isAuthenticated && user?.role === 'admin';

  const regenerateMutation = trpc.sharedReports.regenerate.useMutation({
    onSuccess: (result) => {
      setIsRegenerating(false);
      if (result.success) {
        toast.success('Report regenerated with fresh data. Reloading...');
        setTimeout(() => window.location.reload(), 1500);
      } else {
        toast.error(result.error || 'Failed to regenerate report');
      }
    },
    onError: (err) => {
      setIsRegenerating(false);
      toast.error(err.message || 'Failed to regenerate report');
    },
  });

  const handleRegenerate = () => {
    if (!shareId || isRegenerating) return;
    setIsRegenerating(true);
    regenerateMutation.mutate({ shareId });
  };

  const saveCompSelectionMutation = trpc.sharedReports.saveCompSelection.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success(`Comp selection saved (${result.selectedCount} comps). Clients will see this selection.`);
      }
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to save comp selection');
    },
  });

  const handleSaveCompSelection = () => {
    if (!shareId) return;
    saveCompSelectionMutation.mutate({
      shareId,
      selectedCompIds: Array.from(selectedCompIds),
    });
  };

  const {
    property,
    revenue_estimate,
    monthly_forecast = [],
    comps = [],
    same_bedroom_comps,
    market_data: rawMarketData,
    bedroom_performance = [],
    revenue_percentiles,
    rental_arbitrage,
    purchase,
    historical_data,
    ai_summary,
    generated_at,
    prepared_for,
    stress_test,
    itemized_expenses,
    regulation,
    comparable_sales,
    supply_trend,
    submarkets,
    comp_selection,
  } = data as any;

  // Defensive fallback for market_data (older reports may not have it)
  const market_data = rawMarketData || {
    name: 'Local Market',
    listing_count: 0,
    metrics: {
      occupancy: revenue_estimate?.occupancy || 0,
      adr: revenue_estimate?.nightly || 0,
      revenue: revenue_estimate?.annual || 0,
      revpar: (revenue_estimate?.nightly || 0) * ((revenue_estimate?.occupancy || 0) > 1 ? (revenue_estimate?.occupancy || 0) / 100 : (revenue_estimate?.occupancy || 0)),
      active_listings: 0,
    },
  };

  // Handle legacy expense_breakdown alias
  const expenses = itemized_expenses || (data as any).expense_breakdown;

  // Normalize stress_test for backward compatibility:
  // Old reports use 'occupancy' (integer 0-100), new reports use 'occupancy_pct' (decimal 0-1)
  if (stress_test?.scenarios) {
    stress_test.scenarios = stress_test.scenarios.map((s: any) => {
      if (s.occupancy_pct == null && s.occupancy != null) {
        // Old format: occupancy is integer 0-100, convert to decimal 0-1
        return { ...s, occupancy_pct: s.occupancy > 1 ? s.occupancy / 100 : s.occupancy, cash_flow_positive: (s.monthly_profit ?? 0) >= 0 };
      }
      if (s.occupancy_pct != null && s.cash_flow_positive == null) {
        return { ...s, cash_flow_positive: (s.monthly_profit ?? 0) >= 0 };
      }
      return s;
    });
    // Normalize base_occupancy: if > 1, it's old integer format
    if (stress_test.base_occupancy > 1) {
      stress_test.base_occupancy = stress_test.base_occupancy / 100;
    }
  }

  const displayComps: Comparable[] = (same_bedroom_comps && same_bedroom_comps.length > 0 ? same_bedroom_comps : comps)
    .sort((a: Comparable, b: Comparable) => b.annual_revenue - a.annual_revenue);

  // Initialize comp selection: all comps selected by default
  // Uses a stable key: comp.id || comp.airbnb_listing_id || index
  const getCompKey = (comp: Comparable, index: number) => comp.id || comp.airbnb_listing_id || `comp-${index}`;
  const compStorageKey = shareId ? `comp-selection-${shareId}` : null;

  useEffect(() => {
    if (displayComps.length > 0 && !compSelectionInitialized) {
      // Priority 1: Load from backend-saved selection (persisted in report data)
      if (comp_selection?.selectedIds?.length > 0) {
        const validIds = new Set(
          (comp_selection.selectedIds as string[]).filter((id: string) =>
            displayComps.some((c, i) => getCompKey(c, i) === id)
          )
        );
        if (validIds.size > 0) {
          setSelectedCompIds(validIds);
          setCompSelectionInitialized(true);
          return;
        }
      }
      // Priority 2: Load from localStorage
      if (compStorageKey) {
        try {
          const saved = localStorage.getItem(compStorageKey);
          if (saved) {
            const savedIds = JSON.parse(saved) as string[];
            const validIds = new Set(savedIds.filter(id =>
              displayComps.some((c, i) => getCompKey(c, i) === id)
            ));
            if (validIds.size > 0) {
              setSelectedCompIds(validIds);
              setCompSelectionInitialized(true);
              return;
            }
          }
        } catch { /* ignore parse errors */ }
      }
      // Default: select all comps
      const allIds = new Set<string>(displayComps.map((c: Comparable, i: number) => getCompKey(c, i)));
      setSelectedCompIds(allIds);
      setCompSelectionInitialized(true);
    }
  }, [displayComps, compSelectionInitialized]);

  // Persist comp selection to localStorage whenever it changes
  useEffect(() => {
    if (compSelectionInitialized && compStorageKey) {
      try {
        localStorage.setItem(compStorageKey, JSON.stringify(Array.from(selectedCompIds)));
      } catch { /* ignore storage errors */ }
    }
  }, [selectedCompIds, compSelectionInitialized, compStorageKey]);

  // Filtered comps based on user selection
  const filteredComps = useMemo(() => {
    if (selectedCompIds.size === 0 && compSelectionInitialized) return [];
    return displayComps.filter((c, i) => selectedCompIds.has(getCompKey(c, i)));
  }, [displayComps, selectedCompIds, compSelectionInitialized]);

  const toggleComp = (compKey: string) => {
    setSelectedCompIds(prev => {
      const next = new Set(prev);
      if (next.has(compKey)) {
        next.delete(compKey);
      } else {
        next.add(compKey);
      }
      return next;
    });
  };

  const toggleAllComps = () => {
    if (selectedCompIds.size === displayComps.length) {
      // Deselect all
      setSelectedCompIds(new Set());
    } else {
      // Select all
      setSelectedCompIds(new Set(displayComps.map((c, i) => getCompKey(c, i))));
    }
  };

  const hasRental = !!rental_arbitrage?.monthlyRent;
  const hasPurchase = !!purchase?.purchasePrice;
  const hasExpenses = !!expenses?.items?.length;
  const hasRegulation = !!regulation?.status;
  const hasStressTest = !!stress_test?.scenarios?.length;
  const hasSales = !!comparable_sales?.length;

  // Rental arbitrage calculations
  const rentalCalcs = useMemo(() => {
    if (!rental_arbitrage?.monthlyRent) return null;
    const rent = rental_arbitrage.monthlyRent;
    const startup = rental_arbitrage.startupCosts || (8000 + property.bedrooms * 4000);
    const monthlyRevenue = revenue_estimate.monthly;
    const monthlyProfit = monthlyRevenue - rent;
    const annualProfit = monthlyProfit * 12;
    const breakEvenOccupancy = rent / (revenue_estimate.nightly * 30);
    const breakEvenADR = rent / ((revenue_estimate.occupancy > 1 ? revenue_estimate.occupancy / 100 : revenue_estimate.occupancy) * 30);
    const monthsToRecoup = monthlyProfit > 0 ? Math.ceil(startup / monthlyProfit) : Infinity;
    const roi = startup > 0 ? (annualProfit / startup) * 100 : 0;
    const occupancyCushion = (revenue_estimate.occupancy > 1 ? revenue_estimate.occupancy / 100 : revenue_estimate.occupancy) - breakEvenOccupancy;

    return {
      rent, startup, monthlyRevenue, monthlyProfit, annualProfit,
      breakEvenOccupancy, breakEvenADR, monthsToRecoup, roi, occupancyCushion
    };
  }, [rental_arbitrage, revenue_estimate, property.bedrooms]);

  // Purchase calculations
  const purchaseCalcs = useMemo(() => {
    if (!purchase?.purchasePrice) return null;
    const price = purchase.purchasePrice;
    const downPct = (purchase.downPaymentPercent || 20) / 100;
    const downPayment = price * downPct;
    const loanAmount = price - downPayment;
    const rate = (purchase.interestRate || 7) / 100 / 12;
    const term = (purchase.loanTerm || 30) * 12;
    const monthlyMortgage = purchase.loanType === 'cash' ? 0 :
      loanAmount * (rate * Math.pow(1 + rate, term)) / (Math.pow(1 + rate, term) - 1);
    const annualMortgage = monthlyMortgage * 12;

    // Operating expenses (35% of revenue for STR)
    const operatingExpenses = revenue_estimate.annual * 0.35;
    const propertyTax = purchase.propertyTax || price * 0.012;
    const insurance = purchase.insurance || price * 0.005;
    const totalExpenses = annualMortgage + operatingExpenses + propertyTax + insurance;
    const noi = revenue_estimate.annual - operatingExpenses - propertyTax - insurance;
    const capRate = (noi / price) * 100;
    const annualCashFlow = revenue_estimate.annual - totalExpenses;
    const monthlyCashFlow = annualCashFlow / 12;
    const totalCashNeeded = downPayment + (purchase.closingCosts || price * 0.03);
    const cashOnCash = totalCashNeeded > 0 ? (annualCashFlow / totalCashNeeded) * 100 : 0;
    const dscr = annualMortgage > 0 ? noi / annualMortgage : Infinity;
    const breakEvenOccupancy = totalExpenses / (revenue_estimate.nightly * 365);

    return {
      price, downPayment, downPct, loanAmount, monthlyMortgage, annualMortgage,
      operatingExpenses, propertyTax, insurance, totalExpenses,
      noi, capRate, annualCashFlow, monthlyCashFlow,
      totalCashNeeded, cashOnCash, dscr, breakEvenOccupancy
    };
  }, [purchase, revenue_estimate]);

  // Best/worst months
  const bestMonth = monthly_forecast.length > 0
    ? monthly_forecast.reduce((best, cur) => cur.revenue > best.revenue ? cur : best, monthly_forecast[0])
    : null;
  const worstMonth = monthly_forecast.length > 0
    ? monthly_forecast.reduce((worst, cur) => cur.revenue < worst.revenue ? cur : worst, monthly_forecast[0])
    : null;

  const scrollToSection = (id: string) => {
    setActiveSection(id);
    const el = document.getElementById(`section-${id}`);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  const handleCopyLink = async () => {
    const url = shareId ? `${window.location.origin}/report/${shareId}` : window.location.href;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success('Link copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const reportDate = generated_at ? new Date(generated_at).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric'
  }) : new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#faf9f7] to-[#f5f3f0]">
      {/* ============================================================ */}
      {/* HEADER / TITLE PAGE — LIGHT THEME */}
      {/* ============================================================ */}
      <div className="bg-white border-b border-[#e2e8f0]">
        <div className="max-w-5xl mx-auto px-4 py-12">
          {/* Top Bar */}
          <div className="flex items-center justify-between mb-10">
            {onBack && (
              <button onClick={onBack} className="inline-flex items-center gap-2 text-[#64748b] hover:text-[#1e293b] transition-colors text-sm">
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
            )}
            {!onBack && <div />}
            <div className="flex items-center gap-2">
              {isAdmin && shareId && !isSharedView && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRegenerate}
                  disabled={isRegenerating}
                  className="gap-2 border-[#1e293b]/20 text-[#1e293b] hover:bg-[#1e293b]/5"
                >
                  {isRegenerating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  {isRegenerating ? 'Regenerating...' : 'Regenerate'}
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyLink}
                className="gap-2 border-[#C9A962]/40 text-[#C9A962] hover:bg-[#C9A962]/10"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied!' : 'Copy Link'}
              </Button>
            </div>
          </div>

          {/* Branding */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-[#C9A962]/15 flex items-center justify-center">
              <Home className="w-5 h-5 text-[#C9A962]" />
            </div>
            <div>
              <span className="text-sm font-medium text-[#C9A962] uppercase tracking-wider">Coach Inayah's Turnkey Tool</span>
              <span className="text-[#94a3b8] text-sm ml-3">Full Property Report</span>
            </div>
          </div>

          {/* Title */}
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-serif font-bold text-[#1e293b] mb-4 leading-tight">
            Comprehensive Investment Analysis
          </h1>
          <p className="text-[#64748b] text-lg mb-2">
            {property.address}
          </p>
          <div className="flex flex-wrap gap-4 text-sm text-[#94a3b8] mb-8">
            <span>{property.bedrooms} BR / {property.bathrooms} BA / Sleeps {property.accommodates}</span>
            <span>·</span>
            <span>Report generated {reportDate}</span>
            {prepared_for && (
              <>
                <span>·</span>
                <span>Prepared for: <strong className="text-[#64748b]">{prepared_for}</strong></span>
              </>
            )}
          </div>

          {/* Hero Stats — light cards with gold accent */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-[#C9A962]/8 rounded-xl p-4 border border-[#C9A962]/20">
              <p className="text-[#94a3b8] text-xs uppercase tracking-wider mb-1">
                Est. Annual Revenue
                <InfoTip text="The total projected income this property could earn in one year on Airbnb/VRBO, based on comparable listings in the area, average nightly rate, and expected occupancy." />
              </p>
              <p className="text-2xl font-serif font-bold text-[#C9A962]">{formatCurrency(revenue_estimate.annual)}</p>
              {revenue_estimate.range && (
                <p className="text-xs text-[#94a3b8] mt-1">
                  {formatCurrency(revenue_estimate.range.low)} – {formatCurrency(revenue_estimate.range.high)}
                </p>
              )}
              <DataSourceBadge type="property" />
            </div>
            <div className="bg-white rounded-xl p-4 border border-[#e2e8f0]">
              <p className="text-[#94a3b8] text-xs uppercase tracking-wider mb-1">
                Avg. Nightly Rate
                <InfoTip text="Also called ADR (Average Daily Rate). This is the average price per night guests would pay to stay at your property. It changes by season — higher in peak months, lower in slow months." />
              </p>
              <p className="text-2xl font-serif font-bold text-[#1e293b]">{formatCurrency(revenue_estimate.nightly)}</p>
              <DataSourceBadge type="property" />
            </div>
            <div className="bg-white rounded-xl p-4 border border-[#e2e8f0]">
              <p className="text-[#94a3b8] text-xs uppercase tracking-wider mb-1">
                Occupancy Rate
                <InfoTip text="The percentage of nights per year the property is expected to be booked. For example, 65% means roughly 237 out of 365 nights are booked. Higher occupancy = more consistent income." />
              </p>
              <p className="text-2xl font-serif font-bold text-[#1e293b]">{formatPercent(revenue_estimate.occupancy)}</p>
              <DataSourceBadge type="property" />
            </div>
            <div className="bg-white rounded-xl p-4 border border-[#e2e8f0]">
              <p className="text-[#94a3b8] text-xs uppercase tracking-wider mb-1">
                Monthly Average
                <InfoTip text="Your estimated annual revenue divided by 12. This is a simple average — actual monthly income will vary by season (some months higher, some lower)." />
              </p>
              <p className="text-2xl font-serif font-bold text-[#1e293b]">{formatCurrency(revenue_estimate.monthly)}</p>
              <DataSourceBadge type="property" />
            </div>
          </div>
        </div>
      </div>

      {/* Section Navigation */}
      <SectionNav
        activeSection={activeSection}
        onSectionClick={scrollToSection}
        hasRental={hasRental}
        hasPurchase={hasPurchase}
        hasExpenses={hasExpenses}
        hasRegulation={hasRegulation}
        hasStressTest={hasStressTest}
        hasSales={hasSales}
        hasTax={hasRental || hasPurchase}
      />

      {/* ============================================================ */}
      {/* MAIN CONTENT */}
      {/* ============================================================ */}
      <div className="max-w-5xl mx-auto px-4 py-10">

        {/* ---------------------------------------------------------- */}
        {/* SECTION 1: PROPERTY OVERVIEW */}
        {/* ---------------------------------------------------------- */}
        <section id="section-overview" className="scroll-mt-24 mb-16">
          <SectionHeader icon={Home} title="Property Overview" subtitle="Location, specifications, and neighborhood context" tooltip="Basic details about the property being analyzed — its location, size, and neighborhood. This is the property you entered for analysis." />

          <div className="grid md:grid-cols-2 gap-6 mb-8">
            {/* Property Details Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-[#e2e8f0] overflow-hidden">
              <div className="bg-[#C9A962]/10 border-b border-[#C9A962]/20 p-4">
                <p className="text-[#94a3b8] text-sm">Subject Property</p>
                <p className="text-[#1e293b] font-semibold">{property.address}</p>
              </div>
              <div className="divide-y divide-[#e2e8f0]">
                <DataRow label="Location" value={[property.city, property.state].filter(Boolean).join(', ') + (property.zipCode ? ` ${property.zipCode}` : '')} />
                <DataRow label="Property Type" value={property.propertyType || 'Residential'} />
                <DataRow label="Bedrooms" value={`${property.bedrooms}`} />
                <DataRow label="Bathrooms" value={`${property.bathrooms}`} />
                <DataRow label="Accommodates" value={`${property.accommodates} guests`} />
                {property.sqft && <DataRow label="Size" value={`${property.sqft.toLocaleString()} sqft`} />}
                <DataRow label="Market" value={market_data.name} />
                <DataRow label="Active Listings in Market" value={market_data.listing_count.toLocaleString()} />
              </div>
            </div>

            {/* Map / Street View */}
            <div className="bg-white rounded-2xl shadow-sm border border-[#e2e8f0] overflow-hidden">
              <div className="flex border-b border-[#e2e8f0]">
                <button
                  onClick={() => setShowStreetView(false)}
                  className={`flex-1 py-3 text-sm font-medium transition-colors ${!showStreetView ? 'bg-[#C9A962] text-white' : 'text-[#64748b] hover:bg-[#f8fafc]'}`}
                >
                  <MapPin className="w-4 h-4 inline mr-2" />Map View
                </button>
                <button
                  onClick={() => setShowStreetView(true)}
                  className={`flex-1 py-3 text-sm font-medium transition-colors ${showStreetView ? 'bg-[#C9A962] text-white' : 'text-[#64748b] hover:bg-[#f8fafc]'}`}
                >
                  <Eye className="w-4 h-4 inline mr-2" />Street View
                </button>
              </div>
              <div className="h-[350px] overflow-hidden">
                {property.latitude && property.longitude ? (
                  showStreetView ? (
                    <StreetViewPanorama
                      lat={property.latitude!}
                      lng={property.longitude!}
                    />
                  ) : (
                    <MapView
                      key="property-map"
                      className="w-full h-full sm:h-full md:h-full lg:h-full"
                      onMapReady={(map) => {
                        map.setCenter({ lat: property.latitude!, lng: property.longitude! });
                        map.setZoom(15);
                        new google.maps.marker.AdvancedMarkerElement({
                          map,
                          position: { lat: property.latitude!, lng: property.longitude! },
                          title: property.address,
                        });
                      }}
                    />
                  )
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-[#f8fafc]">
                    <p className="text-[#94a3b8]">Map not available</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------- */}
        {/* SECTION 2: REVENUE PROJECTIONS */}
        {/* ---------------------------------------------------------- */}
        <section id="section-revenue" className="scroll-mt-24 mb-16">
          <SectionHeader icon={DollarSign} title="Revenue Projections" subtitle="Estimated earnings based on market data and comparable properties" tooltip="These projections are based on real performance data from similar short-term rental listings in your area. They show what your property could realistically earn on platforms like Airbnb and VRBO." />

          {/* Revenue Range */}
          <div className="bg-white rounded-2xl shadow-sm border border-[#e2e8f0] p-6 mb-8">
            <h3 className="text-lg font-serif font-semibold text-[#1e293b] mb-4">Annual Revenue Estimate</h3>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <StatCard
                label="Conservative"
                value={formatCurrency(revenue_estimate.range?.low || revenue_estimate.annual * 0.85)}
                sublabel="Lower range"
                icon={TrendingDown}
                tooltip="The low end of the revenue range. Think of this as a worst-case scenario — what you might earn during a slow year or if you're just starting out with fewer reviews."
              />
              <StatCard
                label="Projected"
                value={formatCurrency(revenue_estimate.annual)}
                sublabel="Most likely"
                icon={DollarSign}
                highlight
                tooltip="The most likely annual revenue based on current market conditions. This is the number most hosts should plan around."
              />
              <StatCard
                label="Optimistic"
                value={formatCurrency(revenue_estimate.range?.high || revenue_estimate.annual * 1.15)}
                sublabel="Upper range"
                icon={TrendingUp}
                tooltip="The high end of the revenue range. You could reach this with excellent reviews, professional photos, optimized pricing, and strong demand."
              />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Monthly Average" value={formatCurrency(revenue_estimate.monthly)} icon={Calendar} tooltip="Annual revenue divided by 12. Actual monthly income varies by season — summer months are typically higher." />
              <StatCard label="Nightly Rate (ADR)" value={formatCurrency(revenue_estimate.nightly)} icon={DollarSign} tooltip="Average Daily Rate — the average price per night a guest pays. This is calculated from comparable listings in your area with similar bedrooms and amenities." />
              <StatCard label="Occupancy Rate" value={formatPercent(revenue_estimate.occupancy)} icon={Percent} tooltip="The percentage of available nights that are booked. 70% occupancy means about 255 nights per year are booked. New listings typically start lower and build up over 3-6 months." />
              <StatCard label="RevPAR" value={formatCurrency(revenue_estimate.nightly * (revenue_estimate.occupancy > 1 ? revenue_estimate.occupancy / 100 : revenue_estimate.occupancy))} icon={BarChart3} tooltip="Revenue Per Available Room — your nightly rate multiplied by your occupancy rate. This single number captures both pricing power and demand. Higher RevPAR = better overall performance." />
            </div>
          </div>

          {/* Monthly Forecast Chart */}
          {monthly_forecast.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-[#e2e8f0] p-6 mb-8">
              <h3 className="text-lg font-serif font-semibold text-[#1e293b] mb-4">Monthly Revenue Forecast</h3>
              <MonthlyForecastChart data={monthly_forecast.map(m => ({
                ...m,
                occupancy: m.occupancy > 1 ? m.occupancy : m.occupancy * 100,
              }))} height={300} />

              {bestMonth && worstMonth && (
                <div className="grid grid-cols-2 gap-4 mt-6">
                  <InsightBox type="success">
                    <strong>Peak Month:</strong> {formatMonth(bestMonth.month)} — {formatCurrency(bestMonth.revenue)} revenue
                  </InsightBox>
                  <InsightBox type="warning">
                    <strong>Slowest Month:</strong> {formatMonth(worstMonth.month)} — {formatCurrency(worstMonth.revenue)} revenue
                  </InsightBox>
                </div>
              )}
            </div>
          )}

          {/* Seasonality */}
          {monthly_forecast.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-[#e2e8f0] p-6 mb-8">
              <h3 className="text-lg font-serif font-semibold text-[#1e293b] mb-4">Seasonality Pattern</h3>
              <SeasonalityChart data={monthly_forecast.map(m => ({
                ...m,
                occupancy: m.occupancy > 1 ? m.occupancy : m.occupancy * 100,
              }))} height={180} />
            </div>
          )}

          {/* Historical Trends */}
          {historical_data && historical_data.summary && (
            <div className="bg-white rounded-2xl shadow-sm border border-[#e2e8f0] p-6">
              <h3 className="text-lg font-serif font-semibold text-[#1e293b] mb-4">Year-over-Year Trend</h3>
              <div className="grid grid-cols-2 gap-4">
                <StatCard
                  label="YoY Revenue Change"
                  value={`${(historical_data.summary.yoy_revenue_change ?? historical_data.summary.yearly_pct_change ?? 0) > 0 ? '+' : ''}${(historical_data.summary.yoy_revenue_change ?? historical_data.summary.yearly_pct_change ?? 0).toFixed(1)}%`}
                  icon={(() => { const change = historical_data.summary.yoy_revenue_change ?? historical_data.summary.yearly_pct_change ?? 0; const trend = historical_data.summary.trend || (change > 2 ? 'up' : change < -2 ? 'down' : 'stable'); return trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : BarChart3; })()}
                  highlight={(() => { const change = historical_data.summary.yoy_revenue_change ?? historical_data.summary.yearly_pct_change ?? 0; return (historical_data.summary.trend || (change > 2 ? 'up' : 'stable')) === 'up'; })()}
                />
                <StatCard
                  label="Market Trend"
                  value={(() => { const change = historical_data.summary.yoy_revenue_change ?? historical_data.summary.yearly_pct_change ?? 0; const trend = historical_data.summary.trend || (change > 2 ? 'up' : change < -2 ? 'down' : 'stable'); return trend === 'up' ? 'Growing' : trend === 'down' ? 'Declining' : 'Stable'; })()}
                  icon={BarChart3}
                />
              </div>
            </div>
          )}
        </section>

        {/* ---------------------------------------------------------- */}
        {/* SECTION: ITEMIZED EXPENSES */}
        {/* ---------------------------------------------------------- */}
        {hasExpenses && expenses && (
          <section id="section-expenses" className="scroll-mt-24 mb-16">
            <SectionHeader icon={Wallet} title="Expense Breakdown" subtitle="Itemized operating costs based on property size and market data" tooltip="These are the estimated monthly costs of running a short-term rental — things like cleaning, supplies, insurance, and platform fees. Subtract these from your revenue to see your actual profit." />

            <div className="bg-white rounded-2xl shadow-sm border border-[#e2e8f0] p-6 mb-8">
              <h3 className="text-lg font-serif font-semibold text-[#1e293b] mb-4">Monthly Operating Expenses</h3>
              <div className="divide-y divide-[#e2e8f0] rounded-xl border border-[#e2e8f0] overflow-hidden">
                {expenses.items.map((item: any, i: number) => (
                  <DataRow
                    key={i}
                    label={item.category}
                    value={
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-[#1e293b]">{formatCurrency(item.monthly)}/mo</span>
                        <span className="text-xs text-[#94a3b8]">({item.percentage.toFixed(1)}%)</span>
                      </div>
                    }
                  />
                ))}
                <DataRow
                  label="Total Operating Expenses"
                  value={
                    <span className="font-bold text-red-600">{formatCurrency(expenses.total_monthly)}/mo</span>
                  }
                  highlight
                />
              </div>
            </div>

            {/* Net Revenue After Expenses */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <div className="bg-white rounded-2xl shadow-sm border border-[#e2e8f0] p-6 text-center">
                <p className="text-sm text-[#64748b] mb-1">Gross Annual Revenue <InfoTip text="Your total projected income before any expenses are subtracted. This is the 'top line' number." /></p>
                <p className="text-2xl font-bold text-[#1e293b]">{formatCurrency(revenue_estimate.annual)}</p>
              </div>
              <div className="bg-white rounded-2xl shadow-sm border border-[#e2e8f0] p-6 text-center">
                <p className="text-sm text-[#64748b] mb-1">Total Annual Expenses <InfoTip text="All operating costs added up for the year — cleaning, supplies, insurance, platform fees, maintenance, and more." /></p>
                <p className="text-2xl font-bold text-red-600">- {formatCurrency(expenses.total_annual)}</p>
              </div>
              <div className="bg-white rounded-2xl shadow-sm border border-[#e2e8f0] p-6 text-center">
                <p className="text-sm text-[#64748b] mb-1">Net Annual Revenue <InfoTip text="What you actually keep after all operating expenses. This is your 'bottom line' — the real profit from the rental (before taxes and mortgage if applicable)." /></p>
                <p className={`text-2xl font-bold ${expenses.net_annual_revenue >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(expenses.net_annual_revenue)}
                </p>
              </div>
            </div>

            <InsightBox type="info">
              <strong>Expense Ratio:</strong> Total operating expenses represent {expenses.total_percentage.toFixed(1)}% of gross revenue.
              {expenses.total_percentage < 30 ? ' This is below the typical 30-40% range — verify that all costs are accounted for.' :
               expenses.total_percentage > 45 ? ' This is above the typical 30-40% range — look for opportunities to reduce costs.' :
               ' This is within the typical 30-40% range for short-term rentals.'}
            </InsightBox>
          </section>
        )}

        {/* ---------------------------------------------------------- */}
        {/* SECTION 3: MARKET ANALYSIS */}
        {/* ---------------------------------------------------------- */}
        <section id="section-market" className="scroll-mt-24 mb-16">
          <SectionHeader icon={BarChart3} title="Market Analysis" subtitle="Overall market health, performance by bedroom count, and competitive landscape" tooltip="This section shows how the entire short-term rental market in your area is performing. Use this to understand the bigger picture — how many listings exist, what they earn on average, and how your property compares." />

          {/* Market Overview */}
          <div className="bg-white rounded-2xl shadow-sm border border-[#e2e8f0] p-6 mb-8">
            <div className="flex items-center gap-3 mb-4">
              <h3 className="text-lg font-serif font-semibold text-[#1e293b]">{market_data.name} Market Overview</h3>
              <DataSourceBadge type="market" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Active Listings" value={market_data.listing_count.toLocaleString()} icon={Building} tooltip="The total number of short-term rental listings currently active on Airbnb and VRBO in this market. More listings means more competition, but also indicates strong traveler demand." />
              <StatCard label="Market Avg. Monthly Revenue" value={formatCurrency(market_data.metrics.revenue)} icon={DollarSign} tooltip="The average monthly income across ALL listings in this market (all bedroom counts, all property types). Your property may earn more or less depending on its size and quality." />
              <StatCard label="Market Avg. Occupancy" value={formatPercent(market_data.metrics.occupancy)} icon={Percent} tooltip="The average booking rate across all listings in this market. This includes studios, 1-bedrooms, and large homes — so your specific property type may differ." />
              <StatCard label="Market Avg. ADR" value={formatCurrency(market_data.metrics.adr)} icon={DollarSign} tooltip="The average nightly price across all listings in this market. Larger properties with more bedrooms typically command higher nightly rates." />
            </div>
            {market_data.metrics.market_score && (
              <div className="mt-4">
                <InsightBox type="info">
                  <strong>Market Score:</strong> {Math.round(market_data.metrics.market_score)}/100 — This score reflects the overall investment attractiveness of the market based on supply, demand, and revenue trends.
                </InsightBox>
              </div>
            )}
          </div>

          {/* Your Property vs Market */}
          <div className="bg-white rounded-2xl shadow-sm border border-[#e2e8f0] p-6 mb-8">
            <div className="flex items-center gap-3 mb-4">
              <h3 className="text-lg font-serif font-semibold text-[#1e293b]">Your Property vs. Market Average</h3>
              <InfoTip text="This table compares YOUR property's projected performance against the overall market average. Gold column = your numbers. Gray column = what the average listing earns. Being above the market average is a positive sign." />
            </div>
            <div className="divide-y divide-[#e2e8f0] rounded-xl border border-[#e2e8f0] overflow-hidden">
              <div className="grid grid-cols-3 bg-[#C9A962] text-white text-sm font-medium">
                <div className="p-3">Metric</div>
                <div className="p-3 text-center flex items-center justify-center gap-1"><Home className="w-3 h-3" /> Your Property</div>
                <div className="p-3 text-center flex items-center justify-center gap-1"><BarChart3 className="w-3 h-3" /> Market Average</div>
              </div>
              {[
                { label: 'Annual Revenue', yours: formatCurrency(revenue_estimate.annual), market: formatCurrency(market_data.metrics.revenue < 50000 ? market_data.metrics.revenue * 12 : market_data.metrics.revenue) },
                { label: 'Nightly Rate (ADR)', yours: formatCurrency(revenue_estimate.nightly), market: formatCurrency(market_data.metrics.adr) },
                { label: 'Occupancy Rate', yours: formatPercent(revenue_estimate.occupancy), market: formatPercent(market_data.metrics.occupancy) },
                { label: 'RevPAR', yours: formatCurrency(revenue_estimate.nightly * (revenue_estimate.occupancy > 1 ? revenue_estimate.occupancy / 100 : revenue_estimate.occupancy)), market: formatCurrency(market_data.metrics.revpar ?? (market_data.metrics.adr * (market_data.metrics.occupancy > 1 ? market_data.metrics.occupancy / 100 : market_data.metrics.occupancy))) },
              ].map((row, i) => (
                <div key={i} className="grid grid-cols-3 text-sm">
                  <div className="p-3 text-[#64748b]">{row.label}</div>
                  <div className="p-3 text-center font-semibold text-[#1e293b]">{row.yours}</div>
                  <div className="p-3 text-center text-[#64748b]">{row.market}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Bedroom Performance */}
          {bedroom_performance.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-[#e2e8f0] p-6 mb-8">
              <div className="flex items-center gap-3 mb-4">
                <h3 className="text-lg font-serif font-semibold text-[#1e293b]">Performance by Bedroom Count</h3>
                <DataSourceBadge type="market" />
                <InfoTip text="How different bedroom counts perform in your market. Your property's bedroom count is highlighted. This helps you understand if your property size is in high demand or if other sizes perform better." />
              </div>
              <BedroomPerformanceChart
                data={bedroom_performance.map(bp => ({
                  bedrooms: bp.bedrooms,
                  occupancy: bp.avg_occupancy || bp.occupancy,
                  adr: bp.avg_adr || bp.adr,
                  revenue: bp.avg_revenue || bp.revenue,
                  listing_count: bp.listing_count || bp.count || 0,
                }))}
                highlightBedroom={property.bedrooms}
                height={250}
              />
            </div>
          )}

          {/* Revenue Percentiles */}
          {revenue_percentiles && (
            <div className="bg-white rounded-2xl shadow-sm border border-[#e2e8f0] p-6 mb-8">
              <div className="flex items-center gap-3 mb-2">
                <h3 className="text-lg font-serif font-semibold text-[#1e293b]">Revenue Distribution</h3>
                <DataSourceBadge type="market" />
                <InfoTip text="This shows where your property's projected revenue ranks compared to ALL listings in the market. Gold-highlighted boxes show percentiles you're expected to beat. Being above the median (50th percentile) is a positive sign." />
              </div>
              <p className="text-sm text-[#64748b] mb-4">Where your property's projected revenue falls among all listings in this market:</p>
              <div className="grid grid-cols-5 gap-2">
                {[
                  { label: 'Bottom 10%', value: revenue_percentiles.p10 },
                  { label: '25th Pctl', value: revenue_percentiles.p25 },
                  { label: 'Median', value: revenue_percentiles.p50 },
                  { label: '75th Pctl', value: revenue_percentiles.p75 },
                  { label: 'Top 10%', value: revenue_percentiles.p90 },
                ].map((p, i) => (
                  <div key={i} className={`text-center p-3 rounded-xl ${
                    revenue_estimate.annual >= p.value ? 'bg-[#C9A962]/10 border border-[#C9A962]/30' : 'bg-[#f8fafc] border border-[#e2e8f0]'
                  }`}>
                    <p className="text-xs text-[#94a3b8] mb-1">{p.label}</p>
                    <p className="text-sm font-bold text-[#1e293b]">{formatCurrency(p.value)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Supply Trend Chart */}
          {supply_trend && supply_trend.length > 2 && (
            <div className="bg-white rounded-2xl shadow-sm border border-[#e2e8f0] p-6 mb-8">
              <div className="flex items-center gap-3 mb-2">
                <h3 className="text-lg font-serif font-semibold text-[#1e293b]">Supply Trend</h3>
                <DataSourceBadge type="market" />
                <InfoTip text="Shows how the number of short-term rental listings in your market has changed over time. A growing supply means more competition; a shrinking supply could mean stricter regulations or less demand." />
              </div>
              <p className="text-sm text-[#64748b] mb-4">Active short-term rental listings over time in this market</p>
              {(() => {
                const sorted = [...supply_trend].sort((a, b) => a.date.localeCompare(b.date));
                const maxVal = Math.max(...sorted.map(d => d.value));
                const minVal = Math.min(...sorted.map(d => d.value));
                const range = maxVal - minVal || 1;
                const chartHeight = 180;
                const first = sorted[0];
                const last = sorted[sorted.length - 1];
                const changePercent = first.value > 0 ? ((last.value - first.value) / first.value * 100) : 0;
                const isGrowing = changePercent > 2;
                const isShrinking = changePercent < -2;

                // Build SVG path
                const points = sorted.map((d, i) => {
                  const x = (i / (sorted.length - 1)) * 100;
                  const y = chartHeight - ((d.value - minVal) / range) * (chartHeight - 20) - 10;
                  return `${x},${y}`;
                });
                const linePath = `M ${points.join(' L ')}`;
                const areaPath = `${linePath} L 100,${chartHeight} L 0,${chartHeight} Z`;

                return (
                  <div>
                    {/* Summary stats */}
                    <div className="grid grid-cols-3 gap-4 mb-6">
                      <div className="bg-[#f8fafc] rounded-xl p-3 text-center">
                        <p className="text-xs text-[#64748b] mb-1">Current Listings</p>
                        <p className="text-lg font-bold text-[#1e293b]">{last.value.toLocaleString()}</p>
                      </div>
                      <div className="bg-[#f8fafc] rounded-xl p-3 text-center">
                        <p className="text-xs text-[#64748b] mb-1">{sorted.length} Months Ago</p>
                        <p className="text-lg font-bold text-[#1e293b]">{first.value.toLocaleString()}</p>
                      </div>
                      <div className={`rounded-xl p-3 text-center ${isGrowing ? 'bg-amber-50' : isShrinking ? 'bg-green-50' : 'bg-[#f8fafc]'}`}>
                        <p className="text-xs text-[#64748b] mb-1">Change</p>
                        <p className={`text-lg font-bold ${isGrowing ? 'text-amber-600' : isShrinking ? 'text-green-600' : 'text-[#1e293b]'}`}>
                          {changePercent > 0 ? '+' : ''}{changePercent.toFixed(1)}%
                        </p>
                      </div>
                    </div>

                    {/* SVG Chart */}
                    <div className="relative">
                      <svg viewBox={`0 0 100 ${chartHeight}`} className="w-full" preserveAspectRatio="none" style={{ height: '180px' }}>
                        <defs>
                          <linearGradient id="supplyGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#C9A962" stopOpacity="0.3" />
                            <stop offset="100%" stopColor="#C9A962" stopOpacity="0.02" />
                          </linearGradient>
                        </defs>
                        <path d={areaPath} fill="url(#supplyGradient)" />
                        <path d={linePath} fill="none" stroke="#C9A962" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
                      </svg>
                      {/* X-axis labels */}
                      <div className="flex justify-between mt-2">
                        {sorted.filter((_, i) => i === 0 || i === Math.floor(sorted.length / 2) || i === sorted.length - 1).map((d, i) => (
                          <span key={i} className="text-[10px] text-[#94a3b8]">{formatMonth(d.date)}</span>
                        ))}
                      </div>
                    </div>

                    <InsightBox type={isGrowing ? 'warning' : isShrinking ? 'success' : 'info'}>
                      <strong>Supply Trend:</strong>{' '}
                      {isGrowing
                        ? `Active listings have grown ${changePercent.toFixed(1)}% over the past ${sorted.length} months (from ${first.value.toLocaleString()} to ${last.value.toLocaleString()}). Increasing supply may put downward pressure on occupancy and rates.`
                        : isShrinking
                        ? `Active listings have decreased ${Math.abs(changePercent).toFixed(1)}% over the past ${sorted.length} months (from ${first.value.toLocaleString()} to ${last.value.toLocaleString()}). Decreasing supply is favorable for existing hosts.`
                        : `Active listings have remained relatively stable over the past ${sorted.length} months (${first.value.toLocaleString()} → ${last.value.toLocaleString()}).`}
                    </InsightBox>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Submarket Comparison */}
          {submarkets && submarkets.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-[#e2e8f0] p-6">
              <h3 className="text-lg font-serif font-semibold text-[#1e293b] mb-2">Submarket Comparison</h3>
              <p className="text-sm text-[#64748b] mb-4">How nearby neighborhoods and submarkets compare in key performance metrics</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#f8fafc]">
                      <th className="p-3 text-left text-[#64748b] font-medium rounded-tl-lg">Submarket</th>
                      <th className="p-3 text-right text-[#64748b] font-medium">Listings</th>
                      <th className="p-3 text-right text-[#64748b] font-medium">Avg Revenue</th>
                      <th className="p-3 text-right text-[#64748b] font-medium">Avg ADR</th>
                      <th className="p-3 text-right text-[#64748b] font-medium">Occupancy</th>
                      <th className="p-3 text-right text-[#64748b] font-medium">RevPAR</th>
                      {submarkets.some(s => s.metrics?.market_score) && (
                        <th className="p-3 text-right text-[#64748b] font-medium rounded-tr-lg">Score</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {submarkets
                      .filter(s => s.metrics)
                      .sort((a, b) => (b.metrics?.revenue || 0) - (a.metrics?.revenue || 0))
                      .map((sub, i) => (
                        <tr key={sub.id || i} className="border-t border-[#e2e8f0] hover:bg-[#f8fafc] transition-colors">
                          <td className="p-3 font-medium text-[#1e293b]">{sub.name}</td>
                          <td className="p-3 text-right text-[#64748b]">{sub.listing_count.toLocaleString()}</td>
                          <td className="p-3 text-right font-semibold text-[#1e293b]">{formatCurrency(sub.metrics!.revenue)}</td>
                          <td className="p-3 text-right text-[#64748b]">{formatCurrency(sub.metrics!.adr)}</td>
                          <td className="p-3 text-right text-[#64748b]">{formatPercent(sub.metrics!.occupancy)}</td>
                          <td className="p-3 text-right text-[#64748b]">{formatCurrency(sub.metrics!.revpar)}</td>
                          {submarkets.some(s => s.metrics?.market_score) && (
                            <td className="p-3 text-right">
                              {sub.metrics!.market_score ? (
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                  sub.metrics!.market_score >= 70 ? 'bg-green-100 text-green-700' :
                                  sub.metrics!.market_score >= 50 ? 'bg-amber-100 text-amber-700' :
                                  'bg-red-100 text-red-700'
                                }`}>
                                  {Math.round(sub.metrics!.market_score)}
                                </span>
                              ) : '—'}
                            </td>
                          )}
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              {(() => {
                const withMetrics = submarkets.filter(s => s.metrics);
                if (withMetrics.length < 2) return null;
                const best = withMetrics.reduce((a, b) => (a.metrics!.revenue > b.metrics!.revenue ? a : b));
                const worst = withMetrics.reduce((a, b) => (a.metrics!.revenue < b.metrics!.revenue ? a : b));
                return (
                  <div className="mt-4">
                    <InsightBox type="info">
                      <strong>Top Submarket:</strong> {best.name} leads with {formatCurrency(best.metrics!.revenue)} avg revenue and {formatPercent(best.metrics!.occupancy)} occupancy.
                      {worst.name !== best.name && (
                        <> The lowest performer is {worst.name} at {formatCurrency(worst.metrics!.revenue)} avg revenue.</>
                      )}
                    </InsightBox>
                  </div>
                );
              })()}
            </div>
          )}
        </section>

        {/* ---------------------------------------------------------- */}
        {/* SECTION 4: COMPETITION ANALYSIS */}
        {/* ---------------------------------------------------------- */}
        <section id="section-competition" className="scroll-mt-24 mb-16">
          <SectionHeader icon={Target} title="Competition Analysis" subtitle={`${displayComps.length} comparable ${property.bedrooms}-bedroom properties ranked by revenue`} tooltip="These are real Airbnb/VRBO listings near your property with the same number of bedrooms. They show what your direct competitors are earning, charging, and how guests rate them. Use this to see where you'd stack up." />

          {/* Comp Selection Controls */}
          {displayComps.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-[#e2e8f0] p-4 mb-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <ListFilter className="w-4 h-4 text-[#C9A962]" />
                  <span className="text-sm font-medium text-[#1e293b]">
                    {filteredComps.length} of {displayComps.length} comps selected
                  </span>
                  <InfoTip text="Select or deselect comparable properties to customize which ones are included in the summary statistics, map, and analysis below. Deselecting a comp removes it from all calculations but keeps it visible in the table." />
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={toggleAllComps}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg border border-[#e2e8f0] text-[#64748b] hover:bg-[#f8fafc] hover:text-[#1e293b] transition-colors"
                  >
                    {selectedCompIds.size === displayComps.length ? 'Deselect All' : 'Select All'}
                  </button>
                  {isAdmin && shareId && !isSharedView && (
                    <button
                      onClick={handleSaveCompSelection}
                      disabled={saveCompSelectionMutation.isPending}
                      className="text-xs font-medium px-3 py-1.5 rounded-lg bg-[#C9A962] text-white hover:bg-[#b8963f] transition-colors disabled:opacity-50 flex items-center gap-1"
                    >
                      {saveCompSelectionMutation.isPending ? (
                        <><Loader2 className="w-3 h-3 animate-spin" /> Saving...</>
                      ) : (
                        'Save Selection'
                      )}
                    </button>
                  )}
                </div>
              </div>
              {filteredComps.length === 0 && (
                <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  No comps selected — summary stats will be empty. Select at least one comp.
                </p>
              )}
            </div>
          )}

          {/* Comps Map */}
          {property.latitude && property.longitude && (
            <div className="mb-8">
              <CompsMapView
                comps={filteredComps}
                subjectProperty={{
                  address: property.address,
                  latitude: property.latitude,
                  longitude: property.longitude,
                  bedrooms: property.bedrooms,
                  bathrooms: property.bathrooms,
                }}
              />
            </div>
          )}

          {/* Comps Table */}
          <div className="bg-white rounded-2xl shadow-sm border border-[#e2e8f0] overflow-hidden mb-8">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#C9A962] text-white">
                    <th className="text-left p-4 font-medium w-10">
                      <Checkbox
                        checked={selectedCompIds.size === displayComps.length}
                        onCheckedChange={toggleAllComps}
                        className="border-white/50 data-[state=checked]:bg-white data-[state=checked]:text-[#C9A962]"
                      />
                    </th>
                    <th className="text-left p-4 font-medium">#</th>
                    <th className="text-left p-4 font-medium">Property</th>
                    <th className="text-right p-4 font-medium">Revenue <InfoTip text="Annual revenue this listing earned in the last 12 months from Airbnb/VRBO bookings." className="text-white/70 hover:text-white" /></th>
                    <th className="text-right p-4 font-medium">ADR <InfoTip text="Average Daily Rate — the average price per night this listing charges." className="text-white/70 hover:text-white" /></th>
                    <th className="text-right p-4 font-medium">Occupancy <InfoTip text="What percentage of available nights this listing was booked over the last 12 months." className="text-white/70 hover:text-white" /></th>
                    <th className="text-right p-4 font-medium">Rating <InfoTip text="Guest rating on a 1-5 scale. Higher ratings attract more bookings and allow higher pricing." className="text-white/70 hover:text-white" /></th>
                    <th className="text-right p-4 font-medium">Reviews <InfoTip text="Total number of guest reviews. More reviews = more established listing with booking history." className="text-white/70 hover:text-white" /></th>
                  </tr>
                </thead>
                <tbody>
                  {(showAllComps ? displayComps : displayComps.slice(0, 10)).map((comp, i) => (
                    <tr key={comp.id || i} className={`border-b border-[#e2e8f0] transition-colors ${selectedCompIds.has(getCompKey(comp, i)) ? 'hover:bg-[#C9A962]/5' : 'opacity-40 hover:opacity-60 bg-[#f8fafc]'}`}>
                      <td className="p-4">
                        <Checkbox
                          checked={selectedCompIds.has(getCompKey(comp, i))}
                          onCheckedChange={() => toggleComp(getCompKey(comp, i))}
                          className="data-[state=checked]:bg-[#C9A962] data-[state=checked]:border-[#C9A962]"
                        />
                      </td>
                      <td className="p-4 text-[#94a3b8] font-medium">{i + 1}</td>
                      <td className="p-4">
                        <div className="flex items-start gap-3">
                          {comp.image_url ? (
                            <img
                              src={comp.image_url}
                              alt={comp.title}
                              className="w-16 h-12 rounded-lg object-cover flex-shrink-0 border border-[#e2e8f0]"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <div className="w-16 h-12 rounded-lg bg-[#f1f5f9] flex items-center justify-center flex-shrink-0 border border-[#e2e8f0]">
                              <Building className="w-5 h-5 text-[#94a3b8]" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-medium text-[#1e293b] truncate max-w-[200px]">
                              {comp.title}
                            </p>
                            <p className="text-xs text-[#94a3b8] mt-0.5">
                              {comp.bedrooms}BR / {comp.bathrooms}BA
                              {comp.distance_meters && ` · ${(comp.distance_meters / 1609.34).toFixed(1)} mi away`}
                            </p>
                            {comp.airbnb_url && (
                              <a
                                href={comp.airbnb_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 mt-1.5 px-3 py-1 rounded-full text-xs font-medium bg-[#C9A962]/10 text-[#C9A962] hover:bg-[#C9A962]/20 transition-colors border border-[#C9A962]/20"
                              >
                                <ExternalLink className="w-3 h-3" />
                                View Listing
                              </a>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-right font-semibold text-[#1e293b]">{formatCurrency(comp.annual_revenue)}</td>
                      <td className="p-4 text-right text-[#64748b]">{formatCurrency(comp.adr)}</td>
                      <td className="p-4 text-right text-[#64748b]">{formatPercent(comp.occupancy)}</td>
                      <td className="p-4 text-right">
                        {comp.rating ? (
                          <span className="inline-flex items-center gap-1">
                            <Star className="w-3 h-3 text-[#C9A962] fill-[#C9A962]" />
                            {comp.rating.toFixed(1)}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="p-4 text-right text-[#64748b]">{comp.reviews || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {displayComps.length > 10 && (
              <div className="p-3 border-t border-[#e2e8f0] text-center">
                <button
                  onClick={() => setShowAllComps(!showAllComps)}
                  className="text-sm font-medium text-[#C9A962] hover:text-[#b8943f] transition-colors"
                >
                  {showAllComps ? `Show fewer comps` : `Show all ${displayComps.length} comps`}
                </button>
              </div>
            )}
          </div>

          {/* Comp Summary Stats — based on SELECTED comps only */}
          {filteredComps.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                label="Avg. Comp Revenue"
                value={formatCurrency(filteredComps.reduce((s, c) => s + c.annual_revenue, 0) / filteredComps.length)}
                icon={DollarSign}
                tooltip="The average annual revenue across your SELECTED comparable listings. Deselect outliers to see how the average changes."
              />
              <StatCard
                label="Highest Revenue"
                value={formatCurrency(filteredComps[0]?.annual_revenue || 0)}
                icon={TrendingUp}
                tooltip="The top-earning listing among your selected comps. This represents the ceiling — what's possible with excellent management, reviews, and pricing."
              />
              <StatCard
                label="Avg. Comp Rating"
                value={(() => {
                  const rated = filteredComps.filter(c => c.rating && c.rating > 0);
                  return rated.length > 0 ? (rated.reduce((s, c) => s + (c.rating || 0), 0) / rated.length).toFixed(1) : 'N/A';
                })()}
                icon={Star}
                tooltip="The average guest rating of your selected comparable listings. Aim for 4.8+ to rank well in Airbnb search results and qualify for Superhost status."
              />
              <StatCard
                label="Comps Selected"
                value={`${filteredComps.length} / ${displayComps.length}`}
                icon={ListFilter}
                tooltip="How many comparable properties you've included in the analysis vs. the total found. Adjust your selection above to refine the comparison."
              />
            </div>
          )}
        </section>

        {/* ---------------------------------------------------------- */}
        {/* SECTION: REGULATORY STATUS */}
        {/* ---------------------------------------------------------- */}
        {hasRegulation && regulation && (
          <section id="section-regulation" className="scroll-mt-24 mb-16">
            <SectionHeader icon={BookOpen} title="Regulatory Status" subtitle="Short-term rental regulations for this location" tooltip="Local laws and rules about short-term rentals in your area. Some cities require permits, limit the number of nights you can rent, or have specific zoning restrictions. Always verify with your local government before listing." />

            {/* Status Badge */}
            <div className="bg-white rounded-2xl shadow-sm border border-[#e2e8f0] p-6 mb-8">
              <div className="flex items-center gap-4 mb-6">
                <div className={`px-4 py-2 rounded-full text-sm font-bold uppercase tracking-wider ${
                  regulation.status === 'allowed' ? 'bg-green-100 text-green-800' :
                  regulation.status === 'allowed_with_permit' ? 'bg-yellow-100 text-yellow-800' :
                  regulation.status === 'restricted' || regulation.status === 'limited' ? 'bg-orange-100 text-orange-800' :
                  regulation.status === 'banned' ? 'bg-red-100 text-red-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {regulation.status.replace(/_/g, ' ')}
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                  regulation.confidence === 'high' ? 'bg-green-50 text-green-700' :
                  regulation.confidence === 'medium' ? 'bg-yellow-50 text-yellow-700' :
                  'bg-gray-50 text-gray-700'
                }`}>
                  {regulation.confidence} confidence
                </div>
              </div>

              <p className="text-[#334155] leading-relaxed mb-6">{regulation.simplified_summary || regulation.summary}</p>

              {/* Key Requirements */}
              {regulation.key_requirements?.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-serif font-semibold text-[#1e293b] mb-3">Key Requirements</h3>
                  <ul className="space-y-2">
                    {regulation.key_requirements.map((req, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-[#C9A962] mt-0.5 flex-shrink-0" />
                        <span className="text-sm text-[#334155]">{req}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Quick Facts */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-[#f8fafc] rounded-xl p-3 text-center">
                  <p className="text-xs text-[#64748b] mb-1">Permit Required</p>
                  <p className={`text-sm font-bold ${regulation.permit_required ? 'text-orange-600' : 'text-green-600'}`}>
                    {regulation.permit_required ? 'Yes' : 'No'}
                  </p>
                </div>
                <div className="bg-[#f8fafc] rounded-xl p-3 text-center">
                  <p className="text-xs text-[#64748b] mb-1">Primary Residence Only</p>
                  <p className={`text-sm font-bold ${regulation.primary_residence_only ? 'text-red-600' : 'text-green-600'}`}>
                    {regulation.primary_residence_only ? 'Yes' : 'No'}
                  </p>
                </div>
                {regulation.max_nights_per_year && (
                  <div className="bg-[#f8fafc] rounded-xl p-3 text-center">
                    <p className="text-xs text-[#64748b] mb-1">Max Nights/Year</p>
                    <p className="text-sm font-bold text-[#1e293b]">{regulation.max_nights_per_year}</p>
                  </div>
                )}
                {regulation.occupancy_tax && (
                  <div className="bg-[#f8fafc] rounded-xl p-3 text-center">
                    <p className="text-xs text-[#64748b] mb-1">Occupancy Tax</p>
                    <p className="text-sm font-bold text-[#1e293b]">{regulation.occupancy_tax}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Warnings */}
            {regulation.warnings?.length > 0 && (
              <div className="mb-8">
                {regulation.warnings.map((warning, i) => (
                  <InsightBox key={i} type="warning">
                    {warning}
                  </InsightBox>
                ))}
              </div>
            )}

            {/* Sources */}
            {regulation.sources?.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-[#e2e8f0] p-6">
                <h3 className="text-sm font-semibold text-[#64748b] mb-3 uppercase tracking-wider">Sources</h3>
                <div className="space-y-2">
                  {regulation.sources.map((src, i) => (
                    <a key={i} href={src.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-[#C9A962] hover:underline">
                      <ExternalLink className="w-3 h-3" />
                      {src.title}
                      {src.isOfficial && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Official</span>}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* ---------------------------------------------------------- */}
        {/* SECTION: STRESS TEST / SENSITIVITY ANALYSIS */}
        {/* ---------------------------------------------------------- */}
        {hasStressTest && stress_test && (
          <section id="section-stress" className="scroll-mt-24 mb-16">
            <SectionHeader icon={AlertTriangle} title="Stress Test" subtitle="What happens to your cash flow when occupancy or nightly rate changes?" tooltip="A stress test shows what your monthly profit would look like under different scenarios — what if occupancy drops 20%? What if nightly rates fall? This helps you understand your financial cushion and risk." />

            <div className="bg-white rounded-2xl shadow-sm border border-[#e2e8f0] p-6 mb-8">
              <h3 className="text-lg font-serif font-semibold text-[#1e293b] mb-2">Sensitivity Matrix</h3>
              <p className="text-sm text-[#64748b] mb-6">Monthly profit at different occupancy and ADR combinations{stress_test.base_monthly_rent ? ` (rent: ${formatCurrency(stress_test.base_monthly_rent)}/mo)` : ''}</p>

              {/* Build matrix from scenarios */}
              {(() => {
                const occupancies = Array.from(new Set(stress_test.scenarios.map(s => s.occupancy_pct))).filter(v => v != null && !isNaN(v)).sort((a, b) => a - b);
                const adrs = Array.from(new Set(stress_test.scenarios.map(s => s.adr))).filter(v => v != null && !isNaN(v)).sort((a, b) => a - b);
                const getScenario = (occ: number, adr: number) => stress_test.scenarios.find(s => s.occupancy_pct === occ && s.adr === adr);

                if (occupancies.length === 0 || adrs.length === 0) {
                  return (
                    <div className="text-center py-8 text-[#94a3b8]">
                      <p>Stress test data is not available for this property.</p>
                    </div>
                  );
                }

                return (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr>
                          <th className="p-3 text-left text-[#64748b] font-medium bg-[#f8fafc] rounded-tl-lg">Occ \ ADR</th>
                          {adrs.map((adr, adrIdx) => (
                            <th key={`adr-${adrIdx}-${adr}`} className={`p-3 text-center font-medium bg-[#f8fafc] ${adr === stress_test.base_adr ? 'text-[#C9A962] font-bold' : 'text-[#64748b]'}`}>
                              {formatCurrency(adr)}
                              {adr === stress_test.base_adr && <div className="text-[10px]">base</div>}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {occupancies.map((occ, occIdx) => (
                          <tr key={`occ-${occIdx}-${occ}`} className="border-t border-[#e2e8f0]">
                            <td className={`p-3 font-medium ${occ === stress_test.base_occupancy ? 'text-[#C9A962] font-bold' : 'text-[#64748b]'}`}>
                              {Math.round(occ * 100)}%
                              {occ === stress_test.base_occupancy && <span className="text-[10px] ml-1">base</span>}
                            </td>
                            {adrs.map((adr, adrIdx) => {
                              const scenario = getScenario(occ, adr);
                              const profit = scenario?.monthly_profit ?? scenario?.monthly_revenue ?? 0;
                              const isBase = occ === stress_test.base_occupancy && adr === stress_test.base_adr;
                              return (
                                <td key={`cell-${occIdx}-${adrIdx}`} className={`p-3 text-center font-medium ${
                                  isBase ? 'bg-[#C9A962]/10 ring-2 ring-[#C9A962] rounded' :
                                  profit >= 0 ? 'text-green-700' : 'text-red-600'
                                }`}>
                                  {formatCurrency(profit)}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>

            {/* Break-even insight */}
            {(() => {
              const breakEvenScenarios = stress_test.scenarios.filter(s => s.cash_flow_positive);
              const worstCase = stress_test.scenarios.reduce((min, s) => (s.monthly_profit ?? s.monthly_revenue) < (min.monthly_profit ?? min.monthly_revenue) ? s : min);
              return (
                <InsightBox type={breakEvenScenarios.length > stress_test.scenarios.length / 2 ? 'info' : 'warning'}>
                  <strong>Stress Test Result:</strong> {breakEvenScenarios.length} of {stress_test.scenarios.length} scenarios are cash-flow positive.
                  {' '}Worst case scenario ({Math.round(worstCase.occupancy_pct * 100)}% occupancy, {formatCurrency(worstCase.adr)} ADR) yields {formatCurrency(worstCase.monthly_profit ?? worstCase.monthly_revenue)}/mo.
                </InsightBox>
              );
            })()}
          </section>
        )}

        {/* ---------------------------------------------------------- */}
        {/* SECTION: COMPARABLE SALES */}
        {/* ---------------------------------------------------------- */}
        {hasSales && comparable_sales && (
          <section id="section-sales" className="scroll-mt-24 mb-16">
            <SectionHeader icon={Landmark} title="Comparable Sales" subtitle="Recently sold properties in the area for purchase price context" tooltip="Recently sold homes near your property. These help you understand what similar properties cost to buy, which is essential for calculating investment returns if you're considering purchasing." />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              {comparable_sales.map((sale, i) => (
                <div key={i} className="bg-white rounded-2xl shadow-sm border border-[#e2e8f0] overflow-hidden">
                  {sale.image_url && (
                    <div className="h-40 bg-cover bg-center" style={{ backgroundImage: `url(${sale.image_url})` }} />
                  )}
                  <div className="p-5">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-serif font-semibold text-[#1e293b] text-sm leading-tight flex-1">{sale.address}</h4>
                      <span className="text-lg font-bold text-[#C9A962] ml-3">{formatCurrency(sale.price)}</span>
                    </div>
                    <div className="flex flex-wrap gap-2 mb-3">
                      <span className="text-xs bg-[#f1f5f9] text-[#64748b] px-2 py-1 rounded-full">{sale.bedrooms} BR / {sale.bathrooms} BA</span>
                      {sale.sqft && <span className="text-xs bg-[#f1f5f9] text-[#64748b] px-2 py-1 rounded-full">{sale.sqft.toLocaleString()} sqft</span>}
                      {sale.year_built && <span className="text-xs bg-[#f1f5f9] text-[#64748b] px-2 py-1 rounded-full">Built {sale.year_built}</span>}
                      {sale.price_per_sqft && <span className="text-xs bg-[#C9A962]/10 text-[#C9A962] px-2 py-1 rounded-full font-medium">{formatCurrency(sale.price_per_sqft)}/sqft</span>}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                        sale.status === 'sold' ? 'bg-green-100 text-green-700' :
                        sale.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>{sale.status}</span>
                      {sale.days_on_market !== undefined && (
                        <span className="text-xs text-[#64748b]">{sale.days_on_market} days on market</span>
                      )}
                    </div>
                    {sale.url && (
                      <a href={sale.url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs text-[#C9A962] hover:underline">
                        <ExternalLink className="w-3 h-3" /> View Listing
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Summary Stats */}
            {comparable_sales.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard
                  label="Median Sale Price"
                  value={formatCurrency(comparable_sales.map(s => s.price).sort((a, b) => a - b)[Math.floor(comparable_sales.length / 2)])}
                  icon={DollarSign}
                />
                <StatCard
                  label="Price Range"
                  value={`${formatCurrency(Math.min(...comparable_sales.map(s => s.price)))} - ${formatCurrency(Math.max(...comparable_sales.map(s => s.price)))}`}
                  icon={TrendingUp}
                />
                <StatCard
                  label="Avg Bedrooms"
                  value={(comparable_sales.reduce((s: number, c: any) => s + c.bedrooms, 0) / comparable_sales.length).toFixed(1)}
                  icon={Bed}
                />
                <StatCard
                  label="Properties Analyzed"
                  value={comparable_sales.length.toString()}
                  icon={Building}
                />
              </div>
            )}
          </section>
        )}

        {/* ---------------------------------------------------------- */}
        {/* SECTION 5: RENTAL ARBITRAGE SCENARIO */}
        {/* ---------------------------------------------------------- */}
        {hasRental && rentalCalcs && (
          <section id="section-rental" className="scroll-mt-24 mb-16">
            <SectionHeader icon={Building} title="Rental Arbitrage Analysis" subtitle="Financial projections based on renting the property and subletting on Airbnb" tooltip="Rental arbitrage means renting a property with a traditional lease and then subletting it on Airbnb/VRBO. This section shows whether the short-term rental income would cover the rent and still leave you a profit. You need landlord permission to do this." />

            <div className="bg-white rounded-2xl shadow-sm border border-[#e2e8f0] p-6 mb-8">
              <h3 className="text-lg font-serif font-semibold text-[#1e293b] mb-4">Monthly Cash Flow</h3>
              <div className="divide-y divide-[#e2e8f0] rounded-xl border border-[#e2e8f0] overflow-hidden">
                <DataRow label="Projected Monthly Revenue" value={formatCurrency(rentalCalcs.monthlyRevenue)} highlight tooltip="Your estimated monthly income from Airbnb/VRBO bookings after accounting for occupancy and nightly rate." />
                <DataRow label="Monthly Rent" value={`- ${formatCurrency(rentalCalcs.rent)}`} tooltip="The monthly lease payment you'd pay to the landlord. This is your biggest fixed cost in a rental arbitrage model." />
                <DataRow label="Monthly Profit" value={
                  <span className={rentalCalcs.monthlyProfit >= 0 ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>
                    {formatCurrency(rentalCalcs.monthlyProfit)}
                  </span>
                } highlight />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6 mb-8">
              {/* Break-Even Analysis */}
              <div className="bg-white rounded-2xl shadow-sm border border-[#e2e8f0] p-6">
                <h3 className="text-lg font-serif font-semibold text-[#1e293b] mb-4">Break-Even Analysis</h3>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-[#64748b] mb-1">Break-Even Occupancy <InfoTip text="The minimum occupancy rate needed to cover your rent. Below this, you lose money. The lower this number, the safer the deal." /></p>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 bg-[#f1f5f9] rounded-full h-4 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${rentalCalcs.breakEvenOccupancy < 0.5 ? 'bg-green-500' : rentalCalcs.breakEvenOccupancy < 0.7 ? 'bg-amber-500' : 'bg-red-500'}`}
                          style={{ width: `${Math.min(rentalCalcs.breakEvenOccupancy * 100, 100)}%` }}
                        />
                      </div>
                      <span className="text-sm font-bold text-[#1e293b]">{formatPercent(rentalCalcs.breakEvenOccupancy)}</span>
                    </div>
                    <p className="text-xs text-[#94a3b8] mt-1">
                      You need {formatPercent(rentalCalcs.breakEvenOccupancy)} occupancy to cover rent. Market projects {formatPercent(revenue_estimate.occupancy)}.
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-[#64748b] mb-1">Break-Even ADR <InfoTip text="The minimum nightly rate needed to cover your rent at projected occupancy. If the market rate is well above this, you have a good safety margin." /></p>
                    <p className="text-xl font-bold text-[#1e293b]">{formatCurrency(rentalCalcs.breakEvenADR)}</p>
                    <p className="text-xs text-[#94a3b8]">
                      Minimum nightly rate needed. Market projects {formatCurrency(revenue_estimate.nightly)}.
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-[#64748b] mb-1">Occupancy Cushion <InfoTip text="The gap between your projected occupancy and break-even occupancy. A bigger cushion means more room for slow months without losing money. 15%+ is considered safe." /></p>
                    <p className={`text-xl font-bold ${rentalCalcs.occupancyCushion > 0.15 ? 'text-green-600' : rentalCalcs.occupancyCushion > 0.05 ? 'text-amber-600' : 'text-red-600'}`}>
                      {rentalCalcs.occupancyCushion > 0 ? '+' : ''}{formatPercent(rentalCalcs.occupancyCushion)}
                    </p>
                    <p className="text-xs text-[#94a3b8]">
                      Room between projected and break-even occupancy
                    </p>
                  </div>
                </div>
              </div>

              {/* Investment Returns */}
              <div className="bg-white rounded-2xl shadow-sm border border-[#e2e8f0] p-6">
                <h3 className="text-lg font-serif font-semibold text-[#1e293b] mb-4">Investment Returns</h3>
                <div className="space-y-4">
                  <div className="divide-y divide-[#e2e8f0] rounded-xl border border-[#e2e8f0] overflow-hidden">
                    <DataRow label="Estimated Startup Costs" value={formatCurrency(rentalCalcs.startup)} tooltip="One-time costs to furnish and set up the rental — furniture, linens, kitchen supplies, decor, photography, and initial cleaning. Typically $3,000-$15,000 depending on property size." />
                    <DataRow label="Annual Profit" value={formatCurrency(rentalCalcs.annualProfit)} highlight tooltip="Your total yearly profit after subtracting rent and operating expenses from short-term rental revenue. This is what you actually take home." />
                    <DataRow label="ROI (First Year)" value={`${rentalCalcs.roi.toFixed(0)}%`} highlight tooltip="Return on Investment — your annual profit divided by your startup costs. For example, 200% ROI means you earn 2x what you invested. Higher is better." />
                    <DataRow label="Months to Recoup Startup" value={
                      rentalCalcs.monthsToRecoup === Infinity ? 'N/A' : `${rentalCalcs.monthsToRecoup} months`
                    } />
                  </div>
                </div>
              </div>
            </div>

            {/* Scenario Analysis */}
            <div className="bg-white rounded-2xl shadow-sm border border-[#e2e8f0] p-6">
              <h3 className="text-lg font-serif font-semibold text-[#1e293b] mb-4">Scenario Analysis</h3>
              <div className="grid grid-cols-3 gap-4">
                {[
                  {
                    label: 'Conservative',
                    sublabel: '30% lower occupancy',
                    occupancy: (revenue_estimate.occupancy > 1 ? revenue_estimate.occupancy / 100 : revenue_estimate.occupancy) * 0.7,
                    revenue: revenue_estimate.nightly * ((revenue_estimate.occupancy > 1 ? revenue_estimate.occupancy / 100 : revenue_estimate.occupancy) * 0.7) * 365,
                  },
                  {
                    label: 'Projected',
                    sublabel: 'Based on market data',
                    occupancy: revenue_estimate.occupancy > 1 ? revenue_estimate.occupancy / 100 : revenue_estimate.occupancy,
                    revenue: revenue_estimate.annual,
                  },
                  {
                    label: 'Optimistic',
                    sublabel: '20% higher occupancy',
                    occupancy: Math.min((revenue_estimate.occupancy > 1 ? revenue_estimate.occupancy / 100 : revenue_estimate.occupancy) * 1.2, 0.95),
                    revenue: revenue_estimate.nightly * Math.min((revenue_estimate.occupancy > 1 ? revenue_estimate.occupancy / 100 : revenue_estimate.occupancy) * 1.2, 0.95) * 365,
                  },
                ].map((scenario, i) => {
                  const annualProfit = scenario.revenue - rentalCalcs.rent * 12;
                  return (
                    <div key={i} className={`rounded-xl p-4 border ${i === 1 ? 'border-[#C9A962] bg-[#C9A962]/5' : 'border-[#e2e8f0]'}`}>
                      <p className="font-semibold text-[#1e293b] text-sm">{scenario.label}</p>
                      <p className="text-xs text-[#94a3b8] mb-3">{scenario.sublabel}</p>
                      <p className="text-lg font-bold text-[#1e293b]">{formatCurrency(scenario.revenue)}/yr</p>
                      <p className="text-xs text-[#94a3b8]">at {formatPercent(scenario.occupancy)} occupancy</p>
                      <p className={`text-sm font-bold mt-2 ${annualProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(annualProfit)} profit
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* ---------------------------------------------------------- */}
        {/* SECTION 6: PURCHASE INVESTMENT SCENARIO */}
        {/* ---------------------------------------------------------- */}
        {hasPurchase && purchaseCalcs && (
          <section id="section-purchase" className="scroll-mt-24 mb-16">
            <SectionHeader icon={Landmark} title="Purchase Investment Analysis" subtitle="Financial projections based on purchasing the property" tooltip="This section shows what your returns would look like if you BUY the property and use it as a short-term rental. It includes mortgage payments, down payment, and key investment metrics like cap rate and cash-on-cash return." />

            {/* Purchase Overview */}
            <div className="bg-white rounded-2xl shadow-sm border border-[#e2e8f0] p-6 mb-8">
              <h3 className="text-lg font-serif font-semibold text-[#1e293b] mb-4">Investment Summary</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <StatCard label="Purchase Price" value={formatCurrency(purchaseCalcs.price)} icon={Home} tooltip="The estimated purchase price of the property based on comparable sales data or the value you provided." />
                <StatCard label="Down Payment" value={formatCurrency(purchaseCalcs.downPayment)} sublabel={`${(purchaseCalcs.downPct * 100).toFixed(0)}%`} icon={Wallet} tooltip="The upfront cash you'd pay at closing. Investment properties typically require 20-25% down. A larger down payment means lower monthly mortgage payments." />
                <StatCard label="Total Cash Needed" value={formatCurrency(purchaseCalcs.totalCashNeeded)} sublabel="Down + closing" icon={PiggyBank} tooltip="Your total out-of-pocket cost to close the deal — includes down payment plus closing costs (typically 2-5% of purchase price for inspections, title, appraisal, etc.)." />
                <StatCard label="Monthly Mortgage" value={purchaseCalcs.monthlyMortgage > 0 ? formatCurrency(purchaseCalcs.monthlyMortgage) : 'Cash Purchase'} icon={Landmark} tooltip="Your monthly principal and interest payment on the mortgage loan. This is a fixed cost regardless of how many nights you book." />
              </div>
            </div>

            {/* Key Investment Metrics */}
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              <div className="bg-white rounded-2xl shadow-sm border border-[#e2e8f0] p-6">
                <h3 className="text-lg font-serif font-semibold text-[#1e293b] mb-4">Key Metrics</h3>
                <div className="divide-y divide-[#e2e8f0] rounded-xl border border-[#e2e8f0] overflow-hidden">
                  <DataRow label="Net Operating Income (NOI)" value={formatCurrency(purchaseCalcs.noi)} highlight tooltip="Annual revenue minus all operating expenses (but NOT mortgage). This is the industry-standard measure of a property's earning power before financing costs." />
                  <DataRow label="Cap Rate" value={`${purchaseCalcs.capRate.toFixed(1)}%`} highlight tooltip="Capitalization Rate — NOI divided by purchase price. Think of it as the property's yield if you paid all cash. 5-8% is typical for STR; 8%+ is strong." />
                  <DataRow label="Cash-on-Cash Return" value={`${purchaseCalcs.cashOnCash.toFixed(1)}%`} highlight tooltip="Your annual cash flow divided by the total cash you invested (down payment + closing). This is the return on YOUR money. 8-12% is considered good for STR investments." />
                  {purchaseCalcs.dscr !== Infinity && (
                    <DataRow label="DSCR" value={purchaseCalcs.dscr.toFixed(2)} tooltip="Debt Service Coverage Ratio — NOI divided by annual mortgage payments. Above 1.0 means the property covers its debt. Lenders typically want 1.25+." />
                  )}
                  <DataRow label="Break-Even Occupancy" value={formatPercent(purchaseCalcs.breakEvenOccupancy)} tooltip="The minimum occupancy needed to cover all costs including mortgage. Below this, you're losing money each month." />
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-[#e2e8f0] p-6">
                <h3 className="text-lg font-serif font-semibold text-[#1e293b] mb-4">Annual Cash Flow</h3>
                <div className="divide-y divide-[#e2e8f0] rounded-xl border border-[#e2e8f0] overflow-hidden">
                  <DataRow label="Gross Revenue" value={formatCurrency(revenue_estimate.annual)} highlight tooltip="Total projected annual income before any expenses are subtracted." />
                  <DataRow label="Operating Expenses (35%)" value={`- ${formatCurrency(purchaseCalcs.operatingExpenses)}`} tooltip="Day-to-day costs of running the rental — cleaning, supplies, repairs, platform fees, utilities, etc. Estimated at 35% of gross revenue, which is typical for professionally managed STRs." />
                  <DataRow label="Property Tax" value={`- ${formatCurrency(purchaseCalcs.propertyTax)}`} tooltip="Annual property taxes based on the purchase price and local tax rates. This is usually 1-2% of the property value per year." />
                  <DataRow label="Insurance" value={`- ${formatCurrency(purchaseCalcs.insurance)}`} tooltip="Annual insurance premium for a short-term rental property. STR insurance costs more than standard homeowner's insurance because of the higher liability risk." />
                  {purchaseCalcs.annualMortgage > 0 && (
                    <DataRow label="Mortgage (Annual)" value={`- ${formatCurrency(purchaseCalcs.annualMortgage)}`} />
                  )}
                  <DataRow label="Annual Cash Flow" value={
                    <span className={purchaseCalcs.annualCashFlow >= 0 ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>
                      {formatCurrency(purchaseCalcs.annualCashFlow)}
                    </span>
                  } highlight />
                  <DataRow label="Monthly Cash Flow" value={
                    <span className={purchaseCalcs.monthlyCashFlow >= 0 ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>
                      {formatCurrency(purchaseCalcs.monthlyCashFlow)}
                    </span>
                  } />
                </div>
              </div>
            </div>

            {/* Cap Rate Context */}
            <InsightBox type="info">
              <strong>Cap Rate Context:</strong> A cap rate of {purchaseCalcs.capRate.toFixed(1)}% means the property generates {purchaseCalcs.capRate.toFixed(1)} cents of net operating income for every dollar of property value annually. Short-term rental properties in strong markets typically see cap rates between 5-12%.
            </InsightBox>
          </section>
        )}

        {/* ---------------------------------------------------------- */}
        {/* SECTION: TAX IMPLICATIONS */}
        {/* ---------------------------------------------------------- */}
        {(hasRental || hasPurchase) && (
          <section id="section-tax" className="scroll-mt-24 mb-16">
            <SectionHeader icon={Calculator} title="Tax Implications" subtitle="Estimated tax deductions and benefits for this short-term rental investment" tooltip="Short-term rentals come with tax deductions that can significantly reduce your taxable income — things like depreciation, mortgage interest, repairs, and operating expenses. Always consult a tax professional for your specific situation." />

            {/* Tax Deductions Breakdown */}
            <div className="bg-white rounded-2xl shadow-sm border border-[#e2e8f0] p-6 mb-8">
              <h3 className="text-lg font-serif font-semibold text-[#1e293b] mb-4">Estimated Annual Tax Deductions</h3>
              <p className="text-sm text-[#64748b] mb-6">Based on your projected revenue and property details, here are the estimated tax-deductible expenses you may be able to claim. Consult a tax professional for personalized advice.</p>

              {(() => {
                const annualRev = revenue_estimate.annual;
                const occRate = revenue_estimate.occupancy > 1 ? revenue_estimate.occupancy / 100 : revenue_estimate.occupancy;
                const nightlyRate = revenue_estimate.nightly;

                // Calculate estimated deductions
                const platformFees = Math.round(annualRev * 0.03); // ~3% Airbnb host fee
                const cleaningCosts = Math.round(annualRev * 0.08); // ~8% cleaning
                const utilitiesCost = Math.round(annualRev * 0.04); // ~4% utilities
                const suppliesCost = Math.round(annualRev * 0.025); // ~2.5% supplies
                const maintenanceCost = Math.round(annualRev * 0.04); // ~4% maintenance
                const insuranceCost = Math.round(annualRev * 0.03); // ~3% STR insurance
                const advertisingCost = Math.round(annualRev * 0.01); // ~1% marketing
                const professionalCost = Math.round(annualRev * 0.02); // ~2% accounting/legal

                // Purchase-specific deductions
                const purchasePrice = purchase?.purchasePrice || 0;
                const buildingValue = Math.round(purchasePrice * 0.80); // ~80% building, 20% land
                const annualDepreciation = purchasePrice > 0 ? Math.round(buildingValue / 27.5) : 0;
                const propertyTaxEst = purchasePrice > 0 ? Math.round(purchasePrice * 0.012) : 0; // ~1.2% avg
                const mortgageInterest = (() => {
                  if (!purchase?.purchasePrice) return 0;
                  const price = purchase.purchasePrice;
                  const downPct = (purchase.downPaymentPercent || 20) / 100;
                  const loanAmount = price * (1 - downPct);
                  const rate = (purchase.interestRate || 7) / 100;
                  // First year interest is roughly the loan amount * rate
                  return purchase.loanType === 'cash' ? 0 : Math.round(loanAmount * rate * 0.97);
                })();

                // Rental arbitrage specific
                const monthlyRent = rental_arbitrage?.monthlyRent || 0;
                const annualRent = monthlyRent * 12;

                // Build deductions list
                const deductions: Array<{ category: string; amount: number; note: string }> = [];

                // Operating expenses (both scenarios)
                deductions.push({ category: 'Platform Fees (Airbnb/VRBO)', amount: platformFees, note: '~3% of gross revenue' });
                deductions.push({ category: 'Cleaning & Turnover', amount: cleaningCosts, note: '~8% of gross revenue' });
                deductions.push({ category: 'Utilities (Electric, Water, Internet)', amount: utilitiesCost, note: '~4% of gross revenue' });
                deductions.push({ category: 'Guest Supplies & Consumables', amount: suppliesCost, note: '~2.5% of gross revenue' });
                deductions.push({ category: 'Maintenance & Repairs', amount: maintenanceCost, note: '~4% of gross revenue' });
                deductions.push({ category: 'STR Insurance Premium', amount: insuranceCost, note: '~3% of gross revenue' });
                deductions.push({ category: 'Advertising & Marketing', amount: advertisingCost, note: '~1% of gross revenue' });
                deductions.push({ category: 'Professional Services (CPA, Legal)', amount: professionalCost, note: '~2% of gross revenue' });

                // Purchase-specific
                if (hasPurchase && purchasePrice > 0) {
                  if (annualDepreciation > 0) {
                    deductions.push({ category: 'Property Depreciation (27.5 yr)', amount: annualDepreciation, note: `${formatCurrency(buildingValue)} building value / 27.5 years` });
                  }
                  if (mortgageInterest > 0) {
                    deductions.push({ category: 'Mortgage Interest', amount: mortgageInterest, note: 'Estimated first-year interest' });
                  }
                  if (propertyTaxEst > 0) {
                    deductions.push({ category: 'Property Taxes', amount: propertyTaxEst, note: '~1.2% of property value' });
                  }
                }

                // Rental arbitrage specific
                if (hasRental && monthlyRent > 0) {
                  deductions.push({ category: 'Lease Payments', amount: annualRent, note: `${formatCurrency(monthlyRent)}/mo x 12` });
                }

                const totalDeductions = deductions.reduce((sum, d) => sum + d.amount, 0);
                const taxableIncome = Math.max(0, annualRev - totalDeductions);

                // Estimated tax savings at different brackets
                const brackets = [
                  { rate: 0.22, label: '22% bracket ($44k-$95k)' },
                  { rate: 0.24, label: '24% bracket ($95k-$191k)' },
                  { rate: 0.32, label: '32% bracket ($191k-$244k)' },
                ];

                return (
                  <div>
                    {/* Deductions Table */}
                    <div className="overflow-x-auto mb-6">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-[#f8fafc]">
                            <th className="p-3 text-left text-[#64748b] font-medium rounded-tl-lg">Deduction Category</th>
                            <th className="p-3 text-right text-[#64748b] font-medium">Est. Annual Amount</th>
                            <th className="p-3 text-right text-[#64748b] font-medium rounded-tr-lg">Notes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {deductions.map((d, i) => (
                            <tr key={i} className="border-t border-[#e2e8f0]">
                              <td className="p-3 text-[#1e293b]">{d.category}</td>
                              <td className="p-3 text-right font-semibold text-[#1e293b]">{formatCurrency(d.amount)}</td>
                              <td className="p-3 text-right text-[#94a3b8] text-xs">{d.note}</td>
                            </tr>
                          ))}
                          <tr className="border-t-2 border-[#C9A962] bg-[#C9A962]/5">
                            <td className="p-3 font-bold text-[#1e293b]">Total Estimated Deductions</td>
                            <td className="p-3 text-right font-bold text-[#C9A962] text-lg">{formatCurrency(totalDeductions)}</td>
                            <td className="p-3"></td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Taxable Income Summary */}
                    <div className="grid grid-cols-3 gap-4 mb-6">
                      <div className="bg-[#f8fafc] rounded-xl p-4 text-center">
                        <p className="text-xs text-[#64748b] mb-1">Gross Revenue</p>
                        <p className="text-lg font-bold text-[#1e293b]">{formatCurrency(annualRev)}</p>
                      </div>
                      <div className="bg-[#f8fafc] rounded-xl p-4 text-center">
                        <p className="text-xs text-[#64748b] mb-1">Total Deductions</p>
                        <p className="text-lg font-bold text-red-600">-{formatCurrency(totalDeductions)}</p>
                      </div>
                      <div className="bg-[#C9A962]/10 rounded-xl p-4 text-center border border-[#C9A962]/30">
                        <p className="text-xs text-[#64748b] mb-1">Est. Taxable Income</p>
                        <p className="text-lg font-bold text-[#C9A962]">{formatCurrency(taxableIncome)}</p>
                      </div>
                    </div>

                    {/* Tax Savings by Bracket */}
                    <div className="bg-white rounded-xl border border-[#e2e8f0] p-5 mb-6">
                      <h4 className="text-sm font-semibold text-[#1e293b] mb-3">Estimated Tax Savings from Deductions</h4>
                      <p className="text-xs text-[#64748b] mb-4">How much these deductions could save you depending on your federal tax bracket:</p>
                      <div className="grid grid-cols-3 gap-3">
                        {brackets.map((b, i) => (
                          <div key={i} className="bg-[#f8fafc] rounded-lg p-3 text-center">
                            <p className="text-[10px] text-[#94a3b8] mb-1">{b.label}</p>
                            <p className="text-lg font-bold text-green-600">{formatCurrency(Math.round(totalDeductions * b.rate))}</p>
                            <p className="text-[10px] text-[#94a3b8]">saved annually</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Depreciation Highlight (Purchase only) */}
                    {hasPurchase && annualDepreciation > 0 && (
                      <InsightBox type="success">
                        <strong>Depreciation Advantage:</strong> Property depreciation of {formatCurrency(annualDepreciation)}/year is a "paper loss" that reduces taxable income without any cash outlay. Over 27.5 years, you can deduct the full {formatCurrency(buildingValue)} building value. A cost segregation study could accelerate this to front-load deductions in years 1-5.
                      </InsightBox>
                    )}

                    {/* QBI Deduction Note */}
                    <div className="mt-4">
                      <InsightBox type="info">
                        <strong>QBI Deduction (Section 199A):</strong> If your STR qualifies as an active business (250+ hours of material participation), you may be eligible for an additional 20% Qualified Business Income deduction on net rental income. This deduction is now permanent under the One Big Beautiful Bill Act.
                      </InsightBox>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Key Tax Strategies */}
            <div className="bg-white rounded-2xl shadow-sm border border-[#e2e8f0] p-6 mb-8">
              <h3 className="text-lg font-serif font-semibold text-[#1e293b] mb-4">Key Tax Strategies for STR Owners</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-[#f8fafc] rounded-xl p-4 border border-[#e2e8f0]">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-[#C9A962]/15 flex items-center justify-center">
                      <Building className="w-4 h-4 text-[#C9A962]" />
                    </div>
                    <h4 className="font-semibold text-[#1e293b] text-sm">Cost Segregation Study</h4>
                  </div>
                  <p className="text-xs text-[#64748b]">Reclassify components (appliances, fixtures, landscaping) to 5-15 year schedules for accelerated depreciation. Can front-load significant deductions in years 1-5.</p>
                </div>
                <div className="bg-[#f8fafc] rounded-xl p-4 border border-[#e2e8f0]">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-[#C9A962]/15 flex items-center justify-center">
                      <Calendar className="w-4 h-4 text-[#C9A962]" />
                    </div>
                    <h4 className="font-semibold text-[#1e293b] text-sm">14-Day Rule</h4>
                  </div>
                  <p className="text-xs text-[#64748b]">If you rent your property for 14 days or fewer per year, the rental income is completely tax-free. Useful for properties in high-demand event areas.</p>
                </div>
                <div className="bg-[#f8fafc] rounded-xl p-4 border border-[#e2e8f0]">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-[#C9A962]/15 flex items-center justify-center">
                      <DollarSign className="w-4 h-4 text-[#C9A962]" />
                    </div>
                    <h4 className="font-semibold text-[#1e293b] text-sm">Bonus Depreciation (100%)</h4>
                  </div>
                  <p className="text-xs text-[#64748b]">Under the One Big Beautiful Bill Act, qualifying property placed in service after Jan 19, 2025 is eligible for 100% first-year bonus depreciation on furniture, appliances, and equipment.</p>
                </div>
                <div className="bg-[#f8fafc] rounded-xl p-4 border border-[#e2e8f0]">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-[#C9A962]/15 flex items-center justify-center">
                      <Percent className="w-4 h-4 text-[#C9A962]" />
                    </div>
                    <h4 className="font-semibold text-[#1e293b] text-sm">Schedule C vs. E Filing</h4>
                  </div>
                  <p className="text-xs text-[#64748b]">Schedule C (active business) enables QBI deduction but may trigger self-employment tax. Schedule E (passive rental) avoids SE tax but limits loss deductions. Consult a CPA for optimal classification.</p>
                </div>
              </div>
            </div>

            {/* Disclaimer */}
            <InsightBox type="warning">
              <strong>Disclaimer:</strong> These are estimated deductions based on industry averages and your projected revenue. Actual deductions depend on your specific tax situation, filing status, and local regulations. This is not tax advice. Always consult with a qualified CPA or tax professional who specializes in short-term rental properties.
            </InsightBox>
          </section>
        )}

        {/* ---------------------------------------------------------- */}
        {/* SECTION 7: AI EXECUTIVE SUMMARY */}
        {/* ---------------------------------------------------------- */}
        <section id="section-summary" className="scroll-mt-24 mb-16">
          <SectionHeader icon={Sparkles} title="Executive Summary" subtitle="AI-synthesized analysis of all data points" tooltip="An AI-generated summary that pulls together all the data from every section of this report into a concise overview. This is a great starting point to understand the overall picture before diving into the details." />

          {ai_summary ? (
            <div className="bg-white rounded-2xl shadow-sm border border-[#e2e8f0] p-8">
              <div className="prose prose-sm max-w-none text-[#334155]">
                <LightMarkdown>{ai_summary}</LightMarkdown>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-[#e2e8f0] p-8">
              <div className="space-y-6">
                {/* Auto-generated summary from data */}
                <div>
                  <h3 className="text-lg font-serif font-semibold text-[#1e293b] mb-3">Property at a Glance</h3>
                  <p className="text-[#64748b] leading-relaxed">
                    This {property.bedrooms}-bedroom, {property.bathrooms}-bathroom property at <strong className="text-[#1e293b]">{property.address}</strong> is
                    projected to generate <strong className="text-[#1e293b]">{formatCurrency(revenue_estimate.annual)}</strong> in annual revenue
                    with a <strong className="text-[#1e293b]">{formatPercent(revenue_estimate.occupancy)}</strong> occupancy rate
                    and an average nightly rate of <strong className="text-[#1e293b]">{formatCurrency(revenue_estimate.nightly)}</strong>.
                    {revenue_estimate.range && (
                      <> The revenue range spans from {formatCurrency(revenue_estimate.range.low)} to {formatCurrency(revenue_estimate.range.high)}.</>
                    )}
                  </p>
                </div>

                <div>
                  <h3 className="text-lg font-serif font-semibold text-[#1e293b] mb-3">Market Context</h3>
                  <p className="text-[#64748b] leading-relaxed">
                    The <strong className="text-[#1e293b]">{market_data.name}</strong> market has <strong className="text-[#1e293b]">{market_data.listing_count.toLocaleString()}</strong> active
                    short-term rental listings. The market average annual revenue is {formatCurrency(market_data.metrics.revenue < 50000 ? market_data.metrics.revenue * 12 : market_data.metrics.revenue)} with
                    an average occupancy of {formatPercent(market_data.metrics.occupancy)} and ADR of {formatCurrency(market_data.metrics.adr)}.
                    {revenue_estimate.annual > (market_data.metrics.revenue < 50000 ? market_data.metrics.revenue * 12 : market_data.metrics.revenue)
                      ? ' This property is projected to perform above the market average.'
                      : ' This property is projected to perform near the market average.'}
                  </p>
                </div>

                <div>
                  <h3 className="text-lg font-serif font-semibold text-[#1e293b] mb-3">Competition Landscape</h3>
                  <p className="text-[#64748b] leading-relaxed">
                    {filteredComps.length} comparable {property.bedrooms}-bedroom properties were analyzed{filteredComps.length < displayComps.length ? ` (${filteredComps.length} of ${displayComps.length} selected)` : ''}.
                    {filteredComps.length > 0 && (
                      <> The top performer generates {formatCurrency(filteredComps[0].annual_revenue)} annually.
                      {(() => {
                        const rated = filteredComps.filter((c: Comparable) => c.rating && c.rating > 0);
                        if (rated.length > 0) {
                          const avgRating = rated.reduce((s: number, c: Comparable) => s + (c.rating || 0), 0) / rated.length;
                          return ` The average guest rating among comparables is ${avgRating.toFixed(1)} stars.`;
                        }
                        return '';
                      })()}
                      </>
                    )}
                  </p>
                </div>

                {hasRental && rentalCalcs && (
                  <div>
                    <h3 className="text-lg font-serif font-semibold text-[#1e293b] mb-3">Rental Arbitrage Scenario</h3>
                    <p className="text-[#64748b] leading-relaxed">
                      At a monthly rent of {formatCurrency(rentalCalcs.rent)}, the projected monthly profit
                      is <strong className={rentalCalcs.monthlyProfit >= 0 ? 'text-green-600' : 'text-red-600'}>{formatCurrency(rentalCalcs.monthlyProfit)}</strong>.
                      The break-even occupancy is {formatPercent(rentalCalcs.breakEvenOccupancy)}, which
                      is {rentalCalcs.occupancyCushion > 0.15 ? 'well below' : rentalCalcs.occupancyCushion > 0.05 ? 'below' : 'close to'} the
                      projected occupancy of {formatPercent(revenue_estimate.occupancy)}.
                      {rentalCalcs.monthsToRecoup !== Infinity && (
                        <> Estimated startup costs of {formatCurrency(rentalCalcs.startup)} would be recouped in approximately {rentalCalcs.monthsToRecoup} months.</>
                      )}
                    </p>
                  </div>
                )}

                {hasPurchase && purchaseCalcs && (
                  <div>
                    <h3 className="text-lg font-serif font-semibold text-[#1e293b] mb-3">Purchase Investment Scenario</h3>
                    <p className="text-[#64748b] leading-relaxed">
                      At a purchase price of {formatCurrency(purchaseCalcs.price)} with {(purchaseCalcs.downPct * 100).toFixed(0)}% down,
                      the total cash needed is {formatCurrency(purchaseCalcs.totalCashNeeded)}.
                      The property shows a cap rate of <strong className="text-[#1e293b]">{purchaseCalcs.capRate.toFixed(1)}%</strong> and
                      a cash-on-cash return of <strong className="text-[#1e293b]">{purchaseCalcs.cashOnCash.toFixed(1)}%</strong>.
                      {purchaseCalcs.annualCashFlow >= 0
                        ? ` Annual cash flow is projected at ${formatCurrency(purchaseCalcs.annualCashFlow)}.`
                        : ` The property is projected to have negative cash flow of ${formatCurrency(purchaseCalcs.annualCashFlow)} annually.`}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>

        {/* ============================================================ */}
        {/* FOOTER — Coach Inayah branded */}
        {/* ============================================================ */}
        <div className="mt-12 pt-8 border-t border-[#e2e8f0]">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#C9A962]/15 flex items-center justify-center">
                <Home className="w-4 h-4 text-[#C9A962]" />
              </div>
              <span className="text-sm font-medium text-[#64748b]">Coach Inayah's Turnkey Tool</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyLink}
              className="gap-2 border-[#C9A962]/30 text-[#C9A962] hover:bg-[#C9A962]/10"
            >
              {copied ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
              {copied ? 'Copied!' : 'Share Report'}
            </Button>
          </div>
          <p className="text-xs text-[#94a3b8] text-center italic">
            This report presents market data and projections for informational purposes only.
            All data is sourced from Coach Inayah market data based on trailing 12-month performance of comparable properties.
            Actual results may vary based on property condition, management quality, and market conditions.
            This is not investment advice.
          </p>
        </div>
      </div>
    </div>
  );
}
