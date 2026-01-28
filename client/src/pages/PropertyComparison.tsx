/**
 * Property Comparison Tool
 * Compare 2-3 properties side-by-side to help clients make decisions
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Plus,
  X,
  Building,
  MapPin,
  TrendingUp,
  DollarSign,
  Percent,
  Star,
  Users,
  Home,
  Calendar,
  Target,
  Award,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Trophy,
  Sparkles,
  BarChart3,
  Bed,
  Bath
} from 'lucide-react';
import { Link } from 'wouter';
import { AddressAutocomplete } from '@/components/AddressAutocomplete';
import { SmartAddressInput, type PropertyDetails } from '@/components/SmartAddressInput';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';

interface PropertyData {
  address: string;
  bedrooms: number;
  bathrooms: number;
  accommodates: number;
  monthlyRent: number;
  estimates?: {
    annual_revenue: number;
    annual_revenue_low: number;
    annual_revenue_high: number;
    average_daily_rate: number;
    occupancy_rate: number;
  };
  market?: {
    name: string;
    listing_count: number;
  };
  monthly_forecast?: Array<{
    month: string;
    revenue: number;
    occupancy: number;
  }>;
  loading?: boolean;
  error?: string;
}

const emptyProperty: PropertyData = {
  address: '',
  bedrooms: 2,
  bathrooms: 1,
  accommodates: 4,
  monthlyRent: 0
};

export default function PropertyComparison() {
  const [properties, setProperties] = useState<PropertyData[]>([
    { ...emptyProperty },
    { ...emptyProperty }
  ]);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const getPropertyReport = trpc.rental.getPropertyReport.useMutation();

  const updateProperty = (index: number, updates: Partial<PropertyData>) => {
    setProperties(prev => {
      const newProps = [...prev];
      newProps[index] = { ...newProps[index], ...updates };
      return newProps;
    });
  };

  const addProperty = () => {
    if (properties.length < 3) {
      setProperties(prev => [...prev, { ...emptyProperty }]);
    }
  };

  const removeProperty = (index: number) => {
    if (properties.length > 2) {
      setProperties(prev => prev.filter((_, i) => i !== index));
    }
  };

  const analyzeProperty = async (index: number) => {
    const prop = properties[index];
    if (!prop.address || !prop.monthlyRent) return;

    updateProperty(index, { loading: true, error: undefined });

    try {
      const result = await getPropertyReport.mutateAsync({
        address: prop.address,
        bedrooms: prop.bedrooms,
        bathrooms: prop.bathrooms,
        accommodates: prop.accommodates
      });

      if (result.success && result.data) {
        updateProperty(index, {
          loading: false,
          estimates: result.data.property.estimates,
          market: result.data.market ? {
            name: result.data.market.name,
            listing_count: result.data.market.listing_count
          } : undefined,
          monthly_forecast: result.data.property.monthly_forecast
        });
      } else {
        throw new Error(result.error || 'Failed to analyze property');
      }
    } catch (error: any) {
      updateProperty(index, {
        loading: false,
        error: error.message || 'Failed to analyze property'
      });
    }
  };

  const analyzeAll = async () => {
    const validProperties = properties.filter(p => p.address && p.monthlyRent);
    await Promise.all(validProperties.map((_, i) => analyzeProperty(i)));
  };

  const allAnalyzed = properties.every(p => p.estimates || !p.address);
  const hasResults = properties.some(p => p.estimates);

  // Calculate winner for each metric
  const getWinner = (metric: 'revenue' | 'occupancy' | 'adr' | 'profit') => {
    const validProps = properties.filter(p => p.estimates);
    if (validProps.length < 2) return -1;

    let bestIndex = -1;
    let bestValue = -Infinity;

    properties.forEach((prop, index) => {
      if (!prop.estimates) return;
      
      let value = 0;
      switch (metric) {
        case 'revenue':
          value = prop.estimates.annual_revenue;
          break;
        case 'occupancy':
          value = prop.estimates.occupancy_rate;
          break;
        case 'adr':
          value = prop.estimates.average_daily_rate;
          break;
        case 'profit':
          value = prop.estimates.annual_revenue - (prop.monthlyRent * 12 * 1.4); // 1.4x for expenses
          break;
      }

      if (value > bestValue) {
        bestValue = value;
        bestIndex = index;
      }
    });

    return bestIndex;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(value);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#FAF9F6] to-white">
      {/* Header */}
      <div className="bg-[#0F172A] text-white py-6">
        <div className="container max-w-7xl">
          <Link href="/">
            <button className="flex items-center gap-2 text-white/70 hover:text-white transition-colors mb-4">
              <ArrowLeft className="w-4 h-4" />
              Back to Calculator
            </button>
          </Link>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-[#C9A962]/20 rounded-xl">
              <BarChart3 className="w-6 h-6 text-[#C9A962]" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-serif font-bold">Property Comparison Tool</h1>
              <p className="text-white/60">Compare up to 3 properties side-by-side</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container max-w-7xl py-8">
        {/* Property Input Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {properties.map((prop, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`bg-white rounded-2xl shadow-lg border-2 transition-all ${
                prop.estimates 
                  ? 'border-green-500/30' 
                  : activeIndex === index 
                    ? 'border-[#C9A962]' 
                    : 'border-transparent'
              }`}
            >
              {/* Card Header */}
              <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
                    index === 0 ? 'bg-blue-500' : index === 1 ? 'bg-purple-500' : 'bg-orange-500'
                  }`}>
                    {index + 1}
                  </div>
                  <span className="font-medium text-[#0F172A]">Property {index + 1}</span>
                </div>
                {properties.length > 2 && (
                  <button
                    onClick={() => removeProperty(index)}
                    className="p-1 hover:bg-red-50 rounded-full text-red-500 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>

              {/* Card Body */}
              <div className="p-4 space-y-4">
                {/* Address Input */}
                <div>
                  <label className="block text-xs font-medium text-[#0F172A]/60 uppercase tracking-wide mb-1">
                    Property Address or Zillow/Redfin URL
                  </label>
                  <SmartAddressInput
                    value={prop.address}
                    onChange={(value) => updateProperty(index, { address: value })}
                    onPropertyDetected={(details: PropertyDetails) => {
                      const updates: Partial<PropertyData> = { address: details.address };
                      if (details.bedrooms !== null) updates.bedrooms = details.bedrooms;
                      if (details.bathrooms !== null) updates.bathrooms = details.bathrooms;
                      if (details.price !== null && details.priceType === 'rent') {
                        updates.monthlyRent = details.price;
                      }
                      updateProperty(index, updates);
                      setActiveIndex(null);
                      toast.success(`Property details loaded from Zillow!`);
                    }}
                    placeholder="Enter address or paste Zillow/Redfin URL..."
                    showPropertyCard={false}
                  />
                </div>

                {/* Monthly Rent */}
                <div>
                  <label className="block text-xs font-medium text-[#0F172A]/60 uppercase tracking-wide mb-1">
                    Monthly Rent
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#0F172A]/40" />
                    <input
                      type="number"
                      value={prop.monthlyRent || ''}
                      onChange={(e) => updateProperty(index, { monthlyRent: parseInt(e.target.value) || 0 })}
                      placeholder="e.g., 2000"
                      className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#C9A962]/30 focus:border-[#C9A962] transition-all"
                    />
                  </div>
                </div>

                {/* Property Details */}
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-[#0F172A]/60 uppercase tracking-wide mb-1">
                      Beds
                    </label>
                    <select
                      value={prop.bedrooms}
                      onChange={(e) => updateProperty(index, { bedrooms: parseInt(e.target.value) })}
                      className="w-full px-2 py-2 border border-gray-200 rounded-lg text-sm"
                    >
                      {[1, 2, 3, 4, 5, 6].map(n => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#0F172A]/60 uppercase tracking-wide mb-1">
                      Baths
                    </label>
                    <select
                      value={prop.bathrooms}
                      onChange={(e) => updateProperty(index, { bathrooms: parseFloat(e.target.value) })}
                      className="w-full px-2 py-2 border border-gray-200 rounded-lg text-sm"
                    >
                      {[1, 1.5, 2, 2.5, 3, 3.5, 4].map(n => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#0F172A]/60 uppercase tracking-wide mb-1">
                      Guests
                    </label>
                    <select
                      value={prop.accommodates}
                      onChange={(e) => updateProperty(index, { accommodates: parseInt(e.target.value) })}
                      className="w-full px-2 py-2 border border-gray-200 rounded-lg text-sm"
                    >
                      {[2, 4, 6, 8, 10, 12].map(n => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Analyze Button */}
                <button
                  onClick={() => analyzeProperty(index)}
                  disabled={!prop.address || !prop.monthlyRent || prop.loading}
                  className={`w-full py-2.5 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
                    prop.estimates
                      ? 'bg-green-500 text-white'
                      : !prop.address || !prop.monthlyRent
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-[#C9A962] text-white hover:bg-[#B8994F]'
                  }`}
                >
                  {prop.loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Analyzing...
                    </>
                  ) : prop.estimates ? (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Analyzed
                    </>
                  ) : (
                    'Analyze Property'
                  )}
                </button>

                {/* Error Display */}
                {prop.error && (
                  <div className="p-3 bg-red-50 rounded-lg flex items-start gap-2 text-red-600 text-sm">
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    {prop.error}
                  </div>
                )}

                {/* Quick Results Preview */}
                {prop.estimates && (
                  <div className="pt-3 border-t border-gray-100 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-[#0F172A]/60">Est. Revenue</span>
                      <span className="font-semibold text-[#0F172A]">
                        {formatCurrency(prop.estimates.annual_revenue)}/yr
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-[#0F172A]/60">Occupancy</span>
                      <span className="font-semibold text-[#0F172A]">
                        {Math.round(prop.estimates.occupancy_rate * 100)}%
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-[#0F172A]/60">ADR</span>
                      <span className="font-semibold text-[#0F172A]">
                        {formatCurrency(prop.estimates.average_daily_rate)}/night
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          ))}

          {/* Add Property Button */}
          {properties.length < 3 && (
            <motion.button
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={addProperty}
              className="min-h-[300px] border-2 border-dashed border-gray-300 rounded-2xl flex flex-col items-center justify-center gap-3 text-gray-400 hover:border-[#C9A962] hover:text-[#C9A962] transition-all"
            >
              <Plus className="w-10 h-10" />
              <span className="font-medium">Add Property</span>
            </motion.button>
          )}
        </div>

        {/* Compare All Button */}
        {properties.filter(p => p.address && p.monthlyRent).length >= 2 && !hasResults && (
          <div className="text-center mb-8">
            <button
              onClick={analyzeAll}
              className="px-8 py-3 bg-[#0F172A] text-white rounded-xl font-medium hover:bg-[#1E293B] transition-all flex items-center gap-2 mx-auto"
            >
              <Sparkles className="w-5 h-5" />
              Analyze All Properties
            </button>
          </div>
        )}

        {/* Comparison Results */}
        <AnimatePresence>
          {hasResults && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -30 }}
              className="space-y-6"
            >
              {/* Winner Banner */}
              {properties.filter(p => p.estimates).length >= 2 && (
                <div className="bg-gradient-to-r from-[#C9A962] to-[#D4AF37] rounded-2xl p-6 text-white">
                  <div className="flex items-center gap-3 mb-4">
                    <Trophy className="w-8 h-8" />
                    <h2 className="text-xl font-serif font-bold">Comparison Winner</h2>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {['revenue', 'occupancy', 'adr', 'profit'].map((metric) => {
                      const winnerIndex = getWinner(metric as any);
                      return (
                        <div key={metric} className="bg-white/20 rounded-xl p-3">
                          <div className="text-sm text-white/80 capitalize mb-1">
                            Best {metric === 'adr' ? 'ADR' : metric}
                          </div>
                          <div className="font-bold">
                            {winnerIndex >= 0 ? `Property ${winnerIndex + 1}` : 'N/A'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Detailed Comparison Table */}
              <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                <div className="p-4 bg-[#0F172A] text-white">
                  <h3 className="font-serif font-bold text-lg">Detailed Comparison</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="px-4 py-3 text-left text-sm font-medium text-[#0F172A]/60">Metric</th>
                        {properties.map((prop, index) => (
                          <th key={index} className="px-4 py-3 text-center text-sm font-medium text-[#0F172A]">
                            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${
                              index === 0 ? 'bg-blue-100 text-blue-700' : 
                              index === 1 ? 'bg-purple-100 text-purple-700' : 
                              'bg-orange-100 text-orange-700'
                            }`}>
                              Property {index + 1}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {/* Address */}
                      <tr>
                        <td className="px-4 py-3 text-sm text-[#0F172A]/60">
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4" />
                            Address
                          </div>
                        </td>
                        {properties.map((prop, index) => (
                          <td key={index} className="px-4 py-3 text-sm text-center">
                            {prop.address ? (
                              <span className="font-medium">{prop.address.split(',')[0]}</span>
                            ) : (
                              <span className="text-gray-400">Not set</span>
                            )}
                          </td>
                        ))}
                      </tr>

                      {/* Monthly Rent */}
                      <tr className="bg-gray-50/50">
                        <td className="px-4 py-3 text-sm text-[#0F172A]/60">
                          <div className="flex items-center gap-2">
                            <DollarSign className="w-4 h-4" />
                            Monthly Rent
                          </div>
                        </td>
                        {properties.map((prop, index) => (
                          <td key={index} className="px-4 py-3 text-sm text-center font-medium">
                            {prop.monthlyRent ? formatCurrency(prop.monthlyRent) : '-'}
                          </td>
                        ))}
                      </tr>

                      {/* Annual Revenue */}
                      <tr>
                        <td className="px-4 py-3 text-sm text-[#0F172A]/60">
                          <div className="flex items-center gap-2">
                            <TrendingUp className="w-4 h-4" />
                            Est. Annual Revenue
                          </div>
                        </td>
                        {properties.map((prop, index) => {
                          const isWinner = getWinner('revenue') === index;
                          return (
                            <td key={index} className="px-4 py-3 text-center">
                              {prop.estimates ? (
                                <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-full ${
                                  isWinner ? 'bg-green-100 text-green-700 font-bold' : ''
                                }`}>
                                  {isWinner && <Trophy className="w-4 h-4" />}
                                  {formatCurrency(prop.estimates.annual_revenue)}
                                </div>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>

                      {/* Occupancy Rate */}
                      <tr className="bg-gray-50/50">
                        <td className="px-4 py-3 text-sm text-[#0F172A]/60">
                          <div className="flex items-center gap-2">
                            <Percent className="w-4 h-4" />
                            Occupancy Rate
                          </div>
                        </td>
                        {properties.map((prop, index) => {
                          const isWinner = getWinner('occupancy') === index;
                          return (
                            <td key={index} className="px-4 py-3 text-center">
                              {prop.estimates ? (
                                <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-full ${
                                  isWinner ? 'bg-green-100 text-green-700 font-bold' : ''
                                }`}>
                                  {isWinner && <Trophy className="w-4 h-4" />}
                                  {Math.round(prop.estimates.occupancy_rate * 100)}%
                                </div>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>

                      {/* ADR */}
                      <tr>
                        <td className="px-4 py-3 text-sm text-[#0F172A]/60">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            Avg. Daily Rate
                          </div>
                        </td>
                        {properties.map((prop, index) => {
                          const isWinner = getWinner('adr') === index;
                          return (
                            <td key={index} className="px-4 py-3 text-center">
                              {prop.estimates ? (
                                <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-full ${
                                  isWinner ? 'bg-green-100 text-green-700 font-bold' : ''
                                }`}>
                                  {isWinner && <Trophy className="w-4 h-4" />}
                                  {formatCurrency(prop.estimates.average_daily_rate)}/night
                                </div>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>

                      {/* Annual Costs */}
                      <tr className="bg-gray-50/50">
                        <td className="px-4 py-3 text-sm text-[#0F172A]/60">
                          <div className="flex items-center gap-2">
                            <DollarSign className="w-4 h-4" />
                            Est. Annual Costs
                          </div>
                        </td>
                        {properties.map((prop, index) => (
                          <td key={index} className="px-4 py-3 text-sm text-center font-medium text-red-600">
                            {prop.monthlyRent ? formatCurrency(prop.monthlyRent * 12 * 1.4) : '-'}
                          </td>
                        ))}
                      </tr>

                      {/* Estimated Profit */}
                      <tr className="bg-[#0F172A]/5">
                        <td className="px-4 py-4 text-sm font-bold text-[#0F172A]">
                          <div className="flex items-center gap-2">
                            <Target className="w-4 h-4" />
                            Est. Annual Profit
                          </div>
                        </td>
                        {properties.map((prop, index) => {
                          const isWinner = getWinner('profit') === index;
                          const profit = prop.estimates 
                            ? prop.estimates.annual_revenue - (prop.monthlyRent * 12 * 1.4)
                            : null;
                          return (
                            <td key={index} className="px-4 py-4 text-center">
                              {profit !== null ? (
                                <div className={`inline-flex items-center gap-1 px-4 py-2 rounded-full font-bold ${
                                  isWinner 
                                    ? 'bg-green-500 text-white' 
                                    : profit >= 0 
                                      ? 'bg-green-100 text-green-700'
                                      : 'bg-red-100 text-red-700'
                                }`}>
                                  {isWinner && <Trophy className="w-4 h-4" />}
                                  {formatCurrency(profit)}
                                </div>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>

                      {/* 2x Rule Check */}
                      <tr>
                        <td className="px-4 py-3 text-sm text-[#0F172A]/60">
                          <div className="flex items-center gap-2">
                            <Award className="w-4 h-4" />
                            Passes 2x Rule?
                          </div>
                        </td>
                        {properties.map((prop, index) => {
                          const passes = prop.estimates && prop.monthlyRent
                            ? prop.estimates.annual_revenue >= (prop.monthlyRent * 12 * 2)
                            : null;
                          return (
                            <td key={index} className="px-4 py-3 text-center">
                              {passes !== null ? (
                                passes ? (
                                  <span className="inline-flex items-center gap-1 text-green-600 font-medium">
                                    <CheckCircle2 className="w-4 h-4" />
                                    Yes
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-red-600 font-medium">
                                    <AlertCircle className="w-4 h-4" />
                                    No
                                  </span>
                                )
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* CTA Section */}
              <div className="bg-gradient-to-r from-[#0F172A] to-[#1E293B] rounded-2xl p-8 text-white text-center">
                <h3 className="text-2xl font-serif font-bold mb-3">Ready to Move Forward?</h3>
                <p className="text-white/70 mb-6 max-w-2xl mx-auto">
                  Now that you've compared the properties, let our team help you execute on the best opportunity.
                  We handle everything from lease negotiation to guest management.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <a
                    href="https://calendly.com/coachinayah/str-consultation"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-6 py-3 bg-[#C9A962] text-white rounded-xl font-medium hover:bg-[#B8994F] transition-all inline-flex items-center justify-center gap-2"
                  >
                    Schedule Strategy Call
                    <ArrowLeft className="w-4 h-4 rotate-180" />
                  </a>
                  <Link href="/">
                    <button className="px-6 py-3 bg-white/10 text-white rounded-xl font-medium hover:bg-white/20 transition-all">
                      Analyze Another Property
                    </button>
                  </Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
