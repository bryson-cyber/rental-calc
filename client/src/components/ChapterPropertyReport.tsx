/**
 * Chapter-Based Property Report Component
 * Matches the Airbnb Arbitrage Opportunity format
 */

import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Building,
  MapPin,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Percent,
  Star,
  ExternalLink,
  Users,
  Home,
  Calendar,
  Target,
  Award,
  CheckCircle2,
  Lightbulb,
  BarChart3,
  Car,
  Wifi,
  Sparkles,
  PawPrint,
  Droplets,
  Thermometer,
  Tv,
  BookOpen,
  Calculator,
  PiggyBank,
  TrendingDown as TrendDown,
  Bed,
  Bath,
  Maximize,
  Search
} from 'lucide-react';
import { Link } from 'wouter';
import { MonthlyForecastChart, SeasonalityChart, BedroomPerformanceChart, CompetitorDistributionChart } from './RevenueCharts';
import MarketInsightsPanel from './MarketInsightsPanel';
import BreakEvenCalculator from './BreakEvenCalculator';
import { CompsMapView } from './CompsMapView';
import { ShareReportButton } from './ShareReportButton';
import { StandaloneMarketAdvisor } from './StandaloneMarketAdvisor';
import OpportunityFinderStep from './OpportunityFinderStep';


// Helper function to extract Airbnb listing ID and construct image URL
const getAirbnbImageUrl = (airbnbUrl?: string): string | null => {
  if (!airbnbUrl) return null;
  
  // Extract listing ID from URL like https://www.airbnb.com/rooms/12345
  const match = airbnbUrl.match(/\/rooms\/(\d+)/);
  if (!match) return null;
  
  const listingId = match[1];
  // Airbnb image CDN pattern - this constructs a thumbnail URL
  // Note: This may not work for all listings as Airbnb's CDN requires authentication
  // But we can try the public pattern first
  return `https://a0.muscache.com/im/pictures/miso/Hosting-${listingId}/original/listing-photo.jpg`;
};

// Types
interface PropertyData {
  address: string;
  city: string;
  state: string;
  zipCode: string;
  bedrooms: number;
  bathrooms: number;
  accommodates: number;
  propertyType?: string;
  sqft?: number;
  monthlyRent?: number;
  latitude?: number;
  longitude?: number;
}

interface MarketMetrics {
  occupancy: number;
  adr: number;
  revenue: number;
  revpar: number;
  active_listings: number;
  market_score?: number;
}

interface RevenueEstimate {
  annual: number;
  monthly: number;
  nightly: number;
  occupancy: number;
  range?: {
    low: number;
    high: number;
  };
}

interface MonthlyForecast {
  month: string;
  revenue: number;
  occupancy: number;
}

interface ComparableProperty {
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
  professionally_managed?: boolean;
  distance_meters?: number;
  revenue_trend?: 'growing' | 'stable' | 'declining';
  historical_total_revenue?: number;
  historical_avg_occupancy?: number;
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
  metrics: MarketMetrics;
  listing_count: number;
}

interface PropertyReportData {
  property: PropertyData;
  revenue_estimate: RevenueEstimate;
  monthly_forecast: MonthlyForecast[];
  comps: ComparableProperty[];
  same_bedroom_comps?: ComparableProperty[];
  market_data: MarketData;
  bedroom_performance: BedroomPerformance[];
  revenue_percentiles?: {
    p10: number;
    p25: number;
    p50: number;
    p75: number;
    p90: number;
  };
}

interface ChapterPropertyReportProps {
  data: PropertyReportData;
  onBack: () => void;
  clientName?: string;
  marketId?: number;
}

// Format helpers
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
};

const formatPercent = (value: number) => {
  const percent = value > 1 ? value : value * 100;
  return `${Math.round(percent)}%`;
};

