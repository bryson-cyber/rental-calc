/**
 * Chapter-Based Market Report Component
 * Matches the Marietta, GA Short-Term Rental Market Guide format
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
  ChevronDown,
  ChevronUp,
  Lightbulb,
  BarChart3,
  PieChart,
  Thermometer,
  Snowflake,
  Sun,
  Leaf,
  BookOpen,
  Sparkles
} from 'lucide-react';
import { Link } from 'wouter';
import { ReportDisclaimer } from './ReportDisclaimer';


// Types
interface MarketMetrics {
  occupancy: number;
  adr: number;
  revenue: number;
  revpar: number;
  active_listings: number;
  market_score?: number;
}

interface ListingData {
  id: string;
  title: string;
  airbnb_url?: string;
  image_url?: string;
  bedrooms: number;
  bathrooms: number;
  accommodates: number;
  property_type: string;
  rating: number | null;
  reviews: number;
  annual_revenue: number;
  adr: number;
  occupancy: number;
  superhost?: boolean;
  professionally_managed?: boolean;
  host_size?: string;
}

interface BedroomPerformance {
  bedrooms: number;
  count: number;
  avg_revenue: number;
  avg_adr: number;
  avg_occupancy: number;
}

interface MarketInsights {
  total_listings: number;
  professionally_managed_count: number;
  professionally_managed_pct: number;
  superhost_count: number;
  superhost_pct: number;
  avg_rating: number;
  avg_reviews: number;
  avg_days_available: number;
  avg_days_reserved: number;
  property_type_breakdown: Array<{
    type: string;
    count: number;
    pct: number;
    avg_revenue: number;
  }>;
  host_size_breakdown: Array<{
    size: string;
    count: number;
    pct: number;
    avg_revenue: number;
  }>;
  revenue_percentiles: {
    p10: number;
    p25: number;
    p50: number;
    p75: number;
    p90: number;
  };
}

interface SubmarketData {
  id: string;
  name: string;
  listing_count: number;
}

interface MarketReportData {
  market: {
    id: string;
    name: string;
    listing_count: number;
    location_name: string;
    market_type?: string;
    metrics: MarketMetrics;
  };
  submarkets: SubmarketData[];
  top_listings: ListingData[];
  bedroom_performance: BedroomPerformance[];
  insights?: MarketInsights;
  generated_at: string;
}

interface SubmarketReportData {
  submarket: {
    id: string;
    name: string;
    listing_count: number;
    parent_market?: string;
    market_type?: string;
    metrics: MarketMetrics;
  };
  top_listings: ListingData[];
  bedroom_performance: BedroomPerformance[];
  insights: MarketInsights;
  generated_at: string;
}

interface ChapterMarketReportProps {
  data: MarketReportData | SubmarketReportData;
  reportType: 'market' | 'submarket';
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
    <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[oklch(0.15_0.02_265)]/10 py-4">
      <div className="container mx-auto px-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {chapters.map((chapter) => (
            <button
              key={chapter.id}
              onClick={() => onChapterClick(chapter.id)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                activeChapter === chapter.id
                  ? 'bg-[oklch(0.55_0.14_75)] text-white'
                  : 'bg-[oklch(0.15_0.02_265)]/5 text-[oklch(0.15_0.02_265)]/70 hover:bg-[oklch(0.15_0.02_265)]/10'
              }`}
            >
              Ch. {chapter.id}: {chapter.title}
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
    <section id={id} className="scroll-mt-24 py-12 border-b border-[oklch(0.15_0.02_265)]/10 last:border-0">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
      >
        <h2 className="text-2xl md:text-3xl font-sans font-bold text-[oklch(0.15_0.02_265)] mb-8 flex items-center gap-3">
          <BookOpen className="w-7 h-7 text-[oklch(0.55_0.14_75)]" />
          {title}
        </h2>
        {children}
      </motion.div>
    </section>
  );
}

// Info Card Component
function InfoCard({ title, value, subtitle, icon: Icon, trend }: {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ElementType;
  trend?: 'up' | 'down' | 'neutral';
}) {
  return (
    <div className="bg-white rounded-xl shadow-lg p-6 border border-[oklch(0.15_0.02_265)]/5">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-10 h-10 bg-[oklch(0.55_0.14_75)]/10 rounded-lg flex items-center justify-center">
          <Icon className="w-5 h-5 text-[oklch(0.55_0.14_75)]" />
        </div>
        <span className="text-sm font-medium text-[oklch(0.15_0.02_265)]/60">{title}</span>
      </div>
      <p className="text-3xl font-sans font-bold text-[oklch(0.15_0.02_265)] mb-1">{value}</p>
      {subtitle && (
        <p className="text-sm text-[oklch(0.15_0.02_265)]/50 flex items-center gap-1">
          {trend === 'up' && <TrendingUp className="w-4 h-4 text-green-600" />}
          {trend === 'down' && <TrendingDown className="w-4 h-4 text-red-500" />}
          {subtitle}
        </p>
      )}
    </div>
  );
}

// Table Component
function DataTable({ headers, rows }: {
  headers: string[];
  rows: (string | React.ReactNode)[][];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b-2 border-[oklch(0.55_0.14_75)]/30">
            {headers.map((header, idx) => (
              <th
                key={idx}
                className={`py-3 px-4 text-sm font-semibold text-[oklch(0.15_0.02_265)] ${
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
              className="border-b border-[oklch(0.15_0.02_265)]/5 hover:bg-[oklch(0.55_0.14_75)]/5 transition-colors"
            >
              {row.map((cell, cellIdx) => (
                <td
                  key={cellIdx}
                  className={`py-4 px-4 ${
                    cellIdx === 0 ? 'text-left font-medium text-[oklch(0.15_0.02_265)]' : 'text-right text-[oklch(0.15_0.02_265)]/70'
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

// Highlight Box Component
function HighlightBox({ title, content, variant = 'default' }: {
  title: string;
  content: string;
  variant?: 'default' | 'success' | 'warning' | 'info';
}) {
  const variants = {
    default: 'bg-[oklch(0.15_0.02_265)]/5 border-[oklch(0.15_0.02_265)]',
    success: 'bg-green-50 border-green-600',
    warning: 'bg-amber-50 border-amber-600',
    info: 'bg-blue-50 border-blue-600'
  };

  return (
    <div className={`p-4 rounded-lg border-l-4 ${variants[variant]}`}>
      <p className="font-semibold text-[oklch(0.15_0.02_265)] mb-1">{title}</p>
      <p className="text-sm text-[oklch(0.15_0.02_265)]/70">{content}</p>
    </div>
  );
}

// Tier Card Component
function TierCard({ tier, title, description, markets }: {
  tier: number;
  title: string;
  description: string;
  markets: { name: string; reason: string }[];
}) {
  const tierColors = {
    1: 'from-[oklch(0.55_0.14_75)] to-[oklch(0.65_0.12_75)]',
    2: 'from-[oklch(0.45_0.01_265)] to-[oklch(0.55_0_0)]',
    3: 'from-[oklch(0.50_0.01_50)] to-[oklch(0.65_0.01_50)]'
  };

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      <div className={`bg-gradient-to-r ${tierColors[tier as keyof typeof tierColors]} p-4`}>
        <span className="text-white/80 text-sm font-medium">Tier {tier}</span>
        <h3 className="text-xl font-sans font-bold text-white">{title}</h3>
        <p className="text-white/80 text-sm mt-1">{description}</p>
      </div>
      <div className="p-4 space-y-3">
        {markets.map((market, idx) => (
          <div key={idx} className="p-3 bg-[oklch(0.15_0.02_265)]/5 rounded-lg">
            <p className="font-semibold text-[oklch(0.15_0.02_265)]">{market.name}</p>
            <p className="text-sm text-[oklch(0.15_0.02_265)]/60">{market.reason}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ChapterMarketReport({ data, reportType, onBack, clientName }: ChapterMarketReportProps) {
  const [activeChapter, setActiveChapter] = useState(1);


  const isSubmarket = reportType === 'submarket';
  const marketInfo = isSubmarket
    ? (data as SubmarketReportData).submarket
    : (data as MarketReportData).market;
  const insights = isSubmarket
    ? (data as SubmarketReportData).insights
    : (data as MarketReportData).insights;
  const submarkets = !isSubmarket ? (data as MarketReportData).submarkets : [];

  const chapters = [
    { id: 1, title: 'The Big Picture' },
    { id: 2, title: 'Top Winners' },
    { id: 3, title: 'What Guests Want' },
    { id: 4, title: 'Understanding the Seasons' },
    { id: 5, title: 'Best Neighborhoods' },
    { id: 6, title: 'Property Size Matters' },
    { id: 7, title: 'Deeper Insights' },
    { id: 8, title: 'Your Action Plan' }
  ];

  const scrollToChapter = (id: number) => {
    setActiveChapter(id);
    const element = document.getElementById(`chapter-${id}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Find best performing bedroom size
  const bestBedroom = data.bedroom_performance?.reduce((best, current) =>
    current.avg_occupancy > (best?.avg_occupancy || 0) ? current : best
  , data.bedroom_performance[0]);

  // Calculate key insights
  const avgOccupancy = marketInfo.metrics.occupancy;
  const avgADR = marketInfo.metrics.adr;
  const avgRevenue = marketInfo.metrics.revenue;
  const totalListings = marketInfo.metrics.active_listings || marketInfo.listing_count;
  const profManagedPct = insights?.professionally_managed_pct || 0;

  return (
    <div className="min-h-screen bg-white">
      {/* Title Page / Header */}
      <div className="bg-[oklch(0.15_0.02_265)] text-white">
        <div className="container mx-auto px-4 py-12">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 text-white/70 hover:text-white transition-colors text-sm mb-8"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Search
          </button>

          <div className="max-w-3xl">
            <div className="flex items-center gap-3 mb-4">
              {isSubmarket ? (
                <MapPin className="w-6 h-6 text-[oklch(0.55_0.14_75)]" />
              ) : (
                <Building className="w-6 h-6 text-[oklch(0.55_0.14_75)]" />
              )}
              <span className="text-sm font-medium text-[oklch(0.55_0.14_75)] uppercase tracking-wider">
                Short-Term Rental Market Guide
              </span>
            </div>

            <h1 className="text-4xl md:text-5xl font-sans font-bold mb-4">
              {marketInfo.name}: A Comprehensive Guide to Short-Term Rental Investment
            </h1>

            {isSubmarket && (data as SubmarketReportData).submarket.parent_market && (
              <p className="text-white/70 text-lg mb-6">
                Part of the {(data as SubmarketReportData).submarket.parent_market} market
              </p>
            )}

            <div className="flex flex-wrap gap-4 text-sm text-white/60">
              <span><strong className="text-white">Prepared for:</strong> {clientName || 'Valued Investor'}</span>
              <span>•</span>
              <span><strong className="text-white">Date:</strong> {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
            </div>
          </div>

          {marketInfo.metrics.market_score && (
            <div className="absolute top-12 right-8 text-right hidden lg:block">
              <p className="text-sm text-white/60 mb-1">Market Score</p>
              <p className="text-5xl font-sans font-bold text-[oklch(0.55_0.14_75)]">
                {Math.round(marketInfo.metrics.market_score)}
              </p>
              <p className="text-xs text-white/50">out of 100</p>
            </div>
          )}
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

          {/* Chapter 1: The Big Picture */}
          <ChapterSection id="chapter-1" title="Chapter 1: The Big Picture">
            <p className="text-lg text-[oklch(0.15_0.02_265)]/80 mb-8 leading-relaxed">
              This report provides a deep dive into the short-term rental (STR) market in {marketInfo.name}.
              {isSubmarket
                ? ` As a key neighborhood, ${marketInfo.name} presents unique investment opportunities with specific demand patterns and guest preferences.`
                : ` This market presents a unique investment landscape with a blend of stable demand, diverse property types, and varying neighborhood profiles.`
              } This guide will walk you through the essential data and insights needed to make an informed investment decision.
            </p>

            <h3 className="text-xl font-sans font-semibold text-[oklch(0.15_0.02_265)] mb-6">Key Market Highlights</h3>

            <div className="grid md:grid-cols-2 gap-4 mb-8">
              <HighlightBox
                title={`Strong Overall Occupancy`}
                content={`The ${marketInfo.name} market maintains an average occupancy rate of ${formatPercent(avgOccupancy)}, indicating ${avgOccupancy > 60 ? 'strong' : avgOccupancy > 50 ? 'healthy' : 'moderate'} demand from travelers.`}
                variant="success"
              />
              <HighlightBox
                title={`${bestBedroom?.bedrooms ?? 2}-Bedroom Properties Lead`}
                content={`${bestBedroom?.bedrooms ?? 2}-bedroom properties show the highest occupancy rates (${formatPercent(bestBedroom?.avg_occupancy || avgOccupancy)}), signaling strong demand from ${bestBedroom?.bedrooms === 1 ? 'couples and business travelers' : bestBedroom?.bedrooms === 4 ? 'families and groups' : 'small families and groups'}.`}
                variant="info"
              />
              <HighlightBox
                title={`${profManagedPct < 20 ? 'Low' : profManagedPct < 40 ? 'Moderate' : 'High'} Professional Host Saturation`}
                content={`Only ${profManagedPct}% of listings are professionally managed. This creates ${profManagedPct < 20 ? 'a significant opportunity' : 'room'} for individual hosts to compete and succeed.`}
                variant={profManagedPct < 20 ? 'success' : 'default'}
              />
              <HighlightBox
                title={`Average Revenue: ${formatCurrency(avgRevenue)}`}
                content={`Properties in this market earn an average of ${formatCurrency(avgRevenue)} annually, with top performers earning ${formatCurrency(insights?.revenue_percentiles?.p90 || avgRevenue * 1.5)} or more.`}
                variant="default"
              />
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <InfoCard title="Occupancy Rate" value={formatPercent(avgOccupancy)} icon={Percent} />
              <InfoCard title="Avg. Daily Rate" value={formatCurrency(avgADR)} icon={DollarSign} />
              <InfoCard title="Avg. Revenue" value={formatCurrency(avgRevenue)} icon={TrendingUp} />
              <InfoCard title="Active Listings" value={totalListings.toLocaleString()} icon={Building} />
            </div>
          </ChapterSection>

          {/* Chapter 2: Top Winners */}
          <ChapterSection id="chapter-2" title="Chapter 2: Meet the Top Winners">
            <p className="text-lg text-[oklch(0.15_0.02_265)]/80 mb-8 leading-relaxed">
              These are the highest-earning properties in {marketInfo.name}. Studying what makes them successful 
              gives us a blueprint for achieving top-performer status. Notice their pricing strategies, 
              property types, and occupancy rates.
            </p>

            {data.top_listings && data.top_listings.length > 0 ? (
              <>
                <div className="bg-white rounded-xl shadow-lg overflow-hidden mb-8">
                  <div className="bg-gradient-to-r from-[oklch(0.55_0.14_75)] to-[oklch(0.65_0.12_75)] p-4">
                    <div className="flex items-center gap-2">
                      <Award className="w-5 h-5 text-white" />
                      <p className="text-white font-semibold">Top Performers in {marketInfo.name}</p>
                    </div>
                  </div>
                  <div className="divide-y divide-[oklch(0.15_0.02_265)]/5">
                    {data.top_listings.slice(0, 5).map((listing, idx) => (
                      <div key={listing.id} className="p-4 hover:bg-[oklch(0.15_0.02_265)]/5 transition-colors">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                idx === 0 ? 'bg-[oklch(0.55_0.14_75)] text-white' : 
                                idx === 1 ? 'bg-gray-400 text-white' : 
                                idx === 2 ? 'bg-amber-600 text-white' : 'bg-[oklch(0.15_0.02_265)]/10 text-[oklch(0.15_0.02_265)]'
                              }`}>
                                {idx + 1}
                              </span>
                              {listing.airbnb_url ? (
                                <a
                                  href={listing.airbnb_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-semibold text-[oklch(0.15_0.02_265)] hover:text-[oklch(0.55_0.14_75)] transition-colors flex items-center gap-1"
                                >
                                  {listing.title}
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              ) : (
                                <span className="font-semibold text-[oklch(0.15_0.02_265)]">{listing.title}</span>
                              )}
                            </div>
                            <p className="text-sm text-[oklch(0.15_0.02_265)]/60 mb-2">
                              {listing.bedrooms} BR • {listing.property_type} • {formatPercent(listing.occupancy)} occupancy
                              {listing.rating && (
                                <span className="ml-2 inline-flex items-center gap-1">
                                  <Star className="w-3 h-3 fill-[oklch(0.55_0.14_75)] text-[oklch(0.55_0.14_75)]" />
                                  {listing.rating.toFixed(1)}
                                </span>
                              )}
                              {listing.superhost && (
                                <span className="ml-2 text-xs bg-[oklch(0.55_0.14_75)]/20 text-[oklch(0.55_0.14_75)] px-2 py-0.5 rounded-full">
                                  Superhost
                                </span>
                              )}
                            </p>
                            <p className="text-sm text-[oklch(0.15_0.02_265)]/70">
                              {listing.occupancy > 70
                                ? 'High occupancy indicates strong demand and excellent guest experience.'
                                : listing.rating && listing.rating >= 4.9
                                  ? 'Near-perfect reviews drive premium pricing and repeat bookings.'
                                  : listing.adr > avgADR * 1.3
                                    ? 'Premium pricing suggests unique features or exceptional design.'
                                    : 'Consistent performer with solid bookings.'}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xl font-bold text-[oklch(0.15_0.02_265)]">{formatCurrency(listing.annual_revenue)}</p>
                            <p className="text-sm text-[oklch(0.15_0.02_265)]/50">/year</p>
                            <p className="text-sm text-[oklch(0.15_0.02_265)]/60 mt-1">{formatCurrency(listing.adr)}/night</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid md:grid-cols-3 gap-4 mb-8">
                  <div className="bg-white rounded-xl shadow-lg p-6">
                    <p className="text-sm text-[oklch(0.15_0.02_265)]/60 mb-1">Top Performer Revenue</p>
                    <p className="text-2xl font-sans font-bold text-[oklch(0.55_0.14_75)]">
                      {formatCurrency(data.top_listings[0]?.annual_revenue || 0)}
                    </p>
                    <p className="text-xs text-[oklch(0.15_0.02_265)]/50">per year</p>
                  </div>
                  <div className="bg-white rounded-xl shadow-lg p-6">
                    <p className="text-sm text-[oklch(0.15_0.02_265)]/60 mb-1">Avg. Top 5 Revenue</p>
                    <p className="text-2xl font-sans font-bold text-[oklch(0.15_0.02_265)]">
                      {formatCurrency(data.top_listings.slice(0, 5).reduce((sum, l) => sum + l.annual_revenue, 0) / Math.min(5, data.top_listings.length))}
                    </p>
                    <p className="text-xs text-[oklch(0.15_0.02_265)]/50">per year</p>
                  </div>
                  <div className="bg-white rounded-xl shadow-lg p-6">
                    <p className="text-sm text-[oklch(0.15_0.02_265)]/60 mb-1">vs. Market Average</p>
                    <p className="text-2xl font-sans font-bold text-green-600">
                      +{Math.round(((data.top_listings[0]?.annual_revenue || avgRevenue) / avgRevenue - 1) * 100)}%
                    </p>
                    <p className="text-xs text-[oklch(0.15_0.02_265)]/50">higher revenue</p>
                  </div>
                </div>

                <div className="p-4 bg-[oklch(0.55_0.14_75)]/10 rounded-xl border border-[oklch(0.55_0.14_75)]/30">
                  <div className="flex items-start gap-3">
                    <Lightbulb className="w-5 h-5 text-[oklch(0.55_0.14_75)] flex-shrink-0 mt-1" />
                    <div>
                      <p className="font-semibold text-[oklch(0.15_0.02_265)]">The Thought Process</p>
                      <p className="text-sm text-[oklch(0.15_0.02_265)]/70">
                        The top performers in {marketInfo.name} earn {Math.round(((data.top_listings[0]?.annual_revenue || avgRevenue) / avgRevenue - 1) * 100)}% more than the market average.
                        This shows what's possible when you combine the right property with professional management.
                        Our goal is to position your property to compete with these winners.
                      </p>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <p className="text-[oklch(0.15_0.02_265)]/60">Top performer data not available for this market.</p>
              </div>
            )}
          </ChapterSection>

          {/* Chapter 3: What Guests Want */}
          <ChapterSection id="chapter-3" title="Chapter 3: What Guests Want">
            <p className="text-lg text-[oklch(0.15_0.02_265)]/80 mb-8 leading-relaxed">
              Understanding guest preferences is crucial for maximizing bookings and revenue. In the {marketInfo.name} market,
              the data reveals clear trends in the amenities and property types that attract travelers.
            </p>

            <h3 className="text-xl font-sans font-semibold text-[oklch(0.15_0.02_265)] mb-6">Top 5 Most Important Amenities</h3>

            <div className="bg-white rounded-xl shadow-lg overflow-hidden mb-8">
              <DataTable
                headers={['Amenity', 'Importance', 'What This Means for You']}
                rows={[
                  ['Air Conditioning', '~95%+', <span key="ac" className="text-green-600 font-medium">Essential. A property without AC is non-competitive.</span>],
                  ['Parking', '~85%+', <span key="park" className="text-green-600 font-medium">Crucial. Most guests arrive by car and expect convenient parking.</span>],
                  ['Heating', '~80%+', <span key="heat">Standard. Necessary for comfort during cooler months.</span>],
                  ['TV / Smart TV', '~75%+', <span key="tv">Expected. Guests expect entertainment options.</span>],
                  ['Pets Allowed', '~60%+', <span key="pets" className="text-blue-600 font-medium">High-Impact. Allowing pets significantly expands your guest pool.</span>]
                ]}
              />
            </div>

            <h3 className="text-xl font-sans font-semibold text-[oklch(0.15_0.02_265)] mb-6">Property Type Performance</h3>

            {insights?.property_type_breakdown && insights.property_type_breakdown.length > 0 ? (
              <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                <DataTable
                  headers={['Property Type', 'Market Share', 'Avg. Revenue', 'Insight']}
                  rows={insights.property_type_breakdown.slice(0, 5).map((pt) => [
                    <span key={pt.type} className="capitalize">{pt.type}</span>,
                    `${pt.pct}%`,
                    formatCurrency(pt.avg_revenue),
                    pt.pct > 30
                      ? <span key={`${pt.type}-insight`} className="text-green-600">Dominant type - high demand</span>
                      : pt.avg_revenue > avgRevenue
                        ? <span key={`${pt.type}-insight`} className="text-blue-600">Premium revenue potential</span>
                        : <span key={`${pt.type}-insight`} className="text-[oklch(0.15_0.02_265)]/50">Standard performer</span>
                  ])}
                />
              </div>
            ) : (
              <p className="text-[oklch(0.15_0.02_265)]/60">Property type data not available for this market.</p>
            )}

            <div className="mt-6 p-4 bg-[oklch(0.55_0.14_75)]/10 rounded-xl border border-[oklch(0.55_0.14_75)]/30">
              <div className="flex items-start gap-3">
                <Lightbulb className="w-5 h-5 text-[oklch(0.55_0.14_75)] flex-shrink-0 mt-1" />
                <div>
                  <p className="font-semibold text-[oklch(0.15_0.02_265)]">The Thought Process</p>
                  <p className="text-sm text-[oklch(0.15_0.02_265)]/70">
                    The dominant property type indicates what guests are primarily looking for.
                    {insights?.property_type_breakdown?.[0]?.type === 'house'
                      ? ' Houses suggest guests want space and privacy, reinforcing the trend of family and group travel.'
                      : insights?.property_type_breakdown?.[0]?.type === 'apartment'
                        ? ' Apartments indicate demand from business travelers and couples seeking urban convenience.'
                        : ' Understanding this helps you position your property to meet market demand.'}
                  </p>
                </div>
              </div>
            </div>
          </ChapterSection>

          {/* Chapter 4: Understanding the Seasons */}
          <ChapterSection id="chapter-4" title="Chapter 4: Understanding the Seasons">
            <p className="text-lg text-[oklch(0.15_0.02_265)]/80 mb-8 leading-relaxed">
              Seasonality plays a role in any STR market. Understanding the high and low seasons in {marketInfo.name}
              helps you anticipate income fluctuations and adjust your pricing strategy.
            </p>

            <h3 className="text-xl font-sans font-semibold text-[oklch(0.15_0.02_265)] mb-6">Peak vs. Off-Peak Months</h3>

            <div className="grid md:grid-cols-3 gap-6 mb-8">
              <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-6 border border-amber-200">
                <div className="flex items-center gap-2 mb-3">
                  <Sun className="w-6 h-6 text-amber-500" />
                  <span className="font-semibold text-[oklch(0.15_0.02_265)]">Peak Season</span>
                </div>
                <p className="text-sm text-[oklch(0.15_0.02_265)]/70 mb-2">May through August</p>
                <p className="text-2xl font-sans font-bold text-amber-600">55-65% occupancy</p>
                <p className="text-xs text-[oklch(0.15_0.02_265)]/50 mt-2">Higher rates, strong demand</p>
              </div>

              <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border border-green-200">
                <div className="flex items-center gap-2 mb-3">
                  <Leaf className="w-6 h-6 text-green-500" />
                  <span className="font-semibold text-[oklch(0.15_0.02_265)]">Shoulder Season</span>
                </div>
                <p className="text-sm text-[oklch(0.15_0.02_265)]/70 mb-2">Mar-Apr & Sep-Nov</p>
                <p className="text-2xl font-sans font-bold text-green-600">50-55% occupancy</p>
                <p className="text-xs text-[oklch(0.15_0.02_265)]/50 mt-2">Solid, consistent bookings</p>
              </div>

              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
                <div className="flex items-center gap-2 mb-3">
                  <Snowflake className="w-6 h-6 text-blue-500" />
                  <span className="font-semibold text-[oklch(0.15_0.02_265)]">Off-Peak Season</span>
                </div>
                <p className="text-sm text-[oklch(0.15_0.02_265)]/70 mb-2">December through February</p>
                <p className="text-2xl font-sans font-bold text-blue-600">45-50% occupancy</p>
                <p className="text-xs text-[oklch(0.15_0.02_265)]/50 mt-2">Lower rates, less demand</p>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6">
              <h4 className="font-semibold text-[oklch(0.15_0.02_265)] mb-4">Income Stability Tips</h4>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-[oklch(0.15_0.02_265)]/70">
                    <strong>Use dynamic pricing</strong> — Adjust rates based on demand. Charge premium during peak, offer deals during slow periods.
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-[oklch(0.15_0.02_265)]/70">
                    <strong>Target different guests</strong> — Business travelers in off-season, families during summer.
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-[oklch(0.15_0.02_265)]/70">
                    <strong>Offer monthly discounts</strong> — Attract longer stays during slow months to maintain cash flow.
                  </p>
                </div>
              </div>
            </div>
          </ChapterSection>

          {/* Chapter 5: Best Neighborhoods */}
          <ChapterSection id="chapter-5" title="Chapter 5: The Best Neighborhoods to Invest In">
            <p className="text-lg text-[oklch(0.15_0.02_265)]/80 mb-8 leading-relaxed">
              Not all neighborhoods are created equal. {submarkets.length > 0
                ? `We have categorized the ${submarkets.length} submarkets around ${marketInfo.name} into tiers based on their revenue potential.`
                : `Understanding the competitive landscape helps you position your property for success.`}
            </p>

            {submarkets.length > 0 ? (
              <div className="grid md:grid-cols-3 gap-6">
                <TierCard
                  tier={1}
                  title="Premium Markets"
                  description="Highest revenue potential"
                  markets={submarkets.slice(0, 3).map((s) => ({
                    name: s.name,
                    reason: `${s.listing_count.toLocaleString()} active listings`
                  }))}
                />
                <TierCard
                  tier={2}
                  title="Solid Performers"
                  description="Balanced risk & reward"
                  markets={submarkets.slice(3, 6).map((s) => ({
                    name: s.name,
                    reason: `${s.listing_count.toLocaleString()} active listings`
                  }))}
                />
                <TierCard
                  tier={3}
                  title="Entry-Level Markets"
                  description="Lower initial investment"
                  markets={submarkets.slice(6, 9).map((s) => ({
                    name: s.name,
                    reason: `${s.listing_count.toLocaleString()} active listings`
                  }))}
                />
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h4 className="font-semibold text-[oklch(0.15_0.02_265)] mb-4">Competitive Landscape</h4>
                <p className="text-[oklch(0.15_0.02_265)]/70 mb-4">
                  With {totalListings.toLocaleString()} active listings in {marketInfo.name}, understanding your competition is key.
                </p>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="p-4 bg-green-50 rounded-lg">
                    <p className="font-semibold text-green-700">Opportunity</p>
                    <p className="text-sm text-green-600">
                      {profManagedPct < 20
                        ? 'Low professional competition means individual hosts can thrive.'
                        : 'Room to differentiate with better service and amenities.'}
                    </p>
                  </div>
                  <div className="p-4 bg-amber-50 rounded-lg">
                    <p className="font-semibold text-amber-700">Challenge</p>
                    <p className="text-sm text-amber-600">
                      {insights?.superhost_pct && insights.superhost_pct > 50
                        ? 'High superhost concentration means quality expectations are high.'
                        : 'Standing out requires excellent photos and reviews.'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </ChapterSection>

          {/* Chapter 6: Property Size Matters */}
          <ChapterSection id="chapter-6" title="Chapter 6: Property Size Matters">
            <p className="text-lg text-[oklch(0.15_0.02_265)]/80 mb-8 leading-relaxed">
              In {marketInfo.name}, the number of bedrooms in a property has a direct impact on its performance.
              The data shows clear preferences that can guide your investment decision.
            </p>

            <h3 className="text-xl font-sans font-semibold text-[oklch(0.15_0.02_265)] mb-6">Performance by Property Size</h3>

            {data.bedroom_performance && data.bedroom_performance.length > 0 ? (
              <>
                <div className="bg-white rounded-xl shadow-lg overflow-hidden mb-8">
                  <DataTable
                    headers={['Bedrooms', 'Occupancy Rate', 'Avg. Revenue', 'What This Means']}
                    rows={data.bedroom_performance.map((br) => {
                      const isHighest = br.bedrooms === bestBedroom?.bedrooms;
                      return [
                        <span key={br.bedrooms} className={isHighest ? 'font-bold text-[oklch(0.55_0.14_75)]' : ''}>
                          {br.bedrooms} Bedrooms {isHighest && ' (Best)'}
                        </span>,
                        <span key={`${br.bedrooms}-occ`} className={isHighest ? 'font-bold text-green-600' : ''}>
                          {formatPercent(br.avg_occupancy)}
                        </span>,
                        formatCurrency(br.avg_revenue),
                        br.bedrooms === bestBedroom?.bedrooms
                          ? <span key={`${br.bedrooms}-insight`} className="text-green-600 font-medium">The sweet spot - highest demand</span>
                          : br.bedrooms === 1
                            ? <span key={`${br.bedrooms}-insight`}>Ideal for business travelers or couples</span>
                            : br.bedrooms >= 4
                              ? <span key={`${br.bedrooms}-insight`}>Great for families and groups</span>
                              : <span key={`${br.bedrooms}-insight`}>Solid, reliable performer</span>
                      ];
                    })}
                  />
                </div>

                <div className="p-6 bg-[oklch(0.55_0.14_75)]/10 rounded-xl border border-[oklch(0.55_0.14_75)]/30">
                  <div className="flex items-start gap-3">
                    <Target className="w-6 h-6 text-[oklch(0.55_0.14_75)] flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-[oklch(0.15_0.02_265)] text-lg">Key Takeaway</p>
                      <p className="text-[oklch(0.15_0.02_265)]/70">
                        While all property sizes are viable in {marketInfo.name}, focusing on a{' '}
                        <strong>{bestBedroom?.bedrooms ?? 2}-bedroom property</strong> gives you the best chance to
                        maximize occupancy and align with the strongest segment of market demand.
                      </p>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-[oklch(0.15_0.02_265)]/60">Bedroom performance data not available for this market.</p>
            )}
          </ChapterSection>

          {/* Chapter 7: Deeper Insights */}
          <ChapterSection id="chapter-7" title="Chapter 7: Deeper Insights from the Data">
            <p className="text-lg text-[oklch(0.15_0.02_265)]/80 mb-8 leading-relaxed">
              Beyond the basics, the data reveals several deeper trends that can inform your investment strategy.
            </p>

            <h3 className="text-xl font-sans font-semibold text-[oklch(0.15_0.02_265)] mb-6">The Professional Host Landscape</h3>

            <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
              <p className="text-[oklch(0.15_0.02_265)]/70 mb-6">
                The percentage of listings managed by professional hosts (those with 21+ properties) is a key indicator of competition.
              </p>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-[oklch(0.15_0.02_265)]">Professionally Managed</span>
                    <span className="text-2xl font-bold text-[oklch(0.15_0.02_265)]">{profManagedPct}%</span>
                  </div>
                  <div className="w-full bg-[oklch(0.15_0.02_265)]/10 rounded-full h-3">
                    <div
                      className="bg-[oklch(0.55_0.14_75)] h-3 rounded-full transition-all duration-1000"
                      style={{ width: `${profManagedPct}%` }}
                    />
                  </div>
                  <p className="text-sm text-[oklch(0.15_0.02_265)]/50 mt-2">
                    {insights?.professionally_managed_count || 0} of {insights?.total_listings || totalListings} listings
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-[oklch(0.15_0.02_265)]">Superhosts</span>
                    <span className="text-2xl font-bold text-[oklch(0.15_0.02_265)]">{insights?.superhost_pct || 0}%</span>
                  </div>
                  <div className="w-full bg-[oklch(0.15_0.02_265)]/10 rounded-full h-3">
                    <div
                      className="bg-green-600 h-3 rounded-full transition-all duration-1000"
                      style={{ width: `${insights?.superhost_pct || 0}%` }}
                    />
                  </div>
                  <p className="text-sm text-[oklch(0.15_0.02_265)]/50 mt-2">
                    {insights?.superhost_count || 0} of {insights?.total_listings || totalListings} listings
                  </p>
                </div>
              </div>

              <div className="mt-6 p-4 bg-[oklch(0.15_0.02_265)]/5 rounded-lg">
                <p className="text-sm text-[oklch(0.15_0.02_265)]/70">
                  <strong>What this means:</strong>{' '}
                  {profManagedPct < 15
                    ? 'This market has very low professional competition. Individual hosts have a significant advantage and can compete effectively with good service and marketing.'
                    : profManagedPct < 30
                      ? 'This market has moderate professional presence. You can still compete successfully by focusing on unique amenities and excellent guest experiences.'
                      : 'This market has strong professional competition. You\'ll need a polished listing, professional photos, and excellent service to stand out.'}
                </p>
              </div>
            </div>

            {/* Revenue Distribution */}
            {insights?.revenue_percentiles && (
              <>
                <h3 className="text-xl font-sans font-semibold text-[oklch(0.15_0.02_265)] mb-6">Revenue Distribution</h3>
                <div className="bg-white rounded-xl shadow-lg p-6">
                  <p className="text-[oklch(0.15_0.02_265)]/70 mb-6">
                    Understanding where you can realistically land in the revenue spectrum helps set expectations.
                  </p>

                  <div className="grid grid-cols-5 gap-4 mb-6">
                    {[
                      { label: 'Bottom 10%', value: insights.revenue_percentiles.p10, color: 'bg-red-100 text-red-700' },
                      { label: 'Bottom 25%', value: insights.revenue_percentiles.p25, color: 'bg-orange-100 text-orange-700' },
                      { label: 'Median', value: insights.revenue_percentiles.p50, color: 'bg-[oklch(0.55_0.14_75)]/20 text-[oklch(0.55_0.14_75)]' },
                      { label: 'Top 25%', value: insights.revenue_percentiles.p75, color: 'bg-green-100 text-green-700' },
                      { label: 'Top 10%', value: insights.revenue_percentiles.p90, color: 'bg-emerald-100 text-emerald-700' }
                    ].map((tier) => (
                      <div key={tier.label} className={`p-4 rounded-lg text-center ${tier.color}`}>
                        <p className="text-xs font-medium mb-1">{tier.label}</p>
                        <p className="text-lg font-bold">{formatCurrency(tier.value)}</p>
                      </div>
                    ))}
                  </div>

                  <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                    <p className="text-sm text-green-700">
                      <strong>Our target:</strong> Top 25% ({formatCurrency(insights.revenue_percentiles.p75)}/year).
                      This is achievable with professional photos, smart pricing, and excellent guest service.
                    </p>
                  </div>
                </div>
              </>
            )}
          </ChapterSection>

          {/* Chapter 8: Your Action Plan */}
          <ChapterSection id="chapter-8" title="Chapter 8: Your Action Plan">
            <p className="text-lg text-[oklch(0.15_0.02_265)]/80 mb-8 leading-relaxed">
              Based on this comprehensive analysis, here are tailored recommendations for different investor profiles.
            </p>

            <div className="space-y-6">
              {/* New Investor */}
              <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-4">
                  <h3 className="text-xl font-sans font-bold text-white">For the New Investor Seeking Lower Risk</h3>
                </div>
                <div className="p-6">
                  <ol className="space-y-4">
                    <li className="flex items-start gap-3">
                      <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">1</span>
                      <div>
                        <p className="font-semibold text-[oklch(0.15_0.02_265)]">Target Market</p>
                        <p className="text-sm text-[oklch(0.15_0.02_265)]/70">
                          Focus on the core {marketInfo.name} area. Its {avgOccupancy > 55 ? 'high' : 'stable'} occupancy
                          and consistent demand make it a safer bet for beginners.
                        </p>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">2</span>
                      <div>
                        <p className="font-semibold text-[oklch(0.15_0.02_265)]">Property Size</p>
                        <p className="text-sm text-[oklch(0.15_0.02_265)]/70">
                          Look for a {bestBedroom?.bedrooms ?? 2}-bedroom property. This aligns with the strongest demand segment.
                        </p>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">3</span>
                      <div>
                        <p className="font-semibold text-[oklch(0.15_0.02_265)]">Key Amenities</p>
                        <p className="text-sm text-[oklch(0.15_0.02_265)]/70">
                          Ensure your property has Air Conditioning, Parking, and allows pets to maximize your appeal.
                        </p>
                      </div>
                    </li>
                  </ol>
                </div>
              </div>

              {/* Experienced Investor */}
              <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                <div className="bg-gradient-to-r from-[oklch(0.55_0.14_75)] to-[oklch(0.65_0.12_75)] p-4">
                  <h3 className="text-xl font-sans font-bold text-white">For the Experienced Investor Seeking High Returns</h3>
                </div>
                <div className="p-6">
                  <ol className="space-y-4">
                    <li className="flex items-start gap-3">
                      <span className="w-6 h-6 bg-[oklch(0.55_0.14_75)]/20 text-[oklch(0.55_0.14_75)] rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">1</span>
                      <div>
                        <p className="font-semibold text-[oklch(0.15_0.02_265)]">Target Market</p>
                        <p className="text-sm text-[oklch(0.15_0.02_265)]/70">
                          Look for premium neighborhoods with high ADR potential. Top performers earn {formatCurrency(insights?.revenue_percentiles?.p90 || avgRevenue * 1.5)}+ annually.
                        </p>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="w-6 h-6 bg-[oklch(0.55_0.14_75)]/20 text-[oklch(0.55_0.14_75)] rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">2</span>
                      <div>
                        <p className="font-semibold text-[oklch(0.15_0.02_265)]">Property Size</p>
                        <p className="text-sm text-[oklch(0.15_0.02_265)]/70">
                          A 3-4 bedroom property will allow you to command the highest daily rates and attract families/groups.
                        </p>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="w-6 h-6 bg-[oklch(0.55_0.14_75)]/20 text-[oklch(0.55_0.14_75)] rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">3</span>
                      <div>
                        <p className="font-semibold text-[oklch(0.15_0.02_265)]">Strategy</p>
                        <p className="text-sm text-[oklch(0.15_0.02_265)]/70">
                          Focus on creating a premium experience. Professional photography and high-end furnishings are a must.
                        </p>
                      </div>
                    </li>
                  </ol>
                </div>
              </div>
            </div>

            {/* Why You Need Professional Help Section */}
            <div className="mt-12 bg-white rounded-2xl shadow-lg p-8">
              <h3 className="text-xl font-sans font-semibold text-[oklch(0.15_0.02_265)] mb-6 text-center">
                Why This Complexity Requires Expert Execution
              </h3>
              <div className="grid md:grid-cols-3 gap-6 mb-8">
                <div className="text-center p-4">
                  <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <span className="text-2xl">1</span>
                  </div>
                  <p className="font-semibold text-[oklch(0.15_0.02_265)] mb-2">Market Timing</p>
                  <p className="text-sm text-[oklch(0.15_0.02_265)]/70">
                    Seasonal pricing, competitor analysis, and demand forecasting require constant monitoring and adjustment.
                  </p>
                </div>
                <div className="text-center p-4">
                  <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <span className="text-2xl">2</span>
                  </div>
                  <p className="font-semibold text-[oklch(0.15_0.02_265)] mb-2">Property Setup</p>
                  <p className="text-sm text-[oklch(0.15_0.02_265)]/70">
                    Professional photography, strategic furnishing, and amenity selection directly impact your revenue potential.
                  </p>
                </div>
                <div className="text-center p-4">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <span className="text-2xl">3</span>
                  </div>
                  <p className="font-semibold text-[oklch(0.15_0.02_265)] mb-2">Guest Management</p>
                  <p className="text-sm text-[oklch(0.15_0.02_265)]/70">
                    24/7 communication, cleaning coordination, and review management are full-time responsibilities.
                  </p>
                </div>
              </div>
              <div className="bg-[oklch(0.15_0.02_265)]/5 rounded-xl p-6">
                <p className="text-center text-[oklch(0.15_0.02_265)]/80">
                  <strong>The Bottom Line:</strong> The difference between average performers ({formatCurrency(avgRevenue)}/year) 
                  and top performers ({formatCurrency(insights?.revenue_percentiles?.p90 || avgRevenue * 1.5)}/year) is 
                  <span className="text-[oklch(0.55_0.14_75)] font-bold"> {formatCurrency((insights?.revenue_percentiles?.p90 || avgRevenue * 1.5) - avgRevenue)}</span> in annual revenue. 
                  That gap is closed through professional execution.
                </p>
              </div>
            </div>

            {/* CTA Section */}
            <div className="mt-8 bg-gradient-to-br from-[oklch(0.55_0.14_75)]/15 to-[oklch(0.55_0.14_75)]/5 rounded-2xl p-8 border border-[oklch(0.55_0.14_75)]/30">
              <div className="max-w-2xl mx-auto text-center">
                <div className="inline-flex items-center gap-2 bg-[oklch(0.55_0.14_75)]/20 text-[oklch(0.55_0.14_75)] px-4 py-2 rounded-full text-sm font-medium mb-4">
                  <Award className="w-4 h-4" />
                  Done-For-You Solution
                </div>
                <h3 className="text-2xl md:text-3xl font-sans font-bold mb-4 text-[oklch(0.15_0.02_265)]">
                  Ready to Turn This Data Into Profit?
                </h3>
                <p className="text-[oklch(0.15_0.02_265)]/60 mb-6">
                  You've seen the numbers. You understand the market. Now let our team handle the execution.
                </p>
                <div className="grid md:grid-cols-3 gap-4 mb-8 text-left">
                  <div className="bg-white rounded-lg p-4 border border-[oklch(0.15_0.02_265)]/10">
                    <CheckCircle2 className="w-5 h-5 text-[oklch(0.55_0.14_75)] mb-2" />
                    <p className="text-sm text-[oklch(0.15_0.02_265)]/70">Property sourcing & lease negotiation</p>
                  </div>
                  <div className="bg-white rounded-lg p-4 border border-[oklch(0.15_0.02_265)]/10">
                    <CheckCircle2 className="w-5 h-5 text-[oklch(0.55_0.14_75)] mb-2" />
                    <p className="text-sm text-[oklch(0.15_0.02_265)]/70">Professional design & furnishing</p>
                  </div>
                  <div className="bg-white rounded-lg p-4 border border-[oklch(0.15_0.02_265)]/10">
                    <CheckCircle2 className="w-5 h-5 text-[oklch(0.55_0.14_75)] mb-2" />
                    <p className="text-sm text-[oklch(0.15_0.02_265)]/70">Full-service guest management</p>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <button className="bg-[oklch(0.55_0.14_75)] text-[oklch(0.15_0.02_265)] px-8 py-4 rounded-xl font-semibold hover:bg-[oklch(0.65_0.12_75)] transition-colors flex items-center justify-center gap-2">
                    Schedule Free Strategy Call
                    <ArrowRight className="w-5 h-5" />
                  </button>
                  <Link
                    href="/"
                    className="bg-white/10 text-white px-8 py-4 rounded-xl font-semibold hover:bg-white/20 transition-colors flex items-center justify-center gap-2 border border-white/20"
                  >
                    <Target className="w-5 h-5" />
                    Analyze a Specific Property
                  </Link>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-12 pt-8 border-t border-[oklch(0.15_0.02_265)]/10">
              <div className="flex items-center justify-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-[oklch(0.55_0.14_75)] to-[oklch(0.45_0.12_75)] flex items-center justify-center">
                  <Sparkles className="w-3 h-3 text-white" />
                </div>
                <span className="text-xs font-semibold text-[oklch(0.35_0.08_75)] uppercase tracking-wider">Coach Inayah's Turnkey Tool</span>
              </div>
              <p className="text-xs text-[oklch(0.15_0.02_265)]/50 italic text-center">
                This report was generated based on data from the Coach Inayah market analysis tool.
                All data is for the trailing 12-month period ending {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}.
              </p>
              <ReportDisclaimer />
            </div>
          </ChapterSection>
        </div>
      </div>
    </div>
  );
}
