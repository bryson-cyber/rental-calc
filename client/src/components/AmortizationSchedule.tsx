/**
 * Amortization Schedule
 * 
 * Collapsible view showing key mortgage milestones.
 * Focus on equity buildup at 5/10/15/30 years, not 360 rows of data.
 * 
 * Uses Coach Inayah branding (gold/navy) with clear explainers.
 */
import { useState, useMemo } from 'react';
import { Calendar, ChevronDown, ChevronUp, TrendingUp, DollarSign, PiggyBank, HelpCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface AmortizationScheduleProps {
  purchasePrice: number;
  downPaymentPercent: number;
  interestRate: number;
  loanTermYears?: number;
  loanType?: 'conventional' | 'dscr' | 'fha' | 'cash';
}

interface MilestoneData {
  year: number;
  totalPaid: number;
  principalPaid: number;
  interestPaid: number;
  remainingBalance: number;
  equityBuilt: number;
  equityPercent: number;
}

export default function AmortizationSchedule({
  purchasePrice,
  downPaymentPercent,
  interestRate,
  loanTermYears = 30,
  loanType = 'conventional',
}: AmortizationScheduleProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const schedule = useMemo(() => {
    if (!purchasePrice || loanType === 'cash') return null;

    const downPayment = purchasePrice * (downPaymentPercent / 100);
    const loanAmount = purchasePrice - downPayment;
    const monthlyRate = interestRate / 100 / 12;
    const numPayments = loanTermYears * 12;

    // Calculate monthly payment
    const monthlyPayment = loanAmount * 
      (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / 
      (Math.pow(1 + monthlyRate, numPayments) - 1);

    // Calculate milestones at key years
    const milestones: MilestoneData[] = [];
    const keyYears = [1, 5, 10, 15, 20, 25, 30].filter(y => y <= loanTermYears);

    let balance = loanAmount;
    let totalPrincipal = 0;
    let totalInterest = 0;

    for (let month = 1; month <= numPayments; month++) {
      const interestPayment = balance * monthlyRate;
      const principalPayment = monthlyPayment - interestPayment;
      
      totalInterest += interestPayment;
      totalPrincipal += principalPayment;
      balance -= principalPayment;

      const year = Math.ceil(month / 12);
      
      if (month % 12 === 0 && keyYears.includes(year)) {
        const equityBuilt = downPayment + totalPrincipal;
        milestones.push({
          year,
          totalPaid: monthlyPayment * month,
          principalPaid: totalPrincipal,
          interestPaid: totalInterest,
          remainingBalance: Math.max(0, balance),
          equityBuilt,
          equityPercent: (equityBuilt / purchasePrice) * 100,
        });
      }
    }

    // Total over life of loan
    const totalPayments = monthlyPayment * numPayments;
    const totalInterestPaid = totalPayments - loanAmount;

    return {
      loanAmount,
      downPayment,
      monthlyPayment,
      totalPayments,
      totalInterestPaid,
      milestones,
    };
  }, [purchasePrice, downPaymentPercent, interestRate, loanTermYears, loanType]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  if (!schedule || loanType === 'cash') {
    return (
      <Card className="border-2 border-slate-200 bg-slate-50">
        <CardContent className="py-8 text-center">
          <PiggyBank className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">No mortgage for cash purchases</p>
          <p className="text-sm text-slate-400 mt-1">100% equity from day one!</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2 border-[#C9A962]/30 bg-gradient-to-br from-white to-[#C9A962]/5">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-[#0F172A]">
            <div className="p-2 rounded-lg bg-[#C9A962]/20">
              <Calendar className="w-5 h-5 text-[#C9A962]" />
            </div>
            <div>
              <span className="text-lg font-semibold">Amortization Schedule</span>
              <p className="text-sm font-normal text-slate-500 mt-0.5">
                See how your equity builds over time
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-[#C9A962] hover:text-[#C9A962] hover:bg-[#C9A962]/10"
          >
            {isExpanded ? (
              <>Less <ChevronUp className="w-4 h-4 ml-1" /></>
            ) : (
              <>More <ChevronDown className="w-4 h-4 ml-1" /></>
            )}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-lg p-4 border border-slate-200 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <DollarSign className="w-4 h-4 text-[#C9A962]" />
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Loan Amount</span>
            </div>
            <p className="text-lg font-bold text-[#0F172A]">{formatCurrency(schedule.loanAmount)}</p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-slate-200 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Calendar className="w-4 h-4 text-[#C9A962]" />
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Monthly</span>
            </div>
            <p className="text-lg font-bold text-[#0F172A]">{formatCurrency(schedule.monthlyPayment)}</p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-slate-200 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <TrendingUp className="w-4 h-4 text-red-500" />
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Total Interest</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <HelpCircle className="w-3 h-3 text-slate-400" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-sm">Total interest paid over the life of the loan</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <p className="text-lg font-bold text-red-600">{formatCurrency(schedule.totalInterestPaid)}</p>
          </div>
        </div>

        {/* Equity Milestones - Key Highlights */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <PiggyBank className="w-4 h-4 text-[#C9A962]" />
            Equity Milestones
          </h4>
          
          <div className="grid grid-cols-4 gap-2">
            {schedule.milestones.filter(m => [5, 10, 15, 30].includes(m.year)).map((milestone) => (
              <div 
                key={milestone.year}
                className={`rounded-lg p-3 text-center ${
                  milestone.year === 30 
                    ? 'bg-gradient-to-br from-[#0F172A] to-[#1e293b] border-2 border-[#C9A962]' 
                    : 'bg-white border border-slate-200'
                }`}
              >
                <p className={`text-xs font-medium mb-1 ${milestone.year === 30 ? 'text-white/70' : 'text-slate-500'}`}>
                  Year {milestone.year}
                </p>
                <p className={`text-lg font-bold ${milestone.year === 30 ? 'text-[#C9A962]' : 'text-[#0F172A]'}`}>
                  {milestone.equityPercent.toFixed(0)}%
                </p>
                <p className={`text-xs ${milestone.year === 30 ? 'text-white/60' : 'text-slate-400'}`}>
                  {formatCurrency(milestone.equityBuilt)}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Expanded Details */}
        {isExpanded && (
          <div className="space-y-4 pt-4 border-t border-slate-200">
            {/* Visual Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-slate-500">
                <span>Principal vs Interest Over Time</span>
                <span>30-Year Breakdown</span>
              </div>
              <div className="h-8 bg-slate-100 rounded-full overflow-hidden flex">
                <div 
                  className="bg-emerald-500 flex items-center justify-center text-xs text-white font-medium"
                  style={{ width: `${(schedule.loanAmount / schedule.totalPayments) * 100}%` }}
                >
                  Principal
                </div>
                <div 
                  className="bg-red-400 flex items-center justify-center text-xs text-white font-medium"
                  style={{ width: `${(schedule.totalInterestPaid / schedule.totalPayments) * 100}%` }}
                >
                  Interest
                </div>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-emerald-600">{formatCurrency(schedule.loanAmount)} ({((schedule.loanAmount / schedule.totalPayments) * 100).toFixed(0)}%)</span>
                <span className="text-red-500">{formatCurrency(schedule.totalInterestPaid)} ({((schedule.totalInterestPaid / schedule.totalPayments) * 100).toFixed(0)}%)</span>
              </div>
            </div>

            {/* Detailed Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-2 px-2 text-slate-500 font-medium">Year</th>
                    <th className="text-right py-2 px-2 text-slate-500 font-medium">Principal Paid</th>
                    <th className="text-right py-2 px-2 text-slate-500 font-medium">Interest Paid</th>
                    <th className="text-right py-2 px-2 text-slate-500 font-medium">Balance</th>
                    <th className="text-right py-2 px-2 text-slate-500 font-medium">Equity</th>
                  </tr>
                </thead>
                <tbody>
                  {schedule.milestones.map((milestone) => (
                    <tr key={milestone.year} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-2 px-2 font-medium text-[#0F172A]">Year {milestone.year}</td>
                      <td className="py-2 px-2 text-right text-emerald-600">{formatCurrency(milestone.principalPaid)}</td>
                      <td className="py-2 px-2 text-right text-red-500">{formatCurrency(milestone.interestPaid)}</td>
                      <td className="py-2 px-2 text-right text-slate-600">{formatCurrency(milestone.remainingBalance)}</td>
                      <td className="py-2 px-2 text-right">
                        <span className="inline-flex items-center gap-1 text-[#C9A962] font-medium">
                          {formatCurrency(milestone.equityBuilt)}
                          <span className="text-xs text-slate-400">({milestone.equityPercent.toFixed(0)}%)</span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Key Insight */}
            <div className="bg-[#C9A962]/10 rounded-lg p-4 border border-[#C9A962]/20">
              <p className="text-sm text-[#0F172A]/70">
                <strong className="text-[#C9A962]">Key Insight:</strong> In the first 5 years, 
                you'll pay {formatCurrency(schedule.milestones[0]?.interestPaid || 0)} in interest but only build 
                {' '}{formatCurrency(schedule.milestones[0]?.principalPaid || 0)} in equity. 
                Consider making extra principal payments to accelerate equity buildup.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
