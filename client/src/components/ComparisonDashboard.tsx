/**
 * Comparison Dashboard Component
 * 
 * A dedicated side-by-side table view for comparing saved properties with
 * comprehensive investor metrics for both arbitrage and purchase modes.
 */

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Trophy,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Trash2,
  ExternalLink,
  Info,
  TrendingUp,
  DollarSign,
  Percent,
  Home,
  Building,
} from 'lucide-react';

interface ComparisonProperty {
  id: number;
  address: string;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  bedrooms: number;
  bathrooms: string | number;
  annualRevenue: number;
  occupancyRate: string | number;
  averageDailyRate: number;
  monthlyRent: number | null;
  zillowUrl: string | null;
  imageUrl?: string | null; // Property thumbnail image URL
  // Purchase mode fields (may be null for arbitrage properties)
  purchasePrice?: number | null;
  loanType?: string | null;
  downPaymentPercent?: number | null;
  interestRate?: number | null;
}

interface ComparisonDashboardProps {
  properties: ComparisonProperty[];
  onRemove: (id: number) => void;
  mode: 'rent' | 'purchase';
}

type SortField = 
  | 'address' 
  | 'annualRevenue' 
  | 'monthlyProfit' 
  | 'profitRatio' 
  | 'cashFlow' 
  | 'cashOnCash' 
  | 'capRate'
  | 'purchasePrice';

type SortDirection = 'asc' | 'desc';

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const formatPercent = (value: number): string => {
  return `${value.toFixed(1)}%`;
};

// Calculate investor metrics for a property
function calculateMetrics(property: ComparisonProperty, mode: 'rent' | 'purchase') {
  const annualRevenue = property.annualRevenue || 0;
  const monthlyRevenue = annualRevenue / 12;
  const occupancy = parseFloat(String(property.occupancyRate || 0));
  const adr = property.averageDailyRate || 0;
  
  if (mode === 'rent') {
    // Arbitrage mode calculations
    const monthlyRent = property.monthlyRent || 0;
    const expenseRate = 0.20; // 20% for expenses
    // If no rent data (For Sale property in arbitrage mode), profit is meaningless
    const hasRentData = monthlyRent > 0;
    const monthlyProfit = hasRentData ? monthlyRevenue * (1 - expenseRate) - monthlyRent : 0;
    const annualProfit = monthlyProfit * 12;
    const profitRatio = hasRentData ? monthlyRevenue / monthlyRent : 0;
    
    return {
      monthlyRevenue,
      monthlyRent,
      monthlyProfit,
      annualProfit,
      profitRatio,
      occupancy: occupancy * 100,
      adr,
      // Purchase metrics not applicable
      cashFlow: null,
      cashOnCash: null,
      capRate: null,
      purchasePrice: null,
    };
  } else {
    // Purchase mode calculations
    const purchasePrice = property.purchasePrice || 200000;
    const downPaymentPercent = property.downPaymentPercent || 20;
    const interestRate = property.interestRate || 7;
    
    const downPayment = purchasePrice * (downPaymentPercent / 100);
    const loanAmount = purchasePrice - downPayment;
    
    // Monthly mortgage payment (30-year fixed)
    const monthlyRate = interestRate / 100 / 12;
    const numPayments = 30 * 12;
    const monthlyMortgage = loanAmount > 0 
      ? (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1)
      : 0;
    
    // Operating expenses (property tax, insurance, management, maintenance)
    const annualPropertyTax = purchasePrice * 0.012; // 1.2% property tax
    const annualInsurance = purchasePrice * 0.005; // 0.5% insurance
    const annualManagement = annualRevenue * 0.20; // 20% management
    const annualMaintenance = annualRevenue * 0.05; // 5% maintenance
    const totalAnnualExpenses = annualPropertyTax + annualInsurance + annualManagement + annualMaintenance;
    
    // Net Operating Income (NOI)
    const noi = annualRevenue - totalAnnualExpenses;
    
    // Annual cash flow (NOI - mortgage payments)
    const annualMortgage = monthlyMortgage * 12;
    const annualCashFlow = noi - annualMortgage;
    const monthlyCashFlow = annualCashFlow / 12;
    
    // Cash-on-Cash Return
    const closingCosts = purchasePrice * 0.03; // 3% closing costs
    const startupCosts = 5000; // Furnishing estimate
    const totalCashInvested = downPayment + closingCosts + startupCosts;
    const cashOnCash = totalCashInvested > 0 ? (annualCashFlow / totalCashInvested) * 100 : 0;
    
    // Cap Rate
    const capRate = purchasePrice > 0 ? (noi / purchasePrice) * 100 : 0;
    
    return {
      monthlyRevenue,
      monthlyRent: null,
      monthlyProfit: null,
      annualProfit: null,
      profitRatio: null,
      occupancy: occupancy * 100,
      adr,
      // Purchase metrics
      cashFlow: monthlyCashFlow,
      annualCashFlow,
      cashOnCash,
      capRate,
      purchasePrice,
      monthlyMortgage,
      totalCashInvested,
    };
  }
}

