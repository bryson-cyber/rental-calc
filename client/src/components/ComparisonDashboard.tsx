/**
 * Comparison Dashboard Component
 * 
 * A dedicated side-by-side table view for comparing saved properties with
 * comprehensive investor metrics for both arbitrage and purchase modes.
 * Includes editable purchase assumptions for accurate cash flow analysis.
 */

import { useState, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
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
  Settings2,
  ChevronDown,
  ChevronUp,
  Pencil,
  Check,
  X,
  RotateCcw,
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
  imageUrl?: string | null;
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

// Global purchase assumptions that apply to all properties
export interface PurchaseAssumptions {
  downPaymentPercent: number;
  interestRate: number;
  loanTermYears: number;
  closingCostPercent: number;
  propertyTaxPercent: number;
  insurancePercent: number;
  managementPercent: number;
  maintenancePercent: number;
  startupCosts: number;
}

// Per-property overrides (only purchase price for now)
interface PropertyOverrides {
  [propertyId: number]: {
    purchasePrice?: number;
  };
}

const DEFAULT_ASSUMPTIONS: PurchaseAssumptions = {
  downPaymentPercent: 20,
  interestRate: 7,
  loanTermYears: 30,
  closingCostPercent: 3,
  propertyTaxPercent: 1.2,
  insurancePercent: 0.5,
  managementPercent: 20,
  maintenancePercent: 5,
  startupCosts: 5000,
};

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

// Calculate investor metrics for a property with editable assumptions
function calculateMetrics(
  property: ComparisonProperty, 
  mode: 'rent' | 'purchase',
  assumptions: PurchaseAssumptions,
  priceOverride?: number
) {
  const annualRevenue = property.annualRevenue || 0;
  const monthlyRevenue = annualRevenue / 12;
  const occupancy = parseFloat(String(property.occupancyRate || 0));
  const adr = property.averageDailyRate || 0;
  
  if (mode === 'rent') {
    const monthlyRent = property.monthlyRent || 0;
    const expenseRate = 0.20;
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
      cashFlow: null as number | null,
      cashOnCash: null as number | null,
      capRate: null as number | null,
      purchasePrice: null as number | null,
      monthlyMortgage: null as number | null,
      totalCashInvested: null as number | null,
      annualCashFlow: null as number | null,
      noi: null as number | null,
    };
  } else {
    // Use override price, then property price, then default
    const purchasePrice = priceOverride ?? property.purchasePrice ?? 200000;
    const { downPaymentPercent, interestRate, loanTermYears, closingCostPercent, propertyTaxPercent, insurancePercent, managementPercent, maintenancePercent, startupCosts } = assumptions;
    
    const downPayment = purchasePrice * (downPaymentPercent / 100);
    const loanAmount = purchasePrice - downPayment;
    
    // Monthly mortgage payment
    const monthlyRate = interestRate / 100 / 12;
    const numPayments = loanTermYears * 12;
    const monthlyMortgage = loanAmount > 0 && monthlyRate > 0
      ? (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1)
      : loanAmount > 0 ? loanAmount / numPayments : 0;
    
    // Operating expenses
    const annualPropertyTax = purchasePrice * (propertyTaxPercent / 100);
    const annualInsurance = purchasePrice * (insurancePercent / 100);
    const annualManagement = annualRevenue * (managementPercent / 100);
    const annualMaintenance = annualRevenue * (maintenancePercent / 100);
    const totalAnnualExpenses = annualPropertyTax + annualInsurance + annualManagement + annualMaintenance;
    
    // NOI
    const noi = annualRevenue - totalAnnualExpenses;
    
    // Cash flow
    const annualMortgage = monthlyMortgage * 12;
    const annualCashFlow = noi - annualMortgage;
    const monthlyCashFlow = annualCashFlow / 12;
    
    // Cash-on-Cash
    const closingCosts = purchasePrice * (closingCostPercent / 100);
    const totalCashInvested = downPayment + closingCosts + startupCosts;
    const cashOnCash = totalCashInvested > 0 ? (annualCashFlow / totalCashInvested) * 100 : 0;
    
    // Cap Rate
    const capRate = purchasePrice > 0 ? (noi / purchasePrice) * 100 : 0;
    
    return {
      monthlyRevenue,
      monthlyRent: null as number | null,
      monthlyProfit: null as number | null,
      annualProfit: null as number | null,
      profitRatio: null as number | null,
      occupancy: occupancy * 100,
      adr,
      cashFlow: monthlyCashFlow,
      annualCashFlow,
      cashOnCash,
      capRate,
      purchasePrice,
      monthlyMortgage,
      totalCashInvested,
      noi,
    };
  }
}

