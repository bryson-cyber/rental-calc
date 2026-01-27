/**
 * SharedMarketReport Component
 * Displays shared Step 1 market analysis data
 */

import { ArrowLeft, TrendingUp, DollarSign, Percent, Building, Star, Calendar } from 'lucide-react';
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

interface Seasonality {
  peak_months?: string[];
  low_months?: string[];
  seasonal_variance?: number;
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
    seasonality?: Seasonality;
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

export function SharedMarketReport({ data, onBack }: SharedMarketReportProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#faf9f7] to-[#f5f3f0]">
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
            <div className="w-20" /> {/* Spacer for centering */}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Market Overview */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-500" />
            Market Overview
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-50 rounded-xl p-4 text-center">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Avg Revenue/yr</p>
              <p className="text-2xl font-bold text-emerald-600">{formatCurrency(data.avgRevenue)}</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-4 text-center">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Avg Nightly Rate</p>
              <p className="text-2xl font-bold text-slate-900">{formatCurrency(data.avgAdr)}</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-4 text-center">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Occupancy</p>
              <p className="text-2xl font-bold text-slate-900">{formatPercent(data.avgOccupancy)}</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-4 text-center">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Active Listings</p>
              <p className="text-2xl font-bold text-slate-900">{data.totalListings.toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* Revenue by Property Type */}
        {data.propertyTypes && data.propertyTypes.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Building className="w-5 h-5 text-blue-500" />
              Revenue by Property Type
            </h2>
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
          </div>
        )}

        {/* Market Scores */}
        {data.marketScores && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Star className="w-5 h-5 text-amber-500" />
              Market Scores
            </h2>
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
            <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-500" />
              What Hosts Actually Earn
            </h2>
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
            <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Percent className="w-5 h-5 text-purple-500" />
              Your Competition
            </h2>
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
            <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-500" />
              Booking Patterns
            </h2>
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

        {/* Seasonality */}
        {data.seasonality && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Busy vs Slow Months</h2>
            <div className="grid grid-cols-2 gap-4">
              {data.seasonality.peak_months && data.seasonality.peak_months.length > 0 && (
                <div className="bg-emerald-50 rounded-xl p-4">
                  <p className="text-xs text-emerald-600 font-medium mb-2">Busiest Months</p>
                  <p className="text-slate-900 font-semibold">{data.seasonality.peak_months.join(', ')}</p>
                </div>
              )}
              {data.seasonality.low_months && data.seasonality.low_months.length > 0 && (
                <div className="bg-amber-50 rounded-xl p-4">
                  <p className="text-xs text-amber-600 font-medium mb-2">Slowest Months</p>
                  <p className="text-slate-900 font-semibold">{data.seasonality.low_months.join(', ')}</p>
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