// Get grade based on profit ratio (arbitrage) or cash-on-cash (purchase)
function getGrade(value: number, mode: 'rent' | 'purchase'): { grade: string; color: string; bgColor: string } {
  if (mode === 'rent') {
    // Profit ratio grading
    if (value >= 3) return { grade: 'A+', color: 'text-emerald-600', bgColor: 'bg-emerald-50' };
    if (value >= 2.5) return { grade: 'A', color: 'text-emerald-600', bgColor: 'bg-emerald-50' };
    if (value >= 2) return { grade: 'B+', color: 'text-blue-600', bgColor: 'bg-blue-50' };
    if (value >= 1.75) return { grade: 'B', color: 'text-blue-600', bgColor: 'bg-blue-50' };
    if (value >= 1.5) return { grade: 'C+', color: 'text-amber-600', bgColor: 'bg-amber-50' };
    if (value >= 1.25) return { grade: 'C', color: 'text-amber-600', bgColor: 'bg-amber-50' };
    if (value >= 1) return { grade: 'D', color: 'text-slate-600', bgColor: 'bg-slate-50' };
    return { grade: 'F', color: 'text-red-600', bgColor: 'bg-red-50' };
  } else {
    // Cash-on-cash grading
    if (value >= 20) return { grade: 'A+', color: 'text-emerald-600', bgColor: 'bg-emerald-50' };
    if (value >= 15) return { grade: 'A', color: 'text-emerald-600', bgColor: 'bg-emerald-50' };
    if (value >= 12) return { grade: 'B+', color: 'text-blue-600', bgColor: 'bg-blue-50' };
    if (value >= 10) return { grade: 'B', color: 'text-blue-600', bgColor: 'bg-blue-50' };
    if (value >= 8) return { grade: 'C+', color: 'text-amber-600', bgColor: 'bg-amber-50' };
    if (value >= 5) return { grade: 'C', color: 'text-amber-600', bgColor: 'bg-amber-50' };
    if (value >= 0) return { grade: 'D', color: 'text-slate-600', bgColor: 'bg-slate-50' };
    return { grade: 'F', color: 'text-red-600', bgColor: 'bg-red-50' };
  }
}

