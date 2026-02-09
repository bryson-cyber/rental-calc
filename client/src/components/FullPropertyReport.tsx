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
  Eye
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MonthlyForecastChart, SeasonalityChart, BedroomPerformanceChart } from './RevenueCharts';
import { CompsMapView } from './CompsMapView';
import { MapView } from './Map';
import { toast } from 'sonner';
import { Streamdown } from 'streamdown';

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

export interface FullReportData {
  property: PropertyInfo;
  revenue_estimate: RevenueEstimate;
  monthly_forecast: MonthlyForecast[];
  comps: Comparable[];
  same_bedroom_comps?: Comparable[];
  market_data: MarketData;
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

function SectionHeader({ icon: Icon, title, subtitle }: { icon: any; title: string; subtitle?: string }) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-[#C9A962]/15 flex items-center justify-center">
          <Icon className="w-5 h-5 text-[#C9A962]" />
        </div>
        <h2 className="text-2xl md:text-3xl font-serif font-bold text-[#1e293b]">{title}</h2>
      </div>
      {subtitle && <p className="text-[#64748b] ml-[52px]">{subtitle}</p>}
    </div>
  );
}

function StatCard({ label, value, sublabel, icon: Icon, highlight }: {
  label: string; value: string; sublabel?: string; icon?: any; highlight?: boolean;
}) {
  return (
    <div className={`rounded-xl p-5 ${highlight ? 'bg-[#C9A962]/10 border border-[#C9A962]/30' : 'bg-white border border-[#e2e8f0]'}`}>
      {Icon && <Icon className={`w-5 h-5 mb-2 ${highlight ? 'text-[#C9A962]' : 'text-[#94a3b8]'}`} />}
      <p className={`text-2xl font-serif font-bold ${highlight ? 'text-[#C9A962]' : 'text-[#1e293b]'}`}>{value}</p>
      <p className="text-sm text-[#64748b] mt-1">{label}</p>
      {sublabel && <p className="text-xs text-[#94a3b8] mt-0.5">{sublabel}</p>}
    </div>
  );
}

