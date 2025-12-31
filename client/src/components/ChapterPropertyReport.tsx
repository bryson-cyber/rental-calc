/**
 * Chapter-Based Property Report Component
 * Matches the Airbnb Arbitrage Opportunity format
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
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
  Maximize
} from 'lucide-react';
import { Link } from 'wouter';

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
    <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#0F172A]/10 py-4">
      <div className="container mx-auto px-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {chapters.map((chapter) => (
            <button
              key={chapter.id}
              onClick={() => onChapterClick(chapter.id)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                activeChapter === chapter.id
                  ? 'bg-[#C9A962] text-white'
                  : 'bg-[#0F172A]/5 text-[#0F172A]/70 hover:bg-[#0F172A]/10'
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
    <section id={id} className="scroll-mt-24 py-12 border-b border-[#0F172A]/10 last:border-0">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
      >
        <h2 className="text-2xl md:text-3xl font-serif font-bold text-[#0F172A] mb-8 flex items-center gap-3">
          <BookOpen className="w-7 h-7 text-[#C9A962]" />
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
          <tr className="border-b-2 border-[#C9A962]/30">
            {headers.map((header, idx) => (
              <th
                key={idx}
                className={`py-3 px-4 text-sm font-semibold text-[#0F172A] ${
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
              className={`border-b border-[#0F172A]/5 transition-colors ${
                highlight === rowIdx ? 'bg-[#C9A962]/10' : 'hover:bg-[#0F172A]/5'
              }`}
            >
              {row.map((cell, cellIdx) => (
                <td
                  key={cellIdx}
                  className={`py-4 px-4 ${
                    cellIdx === 0 ? 'text-left font-medium text-[#0F172A]' : 'text-right text-[#0F172A]/70'
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
    <div className="mt-6 p-4 bg-[#C9A962]/10 rounded-xl border border-[#C9A962]/30">
      <div className="flex items-start gap-3">
        <Lightbulb className="w-5 h-5 text-[#C9A962] flex-shrink-0 mt-1" />
        <div>
          <p className="font-semibold text-[#0F172A]">The Thought Process</p>
          <p className="text-sm text-[#0F172A]/70 mt-1">{children}</p>
        </div>
      </div>
    </div>
  );
}

export default function ChapterPropertyReport({ data, onBack, clientName }: ChapterPropertyReportProps) {
  const [activeChapter, setActiveChapter] = useState(1);

  const { property, revenue_estimate, monthly_forecast, comps, same_bedroom_comps, market_data, bedroom_performance, revenue_percentiles } = data;

  // Use same-bedroom comps if available, otherwise use all comps
  const displayComps = same_bedroom_comps && same_bedroom_comps.length > 0 ? same_bedroom_comps : comps;

  const chapters = [
    { id: 1, title: 'The Property' },
    { id: 2, title: 'Local Market Analysis' },
    { id: 3, title: 'Study the Competition' },
    { id: 4, title: 'Project the Profit' }
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
    <div className="min-h-screen bg-gradient-to-br from-[#faf9f7] to-[#f5f3f0]">
      {/* Title Page / Header */}
      <div className="bg-[#0F172A] text-white">
        <div className="container mx-auto px-4 py-12">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 text-white/70 hover:text-white transition-colors text-sm mb-8"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Calculator
          </button>

          <div className="max-w-3xl">
            <div className="flex items-center gap-3 mb-4">
              <Home className="w-6 h-6 text-[#C9A962]" />
              <span className="text-sm font-medium text-[#C9A962] uppercase tracking-wider">
                Airbnb Arbitrage Analysis
              </span>
            </div>

            <h1 className="text-3xl md:text-4xl font-serif font-bold mb-4">
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
              <p className="text-2xl font-serif font-bold text-[#C9A962]">{formatCurrency(revenue_estimate.annual)}</p>
            </div>
            <div className="bg-white/10 rounded-xl p-4">
              <p className="text-white/60 text-sm">Avg. Nightly Rate</p>
              <p className="text-2xl font-serif font-bold text-white">{formatCurrency(revenue_estimate.nightly)}</p>
            </div>
            <div className="bg-white/10 rounded-xl p-4">
              <p className="text-white/60 text-sm">Occupancy Rate</p>
              <p className="text-2xl font-serif font-bold text-white">{formatPercent(revenue_estimate.occupancy)}</p>
            </div>
            <div className="bg-white/10 rounded-xl p-4">
              <p className="text-white/60 text-sm">Monthly Average</p>
              <p className="text-2xl font-serif font-bold text-white">{formatCurrency(revenue_estimate.monthly)}</p>
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
            <h3 className="text-lg font-serif font-semibold text-[#0F172A] mb-3">What is This Report?</h3>
            <p className="text-[#0F172A]/70 leading-relaxed">
              This report is a detailed analysis to show you how we evaluate a property for an <strong>Airbnb Arbitrage</strong> business.
              The idea is simple: we rent a regular, long-term property, furnish it, and re-rent it for short stays on Airbnb.
              The goal is to make more money from short-term Airbnb guests than we pay in rent and other expenses.
              This process helps us decide if a property is a good investment <em>before</em> signing a lease.
            </p>
          </div>

          {/* Chapter 1: The Property */}
          <ChapterSection id="chapter-1" title="1. First, We Look at the Property Itself">
            <p className="text-lg text-[#0F172A]/80 mb-8 leading-relaxed">
              Our analysis starts with the property we might rent. We need to understand its basic details and what makes it special for potential Airbnb guests.
            </p>

            <div className="bg-white rounded-xl shadow-lg overflow-hidden mb-8">
              <div className="bg-[#0F172A] p-4">
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

            <h3 className="text-xl font-serif font-semibold text-[#0F172A] mb-6">What Makes This Property Attractive for Airbnb?</h3>

            <p className="text-[#0F172A]/70 mb-4">
              We look for features that will stand out to guests. Based on the property details and market analysis, here are the key selling points:
            </p>

            <div className="grid md:grid-cols-2 gap-4 mb-6">
              <div className="bg-white rounded-xl p-4 shadow-md border-l-4 border-[#C9A962]">
                <div className="flex items-center gap-3 mb-2">
                  <Bed className="w-5 h-5 text-[#C9A962]" />
                  <span className="font-semibold text-[#0F172A]">{property.bedrooms} Bedrooms</span>
                </div>
                <p className="text-sm text-[#0F172A]/60">
                  {property.bedrooms === 1
                    ? 'Perfect for couples and solo travelers looking for a cozy retreat.'
                    : property.bedrooms === 2
                      ? 'Ideal for small families or two couples traveling together.'
                      : property.bedrooms >= 4
                        ? 'Great for large families and group getaways.'
                        : 'Comfortable space for families and small groups.'}
                </p>
              </div>

              <div className="bg-white rounded-xl p-4 shadow-md border-l-4 border-[#C9A962]">
                <div className="flex items-center gap-3 mb-2">
                  <Bath className="w-5 h-5 text-[#C9A962]" />
                  <span className="font-semibold text-[#0F172A]">{property.bathrooms} Bathrooms</span>
                </div>
                <p className="text-sm text-[#0F172A]/60">
                  {property.bathrooms >= property.bedrooms
                    ? 'Having enough bathrooms is a major comfort factor for groups.'
                    : 'Adequate bathroom facilities for the property size.'}
                </p>
              </div>

              <div className="bg-white rounded-xl p-4 shadow-md border-l-4 border-green-500">
                <div className="flex items-center gap-3 mb-2">
                  <Users className="w-5 h-5 text-green-500" />
                  <span className="font-semibold text-[#0F172A]">Sleeps {property.accommodates}</span>
                </div>
                <p className="text-sm text-[#0F172A]/60">
                  Can accommodate up to {property.accommodates} guests, maximizing booking potential.
                </p>
              </div>

              <div className="bg-white rounded-xl p-4 shadow-md border-l-4 border-blue-500">
                <div className="flex items-center gap-3 mb-2">
                  <MapPin className="w-5 h-5 text-blue-500" />
                  <span className="font-semibold text-[#0F172A]">{property.city} Location</span>
                </div>
                <p className="text-sm text-[#0F172A]/60">
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
            <p className="text-lg text-[#0F172A]/80 mb-8 leading-relaxed">
              Now that we know about the property, we need to understand the local Airbnb market. How much money are similar properties actually making?
              We focus on other <strong>{property.bedrooms}-bedroom properties</strong> in the same area to get a clear picture.
            </p>

            <h3 className="text-xl font-serif font-semibold text-[#0F172A] mb-6">What Do Similar Airbnbs Earn?</h3>

            <p className="text-[#0F172A]/70 mb-4">
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

            <h3 className="text-xl font-serif font-semibold text-[#0F172A] mb-6">How Much is Possible? (Good, Better, Best)</h3>

            <p className="text-[#0F172A]/70 mb-4">
              Not all Airbnbs perform the same. Some are average, while others are run by expert hosts who make much more.
              We look at these different levels to understand the full potential.
            </p>

            {revenue_percentiles && (
              <div className="bg-white rounded-xl shadow-lg overflow-hidden mb-8">
                <div className="bg-[#0F172A] p-4">
                  <p className="text-white font-semibold">Revenue Potential (How much money can be made in a year?)</p>
                </div>
                <DataTable
                  headers={['Performance Level', 'Annual Revenue', 'Who Achieves This?']}
                  rows={[
                    [
                      <span key="top10" className="flex items-center gap-2">
                        <Award className="w-4 h-4 text-[#C9A962]" />
                        Top 10% (Best)
                      </span>,
                      <span key="top10-val" className="font-bold text-[#C9A962]">{formatCurrency(revenue_percentiles.p90)}</span>,
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
            <h3 className="text-xl font-serif font-semibold text-[#0F172A] mb-6 mt-10">Monthly Revenue Forecast</h3>

            <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
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
                <div className="p-4 bg-[#C9A962]/10 rounded-lg">
                  <p className="text-sm text-[#C9A962] font-medium">Annual Total</p>
                  <p className="text-xl font-bold text-[#0F172A]">{formatCurrency(revenue_estimate.annual)}</p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#0F172A]/10">
                      <th className="py-2 px-3 text-left font-medium text-[#0F172A]/60">Month</th>
                      <th className="py-2 px-3 text-right font-medium text-[#0F172A]/60">Revenue</th>
                      <th className="py-2 px-3 text-right font-medium text-[#0F172A]/60">Occupancy</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthly_forecast.slice(0, 12).map((month, idx) => (
                      <tr key={idx} className="border-b border-[#0F172A]/5">
                        <td className="py-2 px-3 font-medium">{month.month}</td>
                        <td className="py-2 px-3 text-right">{formatCurrency(month.revenue)}</td>
                        <td className="py-2 px-3 text-right">{formatPercent(month.occupancy)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </ChapterSection>

          {/* Chapter 3: Study the Competition */}
          <ChapterSection id="chapter-3" title="3. Then, We Study the Competition">
            <p className="text-lg text-[#0F172A]/80 mb-8 leading-relaxed">
              To get into the Top 25%, we need to understand what the best are doing right. We study the top-earning
              {property.bedrooms}-bedroom Airbnbs in the area to learn their secrets.
            </p>

            {/* Minimum Revenue Threshold Explanation */}
            <div className="bg-[#C9A962]/10 border border-[#C9A962]/30 rounded-xl p-6 mb-8">
              <h4 className="font-semibold text-[#0F172A] mb-2 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-[#C9A962]" />
                The "2x Rule" for Arbitrage Success
              </h4>
              <p className="text-[#0F172A]/70 mb-3">
                For arbitrage to be profitable, competitors should earn at least <strong>2x your annual rent</strong>.
                With {formatCurrency(monthlyRent)}/month rent, the minimum threshold is:
              </p>
              <p className="text-2xl font-bold text-[#0F172A]">
                {formatCurrency(minRevenueThreshold)}/year
              </p>
              <p className="text-sm text-[#0F172A]/60 mt-1">
                ({formatCurrency(monthlyRent)} × 12 months × 2 = {formatCurrency(minRevenueThreshold)})
              </p>
            </div>

            {/* RED FLAG Warning if no viable comps */}
            {!hasViableComps && (
              <div className="bg-red-50 border-2 border-red-300 rounded-xl p-6 mb-8">
                <h4 className="font-bold text-red-700 mb-2 flex items-center gap-2 text-lg">
                  ⚠️ RED FLAG: Potential Viability Concern
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

            <h3 className="text-xl font-serif font-semibold text-[#0F172A] mb-6">What Do the Top Competitors Have in Common?</h3>

            <p className="text-[#0F172A]/70 mb-4">
              {hasViableComps 
                ? `Here are the ${property.bedrooms}-bedroom properties in ${property.city} that meet the profitability threshold. These are the "winners" you'll be competing against.`
                : `Even though no properties meet the threshold, here are the top ${property.bedrooms}-bedroom performers in the area for reference.`
              }
            </p>

            <div className="bg-white rounded-xl shadow-lg overflow-hidden mb-8">
              <div className={`p-4 ${hasViableComps ? 'bg-[#0F172A]' : 'bg-red-700'}`}>
                <p className="text-white font-semibold">
                  {hasViableComps 
                    ? `Winners: ${property.bedrooms}-BR Properties Earning ${formatCurrency(minRevenueThreshold)}+/year`
                    : `Top ${property.bedrooms}-BR Performers (Below Threshold)`
                  }
                </p>
              </div>
              <div className="divide-y divide-[#0F172A]/5">
                {(hasViableComps ? winningComps : displayComps).slice(0, 5).map((comp, idx) => (
                  <div key={comp.id} className="p-4 hover:bg-[#0F172A]/5 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="w-6 h-6 bg-[#C9A962]/20 rounded-full flex items-center justify-center text-xs font-bold text-[#C9A962]">
                            {idx + 1}
                          </span>
                          {comp.airbnb_url ? (
                            <a
                              href={comp.airbnb_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-semibold text-[#0F172A] hover:text-[#C9A962] transition-colors flex items-center gap-1"
                            >
                              {comp.title}
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : (
                            <span className="font-semibold text-[#0F172A]">{comp.title}</span>
                          )}
                        </div>
                        <p className="text-sm text-[#0F172A]/60 mb-2">
                          {comp.bedrooms} BR • {comp.property_type} • {formatPercent(comp.occupancy)} occupancy
                          {comp.rating && (
                            <span className="ml-2 inline-flex items-center gap-1">
                              <Star className="w-3 h-3 fill-[#C9A962] text-[#C9A962]" />
                              {comp.rating.toFixed(1)}
                            </span>
                          )}
                        </p>
                        <p className="text-sm text-[#0F172A]/70">
                          {comp.occupancy > 80
                            ? 'High occupancy indicates strong demand and excellent guest experience.'
                            : comp.rating && comp.rating >= 4.9
                              ? 'Near-perfect reviews drive premium pricing and repeat bookings.'
                              : comp.adr > revenue_estimate.nightly * 1.2
                                ? 'Premium pricing suggests unique features or exceptional design.'
                                : 'Solid performer with consistent bookings.'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold text-[#0F172A]">{formatCurrency(comp.annual_revenue)}</p>
                        <p className="text-sm text-[#0F172A]/50">/year</p>
                        <p className="text-sm text-[#0F172A]/60 mt-1">{formatCurrency(comp.adr)}/night</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <ThoughtProcess>
              We are not just providing a place to sleep; we are selling an <strong>experience</strong>.
              The most successful Airbnbs have a unique personality or a special feature that makes them memorable.
              Our job is to create that for our property. Notice how the top performers in {property.city} achieve
              {formatPercent(displayComps[0]?.occupancy || revenue_estimate.occupancy)} occupancy or higher.
            </ThoughtProcess>
          </ChapterSection>

          {/* Chapter 4: Project the Profit */}
          <ChapterSection id="chapter-4" title="4. Finally, We Project the Profit">
            <p className="text-lg text-[#0F172A]/80 mb-8 leading-relaxed">
              This is where we put it all together to see if the business model makes sense financially.
              We estimate the costs and subtract them from the potential revenue.
            </p>

            <h3 className="text-xl font-serif font-semibold text-[#0F172A] mb-6">How Much Does It Cost to Start?</h3>

            <p className="text-[#0F172A]/70 mb-4">
              To turn an empty rental into a beautiful, guest-ready Airbnb, there are upfront costs.
            </p>

            <div className="bg-white rounded-xl shadow-lg overflow-hidden mb-8">
              <DataTable
                headers={['Cost Item', 'Estimated Amount', 'What This Is For']}
                rows={[
                  [
                    <span key="startup" className="font-bold">Total Estimated Startup Costs</span>,
                    <span key="startup-val" className="font-bold text-[#0F172A]">{formatCurrency(estimatedStartupCosts)}</span>,
                    'This is a flat-rate estimate that covers everything needed to get started: first month\'s rent, security deposit, all furniture, decor, kitchen supplies, linens, professional photos, and business licenses.'
                  ]
                ]}
              />
            </div>

            <h3 className="text-xl font-serif font-semibold text-[#0F172A] mb-6">What Are the Monthly Expenses?</h3>

            <p className="text-[#0F172A]/70 mb-4">
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
                    <span key="total-val" className="font-bold text-[#0F172A]">{formatCurrency(totalMonthlyExpenses)}</span>,
                    'This is our estimated total cost per month to operate.'
                  ]
                ]}
              />
            </div>

            <h3 className="text-xl font-serif font-semibold text-[#0F172A] mb-6">What is the Potential Profit?</h3>

            <p className="text-[#0F172A]/70 mb-4">
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
                      <Target className="w-4 h-4 text-[#C9A962]" />
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

            {/* CTA Section */}
            <div className="mt-12 bg-gradient-to-br from-[#0F172A] to-[#1e293b] rounded-2xl p-8 text-white">
              <div className="max-w-2xl mx-auto text-center">
                <div className="inline-flex items-center gap-2 bg-[#C9A962]/20 text-[#C9A962] px-4 py-2 rounded-full text-sm font-medium mb-4">
                  <Award className="w-4 h-4" />
                  Done-For-You Solution
                </div>
                <h3 className="text-2xl md:text-3xl font-serif font-bold mb-4">
                  Ready to Turn This Analysis Into Reality?
                </h3>
                <p className="text-white/70 mb-8">
                  Our turnkey program handles everything — from lease negotiation to property setup to guest management.
                  We've helped hundreds of investors launch profitable Airbnb businesses.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <button className="bg-[#C9A962] text-[#0F172A] px-8 py-4 rounded-xl font-semibold hover:bg-[#d4b876] transition-colors flex items-center justify-center gap-2">
                    Schedule Free Consultation
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

            {/* Footer */}
            <div className="mt-12 pt-8 border-t border-[#0F172A]/10 text-center">
              <p className="text-sm text-[#0F172A]/50 italic">
                This report was generated based on data from the Coach Inayah market analysis tool.
                All data is for the trailing 12-month period. Actual results may vary based on property condition,
                management quality, and market conditions.
              </p>
            </div>
          </ChapterSection>
        </div>
      </div>
    </div>
  );
}