export function ComparisonDashboard({ properties, onRemove, mode }: ComparisonDashboardProps) {
  const [sortField, setSortField] = useState<SortField>(mode === 'rent' ? 'monthlyProfit' : 'cashOnCash');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Calculate metrics for all properties
  const propertiesWithMetrics = useMemo(() => {
    return properties.map(property => ({
      ...property,
      metrics: calculateMetrics(property, mode),
    }));
  }, [properties, mode]);

  // Sort properties
  const sortedProperties = useMemo(() => {
    return [...propertiesWithMetrics].sort((a, b) => {
      let aValue: number = 0;
      let bValue: number = 0;

      switch (sortField) {
        case 'address':
          return sortDirection === 'asc' 
            ? a.address.localeCompare(b.address)
            : b.address.localeCompare(a.address);
        case 'annualRevenue':
          aValue = a.annualRevenue || 0;
          bValue = b.annualRevenue || 0;
          break;
        case 'monthlyProfit':
          aValue = a.metrics.monthlyProfit || 0;
          bValue = b.metrics.monthlyProfit || 0;
          break;
        case 'profitRatio':
          aValue = a.metrics.profitRatio || 0;
          bValue = b.metrics.profitRatio || 0;
          break;
        case 'cashFlow':
          aValue = a.metrics.cashFlow || 0;
          bValue = b.metrics.cashFlow || 0;
          break;
        case 'cashOnCash':
          aValue = a.metrics.cashOnCash || 0;
          bValue = b.metrics.cashOnCash || 0;
          break;
        case 'capRate':
          aValue = a.metrics.capRate || 0;
          bValue = b.metrics.capRate || 0;
          break;
        case 'purchasePrice':
          aValue = a.metrics.purchasePrice || 0;
          bValue = b.metrics.purchasePrice || 0;
          break;
      }

      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
    });
  }, [propertiesWithMetrics, sortField, sortDirection]);

  // Toggle sort
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Get sort icon
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3.5 h-3.5 ml-1 opacity-50" />;
    return sortDirection === 'asc' 
      ? <ArrowUp className="w-3.5 h-3.5 ml-1" />
      : <ArrowDown className="w-3.5 h-3.5 ml-1" />;
  };

  // Find the best property
  const bestProperty = sortedProperties[0];

  if (properties.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500">
        <p>No properties to compare. Save properties from the Find a Property tab first.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center">
            <Trophy className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Property Comparison</h3>
            <p className="text-sm text-slate-500">
              {properties.length} properties • {mode === 'rent' ? 'Arbitrage Mode' : 'Purchase Mode'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500">Sort by:</span>
          <Select 
            value={sortField} 
            onValueChange={(value) => {
              setSortField(value as SortField);
              setSortDirection('desc');
            }}
          >
            <SelectTrigger className="w-[180px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="annualRevenue">Annual Revenue</SelectItem>
              {mode === 'rent' ? (
                <>
                  <SelectItem value="monthlyProfit">Monthly Profit</SelectItem>
                  <SelectItem value="profitRatio">Profit Ratio</SelectItem>
                </>
              ) : (
                <>
                  <SelectItem value="cashFlow">Cash Flow</SelectItem>
                  <SelectItem value="cashOnCash">Cash-on-Cash</SelectItem>
                  <SelectItem value="capRate">Cap Rate</SelectItem>
                  <SelectItem value="purchasePrice">Purchase Price</SelectItem>
                </>
              )}
              <SelectItem value="address">Address</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Winner Banner */}
      {bestProperty && (() => {
        // In arbitrage mode, find the best property that actually has rent data
        const bestDeal = mode === 'rent' 
          ? sortedProperties.find(p => (p.metrics.monthlyRent || 0) > 0) || bestProperty
          : bestProperty;
        const bestProfit = mode === 'rent' ? (bestDeal.metrics.monthlyProfit || 0) : (bestDeal.metrics.cashFlow || 0);
        const hasPositiveProfit = bestProfit > 0;
        const hasRevenue = (bestDeal.annualRevenue || 0) > 0;
        const hasRentData = mode === 'rent' ? (bestDeal.metrics.monthlyRent || 0) > 0 : true;
        
        if (!hasRevenue) {
          return (
            <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center">
                  <Info className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-amber-800">Revenue Data Missing</p>
                  <p className="text-sm text-amber-700">
                    Some properties don't have revenue data yet. Try validating them in Step 5 first to get accurate comparisons.
                  </p>
                </div>
              </div>
            </div>
          );
        }
        
        if (!hasRentData && mode === 'rent') {
          return (
            <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center">
                  <Info className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-amber-800">No Arbitrage Properties Found</p>
                  <p className="text-sm text-amber-700">
                    None of your saved properties have monthly rent data. Save rental properties from Step 2 to compare arbitrage deals.
                  </p>
                </div>
              </div>
            </div>
          );
        }
        
        if (!hasPositiveProfit) {
          return (
            <div className="p-4 bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center">
                  <Info className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-red-800">No Profitable Properties Found</p>
                  <p className="text-sm text-red-700">
                    None of your saved properties are projected to be profitable. Consider adjusting rent expectations or exploring different markets.
                  </p>
                </div>
              </div>
            </div>
          );
        }
        
        return (
          <div className="p-4 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center">
                <Trophy className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-emerald-800">Best Deal: {bestDeal.address}</p>
                <p className="text-sm text-emerald-700">
                  {mode === 'rent' 
                    ? `${formatCurrency(bestDeal.metrics.monthlyProfit || 0)}/month profit \u2022 ${(bestDeal.metrics.profitRatio || 0).toFixed(1)}x revenue ratio`
                    : `${formatCurrency(bestDeal.metrics.cashFlow || 0)}/month cash flow \u2022 ${formatPercent(bestDeal.metrics.cashOnCash || 0)} CoC return`
                  }
                </p>
              </div>
              {bestDeal.zillowUrl && (
                <a 
                  href={bestDeal.zillowUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-sm text-emerald-600 hover:text-emerald-800"
                >
                  View Listing <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          </div>
        );
      })()}

      {/* Comparison Table */}
      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="w-[50px] text-center">#</TableHead>
                <TableHead className="min-w-[200px]">
                  <button 
                    className="flex items-center text-xs font-semibold uppercase tracking-wider hover:text-amber-600"
                    onClick={() => handleSort('address')}
                  >
                    Property <SortIcon field="address" />
                  </button>
                </TableHead>
                <TableHead className="text-right">
                  <button 
                    className="flex items-center justify-end text-xs font-semibold uppercase tracking-wider hover:text-amber-600 w-full"
                    onClick={() => handleSort('annualRevenue')}
                  >
                    Annual Revenue <SortIcon field="annualRevenue" />
                  </button>
                </TableHead>
                {mode === 'rent' ? (
                  <>
                    <TableHead className="text-right">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="flex items-center justify-end text-xs font-semibold uppercase tracking-wider cursor-help">
                              Monthly Rent <Info className="w-3 h-3 ml-1 opacity-50" />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs">Your monthly rent payment to the landlord</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableHead>
                    <TableHead className="text-right">
                      <button 
                        className="flex items-center justify-end text-xs font-semibold uppercase tracking-wider hover:text-amber-600 w-full"
                        onClick={() => handleSort('monthlyProfit')}
                      >
                        Monthly Profit <SortIcon field="monthlyProfit" />
                      </button>
                    </TableHead>
                    <TableHead className="text-right">
                      <button 
                        className="flex items-center justify-end text-xs font-semibold uppercase tracking-wider hover:text-amber-600 w-full"
                        onClick={() => handleSort('profitRatio')}
                      >
                        Ratio <SortIcon field="profitRatio" />
                      </button>
                    </TableHead>
                  </>
                ) : (
                  <>
                    <TableHead className="text-right">
                      <button 
                        className="flex items-center justify-end text-xs font-semibold uppercase tracking-wider hover:text-amber-600 w-full"
                        onClick={() => handleSort('purchasePrice')}
                      >
                        Price <SortIcon field="purchasePrice" />
                      </button>
                    </TableHead>
                    <TableHead className="text-right">
                      <button 
                        className="flex items-center justify-end text-xs font-semibold uppercase tracking-wider hover:text-amber-600 w-full"
                        onClick={() => handleSort('cashFlow')}
                      >
                        Cash Flow <SortIcon field="cashFlow" />
                      </button>
                    </TableHead>
                    <TableHead className="text-right">
                      <button 
                        className="flex items-center justify-end text-xs font-semibold uppercase tracking-wider hover:text-amber-600 w-full"
                        onClick={() => handleSort('cashOnCash')}
                      >
                        CoC Return <SortIcon field="cashOnCash" />
                      </button>
                    </TableHead>
                    <TableHead className="text-right">
                      <button 
                        className="flex items-center justify-end text-xs font-semibold uppercase tracking-wider hover:text-amber-600 w-full"
                        onClick={() => handleSort('capRate')}
                      >
                        Cap Rate <SortIcon field="capRate" />
                      </button>
                    </TableHead>
                  </>
                )}
                <TableHead className="text-center">Grade</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedProperties.map((property, index) => {
                const metrics = property.metrics;
                const hasRentData = mode === 'rent' ? (metrics.monthlyRent || 0) > 0 : true;
                const gradeValue = mode === 'rent' 
                  ? (metrics.profitRatio || 0) 
                  : (metrics.cashOnCash || 0);
                const grade = hasRentData ? getGrade(gradeValue, mode) : { grade: 'N/A', color: 'text-slate-400', bgColor: 'bg-slate-50' };
                const isWinner = index === 0 && hasRentData && (mode === 'rent' ? (metrics.monthlyProfit || 0) > 0 : (metrics.cashFlow || 0) > 0);

                return (
                  <TableRow 
                    key={property.id} 
                    className={isWinner ? 'bg-emerald-50/50' : 'hover:bg-slate-50'}
                  >
                    <TableCell className="text-center">
                      <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
                        isWinner 
                          ? 'bg-gradient-to-br from-amber-500 to-amber-600 text-white' 
                          : 'bg-slate-100 text-slate-500'
                      }`}>
                        {index + 1}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-start gap-3">
                        {/* Property Thumbnail */}
                        <div className="w-14 h-14 rounded-lg bg-slate-100 flex-shrink-0 overflow-hidden">
                          {property.imageUrl ? (
                            <img 
                              src={property.imageUrl} 
                              alt={property.address}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                // Fallback to icon if image fails to load
                                (e.target as HTMLImageElement).style.display = 'none';
                                (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                              }}
                            />
                          ) : null}
                          <div className={`w-full h-full flex items-center justify-center ${property.imageUrl ? 'hidden' : ''}`}>
                            {mode === 'rent' ? (
                              <Home className="w-6 h-6 text-slate-400" />
                            ) : (
                              <Building className="w-6 h-6 text-slate-400" />
                            )}
                          </div>
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900 text-sm truncate max-w-[180px]">
                            {property.address}
                          </p>
                          <p className="text-xs text-slate-500">
                            {property.city}, {property.state} • {property.bedrooms} bed, {property.bathrooms} bath
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div>
                        <p className="font-semibold text-slate-900">{formatCurrency(property.annualRevenue || 0)}</p>
                        <p className="text-xs text-slate-500">{formatCurrency(metrics.monthlyRevenue)}/mo</p>
                      </div>
                    </TableCell>
                    {mode === 'rent' ? (
                      <>
                        <TableCell className="text-right text-slate-600">
                          {metrics.monthlyRent ? formatCurrency(metrics.monthlyRent) + '/mo' : '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          {metrics.monthlyRent ? (
                            <span className={`font-bold ${(metrics.monthlyProfit || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                              {formatCurrency(metrics.monthlyProfit || 0)}/mo
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">N/A</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {metrics.monthlyRent ? (
                            <span className="font-medium text-slate-700">
                              {(metrics.profitRatio || 0).toFixed(1)}x
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">N/A</span>
                          )}
                        </TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell className="text-right text-slate-600">
                          {formatCurrency(metrics.purchasePrice || 0)}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={`font-bold ${(metrics.cashFlow || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {formatCurrency(metrics.cashFlow || 0)}/mo
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={`font-medium ${(metrics.cashOnCash || 0) >= 10 ? 'text-emerald-600' : 'text-slate-700'}`}>
                            {formatPercent(metrics.cashOnCash || 0)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="font-medium text-slate-700">
                            {formatPercent(metrics.capRate || 0)}
                          </span>
                        </TableCell>
                      </>
                    )}
                    <TableCell className="text-center">
                      <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-bold ${grade.bgColor} ${grade.color}`}>
                        {grade.grade}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {property.zillowUrl && (
                          <a 
                            href={property.zillowUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-blue-600 transition-colors"
                            title="View on Zillow"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                        <button
                          onClick={() => onRemove(property.id)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                          title="Remove from comparison"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Metrics Legend */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-xl">
        {mode === 'rent' ? (
          <>
            <div className="flex items-start gap-2">
              <DollarSign className="w-4 h-4 text-amber-600 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-slate-700">Monthly Profit</p>
                <p className="text-xs text-slate-500">Revenue (80%) - Rent</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <TrendingUp className="w-4 h-4 text-amber-600 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-slate-700">Profit Ratio</p>
                <p className="text-xs text-slate-500">Revenue ÷ Rent (2x+ is good)</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Percent className="w-4 h-4 text-amber-600 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-slate-700">Occupancy</p>
                <p className="text-xs text-slate-500">% of nights booked</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-amber-600 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-slate-700">Grade</p>
                <p className="text-xs text-slate-500">A+ (3x+) to F (&lt;1x)</p>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-start gap-2">
              <DollarSign className="w-4 h-4 text-amber-600 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-slate-700">Cash Flow</p>
                <p className="text-xs text-slate-500">NOI - Mortgage</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <TrendingUp className="w-4 h-4 text-amber-600 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-slate-700">Cash-on-Cash</p>
                <p className="text-xs text-slate-500">Cash flow ÷ Cash invested</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Percent className="w-4 h-4 text-amber-600 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-slate-700">Cap Rate</p>
                <p className="text-xs text-slate-500">NOI ÷ Purchase price</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-amber-600 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-slate-700">Grade</p>
                <p className="text-xs text-slate-500">A+ (20%+) to F (&lt;0%)</p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
