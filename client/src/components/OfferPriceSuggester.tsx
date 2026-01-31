/**
 * Offer Price Suggester
 * 
 * Data-driven offer recommendations based on target returns.
 * Shows a range, not a single number, to give flexibility.
 * 
 * Uses Coach Inayah branding (gold/navy) with clear explainers.
 */
import { useMemo } from 'react';
import { Lightbulb, TrendingDown, TrendingUp, Target, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface OfferPriceSuggesterProps {
  listingPrice: number;
  projectedAnnualRevenue: number;
  downPaymentPercent?: number;
  interestRate?: number;
  loanType?: 'conventional' | 'dscr' | 'fha' | 'cash';
  daysOnMarket?: number;
  priceReduced?: boolean;
}

export default function OfferPriceSuggester({
  listingPrice,
  projectedAnnualRevenue,
  downPaymentPercent = 20,
  interestRate = 7,
  loanType = 'conventional',
  daysOnMarket,
  priceReduced = false,
}: OfferPriceSuggesterProps) {
  
  const suggestions = useMemo(() => {
    if (!listingPrice || !projectedAnnualRevenue) return null;

    // Calculate max price for different CoC targets
    const calculateMaxPrice = (targetCoC: number) => {
      const managementRate = 0.20;
      const maintenanceRate = 0.05;
      const utilitiesAnnual = 2400;
      const propertyTaxRate = 0.012;
      const insuranceRate = 0.005;
      const closingCostRate = loanType === 'cash' ? 0.015 : 0.03;
      const startupCosts = 15000;
      const effectiveMortgageRate = loanType === 'cash' ? 0 : 0.07;

      const A = projectedAnnualRevenue * (1 - managementRate - maintenanceRate) - utilitiesAnnual;
      const B = propertyTaxRate + insuranceRate + (1 - downPaymentPercent/100) * effectiveMortgageRate;
      const C = downPaymentPercent/100 + closingCostRate;
      const D = startupCosts;
      const T = targetCoC / 100;

      return (A - T * D) / (T * C + B);
    };

    // Calculate CoC at a given price
    const calculateCoC = (price: number) => {
      const managementRate = 0.20;
      const maintenanceRate = 0.05;
      const utilitiesAnnual = 2400;
      const propertyTaxRate = 0.012;
      const insuranceRate = 0.005;
      const closingCostRate = loanType === 'cash' ? 0.015 : 0.03;
      const startupCosts = 15000;

      const downPayment = price * (downPaymentPercent / 100);
      const closingCosts = price * closingCostRate;
      const totalCash = downPayment + closingCosts + startupCosts;

      const loanAmount = price * (1 - downPaymentPercent / 100);
      const monthlyRate = interestRate / 100 / 12;
      const numPayments = 360;
      const monthlyMortgage = loanType === 'cash' ? 0 :
        loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1);
      const annualMortgage = monthlyMortgage * 12;

      const operatingExpenses =
        projectedAnnualRevenue * (managementRate + maintenanceRate) +
        utilitiesAnnual +
        price * (propertyTaxRate + insuranceRate);

      const annualCashFlow = projectedAnnualRevenue - operatingExpenses - annualMortgage;
      return (annualCashFlow / totalCash) * 100;
    };

    // Calculate offer ranges for different strategies
    const conservativePrice = calculateMaxPrice(15); // 15% CoC target
    const balancedPrice = calculateMaxPrice(12); // 12% CoC target
    const aggressivePrice = calculateMaxPrice(10); // 10% CoC target

    const listingCoC = calculateCoC(listingPrice);

    // Determine negotiation leverage
    let leverage = 'neutral';
    let leverageScore = 50;
    
    if (daysOnMarket !== undefined) {
      if (daysOnMarket > 90) {
        leverage = 'strong';
        leverageScore += 20;
      } else if (daysOnMarket > 60) {
        leverage = 'moderate';
        leverageScore += 10;
      } else if (daysOnMarket < 14) {
        leverage = 'weak';
        leverageScore -= 15;
      }
    }
    
    if (priceReduced) {
      leverageScore += 15;
      if (leverage === 'neutral') leverage = 'moderate';
    }

    // Determine recommendation
    let recommendation: 'strong_buy' | 'consider' | 'negotiate' | 'pass';
    let recommendationText: string;
    
    if (listingCoC >= 15) {
      recommendation = 'strong_buy';
      recommendationText = 'Excellent deal at listing price! Consider offering quickly.';
    } else if (listingCoC >= 12) {
      recommendation = 'consider';
      recommendationText = 'Good deal at listing price. Room for slight negotiation.';
    } else if (listingCoC >= 8) {
      recommendation = 'negotiate';
      recommendationText = 'Decent potential. Negotiate to improve returns.';
    } else {
      recommendation = 'pass';
      recommendationText = 'Returns too low at this price. Significant discount needed.';
    }

    return {
      listingCoC: listingCoC.toFixed(1),
      conservativeOffer: Math.round(conservativePrice),
      balancedOffer: Math.round(balancedPrice),
      aggressiveOffer: Math.round(aggressivePrice),
      leverage,
      leverageScore,
      recommendation,
      recommendationText,
      discountFromListing: {
        conservative: ((listingPrice - conservativePrice) / listingPrice * 100).toFixed(1),
        balanced: ((listingPrice - balancedPrice) / listingPrice * 100).toFixed(1),
        aggressive: ((listingPrice - aggressivePrice) / listingPrice * 100).toFixed(1),
      }
    };
  }, [listingPrice, projectedAnnualRevenue, downPaymentPercent, interestRate, loanType, daysOnMarket, priceReduced]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  if (!suggestions) return null;

  const recommendationColors = {
    strong_buy: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', icon: CheckCircle2 },
    consider: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', icon: CheckCircle2 },
    negotiate: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', icon: AlertCircle },
    pass: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', icon: AlertCircle },
  };

  const recStyle = recommendationColors[suggestions.recommendation];
  const RecIcon = recStyle.icon;

  return (
    <Card className="border-2 border-[#C9A962]/30 bg-gradient-to-br from-white to-[#C9A962]/5">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-3 text-[#0F172A]">
          <div className="p-2 rounded-lg bg-[#C9A962]/20">
            <Lightbulb className="w-5 h-5 text-[#C9A962]" />
          </div>
          <div>
            <span className="text-lg font-semibold">Offer Price Suggester</span>
            <p className="text-sm font-normal text-slate-500 mt-0.5">
              Data-driven offer recommendations based on your target returns
            </p>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Quick Assessment */}
        <div className={`rounded-xl p-4 border ${recStyle.bg} ${recStyle.border}`}>
          <div className="flex items-start gap-3">
            <RecIcon className={`w-5 h-5 mt-0.5 ${recStyle.text}`} />
            <div>
              <p className={`font-semibold ${recStyle.text}`}>
                {suggestions.recommendation === 'strong_buy' && 'Strong Buy Signal'}
                {suggestions.recommendation === 'consider' && 'Worth Considering'}
                {suggestions.recommendation === 'negotiate' && 'Negotiate Down'}
                {suggestions.recommendation === 'pass' && 'Consider Passing'}
              </p>
              <p className="text-sm text-slate-600 mt-1">{suggestions.recommendationText}</p>
              <p className="text-xs text-slate-500 mt-2">
                At listing price ({formatCurrency(listingPrice)}), your Cash-on-Cash return would be <strong>{suggestions.listingCoC}%</strong>
              </p>
            </div>
          </div>
        </div>

        {/* Offer Strategies */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <Target className="w-4 h-4 text-[#C9A962]" />
            Suggested Offer Ranges
          </h4>
          
          <div className="grid gap-3">
            {/* Conservative */}
            <div className="bg-white rounded-lg p-4 border border-slate-200 hover:border-[#C9A962]/50 transition-colors">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-600">Conservative</span>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">15% CoC</span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-sm">Target 15% Cash-on-Cash return for maximum safety margin</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">Best for risk-averse investors</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-[#0F172A]">{formatCurrency(suggestions.conservativeOffer)}</p>
                  <p className="text-xs text-red-500 flex items-center gap-1 justify-end">
                    <TrendingDown className="w-3 h-3" />
                    {suggestions.discountFromListing.conservative}% below listing
                  </p>
                </div>
              </div>
            </div>

            {/* Balanced - Highlighted */}
            <div className="bg-gradient-to-r from-[#0F172A] to-[#1e293b] rounded-lg p-4 border-2 border-[#C9A962]">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">Balanced</span>
                    <span className="text-xs bg-[#C9A962] text-[#0F172A] px-2 py-0.5 rounded-full font-semibold">RECOMMENDED</span>
                  </div>
                  <p className="text-xs text-white/60 mt-1">12% CoC target • Good risk/reward balance</p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-[#C9A962]">{formatCurrency(suggestions.balancedOffer)}</p>
                  <p className="text-xs text-white/60 flex items-center gap-1 justify-end">
                    <TrendingDown className="w-3 h-3" />
                    {suggestions.discountFromListing.balanced}% below listing
                  </p>
                </div>
              </div>
            </div>

            {/* Aggressive */}
            <div className="bg-white rounded-lg p-4 border border-slate-200 hover:border-[#C9A962]/50 transition-colors">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-600">Aggressive</span>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">10% CoC</span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-sm">Target 10% Cash-on-Cash return - higher risk, more competitive</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">For competitive markets or appreciation plays</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-[#0F172A]">{formatCurrency(suggestions.aggressiveOffer)}</p>
                  <p className="text-xs text-red-500 flex items-center gap-1 justify-end">
                    <TrendingDown className="w-3 h-3" />
                    {suggestions.discountFromListing.aggressive}% below listing
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Market Context */}
        {(daysOnMarket !== undefined || priceReduced) && (
          <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
            <h4 className="text-sm font-semibold text-slate-700 mb-3">Negotiation Leverage</h4>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all ${
                      suggestions.leverageScore >= 70 ? 'bg-emerald-500' :
                      suggestions.leverageScore >= 50 ? 'bg-amber-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${suggestions.leverageScore}%` }}
                  />
                </div>
              </div>
              <span className={`text-sm font-medium ${
                suggestions.leverage === 'strong' ? 'text-emerald-600' :
                suggestions.leverage === 'moderate' ? 'text-amber-600' :
                suggestions.leverage === 'weak' ? 'text-red-600' : 'text-slate-600'
              }`}>
                {suggestions.leverage.charAt(0).toUpperCase() + suggestions.leverage.slice(1)}
              </span>
            </div>
            <div className="flex gap-4 mt-3 text-xs text-slate-500">
              {daysOnMarket !== undefined && (
                <span>📅 {daysOnMarket} days on market</span>
              )}
              {priceReduced && (
                <span>📉 Price reduced</span>
              )}
            </div>
          </div>
        )}

        {/* Disclaimer */}
        <p className="text-xs text-slate-400 text-center">
          These suggestions are based on projected revenue and standard expense assumptions. 
          Always conduct your own due diligence before making an offer.
        </p>
      </CardContent>
    </Card>
  );
}