// Chapter Navigation Component
function ChapterNav({ chapters, activeChapter, onChapterClick }: {
  chapters: { id: number; title: string }[];
  activeChapter: number;
  onChapterClick: (id: number) => void;
}) {
  return (
    <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[oklch(0.15_0_0)]/10 py-4">
      <div className="container mx-auto px-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {chapters.map((chapter) => (
            <button
              key={chapter.id}
              onClick={() => onChapterClick(chapter.id)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                activeChapter === chapter.id
                  ? 'bg-[oklch(0.55_0.14_75)] text-white'
                  : 'bg-[oklch(0.15_0_0)]/5 text-[oklch(0.15_0_0)]/70 hover:bg-[oklch(0.15_0_0)]/10'
              }`}
            >
              {chapter.id}. {chapter.title}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// Chapter Section Component
function ChapterSection({ id, title, children }: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 py-12 border-b border-[oklch(0.15_0_0)]/10 last:border-0">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
      >
        <h2 className="text-2xl md:text-3xl font-sans font-bold text-[oklch(0.15_0_0)] mb-8 flex items-center gap-3">
          <BookOpen className="w-7 h-7 text-[oklch(0.55_0.14_75)]" />
          {title}
        </h2>
        {children}
      </motion.div>
    </section>
  );
}

// Table Component
function DataTable({ headers, rows, highlight }: {
  headers: string[];
  rows: (string | React.ReactNode)[][];
  highlight?: number;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b-2 border-[oklch(0.55_0.14_75)]/30">
            {headers.map((header, idx) => (
              <th
                key={idx}
                className={`py-3 px-4 text-sm font-semibold text-[oklch(0.15_0_0)] ${
                  idx === 0 ? 'text-left' : 'text-right'
                }`}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIdx) => (
            <tr
              key={rowIdx}
              className={`border-b border-[oklch(0.15_0_0)]/5 transition-colors ${
                highlight === rowIdx ? 'bg-[oklch(0.55_0.14_75)]/10' : 'hover:bg-[oklch(0.15_0_0)]/5'
              }`}
            >
              {row.map((cell, cellIdx) => (
                <td
                  key={cellIdx}
                  className={`py-4 px-4 ${
                    cellIdx === 0 ? 'text-left font-medium text-[oklch(0.15_0_0)]' : 'text-right text-[oklch(0.15_0_0)]/70'
                  }`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Thought Process Box
function ThoughtProcess({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-6 p-4 bg-[oklch(0.55_0.14_75)]/10 rounded-xl border border-[oklch(0.55_0.14_75)]/30">
      <div className="flex items-start gap-3">
        <Lightbulb className="w-5 h-5 text-[oklch(0.55_0.14_75)] flex-shrink-0 mt-1" />
        <div>
          <p className="font-semibold text-[oklch(0.15_0_0)]">The Thought Process</p>
          <p className="text-sm text-[oklch(0.15_0_0)]/70 mt-1">{children}</p>
        </div>
      </div>
    </div>
  );
}

export default function ChapterPropertyReport({ data, onBack, clientName, marketId }: ChapterPropertyReportProps) {
  const [activeChapter, setActiveChapter] = useState(1);

  const [propertyTypeFilter, setPropertyTypeFilter] = useState<string>('all');
  const [minRatingFilter, setMinRatingFilter] = useState<number>(0);

  // Safely destructure with defaults for shared reports that may have incomplete data
  const { 
    property = { address: '', city: '', state: '', zipCode: '', bedrooms: 0, bathrooms: 0, accommodates: 0 }, 
    revenue_estimate = { annual: 0, monthly: 0, nightly: 0, occupancy: 0 }, 
    monthly_forecast = [], 
    comps = [], 
    same_bedroom_comps, 
    market_data = { name: '', metrics: { occupancy: 0, adr: 0, revenue: 0, revpar: 0, active_listings: 0 }, listing_count: 0 }, 
    bedroom_performance = [], 
    revenue_percentiles 
  } = data || {};

  // Use same-bedroom comps if available, otherwise use all comps
  // Sort by annual revenue descending to show top performers first
  const allComps = same_bedroom_comps && same_bedroom_comps.length > 0 ? same_bedroom_comps : comps;
  
  // Get unique property types for filter dropdown
  const propertyTypes = Array.from(new Set(allComps.map(c => c.property_type).filter(Boolean))) as string[];
  
  // Apply filters and sort
  const displayComps = [...allComps]
    .filter(comp => {
      // Property type filter
      if (propertyTypeFilter !== 'all' && comp.property_type !== propertyTypeFilter) {
        return false;
      }
      // Rating filter
      if (minRatingFilter > 0 && (comp.rating === null || comp.rating < minRatingFilter)) {
        return false;
      }
      return true;
    })
    .sort((a, b) => b.annual_revenue - a.annual_revenue);

  const chapters = [
    { id: 1, title: 'The Property' },
    { id: 2, title: 'Local Market Analysis' },
    { id: 3, title: 'Study the Competition' },
    { id: 4, title: 'Project the Profit' },
    { id: 5, title: 'Setting Up for Success' },
    { id: 6, title: 'Market Advisor' },
    { id: 7, title: 'AI Property Advisor' },
    { id: 8, title: 'Opportunity Finder' }
  ];

  const scrollToChapter = (id: number) => {
    setActiveChapter(id);
    const element = document.getElementById(`chapter-${id}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Calculate startup costs based on bedroom count
  // Base: $8,000 for 1BR, +$4,000 per additional bedroom for furniture/decor
  const baseStartupCost = 8000;
  const perBedroomCost = 4000;
  const estimatedStartupCosts = baseStartupCost + (property.bedrooms * perBedroomCost);
  
  // Monthly rent from user input or estimate
  const monthlyRent = property.monthlyRent || Math.round(revenue_estimate.annual * 0.04);
  
  // Calculate minimum revenue threshold (Rent × 12 × 2)
  const minRevenueThreshold = monthlyRent * 12 * 2;
  
  // Filter competitors to only show winners (meeting threshold)
  const winningComps = (same_bedroom_comps || comps).filter(
    comp => comp.annual_revenue >= minRevenueThreshold
  );
  const hasViableComps = winningComps.length > 0;
  
  // Monthly expenses scale with property size
  const monthlyExpenses = {
    rent: monthlyRent,
    utilities: 150 + (property.bedrooms * 50), // Base + per bedroom
    internet: 80,
    supplies: 150 + (property.bedrooms * 50), // Base + per bedroom
    maintenance: 100 + (property.bedrooms * 50) // Base + per bedroom
  };
  const totalMonthlyExpenses = Object.values(monthlyExpenses).reduce((a, b) => a + b, 0);
  const annualExpenses = totalMonthlyExpenses * 12;

  // Revenue scenarios
  const conservativeRevenue = revenue_percentiles?.p50 || revenue_estimate.annual * 0.85;
  const realisticRevenue = revenue_percentiles?.p75 || revenue_estimate.annual;
  const optimisticRevenue = revenue_percentiles?.p90 || revenue_estimate.annual * 1.15;

  // Find best month
  const bestMonth = monthly_forecast.reduce((best, current) =>
    current.revenue > best.revenue ? current : best
  , monthly_forecast[0]);

  // Find worst month
  const worstMonth = monthly_forecast.reduce((worst, current) =>
    current.revenue < worst.revenue ? current : worst
  , monthly_forecast[0]);

  return (
    <div className="min-h-screen bg-white">
      {/* Title Page / Header */}
      <div className="bg-[oklch(0.15_0_0)] text-white">
        <div className="container mx-auto px-4 py-12">
          <div className="flex items-center justify-between mb-8">
            <button
              onClick={onBack}
              className="inline-flex items-center gap-2 text-white/70 hover:text-white transition-colors text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Calculator
            </button>
            <ShareReportButton
              reportType="property"
              reportData={data}
              address={property.address}
              latitude={property.latitude}
              longitude={property.longitude}
              bedrooms={property.bedrooms}
              bathrooms={property.bathrooms}
            />
          </div>

          <div className="max-w-3xl">
            <div className="flex items-center gap-3 mb-4">
              <Home className="w-6 h-6 text-[oklch(0.55_0.14_75)]" />
              <span className="text-sm font-medium text-[oklch(0.55_0.14_75)] uppercase tracking-wider">
                Airbnb Arbitrage Analysis
              </span>
            </div>

            <h1 className="text-3xl md:text-4xl font-sans font-bold mb-4">
              Understanding the Airbnb Arbitrage Opportunity
            </h1>

            <p className="text-white/70 text-lg mb-6">
              A detailed analysis of the short-term rental potential for this property
            </p>

            <div className="flex flex-wrap gap-4 text-sm text-white/60">
              <span><strong className="text-white">Property:</strong> {property.address}</span>
              <span>•</span>
              <span><strong className="text-white">Prepared for:</strong> {clientName || 'Valued Investor'}</span>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
            <div className="bg-white/10 rounded-xl p-4">
              <p className="text-white/60 text-sm">Est. Annual Revenue</p>
              <p className="text-2xl font-sans font-bold text-[oklch(0.55_0.14_75)]">{formatCurrency(revenue_estimate.annual)}</p>
            </div>
            <div className="bg-white/10 rounded-xl p-4">
              <p className="text-white/60 text-sm">Avg. Nightly Rate</p>
              <p className="text-2xl font-sans font-bold text-white">{formatCurrency(revenue_estimate.nightly)}</p>
            </div>
            <div className="bg-white/10 rounded-xl p-4">
              <p className="text-white/60 text-sm">Occupancy Rate</p>
              <p className="text-2xl font-sans font-bold text-white">{formatPercent(revenue_estimate.occupancy)}</p>
            </div>
            <div className="bg-white/10 rounded-xl p-4">
              <p className="text-white/60 text-sm">Monthly Average</p>
              <p className="text-2xl font-sans font-bold text-white">{formatCurrency(revenue_estimate.monthly)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Chapter Navigation */}
      <ChapterNav
        chapters={chapters}
        activeChapter={activeChapter}
        onChapterClick={scrollToChapter}
      />

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">

          {/* Introduction */}
          <div className="mb-8 p-6 bg-white rounded-xl shadow-lg">
            <h3 className="text-lg font-sans font-semibold text-[oklch(0.15_0_0)] mb-3">What is This Report?</h3>
            <p className="text-[oklch(0.15_0_0)]/70 leading-relaxed">
              This report is a detailed analysis to show you how we evaluate a property for an <strong>Airbnb Arbitrage</strong> business.
              The idea is simple: we rent a regular, long-term property, furnish it, and re-rent it for short stays on Airbnb.
              The goal is to make more money from short-term Airbnb guests than we pay in rent and other expenses.
              This process helps us decide if a property is a good investment <em>before</em> signing a lease.
            </p>
          </div>

          {/* Chapter 1: The Property */}
          <ChapterSection id="chapter-1" title="1. First, We Look at the Property Itself">
            <p className="text-lg text-[oklch(0.15_0_0)]/80 mb-8 leading-relaxed">
              Our analysis starts with the property we might rent. We need to understand its basic details and what makes it special for potential Airbnb guests.
            </p>

            <div className="bg-white rounded-xl shadow-lg overflow-hidden mb-8">
              <div className="bg-[oklch(0.15_0_0)] p-4">
                <p className="text-sm text-white/60">Subject Property</p>
                <p className="text-lg font-semibold text-white">{property.address}</p>
              </div>
              <div className="p-6">
                <DataTable
                  headers={['Property Detail', 'Information']}
                  rows={[
                    ['Full Address', property.address],
                    ['Neighborhood', `${property.city}, ${property.state} ${property.zipCode}`],
                    ['Property Type', property.propertyType || 'Residential'],
                    ['Bedrooms / Bathrooms', `${property.bedrooms} Bedrooms / ${property.bathrooms} Bathrooms`],
                    ['Accommodates', `${property.accommodates} Guests`],
                    ...(property.sqft ? [['Size', `${property.sqft} sqft`]] : []),
                    ...(property.monthlyRent ? [['Monthly Rent', formatCurrency(property.monthlyRent)]] : [])
                  ]}
                />
              </div>
            </div>

            <h3 className="text-xl font-sans font-semibold text-[oklch(0.15_0_0)] mb-6">What Makes This Property Attractive for Airbnb?</h3>

            <p className="text-[oklch(0.15_0_0)]/70 mb-4">
              We look for features that will stand out to guests. Based on the property details and market analysis, here are the key selling points:
            </p>

            <div className="grid md:grid-cols-2 gap-4 mb-6">
              <div className="bg-white rounded-xl p-4 shadow-md border-l-4 border-[oklch(0.55_0.14_75)]">
                <div className="flex items-center gap-3 mb-2">
                  <Bed className="w-5 h-5 text-[oklch(0.55_0.14_75)]" />
                  <span className="font-semibold text-[oklch(0.15_0_0)]">{property.bedrooms} Bedrooms</span>
                </div>
                <p className="text-sm text-[oklch(0.15_0_0)]/60">
                  {property.bedrooms === 1
                    ? 'Perfect for couples and solo travelers looking for a cozy retreat.'
                    : property.bedrooms === 2
                      ? 'Ideal for small families or two couples traveling together.'
                      : property.bedrooms >= 4
                        ? 'Great for large families and group getaways.'
                        : 'Comfortable space for families and small groups.'}
                </p>
              </div>

              <div className="bg-white rounded-xl p-4 shadow-md border-l-4 border-[oklch(0.55_0.14_75)]">
                <div className="flex items-center gap-3 mb-2">
                  <Bath className="w-5 h-5 text-[oklch(0.55_0.14_75)]" />
                  <span className="font-semibold text-[oklch(0.15_0_0)]">{property.bathrooms} Bathrooms</span>
                </div>
                <p className="text-sm text-[oklch(0.15_0_0)]/60">
                  {property.bathrooms >= property.bedrooms
                    ? 'Having enough bathrooms is a major comfort factor for groups.'
                    : 'Adequate bathroom facilities for the property size.'}
                </p>
              </div>

              <div className="bg-white rounded-xl p-4 shadow-md border-l-4 border-green-500">
                <div className="flex items-center gap-3 mb-2">
                  <Users className="w-5 h-5 text-green-500" />
                  <span className="font-semibold text-[oklch(0.15_0_0)]">Sleeps {property.accommodates}</span>
                </div>
                <p className="text-sm text-[oklch(0.15_0_0)]/60">
                  Can accommodate up to {property.accommodates} guests, maximizing booking potential.
                </p>
              </div>

              <div className="bg-white rounded-xl p-4 shadow-md border-l-4 border-blue-500">
                <div className="flex items-center gap-3 mb-2">
                  <MapPin className="w-5 h-5 text-blue-500" />
                  <span className="font-semibold text-[oklch(0.15_0_0)]">{property.city} Location</span>
                </div>
                <p className="text-sm text-[oklch(0.15_0_0)]/60">
                  Located in {property.city}, {property.state} - a market with {market_data.listing_count.toLocaleString()} active rentals.
                </p>
              </div>
            </div>

            <ThoughtProcess>
              We are looking for features that make a property more like a home and less like a generic hotel room.
              These unique comforts are what allow us to charge a premium on Airbnb. A {property.bedrooms}-bedroom property
              in {property.city} has strong demand based on the market data.
            </ThoughtProcess>
          </ChapterSection>

          {/* Chapter 2: Local Market Analysis */}
          <ChapterSection id="chapter-2" title="2. Next, We Analyze the Local Market">
            <p className="text-lg text-[oklch(0.15_0_0)]/80 mb-8 leading-relaxed">
              Now that we know about the property, we need to understand the local Airbnb market. How much money are similar properties actually making?
              We focus on other <strong>{property.bedrooms}-bedroom properties</strong> in the same area to get a clear picture.
            </p>

            <h3 className="text-xl font-sans font-semibold text-[oklch(0.15_0_0)] mb-6">What Do Similar Airbnbs Earn?</h3>

            <p className="text-[oklch(0.15_0_0)]/70 mb-4">
              Here are the average numbers for {property.bedrooms}-bedroom properties in {property.city}:
            </p>

            <div className="bg-white rounded-xl shadow-lg overflow-hidden mb-8">
              <DataTable
                headers={['Metric', 'Average Value', 'What This Means']}
                rows={[
                  [
                    'Annual Revenue',
                    formatCurrency(revenue_estimate.annual),
                    `This is the estimated total money a ${property.bedrooms}-bedroom Airbnb in this area makes in a year.`
                  ],
                  [
                    'Occupancy Rate',
                    formatPercent(revenue_estimate.occupancy),
                    `Properties are booked about ${formatPercent(revenue_estimate.occupancy)} of the nights in a year.`
                  ],
                  [
                    'Average Daily Rate (ADR)',
                    formatCurrency(revenue_estimate.nightly),
                    'This is the average price guests pay per night.'
                  ]
                ]}
              />
            </div>

            <h3 className="text-xl font-sans font-semibold text-[oklch(0.15_0_0)] mb-6">How Much is Possible? (Good, Better, Best)</h3>

            <p className="text-[oklch(0.15_0_0)]/70 mb-4">
              Not all Airbnbs perform the same. Some are average, while others are run by expert hosts who make much more.
              We look at these different levels to understand the full potential.
            </p>

            {revenue_percentiles && (
              <div className="bg-white rounded-xl shadow-lg overflow-hidden mb-8">
                <div className="bg-[oklch(0.15_0_0)] p-4">
                  <p className="text-white font-semibold">Revenue Potential (How much money can be made in a year?)</p>
                </div>
                <DataTable
                  headers={['Performance Level', 'Annual Revenue', 'Who Achieves This?']}
                  rows={[
                    [
                      <span key="top10" className="flex items-center gap-2">
                        <Award className="w-4 h-4 text-[oklch(0.55_0.14_75)]" />
                        Top 10% (Best)
                      </span>,
                      <span key="top10-val" className="font-bold text-[oklch(0.55_0.14_75)]">{formatCurrency(revenue_percentiles.p90)}</span>,
                      'These are the superstar hosts with amazing photos, perfect reviews, and top-notch design.'
                    ],
                    [
                      <span key="top25" className="flex items-center gap-2">
                        <Star className="w-4 h-4 text-green-600" />
                        Top 25% (Better)
                      </span>,
                      <span key="top25-val" className="font-bold text-green-600">{formatCurrency(revenue_percentiles.p75)}</span>,
                      <span key="top25-desc"><strong>This is our target.</strong> Professionally run properties with great design.</span>
                    ],
                    [
                      <span key="median">Median (Good)</span>,
                      formatCurrency(revenue_percentiles.p50),
                      'This is the average, standard Airbnb in the area.'
                    ]
                  ]}
                  highlight={1}
                />
              </div>
            )}

            <ThoughtProcess>
              We don't aim to be average. Our goal is to make our property perform in the <strong>Top 25%</strong> by using
              professional design, great photos, and smart pricing. This data shows us what is realistically achievable if we do our job well.
            </ThoughtProcess>

            {/* Monthly Forecast */}
            <h3 className="text-xl font-sans font-semibold text-[oklch(0.15_0_0)] mb-6 mt-10">Monthly Revenue Forecast</h3>

            <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
              {/* Visual Chart */}
              {monthly_forecast && monthly_forecast.length > 0 && (
                <div className="mb-8">
                  <p className="text-sm text-[oklch(0.15_0_0)]/60 mb-4">Revenue & Occupancy by Month (Green = Above Average, Orange = Below Average)</p>
                  <MonthlyForecastChart data={monthly_forecast} height={280} />
                </div>
              )}

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="p-4 bg-green-50 rounded-lg">
                  <p className="text-sm text-green-600 font-medium">Best Month</p>
                  <p className="text-xl font-bold text-green-700">{bestMonth?.month}</p>
                  <p className="text-lg font-semibold text-green-600">{formatCurrency(bestMonth?.revenue || 0)}</p>
                </div>
                <div className="p-4 bg-amber-50 rounded-lg">
                  <p className="text-sm text-amber-600 font-medium">Slowest Month</p>
                  <p className="text-xl font-bold text-amber-700">{worstMonth?.month}</p>
                  <p className="text-lg font-semibold text-amber-600">{formatCurrency(worstMonth?.revenue || 0)}</p>
                </div>
                <div className="p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-600 font-medium">Monthly Average</p>
                  <p className="text-xl font-bold text-blue-700">{formatCurrency(revenue_estimate.monthly)}</p>
                </div>
                <div className="p-4 bg-[oklch(0.55_0.14_75)]/10 rounded-lg">
                  <p className="text-sm text-[oklch(0.55_0.14_75)] font-medium">Annual Total</p>
                  <p className="text-xl font-bold text-[oklch(0.15_0_0)]">{formatCurrency(revenue_estimate.annual)}</p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[oklch(0.15_0_0)]/10">
                      <th className="py-2 px-3 text-left font-medium text-[oklch(0.15_0_0)]/60">Month</th>
                      <th className="py-2 px-3 text-right font-medium text-[oklch(0.15_0_0)]/60">Revenue</th>
                      <th className="py-2 px-3 text-right font-medium text-[oklch(0.15_0_0)]/60">Occupancy</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthly_forecast.slice(0, 12).map((month, idx) => (
                      <tr key={idx} className="border-b border-[oklch(0.15_0_0)]/5">
                        <td className="py-2 px-3 font-medium">{month.month}</td>
                        <td className="py-2 px-3 text-right">{formatCurrency(month.revenue)}</td>
                        <td className="py-2 px-3 text-right">{formatPercent(month.occupancy)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Market Insights Panel - Booking Patterns & Supply Trend */}
            {marketId && (
              <div className="mt-8">
                <MarketInsightsPanel marketId={String(marketId)} />
              </div>
            )}
          </ChapterSection>

          {/* Chapter 3: Study the Competition */}
          <ChapterSection id="chapter-3" title="3. Then, We Study the Competition">
            <p className="text-lg text-[oklch(0.15_0_0)]/80 mb-8 leading-relaxed">
              To get into the Top 25%, we need to understand what the best are doing right. We study the top-earning
              {property.bedrooms}-bedroom Airbnbs in the area to learn their secrets.
            </p>

            {/* Minimum Revenue Threshold Explanation */}
            <div className="bg-[oklch(0.55_0.14_75)]/10 border border-[oklch(0.55_0.14_75)]/30 rounded-xl p-6 mb-8">
              <h4 className="font-semibold text-[oklch(0.15_0_0)] mb-2 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-[oklch(0.55_0.14_75)]" />
                The "2x Rule" for Arbitrage Success
              </h4>
              <p className="text-[oklch(0.15_0_0)]/70 mb-3">
                For arbitrage to be profitable, competitors should earn at least <strong>2x your annual rent</strong>.
                With {formatCurrency(monthlyRent)}/month rent, the minimum threshold is:
              </p>
              <p className="text-2xl font-bold text-[oklch(0.15_0_0)]">
                {formatCurrency(minRevenueThreshold)}/year
              </p>
              <p className="text-sm text-[oklch(0.15_0_0)]/60 mt-1">
                ({formatCurrency(monthlyRent)} × 12 months × 2 = {formatCurrency(minRevenueThreshold)})
              </p>
            </div>

            {/* RED FLAG Warning if no viable comps */}
            {!hasViableComps && (
              <div className="bg-red-50 border-2 border-red-300 rounded-xl p-6 mb-8">
                <h4 className="font-bold text-red-700 mb-2 flex items-center gap-2 text-lg">
                  <AlertTriangle className="w-5 h-5" /> RED FLAG: Potential Viability Concern
                </h4>
                <p className="text-red-700 mb-3">
                  No {property.bedrooms}-bedroom competitors in this area are earning above the {formatCurrency(minRevenueThreshold)} threshold.
                  This could indicate:
                </p>
                <ul className="list-disc list-inside text-red-700 space-y-1 mb-4">
                  <li>The rent may be too high for this market</li>
                  <li>This property type may not perform well as a short-term rental here</li>
                  <li>You may need to negotiate a lower rent or find a different property</li>
                </ul>
                <p className="text-red-700 font-medium">
                  We recommend consulting with a professional before proceeding with this property.
                </p>
              </div>
            )}

            <h3 className="text-xl font-sans font-semibold text-[oklch(0.15_0_0)] mb-6">What Do the Top Competitors Have in Common?</h3>

            <p className="text-[oklch(0.15_0_0)]/70 mb-4">
              Here are the top-earning {property.bedrooms}-bedroom properties in {property.city}. 
              Properties marked with <span className="text-green-600 font-semibold">"✓ Meets 2x Rule"</span> are earning above the {formatCurrency(minRevenueThreshold)} threshold.
            </p>

            {/* Competitor Revenue Distribution Chart */}
            {displayComps && displayComps.length > 0 && (
              <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
                <p className="text-sm text-[oklch(0.15_0_0)]/60 mb-4">Top 15 Competitors by Annual Revenue (Green = Meets 2x Rule, Red = Below Threshold)</p>
                <CompetitorDistributionChart 
                  data={displayComps.map(c => ({
                    title: c.title,
                    annual_revenue: c.annual_revenue,
                    occupancy: c.occupancy,
                    adr: c.adr
                  }))}
                  threshold={minRevenueThreshold}
                  height={220}
                />
              </div>
            )}

            {/* Filter Controls */}
            <div className="bg-white rounded-xl p-4 shadow-sm mb-6">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-[oklch(0.15_0_0)]/70">Property Type:</label>
                  <select
                    value={propertyTypeFilter}
                    onChange={(e) => setPropertyTypeFilter(e.target.value)}
                    className="px-3 py-1.5 rounded-lg border border-[oklch(0.15_0_0)]/20 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[oklch(0.55_0.14_75)]/50"
                  >
                    <option value="all">All Types</option>
                    {propertyTypes.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-[oklch(0.15_0_0)]/70">Min Rating:</label>
                  <select
                    value={minRatingFilter}
                    onChange={(e) => setMinRatingFilter(Number(e.target.value))}
                    className="px-3 py-1.5 rounded-lg border border-[oklch(0.15_0_0)]/20 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[oklch(0.55_0.14_75)]/50"
                  >
                    <option value={0}>Any Rating</option>
                    <option value={3}>3+ Stars</option>
                    <option value={4}>4+ Stars</option>
                    <option value={4.5}>4.5+ Stars</option>
                    <option value={4.8}>4.8+ Stars</option>
                  </select>
                </div>
                {(propertyTypeFilter !== 'all' || minRatingFilter > 0) && (
                  <button
                    onClick={() => {
                      setPropertyTypeFilter('all');
                      setMinRatingFilter(0);
                    }}
                    className="text-sm text-[oklch(0.55_0.14_75)] hover:text-[oklch(0.55_0.14_75)]/80 font-medium"
                  >
                    Clear Filters
                  </button>
                )}
              </div>
              {(propertyTypeFilter !== 'all' || minRatingFilter > 0) && (
                <p className="text-xs text-[oklch(0.15_0_0)]/50 mt-2">
                  Showing {displayComps.length} of {allComps.length} listings
                </p>
              )}
            </div>

            {/* Comps Map View */}
            {property.latitude && property.longitude && displayComps.length > 0 && (
              <CompsMapView
                comps={displayComps.map(c => ({
                  title: c.title,
                  bedrooms: c.bedrooms,
                  bathrooms: c.bathrooms,
                  rating: c.rating,
                  reviews: c.reviews,
                  annual_revenue: c.annual_revenue,
                  adr: c.adr,
                  occupancy: c.occupancy,
                  distance_meters: c.distance_meters,
                  latitude: c.latitude,
                  longitude: c.longitude,
                  airbnb_listing_id: c.airbnb_listing_id
                }))}
                subjectProperty={{
                  address: property.address,
                  latitude: property.latitude,
                  longitude: property.longitude,
                  bedrooms: property.bedrooms,
                  bathrooms: property.bathrooms
                }}
                className="mb-8"
              />
            )}

            {/* Stats Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <p className="text-sm text-[oklch(0.15_0_0)]/60">Total Same-BR Listings</p>
                <p className="text-2xl font-bold text-[oklch(0.15_0_0)]">{displayComps.length}</p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <p className="text-sm text-[oklch(0.15_0_0)]/60">Meet 2x Threshold</p>
                <p className="text-2xl font-bold text-green-600">{displayComps.filter(c => c.annual_revenue >= minRevenueThreshold).length}</p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <p className="text-sm text-[oklch(0.15_0_0)]/60">Avg Revenue</p>
                <p className="text-2xl font-bold text-[oklch(0.15_0_0)]">{formatCurrency(displayComps.reduce((sum, c) => sum + c.annual_revenue, 0) / displayComps.length || 0)}</p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <p className="text-sm text-[oklch(0.15_0_0)]/60">Top Performer</p>
                <p className="text-2xl font-bold text-[oklch(0.55_0.14_75)]">{formatCurrency(displayComps[0]?.annual_revenue || 0)}</p>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg overflow-hidden mb-8">
              <div className="p-4 bg-[oklch(0.15_0_0)] flex items-center justify-between">
                <p className="text-white font-semibold">
                  All {property.bedrooms}-BR Performers in {property.city} ({displayComps.length} listings)
                </p>
                <span className="text-white/70 text-sm">Sorted by revenue</span>
              </div>
              <div className="divide-y divide-[oklch(0.15_0_0)]/5 max-h-[800px] overflow-y-auto">
                {displayComps.map((comp, idx) => (
                // Show all top performers, highlight those meeting threshold
                  <div key={comp.id} className="p-4 hover:bg-[oklch(0.15_0_0)]/5 transition-colors">
                    <div className="flex items-start gap-4">
                      {/* Listing Photo or View Button */}
                      {(comp.image_url || getAirbnbImageUrl(comp.airbnb_url)) ? (
                        <div className="flex-shrink-0">
                          <a
                            href={comp.airbnb_url || '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block"
                          >
                            <img
                              src={comp.image_url || getAirbnbImageUrl(comp.airbnb_url) || ''}
                              alt={comp.title}
                              className="w-24 h-20 object-cover rounded-lg shadow-md hover:shadow-lg transition-shadow"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          </a>
                        </div>
                      ) : comp.airbnb_url ? (
                        <a
                          href={comp.airbnb_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-shrink-0 w-24 h-20 bg-gradient-to-br from-[oklch(0.60_0.20_25)] to-[oklch(0.58_0.22_15)] rounded-lg flex flex-col items-center justify-center text-white hover:shadow-lg transition-all hover:scale-105 cursor-pointer"
                        >
                          <ExternalLink className="w-5 h-5 mb-1" />
                          <span className="text-[10px] font-semibold">View on</span>
                          <span className="text-xs font-bold">Airbnb</span>
                        </a>
                      ) : (
                        <div className="flex-shrink-0 w-24 h-20 bg-[oklch(0.15_0_0)]/10 rounded-lg flex items-center justify-center">
                          <Home className="w-8 h-8 text-[oklch(0.15_0_0)]/30" />
                        </div>
                      )}
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="w-6 h-6 bg-[oklch(0.55_0.14_75)]/20 rounded-full flex items-center justify-center text-xs font-bold text-[oklch(0.55_0.14_75)]">
                            {idx + 1}
                          </span>
                          {comp.annual_revenue >= minRevenueThreshold && (
                            <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
                              ✓ Meets 2x Rule
                            </span>
                          )}
                          {comp.airbnb_url ? (
                            <a
                              href={comp.airbnb_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-semibold text-[oklch(0.15_0_0)] hover:text-[oklch(0.55_0.14_75)] transition-colors flex items-center gap-1"
                            >
                              {comp.title}
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : (
                            <span className="font-semibold text-[oklch(0.15_0_0)]">{comp.title}</span>
                          )}
                        </div>
                        <p className="text-sm text-[oklch(0.15_0_0)]/60 mb-2">
                          {comp.bedrooms} BR • {comp.property_type} • {formatPercent(comp.occupancy)} occupancy
                          {comp.rating && (
                            <span className="ml-2 inline-flex items-center gap-1">
                              <Star className="w-3 h-3 fill-[oklch(0.55_0.14_75)] text-[oklch(0.55_0.14_75)]" />
                              {comp.rating.toFixed(1)}
                            </span>
                          )}
                          {comp.distance_meters && (
                            <span className="ml-2 text-blue-600">
                              • {(comp.distance_meters / 1609.34).toFixed(1)} mi away
                            </span>
                          )}
                        </p>
                        <p className="text-sm text-[oklch(0.15_0_0)]/70">
                          {comp.occupancy > 80
                            ? 'High occupancy indicates strong demand and excellent guest experience.'
                            : comp.rating && comp.rating >= 4.9
                              ? 'Near-perfect reviews drive premium pricing and repeat bookings.'
                              : comp.adr > revenue_estimate.nightly * 1.2
                                ? 'Premium pricing suggests unique features or exceptional design.'
                                : 'Solid performer with consistent bookings.'}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xl font-bold text-[oklch(0.15_0_0)]">{formatCurrency(comp.annual_revenue)}</p>
                        <p className="text-sm text-[oklch(0.15_0_0)]/50">/year</p>
                        <p className="text-sm text-[oklch(0.15_0_0)]/60 mt-1">{formatCurrency(comp.adr)}/night</p>
                        {comp.revenue_trend && (
                          <div className={`mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                            comp.revenue_trend === 'growing' 
                              ? 'bg-green-100 text-green-700' 
                              : comp.revenue_trend === 'declining' 
                                ? 'bg-red-100 text-red-700' 
                                : 'bg-gray-100 text-gray-600'
                          }`}>
                            {comp.revenue_trend === 'growing' ? (
                              <><TrendingUp className="w-3 h-3" /> Growing</>
                            ) : comp.revenue_trend === 'declining' ? (
                              <><TrendingDown className="w-3 h-3" /> Declining</>
                            ) : (
                              <><span className="w-3 h-0.5 bg-gray-400 rounded"></span> Stable</>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <ThoughtProcess>
              We are not just providing a place to sleep; we are selling an <strong>experience</strong>.
              The most successful Airbnbs have a unique personality or a special feature that makes them memorable.
              Our job is to create that for our property. Notice how the top performers in {property.city} achieve {formatPercent(displayComps[0]?.occupancy || revenue_estimate.occupancy)} occupancy or higher.
            </ThoughtProcess>
          </ChapterSection>

          {/* Chapter 4: Project the Profit */}
          <ChapterSection id="chapter-4" title="4. Finally, We Project the Profit">
            <p className="text-lg text-[oklch(0.15_0_0)]/80 mb-8 leading-relaxed">
              This is where we put it all together to see if the business model makes sense financially.
              We estimate the costs and subtract them from the potential revenue.
            </p>

            <h3 className="text-xl font-sans font-semibold text-[oklch(0.15_0_0)] mb-6">How Much Does It Cost to Start?</h3>

            <p className="text-[oklch(0.15_0_0)]/70 mb-4">
              To turn an empty rental into a beautiful, guest-ready Airbnb, there are upfront costs.
            </p>

            <div className="bg-white rounded-xl shadow-lg overflow-hidden mb-8">
              <DataTable
                headers={['Cost Item', 'Estimated Amount', 'What This Is For']}
                rows={[
                  [
                    <span key="startup" className="font-bold">Total Estimated Startup Costs</span>,
                    <span key="startup-val" className="font-bold text-[oklch(0.15_0_0)]">{formatCurrency(estimatedStartupCosts)}</span>,
                    'This is a flat-rate estimate that covers everything needed to get started: first month\'s rent, security deposit, all furniture, decor, kitchen supplies, linens, professional photos, and business licenses.'
                  ]
                ]}
              />
            </div>

            <h3 className="text-xl font-sans font-semibold text-[oklch(0.15_0_0)] mb-6">What Are the Monthly Expenses?</h3>

            <p className="text-[oklch(0.15_0_0)]/70 mb-4">
              Every month, we have to pay for the costs of running the business.
            </p>

            <div className="bg-white rounded-xl shadow-lg overflow-hidden mb-8">
              <DataTable
                headers={['Expense Item', 'Estimated Monthly Cost', 'Notes']}
                rows={[
                  ['Monthly Rent', formatCurrency(monthlyExpenses.rent), 'This is our biggest and most consistent expense.'],
                  ['Utilities (Gas, Electric, Water)', formatCurrency(monthlyExpenses.utilities), 'We have to pay for the utilities our guests use.'],
                  ['High-Speed Internet', formatCurrency(monthlyExpenses.internet), 'Fast, reliable Wi-Fi is a must-have for guests.'],
                  ['Supplies & Subscriptions', formatCurrency(monthlyExpenses.supplies), 'This covers restocking things like coffee, soap, and paper towels, plus software for managing bookings and pricing.'],
                  ['Maintenance & Repairs', formatCurrency(monthlyExpenses.maintenance), 'A small budget for fixing anything that breaks.'],
                  [
                    <span key="total" className="font-bold">Total Estimated Monthly Expenses</span>,
                    <span key="total-val" className="font-bold text-[oklch(0.15_0_0)]">{formatCurrency(totalMonthlyExpenses)}</span>,
                    'This is our estimated total cost per month to operate.'
                  ]
                ]}
              />
            </div>

            <h3 className="text-xl font-sans font-semibold text-[oklch(0.15_0_0)] mb-6">What is the Potential Profit?</h3>

            <p className="text-[oklch(0.15_0_0)]/70 mb-4">
              Here we compare our revenue goals with our annual costs to see the potential profit.
            </p>

            <div className="bg-white rounded-xl shadow-lg overflow-hidden mb-8">
              <DataTable
                headers={['Scenario', 'Projected Annual Revenue', 'Annual Operating Costs', 'Estimated Annual Profit']}
                rows={[
                  [
                    'Conservative (Average)',
                    formatCurrency(conservativeRevenue),
                    formatCurrency(annualExpenses),
                    <span key="cons-profit" className={conservativeRevenue - annualExpenses > 0 ? 'font-bold text-green-600' : 'font-bold text-red-500'}>
                      {formatCurrency(conservativeRevenue - annualExpenses)}
                    </span>
                  ],
                  [
                    <span key="realistic" className="flex items-center gap-2">
                      <Target className="w-4 h-4 text-[oklch(0.55_0.14_75)]" />
                      <strong>Realistic (Our Target)</strong>
                    </span>,
                    <span key="realistic-rev" className="font-bold">{formatCurrency(realisticRevenue)}</span>,
                    formatCurrency(annualExpenses),
                    <span key="realistic-profit" className="font-bold text-green-600 text-lg">
                      {formatCurrency(realisticRevenue - annualExpenses)}
                    </span>
                  ],
                  [
                    'Optimistic (Superstar)',
                    formatCurrency(optimisticRevenue),
                    formatCurrency(annualExpenses),
                    <span key="opt-profit" className="font-bold text-green-600">
                      {formatCurrency(optimisticRevenue - annualExpenses)}
                    </span>
                  ]
                ]}
                highlight={1}
              />
            </div>

            <ThoughtProcess>
              The goal is to earn enough revenue to comfortably cover all our expenses and generate a healthy profit.
              These numbers show that if we operate the property professionally and hit our <strong>Realistic</strong> target,
              there is a strong potential for profit of <strong>{formatCurrency(realisticRevenue - annualExpenses)}</strong> per year.
              This entire process, from property selection to competitive analysis, is designed to give us the confidence to invest.
            </ThoughtProcess>

            {/* Break-Even Calculator */}
            <div className="mt-8">
              <BreakEvenCalculator
                monthlyRent={monthlyRent}
                estimatedADR={revenue_estimate.nightly}
                estimatedOccupancy={revenue_estimate.occupancy}
                estimatedMonthlyRevenue={revenue_estimate.monthly}
                conservativeRevenue={conservativeRevenue}
                realisticRevenue={realisticRevenue}
                optimisticRevenue={optimisticRevenue}
                annualExpenses={annualExpenses}
              />
            </div>

            {/* Why You Need Professional Help Section */}
            <div className="mt-12 bg-white rounded-2xl shadow-lg p-8">
              <h3 className="text-xl font-sans font-semibold text-[oklch(0.15_0_0)] mb-6 text-center">
                What It Takes to Reach Top-Performer Status
              </h3>
              <div className="grid md:grid-cols-2 gap-6 mb-8">
                <div className="bg-red-50 rounded-xl p-6 border border-red-100">
                  <h4 className="font-semibold text-red-800 mb-4 flex items-center gap-2">
                    <span className="w-6 h-6 bg-red-200 rounded-full flex items-center justify-center text-sm">!</span>
                    Common Mistakes That Kill Profits
                  </h4>
                  <ul className="space-y-2 text-sm text-red-700">
                    <li>• Wrong furniture choices that don't photograph well</li>
                    <li>• Pricing too high during slow seasons</li>
                    <li>• Slow response times that lose bookings</li>
                    <li>• Poor listing descriptions and photos</li>
                    <li>• Inconsistent cleaning standards</li>
                  </ul>
                </div>
                <div className="bg-green-50 rounded-xl p-6 border border-green-100">
                  <h4 className="font-semibold text-green-800 mb-4 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5" />
                    What Top Performers Do Differently
                  </h4>
                  <ul className="space-y-2 text-sm text-green-700">
                    <li>• Professional photography and staging</li>
                    <li>• Dynamic pricing adjusted daily</li>
                    <li>• Response times under 15 minutes</li>
                    <li>• Optimized listings with A/B testing</li>
                    <li>• Hotel-quality turnover processes</li>
                  </ul>
                </div>
              </div>
              <div className="bg-[oklch(0.15_0_0)]/5 rounded-xl p-6">
                <p className="text-center text-[oklch(0.15_0_0)]/80">
                  <strong>The Reality:</strong> The difference between earning {formatCurrency(conservativeRevenue)} (average) 
                  and {formatCurrency(optimisticRevenue)} (top performer) is 
                  <span className="text-[oklch(0.55_0.14_75)] font-bold"> {formatCurrency(optimisticRevenue - conservativeRevenue)}</span> per year. 
                  That's the value of professional execution.
                </p>
              </div>
            </div>

            {/* CTA Section */}
            <div className="mt-8 bg-gradient-to-br from-[oklch(0.15_0_0)] to-[oklch(0.20_0.02_265)] rounded-2xl p-8 text-white">
              <div className="max-w-2xl mx-auto text-center">
                <div className="inline-flex items-center gap-2 bg-[oklch(0.55_0.14_75)]/20 text-[oklch(0.55_0.14_75)] px-4 py-2 rounded-full text-sm font-medium mb-4">
                  <Award className="w-4 h-4" />
                  Done-For-You Solution
                </div>
                <h3 className="text-2xl md:text-3xl font-sans font-bold mb-4">
                  Ready to Turn This Analysis Into Reality?
                </h3>
                <p className="text-white/70 mb-6">
                  You've seen the numbers. You understand the competition. Now let our team handle the execution.
                </p>
                <div className="grid md:grid-cols-3 gap-4 mb-8 text-left">
                  <div className="bg-white/10 rounded-lg p-4">
                    <CheckCircle2 className="w-5 h-5 text-[oklch(0.55_0.14_75)] mb-2" />
                    <p className="text-sm">Lease negotiation & property setup</p>
                  </div>
                  <div className="bg-white/10 rounded-lg p-4">
                    <CheckCircle2 className="w-5 h-5 text-[oklch(0.55_0.14_75)] mb-2" />
                    <p className="text-sm">Professional design & furnishing</p>
                  </div>
                  <div className="bg-white/10 rounded-lg p-4">
                    <CheckCircle2 className="w-5 h-5 text-[oklch(0.55_0.14_75)] mb-2" />
                    <p className="text-sm">Listing optimization & launch</p>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <button className="bg-[oklch(0.55_0.14_75)] text-[oklch(0.15_0_0)] px-8 py-4 rounded-xl font-semibold hover:bg-[oklch(0.65_0.12_75)] transition-colors flex items-center justify-center gap-2">
                    Schedule Free Strategy Call
                    <ArrowRight className="w-5 h-5" />
                  </button>
                  <Link
                    href="/market"
                    className="bg-white/10 text-white px-8 py-4 rounded-xl font-semibold hover:bg-white/20 transition-colors flex items-center justify-center gap-2 border border-white/20"
                  >
                    <BarChart3 className="w-5 h-5" />
                    Explore More Markets
                  </Link>
                </div>
              </div>
            </div>

          </ChapterSection>

          {/* Chapter 5: What It Really Takes */}
          <ChapterSection id="chapter-5" title="5. Setting Up for Success">
            <p className="text-lg text-[oklch(0.15_0_0)]/80 mb-8 leading-relaxed">
              The difference between average and top-performing Airbnbs comes down to <strong>how they're set up from day one</strong>. 
              The right property selection, design choices, and listing optimization can mean the difference between $34K and $67K in annual revenue.
            </p>

            {/* Setup Essentials */}
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden mb-8">
              <div className="bg-gradient-to-r from-[oklch(0.55_0.14_75)] to-amber-500 p-4">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5" />
                  What Separates Top Performers from the Rest
                </h3>
              </div>
              <div className="p-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-semibold text-[oklch(0.15_0_0)] mb-4 flex items-center gap-2">
                      <Home className="w-4 h-4 text-[oklch(0.55_0.14_75)]" />
                      Property Selection
                    </h4>
                    <div className="space-y-3">
                      <div className="flex items-start gap-3 py-2 border-b border-[oklch(0.15_0_0)]/10">
                        <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                        <span className="text-[oklch(0.15_0_0)]/70">Location analysis (walkability, attractions, parking)</span>
                      </div>
                      <div className="flex items-start gap-3 py-2 border-b border-[oklch(0.15_0_0)]/10">
                        <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                        <span className="text-[oklch(0.15_0_0)]/70">Lease negotiation for STR approval</span>
                      </div>
                      <div className="flex items-start gap-3 py-2 border-b border-[oklch(0.15_0_0)]/10">
                        <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                        <span className="text-[oklch(0.15_0_0)]/70">Market demand validation</span>
                      </div>
                      <div className="flex items-start gap-3 py-2">
                        <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                        <span className="text-[oklch(0.15_0_0)]/70">Revenue potential verification</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-semibold text-[oklch(0.15_0_0)] mb-4 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-[oklch(0.55_0.14_75)]" />
                      Design & Staging
                    </h4>
                    <div className="space-y-3">
                      <div className="flex items-start gap-3 py-2 border-b border-[oklch(0.15_0_0)]/10">
                        <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                        <span className="text-[oklch(0.15_0_0)]/70">Interior design that photographs beautifully</span>
                      </div>
                      <div className="flex items-start gap-3 py-2 border-b border-[oklch(0.15_0_0)]/10">
                        <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                        <span className="text-[oklch(0.15_0_0)]/70">Furniture selection for durability & style</span>
                      </div>
                      <div className="flex items-start gap-3 py-2 border-b border-[oklch(0.15_0_0)]/10">
                        <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                        <span className="text-[oklch(0.15_0_0)]/70">Professional photography & virtual tour</span>
                      </div>
                      <div className="flex items-start gap-3 py-2">
                        <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                        <span className="text-[oklch(0.15_0_0)]/70">Amenity packages guests love</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-6 bg-[oklch(0.55_0.14_75)]/10 rounded-xl p-4 border border-[oklch(0.55_0.14_75)]/30">
                  <p className="text-[oklch(0.15_0_0)] text-center">
                    <strong>The Secret:</strong> Top performers invest in <span className="text-[oklch(0.55_0.14_75)] font-bold">professional setup</span> from day one. 
                    The right design and listing optimization can add <span className="font-bold">$10,000-20,000</span> to your annual revenue.
                  </p>
                </div>
              </div>
            </div>

            {/* Listing Optimization */}
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden mb-8">
              <div className="bg-gradient-to-r from-blue-500 to-indigo-500 p-4">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  What Makes a Listing Stand Out
                </h3>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  <div className="flex items-start gap-4 py-3 border-b border-[oklch(0.15_0_0)]/10">
                    <div className="bg-blue-100 rounded-full p-2">
                      <Star className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <span className="font-medium text-[oklch(0.15_0_0)]">Professional Photography</span>
                      <p className="text-sm text-[oklch(0.15_0_0)]/60">Listings with pro photos get 40% more bookings and can charge 20% higher rates</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4 py-3 border-b border-[oklch(0.15_0_0)]/10">
                    <div className="bg-blue-100 rounded-full p-2">
                      <BookOpen className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <span className="font-medium text-[oklch(0.15_0_0)]">Compelling Description</span>
                      <p className="text-sm text-[oklch(0.15_0_0)]/60">Story-driven copy that sells the experience, not just the space</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4 py-3 border-b border-[oklch(0.15_0_0)]/10">
                    <div className="bg-blue-100 rounded-full p-2">
                      <Target className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <span className="font-medium text-[oklch(0.15_0_0)]">Strategic Pricing</span>
                      <p className="text-sm text-[oklch(0.15_0_0)]/60">Launch pricing strategy to build reviews quickly, then optimize for revenue</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4 py-3">
                    <div className="bg-blue-100 rounded-full p-2">
                      <Wifi className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <span className="font-medium text-[oklch(0.15_0_0)]">Must-Have Amenities</span>
                      <p className="text-sm text-[oklch(0.15_0_0)]/60">Fast WiFi, smart TV, quality linens, coffee station, and local guidebook</p>
                    </div>
                  </div>
                </div>
                <div className="mt-6 bg-blue-50 rounded-xl p-4 border border-blue-200">
                  <p className="text-blue-800 font-medium text-center">
                    <strong>The Opportunity:</strong> Most hosts skip these details. That's why <span className="text-blue-600 font-bold">top 25% performers earn 2-3x more</span> than average hosts in the same market.
                  </p>
                </div>
              </div>
            </div>

            {/* Our Setup Process */}
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden mb-8">
              <div className="bg-gradient-to-r from-[oklch(0.55_0.14_75)] to-amber-600 p-4">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Award className="w-5 h-5" />
                  Our Done-For-You Setup Process
                </h3>
              </div>
              <div className="p-6">
                <div className="grid md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="bg-[oklch(0.55_0.14_75)]/10 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-3">
                      <span className="text-2xl font-bold text-[oklch(0.55_0.14_75)]">1</span>
                    </div>
                    <h4 className="font-semibold text-[oklch(0.15_0_0)] mb-2">Market Analysis</h4>
                    <p className="text-sm text-[oklch(0.15_0_0)]/70">We analyze the market, find the best property, and negotiate the lease</p>
                  </div>
                  <div className="text-center">
                    <div className="bg-[oklch(0.55_0.14_75)]/10 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-3">
                      <span className="text-2xl font-bold text-[oklch(0.55_0.14_75)]">2</span>
                    </div>
                    <h4 className="font-semibold text-[oklch(0.15_0_0)] mb-2">Design & Furnish</h4>
                    <p className="text-sm text-[oklch(0.15_0_0)]/70">Professional interior design, furniture procurement, and complete setup</p>
                  </div>
                  <div className="text-center">
                    <div className="bg-[oklch(0.55_0.14_75)]/10 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-3">
                      <span className="text-2xl font-bold text-[oklch(0.55_0.14_75)]">3</span>
                    </div>
                    <h4 className="font-semibold text-[oklch(0.15_0_0)] mb-2">Launch & Optimize</h4>
                    <p className="text-sm text-[oklch(0.15_0_0)]/70">Professional photos, listing creation, and pricing strategy setup</p>
                  </div>
                  <div className="text-center">
                    <div className="bg-[oklch(0.55_0.14_75)]/10 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-3">
                      <span className="text-2xl font-bold text-[oklch(0.55_0.14_75)]">4</span>
                    </div>
                    <h4 className="font-semibold text-[oklch(0.15_0_0)] mb-2">Go Live</h4>
                    <p className="text-sm text-[oklch(0.15_0_0)]/70">Your property goes live and starts earning within 2-4 weeks</p>
                  </div>
                </div>
                <div className="mt-6 bg-green-50 rounded-xl p-4 border border-green-200">
                  <p className="text-green-800 font-medium text-center">
                    <strong>Result:</strong> A fully optimized, professionally designed Airbnb ready to compete with top performers from <span className="text-green-600 font-bold">day one</span>.
                  </p>
                </div>
              </div>
            </div>

            {/* Setup Comparison */}
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden mb-8">
              <div className="bg-gradient-to-r from-[oklch(0.15_0_0)] to-[oklch(0.20_0.02_265)] p-4">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Target className="w-5 h-5" />
                  DIY Setup vs Professional Setup
                </h3>
              </div>
              <div className="p-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="border-2 border-[oklch(0.15_0_0)]/20 rounded-xl p-6">
                    <h4 className="text-xl font-bold text-[oklch(0.15_0_0)] mb-4 text-center">DIY Setup</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between py-2 border-b border-[oklch(0.15_0_0)]/10">
                        <span className="text-[oklch(0.15_0_0)]/70">Revenue Potential</span>
                        <span className="font-medium">{formatCurrency(conservativeRevenue)}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-[oklch(0.15_0_0)]/10">
                        <span className="text-[oklch(0.15_0_0)]/70">Time to Launch</span>
                        <span className="font-medium text-amber-600">2-3 months</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-[oklch(0.15_0_0)]/10">
                        <span className="text-[oklch(0.15_0_0)]/70">Design Quality</span>
                        <span className="font-medium text-amber-600">Variable</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-[oklch(0.15_0_0)]/10">
                        <span className="text-[oklch(0.15_0_0)]/70">Listing Optimization</span>
                        <span className="font-medium text-amber-600">Learning curve</span>
                      </div>
                      <div className="flex justify-between py-2">
                        <span className="text-[oklch(0.15_0_0)]/70">Photography</span>
                        <span className="font-medium text-amber-600">Self or basic</span>
                      </div>
                    </div>
                  </div>
                  <div className="border-2 border-[oklch(0.55_0.14_75)] rounded-xl p-6 bg-[oklch(0.55_0.14_75)]/5">
                    <h4 className="text-xl font-bold text-[oklch(0.15_0_0)] mb-4 text-center flex items-center justify-center gap-2">
                      <Award className="w-5 h-5 text-[oklch(0.55_0.14_75)]" />
                      Professional Setup
                    </h4>
                    <div className="space-y-3">
                      <div className="flex justify-between py-2 border-b border-[oklch(0.55_0.14_75)]/30">
                        <span className="text-[oklch(0.15_0_0)]/70">Revenue Potential</span>
                        <span className="font-bold text-green-600">{formatCurrency(optimisticRevenue)}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-[oklch(0.55_0.14_75)]/30">
                        <span className="text-[oklch(0.15_0_0)]/70">Time to Launch</span>
                        <span className="font-medium text-green-600">2-4 weeks</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-[oklch(0.55_0.14_75)]/30">
                        <span className="text-[oklch(0.15_0_0)]/70">Design Quality</span>
                        <span className="font-medium text-green-600">Top 10% standard</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-[oklch(0.55_0.14_75)]/30">
                        <span className="text-[oklch(0.15_0_0)]/70">Listing Optimization</span>
                        <span className="font-medium text-green-600">Expert from day 1</span>
                      </div>
                      <div className="flex justify-between py-2">
                        <span className="text-[oklch(0.15_0_0)]/70">Photography</span>
                        <span className="font-medium text-green-600">Professional shoot</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-6 bg-[oklch(0.55_0.14_75)]/10 rounded-xl p-4 border border-[oklch(0.55_0.14_75)]/30">
                  <p className="text-center text-[oklch(0.15_0_0)]">
                    <strong>The Difference:</strong> Professional setup typically generates <span className="text-[oklch(0.55_0.14_75)] font-bold">20-35% higher revenue</span> from day one. 
                    That's {formatCurrency(optimisticRevenue - conservativeRevenue)} more per year in this market.
                  </p>
                </div>
              </div>
            </div>

            <ThoughtProcess>
              The top performers in this market didn't get there by accident. They invested in <strong>professional setup</strong> from the start—the right design, 
              the right photos, the right listing strategy. That's exactly what we do for our clients.
            </ThoughtProcess>

            {/* Final CTA */}
            <div className="mt-8 bg-gradient-to-br from-[oklch(0.15_0_0)] to-[oklch(0.20_0.02_265)] rounded-2xl p-8 text-white">
              <div className="max-w-2xl mx-auto text-center">
                <div className="inline-flex items-center gap-2 bg-[oklch(0.55_0.14_75)]/20 text-[oklch(0.55_0.14_75)] px-4 py-2 rounded-full text-sm font-medium mb-4">
                  <Award className="w-4 h-4" />
                  Done-For-You Setup
                </div>
                <h3 className="text-2xl md:text-3xl font-sans font-bold mb-4">
                  Ready to Launch Like a Top Performer?
                </h3>
                <p className="text-white/70 mb-6">
                  We handle the entire setup process—from finding the right property to designing a space that photographs beautifully 
                  and earns top-dollar. You get a turnkey Airbnb ready to compete from day one.
                </p>
                <div className="grid md:grid-cols-4 gap-4 mb-8 text-left">
                  <div className="bg-white/10 rounded-lg p-4">
                    <CheckCircle2 className="w-5 h-5 text-[oklch(0.55_0.14_75)] mb-2" />
                    <p className="text-sm">Market analysis & property sourcing</p>
                  </div>
                  <div className="bg-white/10 rounded-lg p-4">
                    <CheckCircle2 className="w-5 h-5 text-[oklch(0.55_0.14_75)] mb-2" />
                    <p className="text-sm">Interior design & furnishing</p>
                  </div>
                  <div className="bg-white/10 rounded-lg p-4">
                    <CheckCircle2 className="w-5 h-5 text-[oklch(0.55_0.14_75)] mb-2" />
                    <p className="text-sm">Professional photography</p>
                  </div>
                  <div className="bg-white/10 rounded-lg p-4">
                    <CheckCircle2 className="w-5 h-5 text-[oklch(0.55_0.14_75)] mb-2" />
                    <p className="text-sm">Listing creation & launch</p>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <button className="bg-[oklch(0.55_0.14_75)] text-[oklch(0.15_0_0)] px-8 py-4 rounded-xl font-semibold hover:bg-[oklch(0.65_0.12_75)] transition-colors flex items-center justify-center gap-2">
                    Schedule Free Strategy Call
                    <ArrowRight className="w-5 h-5" />
                  </button>
                  <Link
                    href="/compare-properties"
                    className="bg-white/10 text-white px-8 py-4 rounded-xl font-semibold hover:bg-white/20 transition-colors flex items-center justify-center gap-2 border border-white/20"
                  >
                    <Calculator className="w-5 h-5" />
                    Compare More Properties
                  </Link>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-12 pt-8 border-t border-[oklch(0.15_0_0)]/10">
              <div className="flex items-center justify-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-[oklch(0.55_0.14_75)] to-[oklch(0.45_0.12_75)] flex items-center justify-center">
                  <Sparkles className="w-3 h-3 text-white" />
                </div>
                <span className="text-xs font-semibold text-[oklch(0.35_0.08_75)] uppercase tracking-wider">Coach Inayah's Turnkey Tool</span>
              </div>
              <p className="text-xs text-[oklch(0.15_0_0)]/50 italic text-center">
                Powered by Coach Inayah Market Data | Data from Airbnb & Vrbo listings.
                All data is for the trailing 12-month period. Actual results may vary based on property condition,
                management quality, and market conditions.
              </p>
            </div>
          </ChapterSection>

          {/* Chapter 6: Market Advisor */}
          <ChapterSection id="chapter-6" title="6. Is This Market Worth Investing In?">
            <p className="text-lg text-[oklch(0.15_0_0)]/80 mb-8 leading-relaxed">
              Before committing to a property, it's important to understand the <strong>overall health of the market</strong>. 
              This analysis looks at market-wide trends, seasonality, and competition to help you decide if this is the right area to invest in.
            </p>
            <StandaloneMarketAdvisor 
              myProperty={{
                address: property.address,
                zipCode: property.zipCode,
                city: property.city
              }}
            />
          </ChapterSection>

          {/* Chapter 7: AI Property Advisor */}
          <ChapterSection id="chapter-7" title="7. What Does All This Data Mean For You?">
            <p className="text-lg text-[oklch(0.15_0_0)]/80 mb-8 leading-relaxed">
              Now let's put all the pieces together. Our AI advisor analyzes your specific property against the market data 
              to give you a <strong>personalized assessment</strong> of the opportunity.
            </p>
            <div className="bg-[oklch(0.55_0.14_75)]/10 border border-[oklch(0.55_0.14_75)]/30 rounded-xl p-6 text-center">
              <Sparkles className="w-8 h-8 text-[oklch(0.55_0.14_75)] mx-auto mb-3" />
              <h4 className="font-semibold text-[oklch(0.15_0_0)] mb-2">AI Property Analysis</h4>
              <p className="text-[oklch(0.15_0_0)]/70 mb-4">
                Get a personalized AI analysis of this property with investment comparison, break-even calculations, and actionable insights.
              </p>
              <Link
                href={`/ai-advisor?address=${encodeURIComponent(property.address)}&bedrooms=${property.bedrooms}&bathrooms=${property.bathrooms}&rent=${property.monthlyRent || ''}`}
                className="inline-flex items-center gap-2 bg-[oklch(0.55_0.14_75)] text-white px-6 py-3 rounded-xl font-semibold hover:bg-[oklch(0.50_0.14_75)] transition-colors"
              >
                <Sparkles className="w-5 h-5" />
                Get AI Analysis
              </Link>
            </div>
          </ChapterSection>

          {/* Chapter 8: Opportunity Finder */}
          <ChapterSection id="chapter-8" title="8. Find More Opportunities">
            <p className="text-lg text-[oklch(0.15_0_0)]/80 mb-8 leading-relaxed">
              Ready to explore more properties? Use our <strong>Opportunity Finder</strong> to browse available rentals 
              in any market and validate them with one click.
            </p>
            <OpportunityFinderStep
              onSelectProperty={(selectedProperty) => {
                // This would navigate to analyze the selected property
                console.log('Selected property:', selectedProperty);
              }}
            />
          </ChapterSection>
        </div>
      </div>
    </div>
  );
}
