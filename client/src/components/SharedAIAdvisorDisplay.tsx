/**
 * SharedAIAdvisorDisplay — Read-only version of AIAdvisorStep's result UI.
 * Renders the exact same amber card + LightMarkdown design.
 * Used by ShareableReportViewer for 'ai_advisor' report types.
 */

import { motion } from 'framer-motion';
import {
  Sparkles,
  Building2,
  CheckCircle2,
  DollarSign,
  TrendingUp,
  Percent,
  Calendar,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LightMarkdown } from '@/components/LightMarkdown';

interface SharedAIAdvisorDisplayProps {
  data: {
    advice: string;
    revenue?: {
      projected?: number;
      low?: number;
      high?: number;
      adr?: number;
      occupancy?: number;
      revpar?: number;
    };
    cashFlow?: {
      monthlyRevenue?: number;
      monthlyRent?: number;
      monthlyProfit?: number;
      annualProfit?: number;
      profitMargin?: number;
      breakEvenOccupancy?: number;
    };
    marketInsights?: any;
    property?: {
      address?: string;
      city?: string;
      state?: string;
      bedrooms?: number;
      bathrooms?: number;
    };
    comparables?: any[];
  };
  address?: string;
  bedrooms?: number;
  bathrooms?: number;
}

export function SharedAIAdvisorDisplay({ data, address, bedrooms, bathrooms }: SharedAIAdvisorDisplayProps) {
  const propertyAddress = address || data.property?.address || 'Property';
  const br = bedrooms || data.property?.bedrooms;
  const ba = bathrooms || data.property?.bathrooms;

  const formatCurrency = (value: number | undefined | null) => {
    if (!value) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="space-y-6">
      {/* Header — same as AIAdvisorStep */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-amber-100 to-amber-200 rounded-2xl mb-4">
          <Sparkles className="w-8 h-8 text-amber-600" />
        </div>
        <h2 className="text-3xl font-bold text-slate-900">AI Property Advisor</h2>
        <p className="text-slate-600 max-w-2xl mx-auto">
          AI-powered analysis of {propertyAddress}
        </p>
      </div>

      {/* Revenue & Cash Flow Summary Cards */}
      {(data.revenue || data.cashFlow) && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {data.revenue?.projected && (
            <div className="bg-gradient-to-br from-amber-50 to-white rounded-xl p-4 border border-amber-100 shadow-sm">
              <DollarSign className="w-5 h-5 text-amber-500 mb-2" />
              <p className="text-xl font-bold text-gray-900">{formatCurrency(data.revenue.projected)}</p>
              <p className="text-xs text-gray-500">Annual Revenue</p>
            </div>
          )}
          {data.revenue?.adr && (
            <div className="bg-gradient-to-br from-amber-50 to-white rounded-xl p-4 border border-amber-100 shadow-sm">
              <TrendingUp className="w-5 h-5 text-amber-500 mb-2" />
              <p className="text-xl font-bold text-gray-900">{formatCurrency(data.revenue.adr)}</p>
              <p className="text-xs text-gray-500">Avg Daily Rate</p>
            </div>
          )}
          {data.revenue?.occupancy != null && (
            <div className="bg-gradient-to-br from-amber-50 to-white rounded-xl p-4 border border-amber-100 shadow-sm">
              <Calendar className="w-5 h-5 text-amber-500 mb-2" />
              <p className="text-xl font-bold text-gray-900">
                {data.revenue.occupancy > 1 ? `${Math.round(data.revenue.occupancy)}%` : `${Math.round(data.revenue.occupancy * 100)}%`}
              </p>
              <p className="text-xs text-gray-500">Occupancy Rate</p>
            </div>
          )}
          {data.cashFlow?.monthlyProfit != null && (
            <div className={`rounded-xl p-4 border shadow-sm ${
              data.cashFlow.monthlyProfit >= 0
                ? 'bg-gradient-to-br from-emerald-50 to-white border-emerald-100'
                : 'bg-gradient-to-br from-red-50 to-white border-red-100'
            }`}>
              <Percent className="w-5 h-5 text-amber-500 mb-2" />
              <p className={`text-xl font-bold ${data.cashFlow.monthlyProfit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                {formatCurrency(data.cashFlow.monthlyProfit)}/mo
              </p>
              <p className="text-xs text-gray-500">Cash Flow</p>
            </div>
          )}
        </div>
      )}

      {/* Property Analysis Card — same as AIAdvisorStep */}
      <Card className="border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-white">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Building2 className="w-5 h-5 text-amber-600" />
                Property Analysis
              </CardTitle>
              <CardDescription className="mt-1">
                Comprehensive analysis of {propertyAddress}
              </CardDescription>
            </div>
            {br && ba && (
              <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-300">
                {br} BR / {ba} BA
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Analysis Result */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="w-5 h-5" />
              <span className="font-medium">Analysis Complete</span>
            </div>

            <div className="prose prose-slate max-w-none bg-white rounded-lg border border-slate-200 p-6">
              <LightMarkdown>{data.advice}</LightMarkdown>
            </div>
          </motion.div>
        </CardContent>
      </Card>
    </div>
  );
}
