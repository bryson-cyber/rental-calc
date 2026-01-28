/**
 * Shared Comparison Results Page
 * Displays Step 4 comparison results from a shared link
 */

import { useEffect, useState } from 'react';
import { useParams } from 'wouter';
import { 
  Trophy, 
  BedDouble, 
  Bath, 
  DollarSign, 
  TrendingUp,
  AlertCircle,
  Home,
  Shield
} from 'lucide-react';
import { TrustBanner } from '@/components/TrustBanner';

interface SharedResult {
  address: string;
  bedrooms: number;
  bathrooms: number;
  rent: number;
  revenue: number;
  profit: number;
  ratio: number;
  occupancy: number;
  adr: number;
}

interface SharedData {
  results: SharedResult[];
  createdAt: string;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

function getGrade(ratio: number): { grade: string; color: string } {
  if (ratio >= 3) return { grade: 'A+', color: 'bg-green-500' };
  if (ratio >= 2.5) return { grade: 'A', color: 'bg-green-500' };
  if (ratio >= 2) return { grade: 'B+', color: 'bg-blue-500' };
  if (ratio >= 1.75) return { grade: 'B', color: 'bg-blue-500' };
  if (ratio >= 1.5) return { grade: 'C+', color: 'bg-yellow-500' };
  if (ratio >= 1.25) return { grade: 'C', color: 'bg-yellow-500' };
  if (ratio >= 1) return { grade: 'D', color: 'bg-orange-500' };
  return { grade: 'F', color: 'bg-red-500' };
}

export default function SharedComparisonPage() {
  const params = useParams<{ data: string }>();
  const [sharedData, setSharedData] = useState<SharedData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      if (params.data) {
        const decoded = atob(params.data);
        const data = JSON.parse(decoded) as SharedData;
        // Sort by profit (highest first)
        data.results.sort((a, b) => b.profit - a.profit);
        setSharedData(data);
      }
    } catch (e) {
      setError('Invalid or expired share link');
    }
  }, [params.data]);

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Link Error</h1>
          <p className="text-slate-600 mb-6">{error}</p>
          <a 
            href="/"
            className="inline-flex items-center gap-2 bg-[#C9A962] text-white px-6 py-3 rounded-xl font-medium hover:bg-[#b89952] transition-colors"
          >
            <Home className="w-5 h-5" />
            Go to Calculator
          </a>
        </div>
      </div>
    );
  }

  if (!sharedData) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#C9A962]"></div>
      </div>
    );
  }

  const winner = sharedData.results[0];
  const winnerGrade = getGrade(winner.ratio);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white pb-20">
      {/* Header */}
      <header className="bg-[#0F172A] text-white py-6">
        <div className="container max-w-6xl mx-auto px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shield className="w-8 h-8 text-[#C9A962]" />
              <div>
                <h1 className="text-xl font-bold">Property Comparison Results</h1>
                <p className="text-slate-400 text-sm">
                  Shared on {new Date(sharedData.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
            <a 
              href="/"
              className="bg-[#C9A962] text-white px-4 py-2 rounded-lg font-medium hover:bg-[#b89952] transition-colors text-sm"
            >
              Try the Calculator
            </a>
          </div>
        </div>
      </header>

      <div className="container max-w-6xl mx-auto px-4 py-8">
        {/* Winner Hero */}
        <div className="mb-10">
          <div className="bg-gradient-to-br from-[#0F172A] via-[#1e293b] to-[#334155] rounded-2xl p-8 text-white shadow-xl shadow-slate-900/30 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
            
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                  <Trophy className="w-8 h-8 text-yellow-300" />
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl md:text-3xl font-bold">Best Deal Found</h2>
                  <p className="text-slate-300">Winner of {sharedData.results.length} properties compared</p>
                </div>
                <div className="flex flex-col items-center bg-white/20 backdrop-blur-sm rounded-xl px-4 py-2">
                  <span className="text-xs text-[#C9A962] uppercase tracking-wide">Grade</span>
                  <span className="text-3xl font-bold">{winnerGrade.grade}</span>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-xl font-semibold mb-2 truncate">{winner.address}</h3>
                  <div className="flex flex-wrap items-center gap-3 text-slate-300 text-sm mb-4">
                    <span className="flex items-center gap-1">
                      <BedDouble className="w-4 h-4" />
                      {winner.bedrooms} bed
                    </span>
                    <span className="flex items-center gap-1">
                      <Bath className="w-4 h-4" />
                      {winner.bathrooms} bath
                    </span>
                    <span className="flex items-center gap-1 bg-white/20 px-2 py-0.5 rounded-full">
                      <DollarSign className="w-4 h-4" />
                      {formatCurrency(winner.rent)}/mo rent
                    </span>
                  </div>
                  
                  <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                    <span className="text-[#C9A962] text-sm">Annual Profit Potential</span>
                    <p className="text-3xl font-bold mt-1">{formatCurrency(winner.profit * 12)}<span className="text-lg font-normal text-slate-300">/year</span></p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                    <span className="text-[#C9A962] text-xs uppercase tracking-wide">Monthly Profit</span>
                    <p className="text-2xl font-bold mt-1">{formatCurrency(winner.profit)}</p>
                  </div>
                  <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                    <span className="text-[#C9A962] text-xs uppercase tracking-wide">Profit Multiplier</span>
                    <p className="text-2xl font-bold mt-1">{winner.ratio.toFixed(1)}x</p>
                  </div>
                  <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                    <span className="text-[#C9A962] text-xs uppercase tracking-wide">Monthly Revenue</span>
                    <p className="text-2xl font-bold mt-1">{formatCurrency(winner.revenue)}</p>
                  </div>
                  <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                    <span className="text-[#C9A962] text-xs uppercase tracking-wide">Booking Rate</span>
                    <p className="text-2xl font-bold mt-1">{Math.round(winner.occupancy > 1 ? winner.occupancy : winner.occupancy * 100)}%</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* All Properties Comparison */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-200">
            <h3 className="text-xl font-bold text-slate-900">All Properties Compared</h3>
            <p className="text-slate-500 text-sm">Ranked by monthly profit potential</p>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Rank</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Property</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Grade</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Rent</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Revenue</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Profit</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Multiplier</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sharedData.results.map((result, index) => {
                  const grade = getGrade(result.ratio);
                  return (
                    <tr key={index} className={index === 0 ? 'bg-green-50' : 'hover:bg-slate-50'}>
                      <td className="py-4 px-4">
                        {index === 0 ? (
                          <span className="inline-flex items-center gap-1 bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs font-medium">
                            <Trophy className="w-3 h-3" />
                            Winner
                          </span>
                        ) : (
                          <span className="text-slate-500 font-medium">#{index + 1}</span>
                        )}
                      </td>
                      <td className="py-4 px-4">
                        <div className="font-medium text-slate-900 truncate max-w-[200px]">{result.address}</div>
                        <div className="text-sm text-slate-500">{result.bedrooms} bed • {result.bathrooms} bath</div>
                      </td>
                      <td className="py-4 px-4">
                        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-white text-sm font-bold ${grade.color}`}>
                          {grade.grade}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right text-slate-600">{formatCurrency(result.rent)}</td>
                      <td className="py-4 px-4 text-right text-slate-600">{formatCurrency(result.revenue)}</td>
                      <td className="py-4 px-4 text-right font-semibold text-green-600">{formatCurrency(result.profit)}</td>
                      <td className="py-4 px-4 text-right font-semibold text-slate-900">{result.ratio.toFixed(1)}x</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-10 text-center">
          <p className="text-slate-600 mb-4">Want to analyze your own properties?</p>
          <a 
            href="/"
            className="inline-flex items-center gap-2 bg-[#C9A962] text-white px-8 py-4 rounded-xl font-semibold hover:bg-[#b89952] transition-colors text-lg"
          >
            <TrendingUp className="w-5 h-5" />
            Try the Free Calculator
          </a>
        </div>
      </div>

      <TrustBanner />
    </div>
  );
}