function DataRow({ label, value, highlight }: { label: string; value: string | React.ReactNode; highlight?: boolean }) {
  return (
    <div className={`flex justify-between items-center py-3 px-4 ${highlight ? 'bg-[#C9A962]/5' : ''} border-b border-[#e2e8f0] last:border-0`}>
      <span className="text-[#64748b] text-sm">{label}</span>
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
  { id: 'market', label: 'Market', icon: BarChart3 },
  { id: 'competition', label: 'Competition', icon: Target },
  { id: 'rental', label: 'Rental Arbitrage', icon: Building },
  { id: 'purchase', label: 'Purchase', icon: Landmark },
  { id: 'summary', label: 'Summary', icon: Sparkles },
];

function SectionNav({ activeSection, onSectionClick, hasRental, hasPurchase }: {
  activeSection: string;
  onSectionClick: (id: string) => void;
  hasRental: boolean;
  hasPurchase: boolean;
}) {
  const visibleSections = SECTIONS.filter(s => {
    if (s.id === 'rental' && !hasRental) return false;
    if (s.id === 'purchase' && !hasPurchase) return false;
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

  const {
    property,
    revenue_estimate,
    monthly_forecast = [],
    comps = [],
    same_bedroom_comps,
    market_data,
    bedroom_performance = [],
    revenue_percentiles,
    rental_arbitrage,
    purchase,
    historical_data,
    ai_summary,
    generated_at,
    prepared_for,
  } = data;

  const displayComps = (same_bedroom_comps && same_bedroom_comps.length > 0 ? same_bedroom_comps : comps)
    .sort((a, b) => b.annual_revenue - a.annual_revenue);

  const hasRental = !!rental_arbitrage?.monthlyRent;
  const hasPurchase = !!purchase?.purchasePrice;

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
              <p className="text-[#94a3b8] text-xs uppercase tracking-wider mb-1">Est. Annual Revenue</p>
              <p className="text-2xl font-serif font-bold text-[#C9A962]">{formatCurrency(revenue_estimate.annual)}</p>
              {revenue_estimate.range && (
                <p className="text-xs text-[#94a3b8] mt-1">
                  {formatCurrency(revenue_estimate.range.low)} – {formatCurrency(revenue_estimate.range.high)}
                </p>
              )}
            </div>
            <div className="bg-white rounded-xl p-4 border border-[#e2e8f0]">
              <p className="text-[#94a3b8] text-xs uppercase tracking-wider mb-1">Avg. Nightly Rate</p>
              <p className="text-2xl font-serif font-bold text-[#1e293b]">{formatCurrency(revenue_estimate.nightly)}</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-[#e2e8f0]">
              <p className="text-[#94a3b8] text-xs uppercase tracking-wider mb-1">Occupancy Rate</p>
              <p className="text-2xl font-serif font-bold text-[#1e293b]">{formatPercent(revenue_estimate.occupancy)}</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-[#e2e8f0]">
              <p className="text-[#94a3b8] text-xs uppercase tracking-wider mb-1">Monthly Average</p>
              <p className="text-2xl font-serif font-bold text-[#1e293b]">{formatCurrency(revenue_estimate.monthly)}</p>
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
      />

      {/* ============================================================ */}
      {/* MAIN CONTENT */}
      {/* ============================================================ */}
      <div className="max-w-5xl mx-auto px-4 py-10">

        {/* ---------------------------------------------------------- */}
        {/* SECTION 1: PROPERTY OVERVIEW */}
        {/* ---------------------------------------------------------- */}
        <section id="section-overview" className="scroll-mt-24 mb-16">
          <SectionHeader icon={Home} title="Property Overview" subtitle="Location, specifications, and neighborhood context" />

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
              <div className="h-[350px]">
                {property.latitude && property.longitude ? (
                  showStreetView ? (
                    <MapView
                      className="w-full h-full"
                      onMapReady={(map) => {
                        const panorama = new google.maps.StreetViewPanorama(
                          map.getDiv(),
                          {
                            position: { lat: property.latitude!, lng: property.longitude! },
                            pov: { heading: 0, pitch: 0 },
                            zoom: 1,
                            addressControl: false,
                            fullscreenControl: true,
                          }
                        );
                        map.setStreetView(panorama);
                      }}
                    />
                  ) : (
                    <MapView
                      className="w-full h-full"
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
          <SectionHeader icon={DollarSign} title="Revenue Projections" subtitle="Estimated earnings based on market data and comparable properties" />

          {/* Revenue Range */}
          <div className="bg-white rounded-2xl shadow-sm border border-[#e2e8f0] p-6 mb-8">
            <h3 className="text-lg font-serif font-semibold text-[#1e293b] mb-4">Annual Revenue Estimate</h3>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <StatCard
                label="Conservative"
                value={formatCurrency(revenue_estimate.range?.low || revenue_estimate.annual * 0.85)}
                sublabel="Lower range"
                icon={TrendingDown}
              />
              <StatCard
                label="Projected"
                value={formatCurrency(revenue_estimate.annual)}
                sublabel="Most likely"
                icon={DollarSign}
                highlight
              />
              <StatCard
                label="Optimistic"
                value={formatCurrency(revenue_estimate.range?.high || revenue_estimate.annual * 1.15)}
                sublabel="Upper range"
                icon={TrendingUp}
              />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Monthly Average" value={formatCurrency(revenue_estimate.monthly)} icon={Calendar} />
              <StatCard label="Nightly Rate (ADR)" value={formatCurrency(revenue_estimate.nightly)} icon={DollarSign} />
              <StatCard label="Occupancy Rate" value={formatPercent(revenue_estimate.occupancy)} icon={Percent} />
              <StatCard label="RevPAR" value={formatCurrency(revenue_estimate.nightly * (revenue_estimate.occupancy > 1 ? revenue_estimate.occupancy / 100 : revenue_estimate.occupancy))} icon={BarChart3} />
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
        {/* SECTION 3: MARKET ANALYSIS */}
        {/* ---------------------------------------------------------- */}
        <section id="section-market" className="scroll-mt-24 mb-16">
          <SectionHeader icon={BarChart3} title="Market Analysis" subtitle="Overall market health, performance by bedroom count, and competitive landscape" />

          {/* Market Overview */}
          <div className="bg-white rounded-2xl shadow-sm border border-[#e2e8f0] p-6 mb-8">
            <h3 className="text-lg font-serif font-semibold text-[#1e293b] mb-4">{market_data.name} Market Overview</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Active Listings" value={market_data.listing_count.toLocaleString()} icon={Building} />
              <StatCard label="Market Avg. Monthly Revenue" value={formatCurrency(market_data.metrics.revenue)} icon={DollarSign} />
              <StatCard label="Market Avg. Occupancy" value={formatPercent(market_data.metrics.occupancy)} icon={Percent} />
              <StatCard label="Market Avg. ADR" value={formatCurrency(market_data.metrics.adr)} icon={DollarSign} />
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
            <h3 className="text-lg font-serif font-semibold text-[#1e293b] mb-4">Your Property vs. Market Average</h3>
            <div className="divide-y divide-[#e2e8f0] rounded-xl border border-[#e2e8f0] overflow-hidden">
              <div className="grid grid-cols-3 bg-[#C9A962] text-white text-sm font-medium">
                <div className="p-3">Metric</div>
                <div className="p-3 text-center">Your Property</div>
                <div className="p-3 text-center">Market Average</div>
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
              <h3 className="text-lg font-serif font-semibold text-[#1e293b] mb-4">Performance by Bedroom Count</h3>
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
            <div className="bg-white rounded-2xl shadow-sm border border-[#e2e8f0] p-6">
              <h3 className="text-lg font-serif font-semibold text-[#1e293b] mb-4">Revenue Distribution</h3>
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
        </section>

        {/* ---------------------------------------------------------- */}
        {/* SECTION 4: COMPETITION ANALYSIS */}
        {/* ---------------------------------------------------------- */}
        <section id="section-competition" className="scroll-mt-24 mb-16">
          <SectionHeader icon={Target} title="Competition Analysis" subtitle={`${displayComps.length} comparable ${property.bedrooms}-bedroom properties ranked by revenue`} />

          {/* Comps Map */}
          {property.latitude && property.longitude && (
            <div className="mb-8">
              <CompsMapView
                comps={displayComps}
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
                    <th className="text-left p-4 font-medium">#</th>
                    <th className="text-left p-4 font-medium">Property</th>
                    <th className="text-right p-4 font-medium">Revenue</th>
                    <th className="text-right p-4 font-medium">ADR</th>
                    <th className="text-right p-4 font-medium">Occupancy</th>
                    <th className="text-right p-4 font-medium">Rating</th>
                    <th className="text-right p-4 font-medium">Reviews</th>
                  </tr>
                </thead>
                <tbody>
                  {displayComps.slice(0, 15).map((comp, i) => (
                    <tr key={comp.id || i} className="border-b border-[#e2e8f0] hover:bg-[#C9A962]/5 transition-colors">
                      <td className="p-4 text-[#94a3b8] font-medium">{i + 1}</td>
                      <td className="p-4">
                        <div>
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
          </div>

          {/* Comp Summary Stats */}
          {displayComps.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                label="Avg. Comp Revenue"
                value={formatCurrency(displayComps.reduce((s, c) => s + c.annual_revenue, 0) / displayComps.length)}
                icon={DollarSign}
              />
              <StatCard
                label="Highest Revenue"
                value={formatCurrency(displayComps[0]?.annual_revenue || 0)}
                icon={TrendingUp}
              />
              <StatCard
                label="Avg. Comp Rating"
                value={(() => {
                  const rated = displayComps.filter(c => c.rating && c.rating > 0);
                  return rated.length > 0 ? (rated.reduce((s, c) => s + (c.rating || 0), 0) / rated.length).toFixed(1) : 'N/A';
                })()}
                icon={Star}
              />
              <StatCard
                label="Total Comps Analyzed"
                value={displayComps.length.toString()}
                icon={Users}
              />
            </div>
          )}
        </section>

        {/* ---------------------------------------------------------- */}
        {/* SECTION 5: RENTAL ARBITRAGE SCENARIO */}
        {/* ---------------------------------------------------------- */}
        {hasRental && rentalCalcs && (
          <section id="section-rental" className="scroll-mt-24 mb-16">
            <SectionHeader icon={Building} title="Rental Arbitrage Analysis" subtitle="Financial projections based on renting the property and subletting on Airbnb" />

            <div className="bg-white rounded-2xl shadow-sm border border-[#e2e8f0] p-6 mb-8">
              <h3 className="text-lg font-serif font-semibold text-[#1e293b] mb-4">Monthly Cash Flow</h3>
              <div className="divide-y divide-[#e2e8f0] rounded-xl border border-[#e2e8f0] overflow-hidden">
                <DataRow label="Projected Monthly Revenue" value={formatCurrency(rentalCalcs.monthlyRevenue)} highlight />
                <DataRow label="Monthly Rent" value={`- ${formatCurrency(rentalCalcs.rent)}`} />
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
                    <p className="text-sm text-[#64748b] mb-1">Break-Even Occupancy</p>
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
                    <p className="text-sm text-[#64748b] mb-1">Break-Even ADR</p>
                    <p className="text-xl font-bold text-[#1e293b]">{formatCurrency(rentalCalcs.breakEvenADR)}</p>
                    <p className="text-xs text-[#94a3b8]">
                      Minimum nightly rate needed. Market projects {formatCurrency(revenue_estimate.nightly)}.
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-[#64748b] mb-1">Occupancy Cushion</p>
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
                    <DataRow label="Estimated Startup Costs" value={formatCurrency(rentalCalcs.startup)} />
                    <DataRow label="Annual Profit" value={formatCurrency(rentalCalcs.annualProfit)} highlight />
                    <DataRow label="ROI (First Year)" value={`${rentalCalcs.roi.toFixed(0)}%`} highlight />
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
            <SectionHeader icon={Landmark} title="Purchase Investment Analysis" subtitle="Financial projections based on purchasing the property" />

            {/* Purchase Overview */}
            <div className="bg-white rounded-2xl shadow-sm border border-[#e2e8f0] p-6 mb-8">
              <h3 className="text-lg font-serif font-semibold text-[#1e293b] mb-4">Investment Summary</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <StatCard label="Purchase Price" value={formatCurrency(purchaseCalcs.price)} icon={Home} />
                <StatCard label="Down Payment" value={formatCurrency(purchaseCalcs.downPayment)} sublabel={`${(purchaseCalcs.downPct * 100).toFixed(0)}%`} icon={Wallet} />
                <StatCard label="Total Cash Needed" value={formatCurrency(purchaseCalcs.totalCashNeeded)} sublabel="Down + closing" icon={PiggyBank} />
                <StatCard label="Monthly Mortgage" value={purchaseCalcs.monthlyMortgage > 0 ? formatCurrency(purchaseCalcs.monthlyMortgage) : 'Cash Purchase'} icon={Landmark} />
              </div>
            </div>

            {/* Key Investment Metrics */}
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              <div className="bg-white rounded-2xl shadow-sm border border-[#e2e8f0] p-6">
                <h3 className="text-lg font-serif font-semibold text-[#1e293b] mb-4">Key Metrics</h3>
                <div className="divide-y divide-[#e2e8f0] rounded-xl border border-[#e2e8f0] overflow-hidden">
                  <DataRow label="Net Operating Income (NOI)" value={formatCurrency(purchaseCalcs.noi)} highlight />
                  <DataRow label="Cap Rate" value={`${purchaseCalcs.capRate.toFixed(1)}%`} highlight />
                  <DataRow label="Cash-on-Cash Return" value={`${purchaseCalcs.cashOnCash.toFixed(1)}%`} highlight />
                  {purchaseCalcs.dscr !== Infinity && (
                    <DataRow label="DSCR" value={purchaseCalcs.dscr.toFixed(2)} />
                  )}
                  <DataRow label="Break-Even Occupancy" value={formatPercent(purchaseCalcs.breakEvenOccupancy)} />
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-[#e2e8f0] p-6">
                <h3 className="text-lg font-serif font-semibold text-[#1e293b] mb-4">Annual Cash Flow</h3>
                <div className="divide-y divide-[#e2e8f0] rounded-xl border border-[#e2e8f0] overflow-hidden">
                  <DataRow label="Gross Revenue" value={formatCurrency(revenue_estimate.annual)} highlight />
                  <DataRow label="Operating Expenses (35%)" value={`- ${formatCurrency(purchaseCalcs.operatingExpenses)}`} />
                  <DataRow label="Property Tax" value={`- ${formatCurrency(purchaseCalcs.propertyTax)}`} />
                  <DataRow label="Insurance" value={`- ${formatCurrency(purchaseCalcs.insurance)}`} />
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
        {/* SECTION 7: AI EXECUTIVE SUMMARY */}
        {/* ---------------------------------------------------------- */}
        <section id="section-summary" className="scroll-mt-24 mb-16">
          <SectionHeader icon={Sparkles} title="Executive Summary" subtitle="AI-synthesized analysis of all data points" />

          {ai_summary ? (
            <div className="bg-white rounded-2xl shadow-sm border border-[#e2e8f0] p-8">
              <div className="prose prose-sm max-w-none text-[#334155]">
                <Streamdown>{ai_summary}</Streamdown>
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
                    {displayComps.length} comparable {property.bedrooms}-bedroom properties were analyzed.
                    {displayComps.length > 0 && (
                      <> The top performer generates {formatCurrency(displayComps[0].annual_revenue)} annually.
                      {(() => {
                        const rated = displayComps.filter(c => c.rating && c.rating > 0);
                        if (rated.length > 0) {
                          const avgRating = rated.reduce((s, c) => s + (c.rating || 0), 0) / rated.length;
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
