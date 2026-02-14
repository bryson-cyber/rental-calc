/**
 * SharedMarketReport Component
 * Displays shared Step 1 market analysis data - Full report matching Step 1 experience
 */

import { ArrowLeft, TrendingUp, DollarSign, Percent, Building, Star, Calendar, Home, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PropertyType {
  type: string;
  count: number;
  avgRevenue: number;
  occupancy: number;
}

interface MarketScores {
  investability?: number;
  rental_demand?: number;
  revenue_growth?: number;
  seasonality?: number;
  regulation_risk?: number;
  overall?: number;
}

interface RevenuePercentiles {
  p25?: number;
  p50?: number;
  p75?: number;
  p90?: number;
}

interface BookingPatterns {
  avgBookingWindow?: number;
  avgLengthOfStay?: number;
  instantBookPct?: number;
}

interface CompetitionData {
  superhostPct?: number;
  professionalPct?: number;
  avgReviews?: number;
  avgRating?: number;
}

interface SeasonalityMonth {
  month: string;
  occupancy: number;
  adr: number;
  revenue: number;
}

interface Seasonality {
  peak_months?: string[];
  low_months?: string[];
  seasonal_variance?: number;
  peakMonths?: string[];
  lowMonths?: string[];
  monthlyData?: SeasonalityMonth[];
}

interface SharedMarketReportProps {
  data: {
    marketName: string;
    avgRevenue: number;
    avgOccupancy: number;
    avgAdr: number;
    totalListings: number;
    propertyTypes?: PropertyType[];
    marketScores?: MarketScores;
    revenuePercentiles?: RevenuePercentiles;
    bookingPatterns?: BookingPatterns;
    competitionData?: CompetitionData;
    seasonality?: Seasonality | SeasonalityMonth[];
  };
  onBack: () => void;
}

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

const formatMonth = (dateStr: string) => {
  if (!dateStr) return '';
  if (dateStr.includes('-')) {
    const [year, month] = dateStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('en-US', { month: 'short' });
  }
  return dateStr.substring(0, 3);
};

export function SharedMarketReport({ data, onBack }: SharedMarketReportProps) {
  // Process seasonality data
  let monthlyData: SeasonalityMonth[] = [];
  let peakMonths: string[] = [];
  let lowMonths: string[] = [];
  
  if (data.seasonality) {
    if (Array.isArray(data.seasonality)) {
      monthlyData = data.seasonality;
      if (monthlyData.length > 0) {
        const sortedByOccupancy = [...monthlyData].sort((a, b) => b.occupancy - a.occupancy);
        peakMonths = sortedByOccupancy.slice(0, 3).map(m => m.month);
        lowMonths = sortedByOccupancy.slice(-3).map(m => m.month);
      }
    } else {
      peakMonths = data.seasonality.peak_months || data.seasonality.peakMonths || [];
      lowMonths = data.seasonality.low_months || data.seasonality.lowMonths || [];
      monthlyData = data.seasonality.monthlyData || [];
    }
  }
  
  // Calculate averages for charts
  const avgOccupancy = monthlyData.length > 0 
    ? monthlyData.reduce((sum, m) => sum + m.occupancy, 0) / monthlyData.length 
    : data.avgOccupancy;
  const avgAdr = monthlyData.length > 0 
    ? monthlyData.reduce((sum, m) => sum + m.adr, 0) / monthlyData.length 
    : data.avgAdr;
  const maxAdr = monthlyData.length > 0 ? Math.max(...monthlyData.map(m => m.adr)) : data.avgAdr;
  const minAdr = monthlyData.length > 0 ? Math.min(...monthlyData.map(m => m.adr)) : data.avgAdr;
  
  // Property type insights
  const typesWithData = data.propertyTypes?.filter(t => t.count > 0) || [];
  const highestRevenue = typesWithData.length > 0 
    ? typesWithData.reduce((max, t) => t.avgRevenue > max.avgRevenue ? t : max, typesWithData[0])
    : null;
  const highestOccupancy = typesWithData.length > 0 
    ? typesWithData.reduce((max, t) => (t.occupancy || 0) > (max.occupancy || 0) ? t : max, typesWithData[0])
    : null;
  const mostCommon = typesWithData.length > 0 
    ? typesWithData.reduce((max, t) => t.count > max.count ? t : max, typesWithData[0])
    : null;
  const totalListingsFromBreakdown = typesWithData.reduce((sum, t) => sum + t.count, 0);

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={onBack} className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
            <div className="text-center">
              <h1 className="text-xl font-bold text-slate-900">{data.marketName}</h1>
              <p className="text-sm text-slate-500">Market Analysis Report</p>
            </div>
            <div className="w-20" />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Hero Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-600 text-sm font-medium mb-4">
            <CheckCircle2 className="w-4 h-4" />
            Market Validated
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2">
            {data.marketName} is Profitable
          </h2>
          <p className="text-slate-500">
            Avg revenue data from active Airbnb hosts in this market
          </p>
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
            <div className="inline-flex p-2 rounded-lg mb-2 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
              <DollarSign className="w-5 h-5" />
            </div>
            <p className="text-slate-500 text-xs font-medium">Avg Annual Revenue</p>
            <p className="text-xl font-bold text-slate-900">{formatCurrency(data.avgRevenue)}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
            <div className="inline-flex p-2 rounded-lg mb-2 bg-blue-500/10 text-blue-500 border border-blue-500/20">
              <Calendar className="w-5 h-5" />
            </div>
            <p className="text-slate-500 text-xs font-medium">Avg Nightly Rate</p>
            <p className="text-xl font-bold text-slate-900">{formatCurrency(data.avgAdr)}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
            <div className="inline-flex p-2 rounded-lg mb-2 bg-purple-500/10 text-purple-500 border border-purple-500/20">
              <Percent className="w-5 h-5" />
            </div>
            <p className="text-slate-500 text-xs font-medium">Avg Occupancy</p>
            <p className="text-xl font-bold text-slate-900">{Math.round(data.avgOccupancy)}%</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
            <div className="inline-flex p-2 rounded-lg mb-2 bg-amber-500/10 text-amber-500 border border-amber-500/20">
              <Home className="w-5 h-5" />
            </div>
            <p className="text-slate-500 text-xs font-medium">Active Listings</p>
            <p className="text-xl font-bold text-slate-900">{data.totalListings.toLocaleString()}</p>
          </div>
        </div>

        {/* Revenue by Property Type */}
        {data.propertyTypes && data.propertyTypes.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-2 flex items-center gap-2">
              <Building className="w-5 h-5 text-blue-500" />
              Which Property Types Earn the Most?
            </h3>
            <p className="text-slate-500 text-sm mb-4">Compare revenue and occupancy by bedroom count</p>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {data.propertyTypes.map((type, idx) => (
                <div 
                  key={idx} 
                  className={`p-4 rounded-xl border transition-all ${
                    type.count > 0 
                      ? 'bg-slate-50 border-slate-200' 
                      : 'bg-slate-50/50 border-dashed border-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${
                      type.count > 0 ? 'bg-blue-500/10 text-blue-600' : 'bg-slate-200 text-slate-400'
                    }`}>
                      {type.type === 'Studio' ? 'S' : type.type.split(' ')[0]}
                    </div>
                    <p className={`font-semibold text-sm ${type.count > 0 ? 'text-slate-900' : 'text-slate-400'}`}>
                      {type.type}
                    </p>
                  </div>
                  {type.count > 0 ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-slate-500">Revenue/yr</p>
                        <p className="text-emerald-600 font-bold text-sm">{formatCurrency(type.avgRevenue)}</p>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-slate-500">Occupancy</p>
                        <p className="text-slate-900 font-semibold text-sm">{type.occupancy}%</p>
                      </div>
                      <p className="text-xs text-slate-400">{type.count} listings</p>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">Limited data available</p>
                  )}
                </div>
              ))}
            </div>
            
            {/* Data-Driven Insight Summary */}
            {highestRevenue && highestOccupancy && mostCommon && (
              <div className="mt-6 p-4 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                    <TrendingUp className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="flex-1">
                    <h5 className="font-semibold text-slate-900 mb-2">What This Data Shows</h5>
                    <div className="space-y-2 text-sm text-slate-700">
                      <p>
                        <span className="font-medium text-emerald-700">Highest Revenue:</span> {highestRevenue.type} properties average <span className="font-bold text-emerald-600">{formatCurrency(highestRevenue.avgRevenue)}/year</span>
                      </p>
                      <p>
                        <span className="font-medium text-blue-700">Highest Demand:</span> {highestOccupancy.type} properties have <span className="font-bold text-blue-600">{highestOccupancy.occupancy}% occupancy</span>
                      </p>
                      <p>
                        <span className="font-medium text-purple-700">Most Common:</span> {mostCommon.type} has <span className="font-bold text-purple-600">{mostCommon.count} active listings</span> ({Math.round(mostCommon.count / totalListingsFromBreakdown * 100)}% of market)
                      </p>
                    </div>
                    <p className="mt-3 text-xs text-slate-500 italic">
                      Based on {totalListingsFromBreakdown.toLocaleString()} active short-term rentals in this market
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Monthly Earnings Pattern */}
        {monthlyData.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Monthly Earnings Pattern</h3>
                <p className="text-slate-500 text-sm">See which months earn the most (and least) in this market</p>
              </div>
              <span className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded">12-month avg</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Occupancy Chart */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm text-slate-500">How Often It's Booked Each Month</p>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-0.5 bg-amber-500"></div>
                    <span className="text-xs text-amber-600 font-medium">Avg: {Math.round(avgOccupancy)}%</span>
                  </div>
                </div>
                <div className="space-y-2">
                  {monthlyData.map((month, idx) => {
                    const isAboveAvg = month.occupancy >= avgOccupancy;
                    return (
                      <div key={idx} className="flex items-center gap-3">
                        <span className="text-xs text-slate-500 w-12">{formatMonth(month.month)}</span>
                        <div className="flex-1 bg-slate-100 rounded-full h-5 overflow-hidden relative">
                          <div 
                            className="absolute top-0 bottom-0 w-0.5 bg-amber-500 z-10"
                            style={{left: `${avgOccupancy}%`}}
                          />
                          <div 
                            className={`h-full transition-all ${isAboveAvg ? 'bg-gradient-to-r from-emerald-400 to-teal-400' : 'bg-gradient-to-r from-amber-300 to-amber-400'}`}
                            style={{width: `${month.occupancy}%`}}
                          />
                        </div>
                        <span className={`text-xs font-semibold w-10 text-right ${isAboveAvg ? 'text-emerald-600' : 'text-amber-600'}`}>{Math.round(month.occupancy)}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              
              {/* Nightly Rate Chart */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm text-slate-500">Nightly Rate Each Month</p>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-0.5 bg-blue-500"></div>
                    <span className="text-xs text-blue-600 font-medium">Avg: {formatCurrency(avgAdr)}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  {monthlyData.map((month, idx) => {
                    const isAboveAvg = month.adr >= avgAdr;
                    const adrRange = maxAdr - minAdr || 1;
                    const normalizedAdr = ((month.adr - minAdr) / adrRange) * 60 + 40;
                    return (
                      <div key={idx} className="flex items-center gap-3">
                        <span className="text-xs text-slate-500 w-12">{formatMonth(month.month)}</span>
                        <div className="flex-1 bg-slate-100 rounded-full h-5 overflow-hidden">
                          <div 
                            className={`h-full transition-all ${isAboveAvg ? 'bg-gradient-to-r from-blue-400 to-indigo-400' : 'bg-gradient-to-r from-slate-300 to-slate-400'}`}
                            style={{width: `${normalizedAdr}%`}}
                          />
                        </div>
                        <span className={`text-xs font-semibold w-14 text-right ${isAboveAvg ? 'text-blue-600' : 'text-slate-500'}`}>{formatCurrency(month.adr)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            
            {/* Peak and Low months summary */}
            {(peakMonths.length > 0 || lowMonths.length > 0) && (
              <div className="grid grid-cols-2 gap-4 mt-6">
                {peakMonths.length > 0 && (
                  <div className="bg-emerald-50 rounded-xl p-4">
                    <p className="text-xs text-emerald-600 font-medium mb-2">Busiest Months</p>
                    <p className="text-slate-900 font-semibold">{peakMonths.map(formatMonth).join(', ')}</p>
                  </div>
                )}
                {lowMonths.length > 0 && (
                  <div className="bg-amber-50 rounded-xl p-4">
                    <p className="text-xs text-amber-600 font-medium mb-2">Slowest Months</p>
                    <p className="text-slate-900 font-semibold">{lowMonths.map(formatMonth).join(', ')}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Market Scores */}
        {data.marketScores && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Star className="w-5 h-5 text-amber-500" />
              Market Scores
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {data.marketScores.investability !== undefined && (
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-xs text-slate-500 mb-1">Investability</p>
                  <p className="text-xl font-bold text-slate-900">{data.marketScores.investability}/100</p>
                </div>
              )}
              {data.marketScores.rental_demand !== undefined && (
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-xs text-slate-500 mb-1">Rental Demand</p>
                  <p className="text-xl font-bold text-slate-900">{data.marketScores.rental_demand}/100</p>
                </div>
              )}
              {data.marketScores.revenue_growth !== undefined && (
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-xs text-slate-500 mb-1">Revenue Growth</p>
                  <p className="text-xl font-bold text-slate-900">{data.marketScores.revenue_growth}/100</p>
                </div>
              )}
              {data.marketScores.seasonality !== undefined && (
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-xs text-slate-500 mb-1">Income Stability</p>
                  <p className="text-xl font-bold text-slate-900">{data.marketScores.seasonality}/100</p>
                </div>
              )}
              {data.marketScores.regulation_risk !== undefined && (
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-xs text-slate-500 mb-1">Local Rules Risk</p>
                  <p className="text-xl font-bold text-slate-900">{data.marketScores.regulation_risk}/100</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Revenue Percentiles */}
        {data.revenuePercentiles && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-500" />
              What Hosts Actually Earn
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {data.revenuePercentiles.p25 !== undefined && (
                <div className="bg-slate-50 rounded-xl p-4 text-center">
                  <p className="text-xs text-slate-500 mb-1">Bottom 25%</p>
                  <p className="text-lg font-bold text-slate-900">{formatCurrency(data.revenuePercentiles.p25)}</p>
                </div>
              )}
              {data.revenuePercentiles.p50 !== undefined && (
                <div className="bg-slate-50 rounded-xl p-4 text-center">
                  <p className="text-xs text-slate-500 mb-1">Typical Host</p>
                  <p className="text-lg font-bold text-slate-900">{formatCurrency(data.revenuePercentiles.p50)}</p>
                </div>
              )}
              {data.revenuePercentiles.p75 !== undefined && (
                <div className="bg-slate-50 rounded-xl p-4 text-center">
                  <p className="text-xs text-slate-500 mb-1">Top 25%</p>
                  <p className="text-lg font-bold text-slate-900">{formatCurrency(data.revenuePercentiles.p75)}</p>
                </div>
              )}
              {data.revenuePercentiles.p90 !== undefined && (
                <div className="bg-slate-50 rounded-xl p-4 text-center">
                  <p className="text-xs text-slate-500 mb-1">Top 10%</p>
                  <p className="text-lg font-bold text-emerald-600">{formatCurrency(data.revenuePercentiles.p90)}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Competition Data */}
        {data.competitionData && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Percent className="w-5 h-5 text-purple-500" />
              Your Competition
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {data.competitionData.superhostPct !== undefined && (
                <div className="bg-slate-50 rounded-xl p-4 text-center">
                  <p className="text-xs text-slate-500 mb-1">Top-Rated Hosts</p>
                  <p className="text-xl font-bold text-slate-900">{formatPercent(data.competitionData.superhostPct)}</p>
                </div>
              )}
              {data.competitionData.professionalPct !== undefined && (
                <div className="bg-slate-50 rounded-xl p-4 text-center">
                  <p className="text-xs text-slate-500 mb-1">Property Managers</p>
                  <p className="text-xl font-bold text-slate-900">{formatPercent(data.competitionData.professionalPct)}</p>
                </div>
              )}
              {data.competitionData.avgRating !== undefined && (
                <div className="bg-slate-50 rounded-xl p-4 text-center">
                  <p className="text-xs text-slate-500 mb-1">Avg Rating</p>
                  <p className="text-xl font-bold text-slate-900">{data.competitionData.avgRating.toFixed(1)}</p>
                </div>
              )}
              {data.competitionData.avgReviews !== undefined && (
                <div className="bg-slate-50 rounded-xl p-4 text-center">
                  <p className="text-xs text-slate-500 mb-1">Avg Reviews</p>
                  <p className="text-xl font-bold text-slate-900">{Math.round(data.competitionData.avgReviews)}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Booking Patterns */}
        {data.bookingPatterns && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-500" />
              Booking Patterns
            </h3>
            <div className="grid grid-cols-3 gap-4">
              {data.bookingPatterns.avgBookingWindow !== undefined && (
                <div className="bg-slate-50 rounded-xl p-4 text-center">
                  <p className="text-xs text-slate-500 mb-1">Avg Booking Window</p>
                  <p className="text-xl font-bold text-slate-900">{data.bookingPatterns.avgBookingWindow} days</p>
                </div>
              )}
              {data.bookingPatterns.avgLengthOfStay !== undefined && (
                <div className="bg-slate-50 rounded-xl p-4 text-center">
                  <p className="text-xs text-slate-500 mb-1">Avg Length of Stay</p>
                  <p className="text-xl font-bold text-slate-900">{data.bookingPatterns.avgLengthOfStay} nights</p>
                </div>
              )}
              {data.bookingPatterns.instantBookPct !== undefined && (
                <div className="bg-slate-50 rounded-xl p-4 text-center">
                  <p className="text-xs text-slate-500 mb-1">Instant Book</p>
                  <p className="text-xl font-bold text-slate-900">{formatPercent(data.bookingPatterns.instantBookPct)}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center py-8 border-t border-slate-200 mt-8">
          <p className="text-sm text-slate-500">
            Powered by <span className="text-amber-600 font-semibold">Coach Inayah's Turnkey Program</span>
          </p>
        </div>
      </div>
    </div>
  );
}