// Get grade based on profit ratio (arbitrage) or cash-on-cash (purchase)
function getGrade(value: number, mode: 'rent' | 'purchase'): { grade: string; color: string; bgColor: string } {
  if (mode === 'rent') {
    if (value >= 3) return { grade: 'A+', color: 'text-emerald-600', bgColor: 'bg-emerald-50' };
    if (value >= 2.5) return { grade: 'A', color: 'text-emerald-600', bgColor: 'bg-emerald-50' };
    if (value >= 2) return { grade: 'B+', color: 'text-blue-600', bgColor: 'bg-blue-50' };
    if (value >= 1.75) return { grade: 'B', color: 'text-blue-600', bgColor: 'bg-blue-50' };
    if (value >= 1.5) return { grade: 'C+', color: 'text-amber-600', bgColor: 'bg-amber-50' };
    if (value >= 1.25) return { grade: 'C', color: 'text-amber-600', bgColor: 'bg-amber-50' };
    if (value >= 1) return { grade: 'D', color: 'text-slate-600', bgColor: 'bg-slate-50' };
    return { grade: 'F', color: 'text-red-600', bgColor: 'bg-red-50' };
  } else {
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

// Assumptions Panel Component
function AssumptionsPanel({ 
  assumptions, 
  onChange, 
  onReset,
  isOpen,
  onToggle,
}: { 
  assumptions: PurchaseAssumptions; 
  onChange: (key: keyof PurchaseAssumptions, value: number) => void;
  onReset: () => void;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const isDefault = JSON.stringify(assumptions) === JSON.stringify(DEFAULT_ASSUMPTIONS);

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
      {/* Toggle Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
            <Settings2 className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-slate-800">Purchase Assumptions</p>
            <p className="text-xs text-slate-500">
              {assumptions.downPaymentPercent}% down • {assumptions.interestRate}% rate • {assumptions.loanTermYears}yr
              {!isDefault && <span className="text-blue-600 ml-1">(customized)</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isDefault && (
            <span
              onClick={(e) => { e.stopPropagation(); onReset(); }}
              className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" /> Reset
            </span>
          )}
          {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
      </button>

      {/* Expandable Content */}
      {isOpen && (
        <div className="px-4 pb-4 border-t border-slate-100">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4 pt-4">
            {/* Financing Section */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Financing</p>
              
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-slate-600">Down Payment</Label>
                  <span className="text-xs font-semibold text-slate-800">{assumptions.downPaymentPercent}%</span>
                </div>
                <Slider
                  value={[assumptions.downPaymentPercent]}
                  onValueChange={([v]) => onChange('downPaymentPercent', v)}
                  min={0}
                  max={100}
                  step={5}
                  className="w-full"
                />
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>0%</span><span>50%</span><span>100%</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-slate-600">Interest Rate</Label>
                  <span className="text-xs font-semibold text-slate-800">{assumptions.interestRate}%</span>
                </div>
                <Slider
                  value={[assumptions.interestRate]}
                  onValueChange={([v]) => onChange('interestRate', v)}
                  min={0}
                  max={15}
                  step={0.25}
                  className="w-full"
                />
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>0%</span><span>7.5%</span><span>15%</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-slate-600">Loan Term</Label>
                  <span className="text-xs font-semibold text-slate-800">{assumptions.loanTermYears} years</span>
                </div>
                <div className="flex gap-1.5">
                  {[15, 20, 25, 30].map(term => (
                    <button
                      key={term}
                      onClick={() => onChange('loanTermYears', term)}
                      className={`flex-1 py-1.5 text-xs rounded-md border transition-colors ${
                        assumptions.loanTermYears === term 
                          ? 'bg-blue-50 border-blue-200 text-blue-700 font-semibold' 
                          : 'border-slate-200 text-slate-500 hover:border-slate-300'
                      }`}
                    >
                      {term}yr
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Costs Section */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Costs</p>
              
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-slate-600">Closing Costs</Label>
                  <span className="text-xs font-semibold text-slate-800">{assumptions.closingCostPercent}%</span>
                </div>
                <Slider
                  value={[assumptions.closingCostPercent]}
                  onValueChange={([v]) => onChange('closingCostPercent', v)}
                  min={0}
                  max={10}
                  step={0.5}
                  className="w-full"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-slate-600">Property Tax</Label>
                  <span className="text-xs font-semibold text-slate-800">{assumptions.propertyTaxPercent}%</span>
                </div>
                <Slider
                  value={[assumptions.propertyTaxPercent]}
                  onValueChange={([v]) => onChange('propertyTaxPercent', v)}
                  min={0}
                  max={5}
                  step={0.1}
                  className="w-full"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-slate-600">Insurance</Label>
                  <span className="text-xs font-semibold text-slate-800">{assumptions.insurancePercent}%</span>
                </div>
                <Slider
                  value={[assumptions.insurancePercent]}
                  onValueChange={([v]) => onChange('insurancePercent', v)}
                  min={0}
                  max={3}
                  step={0.1}
                  className="w-full"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-slate-600">Startup / Furnishing</Label>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-slate-400">$</span>
                    <Input
                      type="number"
                      value={assumptions.startupCosts}
                      onChange={(e) => onChange('startupCosts', Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-20 h-6 text-xs text-right px-1.5"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Operations Section */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Operations</p>
              
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Label className="text-xs text-slate-600 cursor-help flex items-center gap-1">
                          Management Fee <Info className="w-3 h-3 opacity-50" />
                        </Label>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs">% of revenue paid to property manager</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <span className="text-xs font-semibold text-slate-800">{assumptions.managementPercent}%</span>
                </div>
                <Slider
                  value={[assumptions.managementPercent]}
                  onValueChange={([v]) => onChange('managementPercent', v)}
                  min={0}
                  max={40}
                  step={1}
                  className="w-full"
                />
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>Self-managed</span><span>Full service</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Label className="text-xs text-slate-600 cursor-help flex items-center gap-1">
                          Maintenance <Info className="w-3 h-3 opacity-50" />
                        </Label>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs">% of revenue for repairs & upkeep</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <span className="text-xs font-semibold text-slate-800">{assumptions.maintenancePercent}%</span>
                </div>
                <Slider
                  value={[assumptions.maintenancePercent]}
                  onValueChange={([v]) => onChange('maintenancePercent', v)}
                  min={0}
                  max={20}
                  step={1}
                  className="w-full"
                />
              </div>

              {/* Quick Summary */}
              <div className="mt-3 p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Your Settings</p>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                  <span className="text-slate-500">Down payment:</span>
                  <span className="text-slate-700 font-medium text-right">{assumptions.downPaymentPercent}%</span>
                  <span className="text-slate-500">Rate:</span>
                  <span className="text-slate-700 font-medium text-right">{assumptions.interestRate}% / {assumptions.loanTermYears}yr</span>
                  <span className="text-slate-500">Expenses:</span>
                  <span className="text-slate-700 font-medium text-right">{assumptions.managementPercent + assumptions.maintenancePercent}% of rev</span>
                  <span className="text-slate-500">Closing:</span>
                  <span className="text-slate-700 font-medium text-right">{assumptions.closingCostPercent}% + {formatCurrency(assumptions.startupCosts)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Inline Price Editor Component
function InlinePriceEditor({ 
  currentPrice, 
  onSave, 
  onCancel 
}: { 
  currentPrice: number; 
  onSave: (price: number) => void; 
  onCancel: () => void;
}) {
  const [value, setValue] = useState(String(currentPrice));
  
  const handleSave = () => {
    const parsed = parseInt(value.replace(/[^0-9]/g, ''));
    if (parsed > 0) onSave(parsed);
    else onCancel();
  };

  return (
    <div className="flex items-center gap-1">
      <span className="text-xs text-slate-400">$</span>
      <Input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value.replace(/[^0-9]/g, ''))}
        onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') onCancel(); }}
        className="w-24 h-7 text-xs text-right px-1.5"
        autoFocus
      />
      <button onClick={handleSave} className="p-1 rounded hover:bg-emerald-50 text-emerald-600">
        <Check className="w-3.5 h-3.5" />
      </button>
      <button onClick={onCancel} className="p-1 rounded hover:bg-red-50 text-red-500">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export function ComparisonDashboard({ properties, onRemove, mode }: ComparisonDashboardProps) {
  const [sortField, setSortField] = useState<SortField>(mode === 'rent' ? 'monthlyProfit' : 'cashOnCash');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [assumptions, setAssumptions] = useState<PurchaseAssumptions>(DEFAULT_ASSUMPTIONS);
  const [assumptionsOpen, setAssumptionsOpen] = useState(false);
  const [propertyOverrides, setPropertyOverrides] = useState<PropertyOverrides>({});
  const [editingPriceId, setEditingPriceId] = useState<number | null>(null);

  const handleAssumptionChange = useCallback((key: keyof PurchaseAssumptions, value: number) => {
    setAssumptions(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleResetAssumptions = useCallback(() => {
    setAssumptions(DEFAULT_ASSUMPTIONS);
  }, []);

  const handlePriceOverride = useCallback((propertyId: number, price: number) => {
    setPropertyOverrides(prev => ({
      ...prev,
      [propertyId]: { ...prev[propertyId], purchasePrice: price },
    }));
    setEditingPriceId(null);
  }, []);

  // Calculate metrics for all properties with current assumptions
  const propertiesWithMetrics = useMemo(() => {
    return properties.map(property => ({
      ...property,
      metrics: calculateMetrics(
        property, 
        mode, 
        assumptions,
        propertyOverrides[property.id]?.purchasePrice
      ),
    }));
  }, [properties, mode, assumptions, propertyOverrides]);

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
    <div className="space-y-4">
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

      {/* Purchase Assumptions Panel (only in purchase mode) */}
      {mode === 'purchase' && (
        <AssumptionsPanel
          assumptions={assumptions}
          onChange={handleAssumptionChange}
          onReset={handleResetAssumptions}
          isOpen={assumptionsOpen}
          onToggle={() => setAssumptionsOpen(prev => !prev)}
        />
      )}

      {/* Winner Banner */}
      {bestProperty && (() => {
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
                    {mode === 'purchase' 
                      ? 'Try adjusting your purchase assumptions (lower down payment, better rate) or explore different markets.'
                      : 'None of your saved properties are projected to be profitable. Consider adjusting rent expectations or exploring different markets.'}
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
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button 
                              className="flex items-center justify-end text-xs font-semibold uppercase tracking-wider hover:text-amber-600 w-full"
                              onClick={() => handleSort('purchasePrice')}
                            >
                              Price <Pencil className="w-3 h-3 ml-1 opacity-40" /> <SortIcon field="purchasePrice" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs">Click a price to edit it for what-if analysis</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
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
                const hasOverride = propertyOverrides[property.id]?.purchasePrice !== undefined;

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
                          {property.purchasePrice && property.purchasePrice > 0 && mode === 'rent' && (
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-600 border border-blue-100">
                                For Sale
                              </span>
                              <span className="text-[11px] text-blue-600 font-medium">
                                {formatCurrency(property.purchasePrice)}
                              </span>
                            </div>
                          )}
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
                        <TableCell className="text-right">
                          {editingPriceId === property.id ? (
                            <InlinePriceEditor
                              currentPrice={metrics.purchasePrice || 200000}
                              onSave={(price) => handlePriceOverride(property.id, price)}
                              onCancel={() => setEditingPriceId(null)}
                            />
                          ) : (
                            <div 
                              className="group cursor-pointer"
                              onClick={() => setEditingPriceId(property.id)}
                            >
                              <div className="flex items-center justify-end gap-1">
                                <span className={`text-slate-600 ${hasOverride ? 'font-semibold text-blue-600' : ''}`}>
                                  {formatCurrency(metrics.purchasePrice || 0)}
                                </span>
                                <Pencil className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                              </div>
                              {hasOverride && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setPropertyOverrides(prev => {
                                      const next = { ...prev };
                                      delete next[property.id];
                                      return next;
                                    });
                                  }}
                                  className="text-[10px] text-blue-500 hover:text-blue-700"
                                >
                                  reset to original
                                </button>
                              )}
                            </div>
                          )}
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
                <p className="text-xs text-slate-500">NOI - Mortgage ({assumptions.downPaymentPercent}% down, {assumptions.interestRate}%)</p>
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
